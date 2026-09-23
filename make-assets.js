const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

/* ---------- PNG encoder ---------- */
function crc32(buf) {
  let t = crc32.t;
  if (!t) {
    t = crc32.t = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const typ = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typ, data])));
  return Buffer.concat([len, typ, data, crc]);
}

function encodePNG(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    const ro = y * (w * 4 + 1);
    raw[ro] = 0;
    rgba.copy(raw, ro + 1, y * w * 4, (y + 1) * w * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

/* ---------- drawing helpers ---------- */
function create(w, h, bg) {
  const buf = Buffer.alloc(w * h * 4);
  const px = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const i = (y * w + x) * 4;
    if (a >= 255) { buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = 255; return; }
    const al = a / 255;
    buf[i]   = buf[i]   * (1 - al) + r * al;
    buf[i+1] = buf[i+1] * (1 - al) + g * al;
    buf[i+2] = buf[i+2] * (1 - al) + b * al;
    buf[i+3] = Math.max(buf[i+3], a);
  };
  const rect = (x, y, rw, rh, r, g, b, a = 255) => {
    for (let yy = y; yy < y + rh; yy++)
      for (let xx = x; xx < x + rw; xx++) px(xx, yy, r, g, b, a);
  };
  const rrect = (x, y, rw, rh, rad, r, g, b, a = 255) => {
    for (let yy = y; yy < y + rh; yy++)
      for (let xx = x; xx < x + rw; xx++) {
        const dx = Math.max(x + rad - xx, xx - (x + rw - rad - 1), 0);
        const dy = Math.max(y + rad - yy, yy - (y + rh - rad - 1), 0);
        if (dx * dx + dy * dy <= rad * rad) px(xx, yy, r, g, b, a);
      }
  };
  const line = (x0, y0, x1, y1, r, g, b, a = 255) => {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    while (true) {
      px(x0, y0, r, g, b, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx)  { err += dx; y0 += sy; }
    }
  };
  const circle = (cx, cy, rad, r, g, b, a = 255) => {
    for (let y = -rad; y <= rad; y++)
      for (let x = -rad; x <= rad; x++)
        if (x * x + y * y <= rad * rad) px(cx + x, cy + y, r, g, b, a);
  };
  const ellipse = (cx, cy, rx, ry, r, g, b, a = 255) => {
    for (let y = -ry; y <= ry; y++)
      for (let x = -rx; x <= rx; x++)
        if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) px(cx + x, cy + y, r, g, b, a);
  };
  rect(0, 0, w, h, bg[0], bg[1], bg[2]);
  return { buf, w, h, px, rect, rrect, line, circle, ellipse };
}

function noise(d, amount = 10) {
  for (let i = 0; i < d.buf.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d.buf[i] = Math.min(255, Math.max(0, d.buf[i] + n));
    d.buf[i+1] = Math.min(255, Math.max(0, d.buf[i+1] + n));
    d.buf[i+2] = Math.min(255, Math.max(0, d.buf[i+2] + n));
  }
}

function save(d, file) {
  fs.writeFileSync(file, encodePNG(d.w, d.h, d.buf));
  console.log('created', file, fs.statSync(file).size, 'bytes');
}

const root = path.join(__dirname, 'assets');
const proj = path.join(root, 'projects');
fs.mkdirSync(proj, { recursive: true });

/* ============ PROFILE (portrait placeholder 1000x1250) ============ */
(function profile() {
  const d = create(1000, 1250, [16, 16, 16]);
  // vignette
  for (let y = 0; y < 1250; y++)
    for (let x = 0; x < 1000; x++) {
      const dx = (x - 500) / 500, dy = (y - 625) / 625;
      const v = Math.max(0, 1 - (dx * dx + dy * dy) * 0.55);
      const i = (y * 1000 + x) * 4;
      d.buf[i] *= 0.55 + v * 0.45;
      d.buf[i+1] *= 0.55 + v * 0.45;
      d.buf[i+2] *= 0.55 + v * 0.45;
    }
  // soft studio light
  for (let y = 0; y < 1250; y++)
    for (let x = 0; x < 1000; x++) {
      const dist = Math.hypot(x - 620, y - 320);
      const g = Math.max(0, 1 - dist / 520) * 38;
      const i = (y * 1000 + x) * 4;
      d.buf[i] = Math.min(255, d.buf[i] + g);
      d.buf[i+1] = Math.min(255, d.buf[i+1] + g);
      d.buf[i+2] = Math.min(255, d.buf[i+2] + g);
    }
  // silhouette — shoulders
  d.ellipse(500, 1180, 340, 260, 8, 8, 8);
  // torso / neck
  d.rrect(420, 720, 160, 240, 60, 10, 10, 10);
  // head
  d.ellipse(500, 560, 175, 220, 14, 14, 14);
  // hair mass
  d.ellipse(500, 450, 185, 130, 6, 6, 6);
  d.rrect(315, 450, 370, 90, 40, 6, 6, 6);
  // rim light left
  for (let t = -200; t < 240; t++) {
    const x = 500 - 175 + Math.round(Math.sin((t + 200) / 440 * Math.PI) * 0);
    d.px(325 + Math.round(Math.sin(t / 90) * 3), 560 + t, 120, 120, 120, 140);
  }
  // shoulder rim
  for (let a = 0; a < 180; a++) {
    const rad = a * Math.PI / 180;
    d.px(Math.round(500 - 340 * Math.cos(rad)), Math.round(1180 - 260 * Math.sin(rad)), 90, 90, 90, 100);
  }
  // film frame marks
  d.rect(40, 40, 60, 2, 180, 180, 180);
  d.rect(40, 40, 2, 60, 180, 180, 180);
  d.rect(900, 40, 60, 2, 180, 180, 180);
  d.rect(958, 40, 2, 60, 180, 180, 180);
  d.rect(40, 1208, 60, 2, 180, 180, 180);
  d.rect(40, 1190, 2, 60, 180, 180, 180);
  d.rect(900, 1208, 60, 2, 180, 180, 180);
  d.rect(958, 1190, 2, 60, 180, 180, 180);
  // side label bars (editorial)
  d.rect(60, 580, 3, 90, 200, 200, 200);
  d.rect(937, 580, 3, 90, 200, 200, 200);
  noise(d, 14);
  save(d, path.join(root, 'profile.jpg'));
})();

/* ============ SEATSHARE (1600x1000) ============ */
(function seatshare() {
  const d = create(1600, 1000, [12, 12, 12]);
  // top bar
  d.rect(0, 0, 1600, 64, 16, 16, 16);
  d.line(0, 64, 1600, 64, 50, 50, 50);
  d.circle(30, 32, 7, 70, 70, 70);
  d.circle(54, 32, 7, 70, 70, 70);
  d.circle(78, 32, 7, 70, 70, 70);
  d.rrect(120, 18, 260, 28, 8, 24, 24, 24);
  d.rrect(1360, 18, 60, 28, 8, 230, 230, 230);
  // sidebar
  d.rect(0, 64, 240, 936, 14, 14, 14);
  d.line(240, 64, 240, 1000, 45, 45, 45);
  for (let i = 0; i < 7; i++) {
    const y = 110 + i * 60;
    if (i === 1) d.rrect(20, y - 14, 200, 40, 8, 32, 32, 32);
    d.rrect(40, y, 16, 16, 3, i === 1 ? 235 : 70, i === 1 ? 235 : 70, i === 1 ? 235 : 70);
    d.rrect(70, y + 3, i === 1 ? 110 : 90, 10, 4, i === 1 ? 220 : 55, i === 1 ? 220 : 55, i === 1 ? 220 : 55);
  }
  // main header
  d.rrect(280, 100, 420, 34, 6, 235, 235, 235);
  d.rrect(280, 150, 260, 14, 5, 70, 70, 70);
  // filter chips
  const chips = ['TODAY', 'BLOCK A', 'FLOOR 2', 'AVAILABLE'];
  let cx = 280;
  chips.forEach((c, i) => {
    const w = 120 + i * 14;
    d.rrect(cx, 196, w, 36, 18, i === 3 ? 230 : 24, i === 3 ? 230 : 24, i === 3 ? 230 : 24);
    if (i !== 3) { d.line(cx, 196, cx + w, 196, 60, 60, 60); d.line(cx, 232, cx + w, 232, 60, 60, 60); }
    cx += w + 14;
  });
  // stats row
  for (let i = 0; i < 4; i++) {
    const x = 280 + i * 320;
    d.rrect(x, 260, 290, 100, 10, 18, 18, 18);
    d.line(x, 260, x + 290, 260, 50, 50, 50);
    d.rrect(x + 20, 284, 90, 40, 4, i === 0 ? 240 : 160, i === 0 ? 240 : 160, i === 0 ? 240 : 160);
    d.rrect(x + 20, 336, 140, 10, 4, 55, 55, 55);
  }
  // seat map panel
  d.rrect(280, 390, 1000, 570, 12, 15, 15, 15);
  d.line(280, 390, 1280, 390, 55, 55, 55);
  d.rrect(310, 420, 200, 16, 4, 200, 200, 200);
  // stage
  d.rrect(560, 460, 440, 46, 8, 30, 30, 30);
  d.line(560, 460, 1000, 460, 70, 70, 70);
  // seats grid
  const cols = 14, rows = 9;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = 330 + c * 64;
      const y = 540 + r * 44;
      const n = (r * 17 + c * 7) % 10;
      if (n < 3) d.rrect(x, y, 44, 30, 6, 235, 235, 235);
      else if (n < 5) d.rrect(x, y, 44, 30, 6, 90, 90, 90);
      else d.rrect(x, y, 44, 30, 6, 28, 28, 28);
      if (n >= 5) d.line(x, y, x + 44, y, 55, 55, 55);
    }
  }
  // legend
  const leg = [[235, 'FREE'], [90, 'HELD'], [28, 'TAKEN']];
  leg.forEach(([v, _], i) => {
    const x = 330 + i * 160;
    d.rrect(x, 930, 22, 16, 4, v, v, v);
    d.rrect(x + 32, 934, 70, 8, 3, 60, 60, 60);
  });
  // right panel
  d.rrect(1310, 100, 260, 860, 12, 15, 15, 15);
  d.line(1310, 100, 1310, 960, 50, 50, 50);
  d.rrect(1340, 130, 140, 18, 4, 210, 210, 210);
  for (let i = 0; i < 8; i++) {
    const y = 180 + i * 90;
    d.rrect(1340, y, 200, 70, 8, 20, 20, 20);
    d.rrect(1356, y + 14, 80, 12, 3, 170, 170, 170);
    d.rrect(1356, y + 38, 150, 8, 3, 55, 55, 55);
    d.rrect(1356, y + 52, 100, 8, 3, 45, 45, 45);
  }
  noise(d, 6);
  save(d, path.join(proj, 'seatshare.png'));
})();

/* ============ VANI-SETRA (1600x1000) ============ */
(function vani() {
  const d = create(1600, 1000, [11, 11, 11]);
  // header
  d.rect(0, 0, 1600, 70, 15, 15, 15);
  d.line(0, 70, 1600, 70, 48, 48, 48);
  d.circle(34, 35, 9, 230, 230, 230);
  d.circle(34, 35, 4, 11, 11, 11);
  d.rrect(70, 22, 220, 26, 6, 220, 220, 220);
  d.rrect(1340, 18, 100, 34, 17, 30, 30, 30);
  d.line(1340, 18, 1440, 18, 70, 70, 70);
  d.line(1340, 52, 1440, 52, 70, 70, 70);
  d.rrect(1470, 18, 90, 34, 17, 235, 235, 235);

  // waveform panel
  d.rrect(60, 110, 1000, 420, 14, 14, 14, 14);
  d.line(60, 110, 1060, 110, 52, 52, 52);
  d.rrect(90, 140, 180, 14, 4, 190, 190, 190);
  d.rrect(90, 168, 120, 10, 4, 55, 55, 55);
  // waveform bars
  const mid = 340;
  for (let i = 0; i < 110; i++) {
    const x = 100 + i * 8.5;
    const t = i / 110;
    const amp = (Math.sin(t * 40) * 0.5 + Math.sin(t * 13) * 0.5 + Math.sin(t * 71) * 0.3);
    const hgt = Math.max(6, Math.abs(amp) * 150 + 10);
    const v = t > 0.35 && t < 0.72 ? 235 : 95;
    d.rrect(x, mid - hgt / 2, 5, hgt, 2, v, v, v);
  }
  // playhead
  d.line(600, 200, 600, 480, 255, 255, 255);
  d.circle(600, 200, 6, 255, 255, 255);

  // analysis panel right
  d.rrect(1090, 110, 450, 420, 14, 14, 14, 14);
  d.line(1090, 110, 1540, 110, 52, 52, 52);
  d.rrect(1120, 140, 160, 14, 4, 190, 190, 190);
  // gauge
  d.circle(1315, 300, 100, 24, 24, 24);
  d.circle(1315, 300, 88, 14, 14, 14);
  for (let a = -220; a < 40; a++) {
    const rad = a * Math.PI / 180;
    const on = a < -30;
    for (let rr = 78; rr < 96; rr++) {
      const x = 1315 + Math.cos(rad) * rr;
      const y = 300 + Math.sin(rad) * rr;
      const v = on ? 240 : 55;
      d.px(Math.round(x), Math.round(y), v, v, v);
    }
  }
  d.rrect(1265, 285, 100, 30, 4, 240, 240, 240);
  d.rrect(1245, 420, 140, 12, 4, 60, 60, 60);
  d.rrect(1200, 450, 230, 10, 4, 45, 45, 45);

  // bottom metrics
  const cards = [
    ['CONFIDENCE', '98.4%'],
    ['CLASS', 'HUMAN'],
    ['SAMPLE', '4.2s'],
    ['MODEL', 'AUDIO-ML']
  ];
  cards.forEach(([_, __], i) => {});
  cards.forEach((c, i) => {
    const x = 60 + i * 380;
    d.rrect(x, 560, 350, 160, 12, 15, 15, 15);
    d.line(x, 560, x + 350, 560, 50, 50, 50);
    d.rrect(x + 24, 590, 130, 12, 4, 70, 70, 70);
    d.rrect(x + 24, 630, 180, 44, 5, 230, 230, 230);
    d.rrect(x + 24, 690, 120, 10, 4, 50, 50, 50);
  });

  // spectrogram strip
  d.rrect(60, 750, 1480, 200, 12, 14, 14, 14);
  d.line(60, 750, 1540, 750, 50, 50, 50);
  d.rrect(90, 778, 150, 12, 4, 170, 170, 170);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 90; x++) {
      const v = Math.floor(30 + Math.abs(Math.sin(x * 0.4 + y) * Math.cos(x * 0.13 - y * 0.7)) * 170);
      d.rrect(100 + x * 15, 810 + y * 11, 13, 9, 2, v, v, v);
    }
  }
  noise(d, 7);
  save(d, path.join(proj, 'vani-setra.png'));
})();

/* ============ CODIXIFYY (1600x1000) ============ */
(function codix() {
  const d = create(1600, 1000, [12, 12, 12]);
  // top bar
  d.rect(0, 0, 1600, 60, 16, 16, 16);
  d.line(0, 60, 1600, 60, 48, 48, 48);
  d.circle(28, 30, 7, 70, 70, 70);
  d.circle(50, 30, 7, 70, 70, 70);
  d.circle(72, 30, 7, 70, 70, 70);
  d.rrect(110, 16, 300, 28, 8, 24, 24, 24);
  d.rrect(1380, 14, 90, 32, 16, 235, 235, 235);

  // lesson sidebar
  d.rect(0, 60, 300, 940, 14, 14, 14);
  d.line(300, 60, 300, 1000, 45, 45, 45);
  d.rrect(24, 90, 160, 16, 4, 200, 200, 200);
  for (let i = 0; i < 9; i++) {
    const y = 140 + i * 70;
    const active = i === 2;
    if (active) d.rrect(14, y - 12, 272, 54, 8, 30, 30, 30);
    if (active) d.rect(14, y - 12, 4, 54, 235, 235, 235);
    d.circle(44, y + 12, 10, active ? 235 : 60, active ? 235 : 60, active ? 235 : 60);
    d.rrect(66, y + 4, active ? 150 : 130, 10, 4, active ? 220 : 55, active ? 220 : 55, active ? 220 : 55);
    d.rrect(66, y + 22, 90, 8, 4, 45, 45, 45);
  }
  // progress bottom
  d.rrect(24, 900, 250, 8, 4, 40, 40, 40);
  d.rrect(24, 900, 150, 8, 4, 230, 230, 230);
  d.rrect(24, 924, 100, 8, 4, 55, 55, 55);

  // tabs
  const tabs = ['index.php', 'learn.js', 'style.css'];
  let tx = 330;
  tabs.forEach((t, i) => {
    const w = 170;
    d.rrect(tx, 84, w, 40, 6, i === 0 ? 24 : 16, i === 0 ? 24 : 16, i === 0 ? 24 : 16);
    if (i === 0) d.rect(tx, 84, w, 2, 235, 235, 235);
    d.rrect(tx + 16, 98, 90, 10, 3, i === 0 ? 190 : 70, i === 0 ? 190 : 70, i === 0 ? 190 : 70);
    tx += w + 8;
  });

  // editor area
  d.rect(320, 140, 760, 660, 11, 11, 11);
  // line numbers
  for (let i = 0; i < 22; i++) {
    d.rrect(340, 168 + i * 28, 24, 10, 3, 48, 48, 48);
    const indent = (i * 37) % 5;
    const widths = [200, 320, 150, 260, 180, 340, 120, 290];
    const w = widths[i % widths.length];
    const bright = i % 4 === 0;
    d.rrect(390 + indent * 18, 168 + i * 28, w, 10, 3,
      bright ? 210 : 95, bright ? 210 : 95, bright ? 210 : 95);
    if (i % 5 === 2) d.rrect(390 + indent * 18 + w + 16, 168 + i * 28, 70, 10, 3, 60, 60, 60);
  }
  // caret
  d.rect(390 + 72, 168 + 6 * 28 - 4, 2, 20, 240, 240, 240);

  // console bottom
  d.rect(320, 800, 760, 200, 13, 13, 13);
  d.line(320, 800, 1080, 800, 50, 50, 50);
  d.rrect(344, 824, 110, 12, 4, 180, 180, 180);
  for (let i = 0; i < 5; i++) {
    const w = 200 + ((i * 97) % 400);
    d.rrect(344, 860 + i * 26, w, 9, 3, i === 0 ? 200 : 70, i === 0 ? 200 : 70, i === 0 ? 200 : 70);
  }

  // right panel — preview / output
  d.rrect(1110, 84, 460, 890, 12, 15, 15, 15);
  d.line(1110, 84, 1110, 974, 50, 50, 50);
  d.rrect(1140, 114, 180, 14, 4, 200, 200, 200);
  // preview hero
  d.rrect(1140, 150, 400, 180, 10, 22, 22, 22);
  d.rrect(1164, 180, 220, 22, 4, 230, 230, 230);
  d.rrect(1164, 216, 300, 12, 4, 80, 80, 80);
  d.rrect(1164, 240, 260, 12, 4, 65, 65, 65);
  d.rrect(1164, 280, 120, 32, 16, 235, 235, 235);
  // output blocks
  for (let i = 0; i < 4; i++) {
    const y = 360 + i * 100;
    d.rrect(1140, y, 400, 80, 10, 20, 20, 20);
    d.line(1140, y, 1540, y, 48, 48, 48);
    d.rrect(1160, y + 18, 140, 12, 4, 180, 180, 180);
    d.rrect(1160, y + 42, 300, 10, 4, 55, 55, 55);
    d.rrect(1160, y + 58, 220, 10, 4, 45, 45, 45);
  }
  // run button
  d.rrect(1140, 780, 180, 48, 24, 235, 235, 235);
  d.rrect(1340, 780, 140, 48, 24, 24, 24, 24);
  d.line(1340, 780, 1480, 780, 70, 70, 70);
  d.line(1340, 828, 1480, 828, 70, 70, 70);
  // stats
  d.rrect(1140, 860, 400, 90, 10, 18, 18, 18);
  d.rrect(1164, 884, 90, 30, 4, 220, 220, 220);
  d.rrect(1300, 884, 90, 30, 4, 120, 120, 120);
  d.rrect(1164, 924, 200, 10, 4, 55, 55, 55);

  noise(d, 6);
  save(d, path.join(proj, 'codixifyy.png'));
})();

console.log('done');
