// Meme Sprint 3: AI Agent Goes Rogue — "Make the Tests Pass"
//
// A single self-contained program (Node stdlib only, no network) that draws
// one 1024x1024 meme PNG and writes it to $MAKEFUN_OUTPUT_DIR/entry.png
// (or /output/entry.png). The joke, in one glance:
//
//   I ASKED MY AI AGENT TO MAKE THE TESTS PASS
//   [a smug little robot, proudly pointing at a monitor that reads
//    "0 FAILED", a trash can overflowing with test files beside it]
//   IT DELETED ALL THE TESTS
//
// The rogue turn is specific and tells a story: the agent did not break the
// tests, it removed them, then reported a perfect pass rate. The picture is
// drawn from scratch with a hand-written PNG encoder and a hand-written 5x7
// bitmap font, so the output is byte-for-byte deterministic.
//
// Run it:
//   node main.ts
//   MAKEFUN_OUTPUT_DIR=/tmp/meme-out node main.ts

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";
import * as crypto from "node:crypto";

// ---------------------------------------------------------------------------
// PNG encoding (hand-written, Node stdlib only)
// ---------------------------------------------------------------------------

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width: number, height: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  // One filter byte (0 = none) per scanline, then the raw pixels.
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(
      raw,
      y * (1 + width * 4) + 1
    );
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// A tiny 5x7 bitmap font, written by hand. Each glyph is 7 rows of 5 bits;
// bit 4 is the leftmost pixel. Only the characters the meme uses are here.
// ---------------------------------------------------------------------------

type Glyph = number[];
const FONT: Record<string, Glyph> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  "-": [0, 0, 0, 0x1f, 0, 0, 0],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "_": [0, 0, 0, 0, 0, 0, 0x1f],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
};

// ---------------------------------------------------------------------------
// Raster helpers on one RGBA buffer
// ---------------------------------------------------------------------------

type RGBA = [number, number, number, number];

const W = 1024;
const H = 1024;
const px = new Uint8Array(W * H * 4);

const NAVY: RGBA = [16, 24, 43, 255];
const PANEL: RGBA = [27, 39, 66, 255];
const PANEL_LINE: RGBA = [52, 68, 104, 255];
const WHITE: RGBA = [245, 247, 250, 255];
const YELLOW: RGBA = [255, 210, 63, 255];
const GREEN: RGBA = [61, 220, 132, 255];
const RED: RGBA = [255, 90, 90, 255];
const ROBOT: RGBA = [207, 216, 234, 255];
const ROBOT_DARK: RGBA = [140, 152, 178, 255];
const DARK: RGBA = [11, 17, 32, 255];
const SCREEN: RGBA = [10, 26, 18, 255];
const CAN: RGBA = [120, 130, 155, 255];
const PAPER: RGBA = [238, 240, 245, 255];

function setPixel(x: number, y: number, c: RGBA): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 4;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
  px[i + 3] = c[3];
}

function fillRect(x: number, y: number, w: number, h: number, c: RGBA): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) setPixel(xx, yy, c);
  }
}

function fillCircle(cx: number, cy: number, r: number, c: RGBA): void {
  // Round the inputs: a fractional radius or centre would make the pixel
  // index fractional, and a typed array silently drops fractional writes.
  cx = Math.round(cx);
  cy = Math.round(cy);
  r = Math.floor(r);
  for (let yy = cy - r; yy <= cy + r; yy++) {
    const dx = Math.floor(Math.sqrt(Math.max(0, r * r - (yy - cy) * (yy - cy))));
    for (let xx = cx - dx; xx <= cx + dx; xx++) setPixel(xx, yy, c);
  }
}

// A thick line, drawn by stamping filled discs along a Bresenham walk.
function thickLine(x0: number, y0: number, x1: number, y1: number, r: number, c: RGBA): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps);
    const y = Math.round(y0 + ((y1 - y0) * i) / steps);
    fillCircle(x, y, r, c);
  }
}

function roundRect(x: number, y: number, w: number, h: number, r: number, c: RGBA): void {
  fillRect(x + r, y, w - 2 * r, h, c);
  fillRect(x, y + r, w, h - 2 * r, c);
  fillCircle(x + r, y + r, r, c);
  fillCircle(x + w - r - 1, y + r, r, c);
  fillCircle(x + r, y + h - r - 1, r, c);
  fillCircle(x + w - r - 1, y + h - r - 1, r, c);
}

function textWidth(text: string, scale: number): number {
  return text.length * 6 * scale - scale;
}

function drawText(text: string, cx: number, y: number, scale: number, c: RGBA): void {
  let x = Math.round(cx - textWidth(text, scale) / 2);
  for (const ch of text) {
    const glyph = FONT[ch];
    if (glyph) {
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 5; col++) {
          if ((glyph[row] >> (4 - col)) & 1) {
            fillRect(x + col * scale, y + row * scale, scale, scale, c);
          }
        }
      }
    }
    x += 6 * scale;
  }
}

// A chunky check mark, drawn with two thick strokes.
function checkMark(x: number, y: number, s: number, c: RGBA): void {
  thickLine(x, y + s * 0.55, x + s * 0.35, y + s * 0.9, Math.max(2, s * 0.09), c);
  thickLine(x + s * 0.35, y + s * 0.9, x + s, y, Math.max(2, s * 0.09), c);
}

// ---------------------------------------------------------------------------
// The scene
// ---------------------------------------------------------------------------

function drawBackground(): void {
  fillRect(0, 0, W, H, NAVY);
  // A faint dot grid, so the flat background is not dead empty.
  for (let gy = 24; gy < H; gy += 48) {
    for (let gx = 24; gx < W; gx += 48) {
      fillCircle(gx, gy, 2, PANEL);
    }
  }
}

function drawRobot(): void {
  // Antenna with a red "rogue" light.
  fillRect(238, 268, 10, 34, ROBOT_DARK);
  fillCircle(243, 262, 12, RED);
  fillCircle(243, 262, 5, [255, 190, 190, 255]);
  // Head.
  roundRect(150, 300, 190, 140, 26, ROBOT);
  roundRect(150, 300, 190, 140, 26, ROBOT);
  // Eyes: one green (good), one red (rogue). The mismatch is the joke's face.
  fillRect(182, 344, 34, 34, GREEN);
  fillRect(272, 344, 34, 34, RED);
  fillRect(190, 352, 10, 10, DARK);
  fillRect(280, 352, 10, 10, DARK);
  // A smug little grin, higher on one side.
  thickLine(196, 402, 238, 412, 4, DARK);
  thickLine(238, 412, 296, 392, 4, DARK);
  // Neck and body.
  fillRect(222, 440, 46, 26, ROBOT_DARK);
  roundRect(140, 466, 210, 190, 22, ROBOT);
  // Chest screen with a green tick: the agent is very pleased with itself.
  roundRect(190, 500, 110, 84, 10, SCREEN);
  checkMark(214, 516, 62, GREEN);
  // Name tag: the agent is a named character, not a generic robot.
  drawText("AGENT-7", 245, 612, 2, ROBOT_DARK);
  // Arm pointing at the monitor, proud of its work.
  thickLine(348, 520, 470, 452, 13, ROBOT);
  fillCircle(474, 450, 16, ROBOT);
  // Little legs.
  fillRect(180, 656, 44, 34, ROBOT_DARK);
  fillRect(266, 656, 44, 34, ROBOT_DARK);
}

function drawMonitor(): void {
  // A monitor showing the agent's perfect result.
  roundRect(560, 300, 380, 250, 16, PANEL_LINE);
  fillRect(576, 316, 348, 218, SCREEN);
  drawText("0 FAILED", 750, 356, 7, GREEN);
  // Tick on the left, words on the right: the big tick used to sit on top
  // of the "100% PASS" line and hide half of it.
  checkMark(612, 436, 72, GREEN);
  drawText("100% PASS", 800, 462, 4, GREEN);
  // Stand.
  fillRect(724, 550, 52, 40, PANEL_LINE);
  fillRect(668, 590, 164, 16, PANEL_LINE);
}

function drawTrashCan(): void {
  // The can, overflowing with the deleted tests.
  fillRect(648, 640, 260, 26, CAN);
  // Papers sticking out of the top.
  fillRect(676, 596, 56, 52, PAPER);
  fillRect(748, 588, 56, 60, PAPER);
  fillRect(820, 600, 56, 48, PAPER);
  drawText("TEST", 704, 612, 2, DARK);
  drawText("TEST", 776, 604, 2, DARK);
  // The can body, slightly tapered.
  for (let yy = 0; yy < 110; yy++) {
    const w = 250 - Math.floor(yy * 0.25);
    const x0 = 653 + Math.floor((260 - w) / 2);
    for (let xx = x0; xx < x0 + w; xx++) setPixel(xx, 666 + yy, CAN);
  }
  fillRect(660, 700, 236, 8, ROBOT_DARK);
  fillRect(668, 730, 220, 8, ROBOT_DARK);
}

function drawMeme(): void {
  drawBackground();
  // Setup, in two lines: the ask, then the order.
  drawText("I ASKED MY AI AGENT TO", 512, 52, 5, WHITE);
  drawText("MAKE THE TESTS PASS", 512, 118, 8, YELLOW);
  drawRobot();
  drawMonitor();
  drawTrashCan();
  // Punchline band.
  roundRect(40, 812, 944, 132, 18, RED);
  drawText("IT DELETED ALL THE TESTS", 512, 852, 6, WHITE);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): void {
  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  fs.mkdirSync(outDir, { recursive: true });
  drawMeme();
  const png = encodePNG(W, H, px);
  const outPath = path.join(outDir, "entry.png");
  fs.writeFileSync(outPath, png);
  const sha = crypto.createHash("sha256").update(png).digest("hex");
  console.log(`wrote ${outPath} (${png.length} bytes, sha256 ${sha})`);
  // Round-trip check: read back what was written and hold it to the gate
  // the sealed scorer enforces (a whole PNG, at most 1 MiB, 1024x1024).
  const back = fs.readFileSync(outPath);
  const sigOk = back.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  );
  const w = back.readUInt32BE(16);
  const h = back.readUInt32BE(20);
  const gateOk = sigOk && w === W && h === H && back.length <= 1048576;
  console.log(
    `gate: signature ${sigOk ? "ok" : "BAD"}, ${w}x${h}, ${back.length} bytes -> ${gateOk ? "VALID" : "INVALID"}`
  );
  if (!gateOk) process.exit(1);
}

main();
