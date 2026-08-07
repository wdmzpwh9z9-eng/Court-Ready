/**
 * make-icons.mjs — generates the extension icons with zero dependencies.
 * Draws the Aura mark (a rounded square with a diagonal violet→cyan→mint
 * gradient and a soft inner glow) at 16/32/48/128 px and writes PNGs.
 *
 * Run: node tools/make-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, "../extension/assets/icons");
mkdirSync(OUT_DIR, { recursive: true });

// ---- minimal PNG encoder (RGBA) -------------------------------------------
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}
function encodePng(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // rest zero (compression, filter, interlace)
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---- drawing ---------------------------------------------------------------
function lerp(a, b, t) { return a + (b - a) * t; }
function mix(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }

// gradient stops (violet -> blue -> mint)
const STOPS = [
  [0.0, [124, 92, 255]],
  [0.5, [56, 189, 248]],
  [1.0, [52, 211, 153]],
];
function gradient(t) {
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i][0]) {
      const [p0, c0] = STOPS[i - 1];
      const [p1, c1] = STOPS[i];
      return mix(c0, c1, (t - p0) / (p1 - p0));
    }
  }
  return STOPS[STOPS.length - 1][1];
}

function drawIcon(size) {
  const buf = Buffer.alloc(size * size * 4);
  const r = size * 0.24; // corner radius
  const cx = size / 2, cy = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // rounded-rect coverage
      const dx = Math.max(r - x, x - (size - r), 0);
      const dy = Math.max(r - y, y - (size - r), 0);
      const dist = Math.sqrt(dx * dx + dy * dy);
      let alpha = r === 0 ? 1 : Math.max(0, Math.min(1, r - dist + 0.5));
      // margin so the tile floats
      const m = size * 0.06;
      if (x < m || y < m || x > size - m || y > size - m) alpha = 0;

      const t = (x + y) / (2 * size); // diagonal position
      let [rr, gg, bb] = gradient(t);

      // soft inner glow toward center
      const g = 1 - Math.min(1, Math.hypot(x - cx, y - cy) / (size * 0.7));
      rr = lerp(rr, 255, g * 0.18);
      gg = lerp(gg, 255, g * 0.18);
      bb = lerp(bb, 255, g * 0.18);

      // a subtle "spark" dot (the Aura mark) off-center
      const sd = Math.hypot(x - size * 0.62, y - size * 0.4);
      if (sd < size * 0.08) {
        const s = 1 - sd / (size * 0.08);
        rr = lerp(rr, 255, s); gg = lerp(gg, 255, s); bb = lerp(bb, 255, s);
      }

      const i = (y * size + x) * 4;
      buf[i] = Math.round(rr);
      buf[i + 1] = Math.round(gg);
      buf[i + 2] = Math.round(bb);
      buf[i + 3] = Math.round(alpha * 255);
    }
  }
  return encodePng(size, size, buf);
}

for (const size of [16, 32, 48, 128]) {
  const png = drawIcon(size);
  writeFileSync(resolve(OUT_DIR, `icon${size}.png`), png);
  console.log(`icon${size}.png (${png.length} bytes)`);
}
