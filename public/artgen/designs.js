/* สูตรวาดภาพประกอบทุกใบของ CAMELOT: ARCANE REALM — ภาพความละเอียดสูง (256px) สร้างจากโค้ดล้วน
   ภาพผลลัพธ์ถูกบันทึกถาวรที่ public/art/ ด้วย scripts/build-art.js */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./raster'));
  else root.ArtDesigns = factory(root.ArtRaster);
}(typeof self !== 'undefined' ? self : this, function (R) {
  'use strict';

  const { Canvas, hash, rng, rgb, mix, shade, clamp01, smooth, makeNoise, spline, bezier, transform, linear, radial, lit, textured } = R;
  const VERSION = 4;

  // ขนาดภาพจริง (พิกเซล) และตัวคูณ supersampling ตอนวาด
  const SPECS = {
    cards: { w: 256, h: 208, k: 3 },
    heroes: { w: 256, h: 256, k: 3 },
    back: { w: 240, h: 336, k: 2 },
    felt: { w: 800, h: 500, k: 1 },
    table: { w: 512, h: 512, k: 2 },
  };

  const PI = Math.PI;
  const TAU = PI * 2;
  const INK = '#120a10';

  // ═══════════════════════ ตัวช่วยทั่วไป ═══════════════════════

  /** วาดลงเลเยอร์ใหม่ เบลอ แล้วผสมแบบ add = แสงเรือง */
  function glow(cv, radius, strength, draw) {
    const L = cv.layer();
    draw(L);
    L.blur(radius);
    cv.draw(L, strength, 'add');
    return cv;
  }
  /** วาดลงเลเยอร์ พร้อมเงานุ่มด้านล่าง และแสงขอบ (rim) */
  function figure(cv, draw, o = {}) {
    const L = cv.layer();
    draw(L);
    if (o.shadow !== false) {
      const sh = L.silhouette('#000000', o.shadowA ?? 0.55).offset(o.sx ?? 3, o.sy ?? 5);
      sh.blur(o.shadowBlur ?? 5);
      cv.draw(sh);
    }
    if (o.rim) {
      const rim = L.silhouette(o.rim, 1);
      rim.blur(o.rimBlur ?? 6);
      cv.draw(rim, o.rimA ?? 0.9, 'add');
    }
    cv.draw(L);
    return L;
  }

  function sparkle(cv, x, y, s, c = '#fff6d8', a = 1) {
    const pts = [];
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? s * 0.22 : s;
      const t = (i / 8) * TAU - PI / 2;
      pts.push([x + Math.cos(t) * r, y + Math.sin(t) * r]);
    }
    cv.poly(pts, c, a, 'add');
    cv.circle(x, y, s * 0.3, '#ffffff', a);
  }
  function sparkles(cv, seed, n, box, c, size = 4) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) sparkle(cv, box[0] + r() * box[2], box[1] + r() * box[3], size * (0.4 + r() * 0.8), c, 0.5 + r() * 0.5);
  }
  function stars(cv, seed, n, box, a = 1) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = box[0] + r() * box[2]; const y = box[1] + r() * box[3];
      const s = r();
      cv.circle(x, y, 0.35 + s * 0.8, s > 0.9 ? '#fff4c8' : '#dfe8ff', (0.3 + s * 0.7) * a);
    }
  }

  // ═══════════════════════ ฉากหลัง ═══════════════════════

  const SKIES = {
    dusk: [[0, '#1c1440'], [0.45, '#6a2d5c'], [0.75, '#d9744a'], [1, '#f6c46a']],
    night: [[0, '#060a1c'], [0.6, '#16244a'], [1, '#2f4a78']],
    lake: [[0, '#0b1a2e'], [0.5, '#1f4a66'], [1, '#8fc3cf']],
    storm: [[0, '#0a0810'], [0.5, '#2a1f33'], [1, '#4b3a52']],
    mist: [[0, '#1c2e36'], [0.5, '#4f7a80'], [1, '#bfdad6']],
    dawn: [[0, '#2b3f73'], [0.5, '#c77f8a'], [1, '#ffd9a0']],
    sun: [[0, '#6a2a10'], [0.5, '#d9761c'], [1, '#ffe7a0']],
    grail: [[0, '#3a2a10'], [0.5, '#c8a050'], [1, '#fff4d0']],
    forest: [[0, '#0c1a10'], [0.5, '#1f3a22'], [1, '#56794a']],
    abyss: [[0, '#05030a'], [0.6, '#1f0a26'], [1, '#4a1030']],
    hall: [[0, '#1a0e08'], [0.6, '#4a2814'], [1, '#8a5a2a']],
    snow: [[0, '#1a2436'], [0.55, '#5a6e8a'], [1, '#d6e0ea']],
    violet: [[0, '#0e0618'], [0.5, '#3a1650'], [1, '#8a4a9a']],
    sea: [[0, '#13254a'], [0.5, '#3f6f9a'], [1, '#e8c89a']],
  };

  function sky(cv, seed, name, o = {}) {
    const noise = makeNoise(seed);
    const stops = SKIES[name] || SKIES.dusk;
    const H = cv.H; const W = cv.W;
    const hz = o.horizon ?? 0.72;
    cv.fill((x, y) => {
      const t = y / (H * hz);
      let c = R.ramp(stops, clamp01(t));
      const n = noise.fbm(x * 0.012 + 3, y * 0.03, 4);
      const band = smooth(0.45, 0.8, n) * (o.clouds ?? 0.35);
      c = mix(c, shade(c, 0.35), band);
      return c;
    });
    if (o.stars) stars(cv, seed + 1, o.stars, [0, 0, W, H * 0.55]);
    if (o.moon) {
      const [mx, my, mr, mc] = o.moon;
      glow(cv, mr * 1.2, 0.8, (L) => L.circle(mx, my, mr * 1.5, mc || '#fff0c8', 0.8));
      cv.circle(mx, my, mr, radial(mx - mr * 0.3, my - mr * 0.3, mr * 1.4, [mc || '#fff6dc', shade(mc || '#f0dca8', -0.15)]));
      if (o.eclipse) cv.circle(mx + mr * 0.35, my - mr * 0.1, mr * 0.92, '#0c0612', 0.95);
    }
    if (o.sun) {
      const [sx, sy2, sr] = o.sun;
      glow(cv, sr * 1.6, 1, (L) => L.circle(sx, sy2, sr * 1.8, '#ffcf6a', 0.9));
      cv.circle(sx, sy2, sr, radial(sx, sy2, sr, ['#fffbe6', '#ffd070']));
    }
    return noise;
  }

  /** ภูเขา/เนินไกลๆ เป็นชั้นๆ */
  function hills(cv, seed, y, amp, color, a = 1, rough = 0.02) {
    const noise = makeNoise(seed);
    const pts = [[0, cv.H]];
    for (let x = 0; x <= cv.W; x += 4) pts.push([x, y - noise.fbm(x * rough, 1.7, 4) * amp]);
    pts.push([cv.W, cv.H]);
    cv.poly(pts, color, a);
  }

  /** ปราสาทคาเมลอตเป็นเงา */
  function castle(cv, x, y, s, color, a = 1, windows) {
    const L = cv.layer();
    const tower = (tx, w, h, cone) => {
      L.rect(tx - w / 2, y - h, w, h + 40, color);
      if (cone) L.poly([[tx - w * 0.65, y - h], [tx, y - h - cone], [tx + w * 0.65, y - h]], color);
      else for (let i = 0; i < 3; i++) L.rect(tx - w / 2 + i * w / 2.5, y - h - w * 0.25, w / 4, w * 0.25, color);
    };
    tower(x, 14 * s, 70 * s, 26 * s);
    tower(x - 26 * s, 11 * s, 48 * s, 18 * s);
    tower(x + 28 * s, 12 * s, 54 * s, 20 * s);
    tower(x - 48 * s, 9 * s, 32 * s, 0);
    tower(x + 50 * s, 9 * s, 30 * s, 0);
    L.rect(x - 52 * s, y - 24 * s, 104 * s, 30 * s, color);
    for (let i = -5; i <= 5; i++) L.rect(x + i * 9 * s - 2.5 * s, y - 28 * s, 5 * s, 5 * s, color);
    cv.draw(L, a);
    if (windows) {
      const r = rng(hash('win' + x));
      glow(cv, 3, 1, (G) => {
        for (let i = 0; i < 9; i++) G.rect(x + (r() - 0.5) * 90 * s, y - r() * 55 * s, 2.2 * s, 3.6 * s, windows);
      });
    }
  }

  function trees(cv, seed, y, n, color, h = 60, a = 1) {
    const r = rng(seed);
    for (let i = 0; i < n; i++) {
      const x = r() * cv.W; const th = h * (0.6 + r() * 0.6); const w = th * 0.32;
      cv.poly([[x - w, y], [x, y - th], [x + w, y]], color, a);
      cv.poly([[x - w * 0.8, y - th * 0.35], [x, y - th * 1.12], [x + w * 0.8, y - th * 0.35]], color, a);
    }
  }

  function mistBand(cv, seed, y, h, color, a = 0.5) {
    const noise = makeNoise(seed);
    cv.fill((x, yy) => {
      const d = Math.abs(yy - y) / h;
      if (d > 1) return null;
      const n = noise.fbm(x * 0.02, yy * 0.05, 3);
      return [...rgb(color), (1 - d) * (1 - d) * a * smooth(0.3, 0.75, n)];
    });
  }

  function water(cv, seed, y0, top, bottom, shine) {
    const noise = makeNoise(seed);
    cv.poly([[0, y0], [cv.W, y0], [cv.W, cv.H], [0, cv.H]], (x, y) => {
      const t = (y - y0) / (cv.H - y0);
      let c = mix(top, bottom, t);
      const ripple = noise.n2(x * 0.05, y * 0.5);
      if (shine && ripple > 0.62) c = mix(c, shine, (ripple - 0.62) * 2.2 * (1 - t));
      return c;
    });
  }

  /** วงเวทพร้อมอักขระรูน */
  function runeCircle(cv, cx, cy, r, color, a = 1, seed = 7, sy = 1) {
    const L = cv.layer();
    const ring = (rr, w) => {
      const pts = [];
      for (let i = 0; i <= 96; i++) { const t = (i / 96) * TAU; pts.push([cx + Math.cos(t) * rr, cy + Math.sin(t) * rr * sy]); }
      L.stroke(pts, w, color);
    };
    ring(r, 1.6); ring(r * 0.82, 1.1); ring(r * 0.38, 1);
    const rr = rng(seed);
    const glyphs = 14;
    for (let i = 0; i < glyphs; i++) {
      const t = (i / glyphs) * TAU;
      const gx = cx + Math.cos(t) * r * 0.91; const gy = cy + Math.sin(t) * r * 0.91 * sy;
      const g = r * 0.06;
      const kind = Math.floor(rr() * 4);
      if (kind === 0) { L.line(gx, gy - g, gx, gy + g, 1, color); L.line(gx, gy - g, gx + g, gy, 1, color); }
      else if (kind === 1) { L.line(gx - g, gy + g, gx, gy - g, 1, color); L.line(gx, gy - g, gx + g, gy + g, 1, color); }
      else if (kind === 2) { L.line(gx, gy - g, gx, gy + g, 1, color); L.line(gx - g * 0.7, gy - g * 0.3, gx + g * 0.7, gy + g * 0.3, 1, color); }
      else { L.line(gx - g, gy, gx + g, gy, 1, color); L.line(gx, gy - g, gx, gy + g, 1, color); }
    }
    const tri = (off) => {
      const pts = [];
      for (let i = 0; i < 3; i++) { const t = off + (i / 3) * TAU; pts.push([cx + Math.cos(t) * r * 0.8, cy + Math.sin(t) * r * 0.8 * sy]); }
      pts.push(pts[0]);
      L.stroke(pts, 1.1, color);
    };
    tri(-PI / 2); tri(PI / 2);
    const G = L.silhouette(color, 1); G.blur(r * 0.08);
    cv.draw(G, a, 'add');
    cv.draw(L, a);
  }

  function vignette(cv, amt = 0.55, cx = 0.5, cy = 0.45) {
    const W = cv.W; const H = cv.H;
    cv.fill((x, y) => {
      const d = Math.hypot((x / W - cx) / 0.62, (y / H - cy) / 0.62);
      const v = smooth(0.55, 1.25, d) * amt;
      return v > 0 ? [0, 0, 0, v] : null;
    });
  }

  // ═══════════════════════ อาวุธและวัตถุ ═══════════════════════

  function sword(cv, x0, y0, x1, y1, o = {}) {
    const dx = x1 - x0; const dy = y1 - y0; const L = Math.hypot(dx, dy);
    const ux = dx / L; const uy = dy / L; const px = -uy; const py = ux;
    const bw = o.w || 7;
    const gk = o.grip ?? 0.2;
    const g = [x0 + ux * L * gk, y0 + uy * L * gk];
    const tipBase = [x1 - ux * bw * 2.4, y1 - uy * bw * 2.4];
    const blade = o.blade || '#dfe6ee';
    const P = (p, k) => [p[0] + px * k, p[1] + py * k];
    const bladePts = [P(g, bw), P(tipBase, bw * 0.92), [x1, y1], P(tipBase, -bw * 0.92), P(g, -bw)];
    if (o.glow) glow(cv, bw * 2.2, o.glowA ?? 0.9, (G) => G.poly(bladePts, o.glow));
    cv.poly(bladePts, (x, y) => {
      const side = ((x - g[0]) * px + (y - g[1]) * py) / bw; // -1..1 across the blade
      const along = ((x - g[0]) * ux + (y - g[1]) * uy) / L;
      let c = side > 0 ? shade(blade, 0.25 - side * 0.2) : shade(blade, -0.12 + side * 0.25);
      if (o.runes && Math.abs(side) < 0.3 && Math.floor(along * 26) % 3 === 0) c = mix(c, o.runes, 0.8);
      return c;
    });
    cv.line(g[0], g[1], tipBase[0], tipBase[1], bw * 0.18, '#ffffff', 0.5);
    const gw = o.guard || bw * 3.2;
    const gc = o.gold || '#d9a441';
    cv.line(g[0] + px * gw, g[1] + py * gw, g[0] - px * gw, g[1] - py * gw, bw * 0.9, lit(gc, [g[0] - gw, g[1] - 4, gw * 2, 8]));
    cv.circle(g[0] + px * gw, g[1] + py * gw, bw * 0.62, gc);
    cv.circle(g[0] - px * gw, g[1] - py * gw, bw * 0.62, gc);
    cv.line(x0, y0, g[0], g[1], bw * 0.8, o.hilt || '#4a2616');
    for (let t = 0.1; t < 0.95; t += 0.18) {
      const q = [x0 + (g[0] - x0) * t, y0 + (g[1] - y0) * t];
      cv.line(q[0] + px * bw * 0.4, q[1] + py * bw * 0.4, q[0] - px * bw * 0.4 + ux * 2, q[1] - py * bw * 0.4 + uy * 2, 1, shade(o.hilt || '#4a2616', 0.3), 0.8);
    }
    cv.circle(x0, y0, bw * 0.8, radial(x0 - 1, y0 - 1, bw, [shade(gc, 0.5), gc, shade(gc, -0.4)]));
    if (o.gem) { cv.circle(g[0], g[1], bw * 0.5, radial(g[0] - 1, g[1] - 1, bw * 0.6, ['#ffffff', o.gem, shade(o.gem, -0.5)])); }
  }

  function spear(cv, x0, y0, x1, y1, o = {}) {
    const L = Math.hypot(x1 - x0, y1 - y0); const ux = (x1 - x0) / L; const uy = (y1 - y0) / L; const px = -uy; const py = ux;
    cv.line(x0, y0, x1 - ux * 22, y1 - uy * 22, o.w || 4, lit(o.shaft || '#6a4424', [x0, y0, x1 - x0 || 1, y1 - y0 || 1]));
    const b = [x1 - ux * 26, y1 - uy * 26];
    const head = [[b[0] + px * 6, b[1] + py * 6], [x1, y1], [b[0] - px * 6, b[1] - py * 6], [b[0] + ux * 4, b[1] + uy * 4]];
    if (o.glow) glow(cv, 10, 1, (G) => G.poly(head, o.glow));
    cv.poly(head, (x, y) => (((x - b[0]) * px + (y - b[1]) * py) > 0 ? shade(o.head || '#e4ecf4', 0.2) : shade(o.head || '#e4ecf4', -0.2)));
    cv.line(b[0] + px * 7, b[1] + py * 7, b[0] - px * 7, b[1] - py * 7, 3, o.gold || '#d9a441');
  }

  function staff(cv, x0, y0, x1, y1, orb, o = {}) {
    cv.curve([[x0, y0], [(x0 + x1) / 2 + 3, (y0 + y1) / 2], [x1, y1]], o.w || 5, lit(o.wood || '#5a3a22', [Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0) + 1, Math.abs(y1 - y0) + 1]));
    for (let i = 0; i < 3; i++) cv.curve([[x1 - 8, y1 + 10], [x1 - 12 + i * 8, y1 - 6], [x1 + (i - 1) * 5, y1 - 14]], 2, o.wood || '#5a3a22');
    glow(cv, 14, 1.1, (G) => G.circle(x1, y1 - 10, 12, orb));
    cv.circle(x1, y1 - 10, 8, radial(x1 - 3, y1 - 13, 11, ['#ffffff', orb, shade(orb, -0.5)]));
  }

  function shield(cv, cx, cy, s, face, emblem, o = {}) {
    const pts = spline([[cx - 30 * s, cy - 34 * s], [cx, cy - 38 * s], [cx + 30 * s, cy - 34 * s], [cx + 28 * s, cy + 2 * s], [cx + 12 * s, cy + 30 * s], [cx, cy + 40 * s], [cx - 12 * s, cy + 30 * s], [cx - 28 * s, cy + 2 * s]], true, 8);
    cv.poly(pts, lit(face, [cx - 30 * s, cy - 38 * s, 60 * s, 78 * s], { spec: 0.5 }));
    const inner = transform(pts, { x: cx, y: cy, s: 0.84, cx, cy });
    cv.stroke([...inner, inner[0]], 3.2 * s, o.rim || '#d9a441');
    cv.stroke([...pts, pts[0]], 2.2 * s, shade(o.rim || '#d9a441', -0.4));
    if (emblem === 'cross') {
      cv.rect(cx - 4 * s, cy - 26 * s, 8 * s, 52 * s, o.mark || '#b3242a');
      cv.rect(cx - 20 * s, cy - 8 * s, 40 * s, 8 * s, o.mark || '#b3242a');
    } else if (emblem === 'dragon') {
      cv.blob([[cx - 16 * s, cy + 10 * s], [cx - 4 * s, cy - 20 * s], [cx + 14 * s, cy - 14 * s], [cx + 6 * s, cy], [cx + 16 * s, cy + 16 * s], [cx, cy + 8 * s]], o.mark || '#b3242a');
    } else if (emblem === 'star') {
      const st = [];
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 7 * s : 18 * s; const t = (i / 10) * TAU - PI / 2; st.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
      cv.poly(st, o.mark || '#f6e3a0');
    } else if (emblem === 'madonna') {
      cv.ellipse(cx, cy - 6 * s, 9 * s, 11 * s, '#f0d8b8');
      cv.poly([[cx - 16 * s, cy + 24 * s], [cx - 8 * s, cy - 2 * s], [cx + 8 * s, cy - 2 * s], [cx + 16 * s, cy + 24 * s]], '#3a64b8');
      glow(cv, 8, 0.7, (G) => G.circle(cx, cy - 8 * s, 14 * s, '#ffe6a0'));
    }
  }

  function chalice(cv, cx, cy, s, o = {}) {
    const gold = o.gold || '#e2b24a';
    if (o.glow !== false) glow(cv, 22 * s, 1, (G) => { G.ellipse(cx, cy - 16 * s, 26 * s, 18 * s, o.glow || '#fff0b0'); });
    const cup = spline([[cx - 18 * s, cy - 26 * s], [cx + 18 * s, cy - 26 * s], [cx + 14 * s, cy - 6 * s], [cx + 4 * s, cy + 4 * s], [cx - 4 * s, cy + 4 * s], [cx - 14 * s, cy - 6 * s]], true, 8);
    cv.poly(cup, lit(gold, [cx - 18 * s, cy - 26 * s, 36 * s, 30 * s], { spec: 0.8 }));
    cv.rect(cx - 2.5 * s, cy + 2 * s, 5 * s, 16 * s, lit(gold, [cx - 3 * s, cy, 6 * s, 16 * s]));
    cv.ellipse(cx, cy + 20 * s, 14 * s, 4.5 * s, lit(gold, [cx - 14 * s, cy + 16 * s, 28 * s, 8 * s]));
    cv.ellipse(cx, cy - 26 * s, 18 * s, 4 * s, o.liquid || '#b8202c');
    for (const [gx, gc] of [[-8, '#c8243a'], [0, '#2a7ad8'], [8, '#2aa860']]) cv.circle(cx + gx * s, cy - 14 * s, 2.4 * s, radial(cx + gx * s - 1, cy - 15 * s, 3 * s, ['#ffffff', gc]));
  }

  function vial(cv, cx, cy, s, liquid, o = {}) {
    glow(cv, 16 * s, 0.9, (G) => G.ellipse(cx, cy + 6 * s, 22 * s, 24 * s, liquid));
    const body = spline([[cx - 6 * s, cy - 20 * s], [cx + 6 * s, cy - 20 * s], [cx + 7 * s, cy - 10 * s], [cx + 20 * s, cy + 6 * s], [cx + 16 * s, cy + 22 * s], [cx, cy + 27 * s], [cx - 16 * s, cy + 22 * s], [cx - 20 * s, cy + 6 * s], [cx - 7 * s, cy - 10 * s]], true, 8);
    cv.poly(body, (x, y) => {
      const t = (y - cy) / (27 * s);
      if (t > -0.25) return mix(shade(liquid, 0.3), shade(liquid, -0.35), (x - cx + 20 * s) / (40 * s));
      return [210, 230, 240, 0.35];
    });
    cv.stroke([...body, body[0]], 1.6 * s, '#e8f4ff', 0.8);
    cv.line(cx - 10 * s, cy + 2 * s, cx - 13 * s, cy + 14 * s, 3 * s, '#ffffff', 0.5);
    cv.rect(cx - 7 * s, cy - 28 * s, 14 * s, 9 * s, lit(o.cork || '#9a6a3a', [cx - 7 * s, cy - 28 * s, 14 * s, 9 * s]));
    sparkles(cv, hash('vial' + cx), 6, [cx - 20 * s, cy - 10 * s, 40 * s, 36 * s], '#ffffff', 3 * s);
  }

  function harp(cv, x, y, s, gold = '#d9a441') {
    const frame = [[x, y + 30 * s], [x - 4 * s, y - 10 * s], [x + 6 * s, y - 32 * s], [x + 26 * s, y - 28 * s], [x + 30 * s, y - 8 * s], [x + 18 * s, y + 10 * s], [x + 4 * s, y + 30 * s]];
    cv.curve(frame, 4.5 * s, lit(gold, [x - 4 * s, y - 32 * s, 36 * s, 62 * s], { spec: 0.6 }));
    for (let i = 0; i < 6; i++) {
      const t = i / 6;
      cv.line(x + (2 + t * 20) * s, y + (24 - t * 14) * s, x + (4 + t * 22) * s, y + (-26 + t * 4) * s, 0.8, '#f4eed8', 0.9);
    }
  }

  function note(cv, x, y, s, c) {
    cv.ellipse(x, y, 4 * s, 3 * s, c, 1, undefined, -0.4);
    cv.line(x + 3.5 * s, y - 1 * s, x + 3.5 * s, y - 16 * s, 1.4 * s, c);
    cv.curve([[x + 3.5 * s, y - 16 * s], [x + 8 * s, y - 12 * s], [x + 9 * s, y - 6 * s]], 1.4 * s, c);
  }

  // ═══════════════════════ การ์ด ═══════════════════════

  const CW = SPECS.cards.w; const CH = SPECS.cards.h;
  const CARD = {};
  const card = (key, draw) => { CARD[key] = draw; };

  card('strike', (cv, seed) => {
    sky(cv, seed, 'violet', { clouds: 0.5, stars: 40 });
    runeCircle(cv, 128, 118, 84, '#b89aff', 0.55, seed);
    glow(cv, 10, 1, (L) => L.curve([[26, 176], [90, 120], [170, 70], [236, 26]], 12, '#8fd8ff', 1, undefined, 2));
    cv.curve([[26, 176], [90, 120], [170, 70], [236, 26]], 4, '#ffffff', 0.95, undefined, 1);
    sword(cv, 64, 176, 196, 36, { w: 8, glow: '#9fe0ff', runes: '#7fd6ff', gem: '#4aa8ff' });
    sparkles(cv, seed, 14, [20, 20, 216, 160], '#cfe8ff', 5);
    vignette(cv, 0.5);
  });
  card('aegis', (cv, seed) => {
    sky(cv, seed, 'night', { stars: 60, clouds: 0.3 });
    hills(cv, seed, 190, 40, '#0e1628');
    const cx = 128; const cy = 150;
    glow(cv, 18, 0.9, (L) => L.ellipse(cx, cy, 108, 96, '#5fb8ff', 0.5));
    cv.ellipse(cx, cy, 104, 94, radial(cx, cy - 20, 110, [[0, [120, 200, 255, 0.05]], [0.8, [120, 200, 255, 0.25]], [1, [200, 240, 255, 0.7]]]));
    const hex = (hx, hy, r) => { const p = []; for (let i = 0; i <= 6; i++) { const t = (i / 6) * TAU; p.push([hx + Math.cos(t) * r, hy + Math.sin(t) * r]); } return p; };
    for (let row = -5; row <= 5; row++) {
      for (let col = -6; col <= 6; col++) {
        const hx = cx + col * 17.3 + (row % 2 ? 8.6 : 0); const hy = cy + row * 15;
        if (Math.hypot((hx - cx) / 100, (hy - cy) / 90) > 0.97) continue;
        cv.stroke(hex(hx, hy, 9.4), 1, '#bfe8ff', 0.35);
      }
    }
    for (const [x, y] of [[40, 60], [70, 40], [200, 50], [220, 80]]) {
      cv.line(x, y, x + (cx - x) * 0.45, y + (cy - y) * 0.45, 2.2, '#ff8a4a', 0.9);
      sparkle(cv, x + (cx - x) * 0.45, y + (cy - y) * 0.45, 8, '#ffd08a');
    }
    vignette(cv, 0.45);
  });
  card('elixir', (cv, seed) => {
    sky(cv, seed, 'lake', { clouds: 0.25, stars: 30 });
    water(cv, seed, 150, '#2a5a78', '#0e2436', '#bfe8ff');
    mistBand(cv, seed, 150, 30, '#d6f0f4', 0.6);
    vial(cv, 128, 100, 2.4, '#e0487a');
    vignette(cv, 0.45);
  });
  card('blink', (cv, seed) => {
    sky(cv, seed, 'violet', { clouds: 0.4, stars: 50 });
    hills(cv, seed, 196, 20, '#1a0c26');
    const portal = (cx, cy, c) => {
      glow(cv, 14, 1.2, (L) => L.ellipse(cx, cy, 30, 52, c));
      cv.ellipse(cx, cy, 26, 48, radial(cx, cy, 48, [[0, [10, 0, 20]], [0.7, [40, 10, 70]], [1, rgb(c)]], 1.8));
      const ring = [];
      for (let i = 0; i <= 64; i++) { const t = (i / 64) * TAU; ring.push([cx + Math.cos(t) * 27, cy + Math.sin(t) * 49]); }
      cv.stroke(ring, 3, '#ffffff', 0.8);
    };
    portal(58, 122, '#b46aff');
    portal(198, 104, '#5ad0ff');
    // ร่างที่สลายเป็นละอองระหว่างประตูมิติ
    const fig = (x, y, a, c) => {
      cv.circle(x, y - 30, 8, c, a);
      cv.blob([[x - 12, y + 24], [x - 10, y - 10], [x, y - 20], [x + 10, y - 10], [x + 12, y + 24]], c, a);
    };
    fig(58, 128, 0.9, '#1a0a26');
    fig(198, 110, 0.95, '#0e1a2a');
    const r = rng(seed);
    glow(cv, 4, 1, (L) => {
      for (let i = 0; i < 60; i++) {
        const t = r(); const x = 70 + t * 118; const y = 118 - Math.sin(t * PI) * 44 - t * 12 + (r() - 0.5) * 18;
        L.circle(x, y, 0.8 + r() * 1.6, t < 0.5 ? '#d8a8ff' : '#a8e8ff');
      }
    });
    vignette(cv, 0.5);
  });
  card('dispel', (cv, seed) => {
    sky(cv, seed, 'storm', { clouds: 0.5 });
    const noise = makeNoise(seed);
    // เปลวเพลิงขาวชำระล้าง
    glow(cv, 20, 1, (L) => L.ellipse(128, 120, 60, 80, '#ffcc66', 0.8));
    for (let k = 0; k < 3; k++) {
      const c = ['#ff7a2a', '#ffc24a', '#fff4d0'][k];
      const w = 58 - k * 16; const h = 120 - k * 26;
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24; const side = t < 0.5 ? -1 : 1; const u = t < 0.5 ? t * 2 : (1 - t) * 2;
        const wob = (noise.n2(i * 0.7, k) - 0.5) * 12;
        pts.push([128 + side * w * Math.sin(u * PI * 0.5) * (1 - u * 0.2) + wob, 176 - h * (1 - u) - 8 * Math.sin(u * 6)]);
      }
      cv.blob(pts, c, 0.95);
    }
    // สายโซ่มนตร์ขาดสะบั้น
    for (const [x, y, r] of [[48, 70, -0.4], [206, 78, 0.5]]) {
      for (let i = 0; i < 3; i++) cv.ellipse(x + Math.cos(r) * i * 12, y + Math.sin(r) * i * 12, 7, 4, '#a0a0b8', 0.9, undefined, r);
    }
    sparkles(cv, seed, 16, [40, 30, 176, 140], '#fff2c0', 5);
    vignette(cv, 0.45);
  });
  card('meteor', (cv, seed) => {
    sky(cv, seed, 'abyss', { stars: 80, clouds: 0.3 });
    hills(cv, seed, 186, 30, '#140a14');
    castle(cv, 128, 190, 1.1, '#1a0e18', 1, '#ffb040');
    const r = rng(seed);
    for (let i = 0; i < 7; i++) {
      const x = 30 + r() * 200; const y = 20 + r() * 110; const len = 40 + r() * 50;
      glow(cv, 8, 1, (L) => L.line(x - len * 0.6, y - len, x, y, 7, '#ff7a2a', 1, undefined, 3));
      cv.line(x - len * 0.6, y - len, x, y, 3, '#ffe0a0', 0.9, undefined, 1);
      cv.circle(x, y, 4 + r() * 3, radial(x - 1, y - 1, 6, ['#ffffff', '#ffc040', '#ff5020']));
    }
    glow(cv, 16, 0.8, (L) => L.ellipse(128, 196, 120, 18, '#ff5a1a'));
    vignette(cv, 0.4);
  });
  card('blessing', (cv, seed) => {
    sky(cv, seed, 'grail', { clouds: 0.3 });
    // รัศมีแสงลงมาจากเบื้องบน
    glow(cv, 10, 0.8, (L) => { for (let i = -5; i <= 5; i++) L.poly([[128 + i * 6, -10], [128 + i * 30 - 12, 210], [128 + i * 30 + 12, 210]], '#fff4c8', 0.35); });
    // หนังสือสวดมนต์เปิด
    const book = (flip) => transform([[0, 0], [70, -12], [74, 40], [4, 52]], { x: 128, y: 120, flip });
    for (const f of [false, true]) {
      cv.poly(book(f), lit('#f6ecd0', [60, 108, 136, 64]));
      for (let i = 0; i < 5; i++) cv.line(128 + (f ? -1 : 1) * 12, 128 + i * 8, 128 + (f ? -1 : 1) * 60, 120 + i * 8, 1.2, '#b8a070', 0.7);
    }
    cv.poly([[60, 172], [128, 172], [196, 172], [196, 180], [60, 180]], '#6a2a1a');
    sparkles(cv, seed, 14, [50, 20, 156, 90], '#ffffff', 6);
    vignette(cv, 0.35);
  });
  card('siren', (cv, seed) => {
    sky(cv, seed, 'sea', { clouds: 0.4, moon: [196, 50, 18] });
    water(cv, seed, 140, '#2f5f8a', '#0c1c30', '#e8f0ff');
    // โขดหิน
    cv.blob([[70, 208], [80, 160], [110, 140], [150, 146], [176, 170], [190, 208]], lit('#3a3a48', [70, 140, 120, 68]));
    // นางไซเรน
    figure(cv, (L) => {
      L.blob([[112, 150], [118, 118], [132, 106], [146, 118], [150, 150], [142, 162], [120, 162]], '#9fd8c8');
      L.blob([[118, 160], [150, 156], [174, 176], [186, 168], [178, 186], [148, 176], [124, 176]], lit('#2aa89a', [118, 156, 70, 30], { spec: 0.4 }));
      L.circle(132, 96, 12, '#f2d0c0');
      L.blob([[118, 90], [132, 80], [148, 90], [152, 130], [140, 112], [128, 100], [120, 118]], '#e0503a');
    }, { rim: '#7fe0ff', rimA: 0.6 });
    for (let i = 0; i < 5; i++) note(cv, 60 + i * 14 - (i % 2) * 6, 70 - i * 6, 1, '#dff6ff');
    glow(cv, 6, 0.8, (L) => { for (let i = 0; i < 5; i++) note(L, 60 + i * 14 - (i % 2) * 6, 70 - i * 6, 1, '#7fe0ff'); });
    vignette(cv, 0.45);
  });
  card('blood_duel', (cv, seed) => {
    sky(cv, seed, 'abyss', { clouds: 0.5 });
    runeCircle(cv, 128, 150, 96, '#ff4a4a', 0.5, seed, 0.35);
    sword(cv, 50, 190, 190, 36, { w: 7, blade: '#e4e0e8' });
    sword(cv, 206, 190, 66, 36, { w: 7, blade: '#d8d0dc', gold: '#b8b8c8' });
    // โซ่โลหิต
    for (let i = 0; i < 9; i++) {
      const t = i / 8; const x = 40 + t * 176; const y = 120 + Math.sin(t * PI) * -26;
      glow(cv, 4, 0.6, (L) => L.ellipse(x, y, 8, 5, '#ff2a2a', 1, undefined, t * 2));
      cv.ellipse(x, y, 8, 5, lit('#a8141c', [x - 8, y - 5, 16, 10]), 1, undefined, t * 2);
      cv.ellipse(x, y, 4, 2, '#1a0608', 1, undefined, t * 2);
    }
    vignette(cv, 0.5);
  });
  card('blood_moon', (cv, seed) => {
    sky(cv, seed, 'abyss', { stars: 90, clouds: 0.3, moon: [150, 70, 44, '#e83a2a'] });
    hills(cv, seed, 190, 26, '#12060c');
    trees(cv, seed, 200, 14, '#0c0408', 40);
    glow(cv, 10, 1, (L) => L.line(60, 20, 96, 150, 10, '#6a2aff', 1, undefined, 4));
    cv.circle(96, 150, 10, radial(94, 147, 12, ['#b08aff', '#2a0a4a', '#000000']));
    vignette(cv, 0.45);
  });
  card('petrify', (cv, seed) => {
    sky(cv, seed, 'mist', { clouds: 0.5 });
    const noise = makeNoise(seed + 3);
    const stone = textured(lit('#8a8a90', [80, 30, 96, 170]), noise, 0.08, 0.25);
    figure(cv, (L) => {
      L.blob([[90, 208], [96, 140], [110, 118], [146, 118], [160, 140], [166, 208]], stone);
      L.ellipse(128, 92, 22, 28, stone);
      L.blob([[100, 150], [70, 120], [78, 110], [108, 136]], stone);
    }, { rim: '#9fe0c0', rimA: 0.3 });
    const r = rng(seed);
    for (let i = 0; i < 9; i++) {
      const x = 96 + r() * 64; const y = 70 + r() * 130;
      cv.curve([[x, y], [x + (r() - 0.5) * 16, y + 8], [x + (r() - 0.5) * 20, y + 18]], 1.4, '#2a2a30', 0.9);
    }
    runeCircle(cv, 128, 196, 70, '#8affc8', 0.6, seed, 0.25);
    vignette(cv, 0.45);
  });
  card('excalibur', (cv, seed) => {
    sky(cv, seed, 'dawn', { clouds: 0.4 });
    hills(cv, seed, 180, 30, '#2a2438');
    // ศิลา
    const noise = makeNoise(seed + 2);
    cv.blob([[60, 208], [70, 160], [100, 146], [158, 146], [190, 166], [198, 208]], textured(lit('#7a7a86', [60, 146, 138, 62]), noise, 0.1, 0.2));
    glow(cv, 26, 1, (L) => L.ellipse(128, 90, 30, 90, '#fff0b0', 0.7));
    sword(cv, 128, 18, 128, 172, { w: 8, glow: '#fff4c0', gem: '#3a7ad8', runes: '#ffe08a', guard: 26 });
    sparkles(cv, seed, 18, [60, 10, 136, 150], '#fff4d0', 6);
    vignette(cv, 0.4);
  });
  card('rhongomyniad', (cv, seed) => {
    sky(cv, seed, 'storm', { clouds: 0.6 });
    glow(cv, 16, 1, (L) => L.line(20, 196, 236, 20, 16, '#8ad8ff', 0.9));
    spear(cv, 20, 196, 236, 20, { glow: '#bff0ff', head: '#f4fbff', w: 5 });
    glow(cv, 5, 0.9, (L) => {
      for (let i = 0; i < 6; i++) {
        const t = 0.2 + i * 0.13; const x = 20 + t * 216; const y = 196 - t * 176;
        L.curve([[x, y], [x + 10, y + 14], [x + 2, y + 24], [x + 12, y + 38]], 1.2, '#e0f6ff');
      }
    });
    vignette(cv, 0.45);
  });
  card('carnwennan', (cv, seed) => {
    sky(cv, seed, 'night', { stars: 50, clouds: 0.5 });
    glow(cv, 22, 0.9, (L) => L.ellipse(128, 110, 70, 60, '#3a1a5a'));
    const noise = makeNoise(seed);
    cv.fill((x, y) => { const n = noise.fbm(x * 0.03, y * 0.03, 4); const d = Math.hypot(x - 128, y - 110) / 110; return n > 0.55 && d < 1 ? [20, 8, 30, (n - 0.55) * 2.5 * (1 - d)] : null; });
    sword(cv, 70, 170, 176, 56, { w: 7, blade: '#a8a0c0', gold: '#6a5a8a', hilt: '#1a1020', gem: '#a040ff', glow: '#7a3aff', glowA: 0.6 });
    vignette(cv, 0.6);
  });
  card('merlin_staff', (cv, seed) => {
    sky(cv, seed, 'night', { stars: 90, clouds: 0.3 });
    runeCircle(cv, 128, 70, 56, '#7fd6ff', 0.55, seed);
    staff(cv, 110, 206, 138, 70, '#5fd0ff', { w: 6 });
    sparkles(cv, seed, 16, [60, 10, 136, 120], '#dff4ff', 5);
    vignette(cv, 0.45);
  });
  card('pridwen', (cv, seed) => {
    sky(cv, seed, 'dusk', { clouds: 0.4 });
    castle(cv, 128, 196, 1, '#2a1a2a', 0.9, '#ffb050');
    glow(cv, 14, 0.8, (L) => L.circle(128, 104, 72, '#ffe0a0', 0.6));
    shield(cv, 128, 104, 1.95, '#e8e4dc', 'madonna', { rim: '#d9a441' });
    vignette(cv, 0.45);
  });
  card('mantle', (cv, seed) => {
    sky(cv, seed, 'mist', { clouds: 0.6 });
    const noise = makeNoise(seed);
    cv.blob([[70, 200], [80, 110], [104, 60], [128, 48], [152, 60], [176, 110], [186, 200]], (x, y) => {
      const fade = smooth(60, 200, y);
      const n = noise.fbm(x * 0.04, y * 0.04, 3);
      const c = mix('#2a5a6a', '#9fd0d0', n);
      return [...c, 0.95 - fade * 0.85 * (0.5 + n)];
    });
    cv.ellipse(128, 86, 20, 24, '#081418', 0.9);
    glow(cv, 3, 1, (L) => { L.circle(120, 86, 2.2, '#bff8ff'); L.circle(136, 86, 2.2, '#bff8ff'); });
    sparkles(cv, seed, 12, [50, 40, 156, 150], '#e0ffff', 4);
    vignette(cv, 0.4);
  });
  card('dragonscale', (cv, seed) => {
    sky(cv, seed, 'snow', { clouds: 0.4 });
    figure(cv, (L) => {
      L.blob([[62, 208], [66, 120], [96, 88], [160, 88], [190, 120], [194, 208]], lit('#e8eef4', [62, 88, 132, 120], { spec: 0.5 }));
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 9; col++) {
          const x = 76 + col * 13 + (row % 2) * 6.5; const y = 100 + row * 13;
          if (x > 186 || x < 70) continue;
          L.poly(spline([[x - 7, y], [x, y - 4], [x + 7, y], [x, y + 9]], true, 6), lit('#dfe8f2', [x - 7, y - 4, 14, 13], { spec: 0.7 }));
          L.curve([[x - 6, y + 1], [x, y + 8], [x + 6, y + 1]], 0.8, '#8aa0b8', 0.7);
        }
      }
      L.ellipse(92, 96, 22, 14, lit('#f4f8fb', [70, 82, 44, 28], { spec: 0.8 }));
      L.ellipse(164, 96, 22, 14, lit('#f4f8fb', [142, 82, 44, 28], { spec: 0.8 }));
    }, { rim: '#bfe8ff', rimA: 0.5 });
    glow(cv, 10, 0.6, (L) => L.ellipse(190, 60, 40, 24, '#ff8a3a'));
    vignette(cv, 0.4);
  });

  function gryphon(L, x, y, s) {
    // ปีก
    const wing = (flip) => transform([[0, 0], [-30, -40], [-70, -60], [-96, -52], [-80, -34], [-92, -26], [-72, -14], [-80, -2], [-50, 4]], { x, y, s, flip });
    for (const f of [true, false]) L.blob(wing(f), lit('#d8c090', [x - 96 * s, y - 60 * s, 192 * s, 64 * s], { spec: 0.3 }));
    // ลำตัวสิงโต
    L.blob(transform([[-20, 0], [0, -14], [30, -10], [44, 6], [36, 26], [0, 24], [-24, 16]], { x, y, s }), lit('#c8943a', [x - 24 * s, y - 14 * s, 68 * s, 40 * s]));
    // หัวนกอินทรี
    L.blob(transform([[-24, -4], [-36, -20], [-32, -34], [-18, -34], [-10, -20]], { x, y, s }), lit('#f2ead8', [x - 36 * s, y - 34 * s, 26 * s, 30 * s]));
    L.poly(transform([[-36, -28], [-48, -22], [-36, -20]], { x, y, s }), '#e8b030');
    L.circle(x - 28 * s, y - 27 * s, 1.8 * s, INK);
    L.curve(transform([[44, 6], [60, 0], [66, -12]], { x, y, s }), 3 * s, '#c8943a');
  }
  card('gryphon', (cv, seed) => {
    sky(cv, seed, 'dawn', { clouds: 0.6, sun: [200, 150, 20] });
    hills(cv, seed, 196, 40, '#3a3050');
    figure(cv, (L) => gryphon(L, 128, 110, 1.15), { rim: '#ffe0a0', rimA: 0.6, sy: 20, shadowA: 0.25, shadowBlur: 10 });
    vignette(cv, 0.35);
  });

  function unicorn(L, x, y, s, coat = '#f2f4f8', mane = '#b8d8ff') {
    const T = (pts) => transform(pts, { x, y, s });
    L.blob(T([[-40, 10], [-20, -6], [20, -8], [40, 4], [38, 30], [-38, 32]]), lit(coat, [x - 40 * s, y - 8 * s, 80 * s, 40 * s], { spec: 0.3 }));
    for (const lx of [-30, -16, 20, 32]) L.line(x + lx * s, y + 28 * s, x + (lx + 2) * s, y + 62 * s, 6 * s, coat);
    L.blob(T([[20, -2], [34, -34], [44, -52], [60, -52], [62, -40], [48, -26], [38, 6]]), lit(coat, [x + 20 * s, y - 52 * s, 42 * s, 58 * s]));
    L.curve(T([[36, -40], [22, -24], [16, -2], [14, 16]]), 7 * s, mane, 1, undefined, 2 * s);
    L.curve(T([[-40, 12], [-56, 20], [-60, 44]]), 6 * s, mane, 1, undefined, 1.5 * s);
    L.line(x + 52 * s, y - 54 * s, x + 64 * s, y - 84 * s, 3.5 * s, '#ffe6a0', 1, undefined, 0.5 * s);
    L.circle(x + 52 * s, y - 44 * s, 1.6 * s, INK);
  }
  card('unicorn', (cv, seed) => {
    sky(cv, seed, 'mist', { clouds: 0.5, moon: [70, 50, 18] });
    trees(cv, seed, 180, 16, '#274a4a', 70, 0.6);
    const L = figure(cv, (Ly) => unicorn(Ly, 118, 118, 1.1), { rim: '#dff8ff', rimA: 0.7, shadowA: 0.3 });
    void L;
    glow(cv, 8, 1, (G) => G.line(118 + 52 * 1.1, 118 - 54 * 1.1, 118 + 64 * 1.1, 118 - 84 * 1.1, 4, '#fff0b0'));
    mistBand(cv, seed, 186, 30, '#e0f4f2', 0.85);
    vignette(cv, 0.4);
  });

  // ═══════════════════════ ภัยพิบัติแห่งบริทาเนีย ═══════════════════════
  const THREAT = {};
  THREAT.dragon = (cv, seed) => {
    sky(cv, seed, 'abyss', { clouds: 0.5, stars: 30 });
    hills(cv, seed, 196, 24, '#1a0808');
    castle(cv, 60, 200, 0.7, '#140606', 1, '#ff7030');
    figure(cv, (L) => {
      const scale = (x, y) => {
        const base = mix('#6a0c0c', '#d0401a', clamp01((x - 170) / 80));
        const sx = x / 8; const sy = y / 6 + (Math.floor(x / 8) % 2) * 0.5;
        const f = Math.abs((sx - Math.floor(sx)) - 0.5) + Math.abs((sy - Math.floor(sy)) - 0.5);
        return shade(base, f > 0.72 ? -0.3 : 0.04);
      };
      L.curve([[250, 210], [210, 170], [190, 120], [170, 80]], 42, scale, 1, undefined, 26);
      L.blob([[150, 60], [180, 44], [214, 50], [226, 70], [206, 84], [174, 92], [150, 84]], lit('#b01818', [150, 44, 76, 48], { spec: 0.4 }));
      L.blob([[150, 80], [120, 96], [110, 108], [140, 104], [170, 92]], '#5a0808');
      for (let i = 0; i < 5; i++) L.poly([[122 + i * 9, 96 - i * 2], [126 + i * 9, 104 - i * 2], [130 + i * 9, 95 - i * 2]], '#f4ecd0');
      L.poly([[190, 48], [206, 14], [212, 50]], '#3a1a10');
      L.poly([[176, 48], [178, 20], [190, 48]], '#3a1a10');
      L.poly([[214, 74], [256, 40], [256, 110]], lit('#6a0a0a', [214, 40, 42, 70]));
    }, { rim: '#ff8030', rimA: 0.9 });
    glow(cv, 5, 1.5, (L) => L.ellipse(186, 62, 6, 3.5, '#ffe040'));
    glow(cv, 14, 1.2, (L) => L.poly([[118, 100], [10, 150], [0, 200], [30, 208], [120, 110]], '#ff8a20'));
    cv.poly([[118, 100], [20, 150], [10, 190], [120, 108]], radial(118, 104, 120, ['#fff4c0', '#ffb030', '#ff4010']), 0.85);
    vignette(cv, 0.45);
  };
  THREAT.saxons = (cv, seed) => {
    sky(cv, seed, 'storm', { clouds: 0.6 });
    glow(cv, 20, 0.8, (L) => L.ellipse(128, 190, 150, 30, '#ff5a1a'));
    hills(cv, seed, 180, 20, '#1a1010');
    const r = rng(seed);
    for (let i = 0; i < 18; i++) {
      const x = 8 + i * 14 + (r() - 0.5) * 6; const y = 176 + r() * 10; const sc = 0.8 + r() * 0.4;
      cv.circle(x, y - 26 * sc, 5 * sc, '#140c0c');
      cv.poly([[x - 8 * sc, y + 20], [x - 6 * sc, y - 20 * sc], [x + 6 * sc, y - 20 * sc], [x + 8 * sc, y + 20]], '#140c0c');
      cv.line(x + 7 * sc, y + 10, x + 10 * sc, y - 60 * sc, 1.6, '#2a1a14');
      cv.poly([[x + 10 * sc, y - 60 * sc], [x + 8 * sc, y - 52 * sc], [x + 12 * sc, y - 52 * sc]], '#b8b8c0');
      if (i % 4 === 1) glow(cv, 6, 1, (L) => L.circle(x - 10 * sc, y - 34 * sc, 4, '#ffb040'));
    }
    cv.poly([[20, 120], [20, 60], [60, 70], [20, 80]], '#8a1a14');
    cv.line(20, 190, 20, 58, 2, '#3a2010');
    vignette(cv, 0.45);
  };
  THREAT.wild_hunt = (cv, seed) => {
    sky(cv, seed, 'night', { clouds: 0.5, stars: 60, moon: [200, 50, 24, '#dff4ff'] });
    trees(cv, seed, 208, 14, '#081410', 90);
    const rider = (x, y, s, a) => {
      glow(cv, 8, 0.8 * a, (L) => L.ellipse(x, y, 40 * s, 24 * s, '#7fffd0'));
      cv.blob(transform([[-30, 0], [-10, -12], [24, -10], [36, 0], [30, 14], [-26, 12]], { x, y, s }), '#9fffe0', 0.5 * a);
      cv.blob(transform([[-4, -12], [0, -40], [8, -40], [10, -12]], { x, y, s }), '#bfffea', 0.6 * a);
      cv.line(x + 4 * s, y - 40 * s, x - 8 * s, y - 62 * s, 1.5, '#dfffee', 0.7 * a);
      cv.line(x + 4 * s, y - 40 * s, x + 16 * s, y - 62 * s, 1.5, '#dfffee', 0.7 * a);
    };
    rider(70, 120, 1.1, 1); rider(150, 100, 0.8, 0.8); rider(210, 140, 0.9, 0.9);
    for (let i = 0; i < 5; i++) { const x = 40 + i * 40; glow(cv, 3, 1, (L) => L.line(x, 40 + i * 8, x + 30, 70 + i * 8, 1.4, '#bfffe8')); }
    mistBand(cv, seed, 200, 30, '#9fe8d0', 0.5);
    vignette(cv, 0.5);
  };
  THREAT.blight = (cv, seed) => {
    sky(cv, seed, 'forest', { clouds: 0.5 });
    cv.fill(() => [90, 110, 30, 0.35], 'multiply');
    hills(cv, seed, 190, 24, '#2a2414');
    const tree = (x, y, s) => {
      cv.line(x, y, x - 4 * s, y - 70 * s, 7 * s, '#1a140c', 1, undefined, 3 * s);
      for (const [a, l] of [[-0.8, 40], [0.6, 36], [-0.3, 30], [1.1, 26]]) cv.curve([[x - 3 * s, y - 50 * s], [x + Math.sin(a) * l * 0.6 * s, y - (50 + l * 0.5) * s], [x + Math.sin(a) * l * s, y - (58 + l * 0.8) * s]], 2.4 * s, '#1a140c', 1, undefined, 0.5);
    };
    tree(70, 200, 1.4); tree(190, 196, 1.1);
    mistBand(cv, seed, 170, 50, '#b8e060', 0.7);
    const r = rng(seed);
    for (let i = 0; i < 20; i++) cv.circle(r() * 256, 120 + r() * 80, 1 + r() * 2, '#d8ff70', 0.6);
    vignette(cv, 0.5);
  };

  function renderThreat(id) {
    const draw = THREAT[id];
    if (!draw) throw new Error(`no design for threat ${id}`);
    const cv = new Canvas(CW, CH, SPECS.cards.k);
    draw(cv, hash(`threat:${id}`));
    return cv;
  }

  function renderCard(key) {
    const draw = CARD[key];
    if (!draw) throw new Error(`no design for card ${key}`);
    const cv = new Canvas(CW, CH, SPECS.cards.k);
    draw(cv, hash(`card:${key}`));
    return cv;
  }

  // ═══════════════════════ ฮีโร่ ═══════════════════════

  const FACTION = {
    crown: { glow: '#ffd27a', sky: 'dusk' },
    coven: { glow: '#b46aff', sky: 'violet' },
    avalon: { glow: '#7fe0ff', sky: 'lake' },
    grail: { glow: '#fff0b0', sky: 'grail' },
  };

  const SKIN = { fair: '#f0cdb0', light: '#e8bc98', tan: '#c99670', dark: '#8a5a3c', pale: '#e6dcd6', green: '#6f9a4a' };

  const HERO = {
    arthur: { f: 'crown', scene: 'castle', skin: 'light', hair: '#6a3f22', style: 'short', beard: 'short', eyes: '#4a6a9a', brow: 'noble', head: 'crown', attire: 'plate', main: '#c8a04a', trim: '#2a4a9a', cape: '#a0202a', back: 'excalibur' },
    lancelot: { f: 'crown', scene: 'lake', skin: 'fair', hair: '#1e1612', style: 'wavy', beard: 'none', eyes: '#3a5a7a', brow: 'noble', attire: 'plate', main: '#b8c4d4', trim: '#2a5aa8', cape: '#1e3a78', back: 'sword' },
    gawain: { f: 'crown', scene: 'sun', skin: 'tan', hair: '#e0a040', style: 'short', beard: 'short', eyes: '#8a5a20', brow: 'bold', attire: 'plate', main: '#d8a038', trim: '#ffdf8a', cape: '#d8661a', back: 'sword', halo: '#ffd070' },
    bedivere: { f: 'crown', scene: 'castle', skin: 'light', hair: '#7a6a5a', style: 'short', beard: 'full', eyes: '#5a7a6a', brow: 'calm', attire: 'plate', main: '#9aa4b0', trim: '#5a7aa0', cape: '#3a4a6a', front: 'silverhand' },
    kay: { f: 'crown', scene: 'hall', skin: 'light', hair: '#5a3a22', style: 'receding', beard: 'mustache', eyes: '#5a4a3a', brow: 'stern', attire: 'tunic', main: '#7a2a2a', trim: '#d9a441', cape: '#4a2a1a', front: 'keys' },
    gareth: { f: 'crown', scene: 'meadow', skin: 'fair', hair: '#e8c070', style: 'wavy', beard: 'none', eyes: '#4a7ab0', brow: 'soft', attire: 'plate', main: '#e6e8ee', trim: '#3a6ac8', cape: '#3a6ac8', front: 'shield' },
    guinevere: { f: 'crown', scene: 'castle', skin: 'fair', female: true, hair: '#9a3a1a', style: 'long', eyes: '#3a7a4a', brow: 'soft', head: 'tiara', attire: 'dress', main: '#2a6a4a', trim: '#e0b84a', front: 'rose', lips: '#c0404a' },

    mordred: { f: 'coven', scene: 'storm', skin: 'pale', hair: '#141018', style: 'slick', beard: 'goatee', eyes: '#8a2a2a', brow: 'angry', attire: 'plate', main: '#3a2a44', trim: '#8a3ab0', cape: '#1a1020', back: 'venomsword' },
    morgan: { f: 'coven', scene: 'eclipse', skin: 'pale', female: true, hair: '#120a18', style: 'long', eyes: '#8a3ad8', brow: 'arched', head: 'circlet', gem: '#b040ff', attire: 'robe', main: '#3a1a4a', trim: '#b88ad8', front: 'orb', orb: '#b46aff', lips: '#6a1a3a' },
    agravain: { f: 'coven', scene: 'storm', skin: 'light', hair: '#2a1e18', style: 'short', beard: 'thin', eyes: '#5a6a3a', brow: 'sly', head: 'hood', hood: '#2a3a2a', attire: 'leather', main: '#2a3a2a', trim: '#8a8a5a', front: 'dagger' },
    black_knight: { f: 'coven', scene: 'storm', helm: 'greathelm', visor: '#ff3a2a', attire: 'plate', main: '#26222c', trim: '#6a1a1a', cape: '#140c10', back: 'greatsword' },
    lot: { f: 'coven', scene: 'snow', skin: 'light', hair: '#a8a8a8', style: 'long', beard: 'long', beardColor: '#b8b8b8', eyes: '#4a5a6a', brow: 'stern', head: 'ironcrown', attire: 'fur', main: '#4a3a4a', trim: '#c8c0b0', cape: '#6a5a4a' },
    balin: { f: 'coven', scene: 'forest', skin: 'tan', hair: '#a8401a', style: 'wild', beard: 'full', eyes: '#3a5a3a', brow: 'angry', attire: 'mail', main: '#7a7a80', trim: '#8a2a1a', cape: '#4a1a14', back: 'twinswords' },
    morgause: { f: 'coven', scene: 'eclipse', skin: 'fair', female: true, hair: '#5a0a14', style: 'long', eyes: '#aa3a3a', brow: 'arched', head: 'veil', veil: '#1a0a14', attire: 'dress', main: '#5a0a1a', trim: '#d8a0a0', front: 'threads', lips: '#8a1a2a' },

    merlin: { f: 'avalon', scene: 'stars', skin: 'light', hair: '#e8e8f0', style: 'long', beard: 'wizard', beardColor: '#eceef4', eyes: '#3a8ad8', brow: 'bushy', head: 'wizard', hat: '#23306a', attire: 'robe', main: '#23306a', trim: '#d8c070', back: 'staff', orb: '#5fd0ff' },
    nimue: { f: 'avalon', scene: 'lake', skin: 'pale', female: true, hair: '#b8d8f0', style: 'flowing', eyes: '#2aa8c8', brow: 'soft', head: 'pearls', attire: 'dress', main: '#2a8aa0', trim: '#e0f4ff', front: 'waterorb', orb: '#7fe0ff', lips: '#c07080' },
    viviane: { f: 'avalon', scene: 'mist', skin: 'fair', female: true, hair: '#f0f0f0', style: 'long', eyes: '#3aa8a0', brow: 'calm', head: 'hood', hood: '#dfeeee', attire: 'robe', main: '#e8f4f2', trim: '#3aa8a0', front: 'lotus', lips: '#b07070' },
    tristan: { f: 'avalon', scene: 'sea', skin: 'fair', hair: '#6a4022', style: 'wavy', beard: 'stubble', eyes: '#3a6a8a', brow: 'soft', attire: 'leather', main: '#3a5a3a', trim: '#c8a060', cape: '#2a4a6a', back: 'bow' },
    isolde: { f: 'avalon', scene: 'sea', skin: 'fair', female: true, hair: '#f2d27a', style: 'braid', eyes: '#4a8ac8', brow: 'soft', head: 'circlet', gem: '#e05a8a', attire: 'dress', main: '#f0eef4', trim: '#d8a0c0', front: 'philter', lips: '#d06a7a' },
    taliesin: { f: 'avalon', scene: 'forest', skin: 'tan', hair: '#3a2414', style: 'curly', beard: 'short', eyes: '#6a8a3a', brow: 'soft', attire: 'robe', main: '#2e6a3a', trim: '#e0c070', front: 'harp' },

    galahad: { f: 'grail', scene: 'grail', skin: 'fair', hair: '#f0d890', style: 'wavy', beard: 'none', eyes: '#5a9ad8', brow: 'soft', attire: 'plate', main: '#f0f0f4', trim: '#e0b84a', cape: '#e8e0d0', front: 'grail', halo: '#fff4c0' },
    percival: { f: 'grail', scene: 'meadow', skin: 'light', hair: '#8a5a2a', style: 'wavy', beard: 'none', eyes: '#6a8a4a', brow: 'soft', attire: 'tunic', main: '#e8e0d4', trim: '#b82a2a', cape: '#8a2a2a', back: 'spear' },
    bors: { f: 'grail', scene: 'chapel', skin: 'tan', hair: '#3a2a1a', style: 'bald', beard: 'full', eyes: '#5a4a3a', brow: 'calm', attire: 'monk', main: '#6a4a2a', trim: '#a8a8b0', front: 'beads' },
    green_knight: { f: 'grail', scene: 'forest', skin: 'green', hair: '#2a5a1a', style: 'wild', beard: 'long', beardColor: '#3a6a22', eyes: '#e8d040', brow: 'bushy', head: 'holly', attire: 'plate', main: '#3a6a2a', trim: '#c8a040', cape: '#1e4a18', back: 'axe' },
    questing_beast: { f: 'grail', scene: 'abyss', beast: true },
  };

  function heroScene(cv, h, seed) {
    const sc = h.scene;
    switch (sc) {
      case 'castle':
        sky(cv, seed, 'dusk', { clouds: 0.45, sun: [200, 150, 16] });
        hills(cv, seed, 210, 30, '#3a2238');
        castle(cv, 60, 206, 0.9, '#2a1830', 1, '#ffc060');
        break;
      case 'lake':
        sky(cv, seed, 'lake', { clouds: 0.3, stars: 40, moon: [196, 56, 16] });
        hills(cv, seed, 176, 36, '#12283a');
        water(cv, seed, 176, '#3a6a88', '#0c1c2c', '#dff4ff');
        mistBand(cv, seed, 176, 24, '#dff0f4', 0.6);
        break;
      case 'sun':
        sky(cv, seed, 'sun', { clouds: 0.4, sun: [128, 96, 40] });
        hills(cv, seed, 214, 30, '#5a2a10');
        break;
      case 'hall': {
        sky(cv, seed, 'hall', { clouds: 0.1 });
        for (const x of [36, 220]) {
          cv.rect(x - 16, 0, 32, 256, lit('#3a2414', [x - 16, 0, 32, 256]));
          glow(cv, 18, 1, (L) => L.ellipse(x, 90, 16, 24, '#ff9a3a'));
          cv.ellipse(x, 92, 5, 10, '#ffe0a0');
        }
        cv.poly([[70, 0], [186, 0], [186, 120], [128, 150], [70, 120]], '#6a1a1a', 0.7);
        break;
      }
      case 'meadow':
        sky(cv, seed, 'dawn', { clouds: 0.5 });
        hills(cv, seed, 200, 40, '#5a7a4a');
        hills(cv, seed + 1, 230, 26, '#3a5a2e');
        break;
      case 'storm':
        sky(cv, seed, 'storm', { clouds: 0.7 });
        glow(cv, 6, 1, (L) => L.curve([[190, 0], [176, 50], [196, 80], [170, 140]], 2, '#c8a8ff'));
        hills(cv, seed, 214, 36, '#140e18');
        castle(cv, 196, 214, 0.7, '#0c080e', 1);
        break;
      case 'eclipse':
        sky(cv, seed, 'violet', { clouds: 0.45, stars: 60, moon: [128, 80, 44, '#ffd0a0'], eclipse: true });
        glow(cv, 24, 0.7, (L) => L.circle(128, 80, 50, '#b040ff', 0.6));
        break;
      case 'stars':
        sky(cv, seed, 'night', { clouds: 0.25, stars: 140 });
        runeCircle(cv, 128, 96, 100, '#6fb8ff', 0.35, seed);
        break;
      case 'mist':
        sky(cv, seed, 'mist', { clouds: 0.5 });
        trees(cv, seed, 220, 18, '#2a4a48', 90, 0.5);
        mistBand(cv, seed, 190, 60, '#eef8f6', 0.8);
        break;
      case 'sea':
        sky(cv, seed, 'sea', { clouds: 0.45 });
        water(cv, seed, 186, '#3a6a98', '#12243a', '#fff0d0');
        cv.blob([[170, 256], [180, 170], [214, 150], [256, 160], [256, 256]], '#2a2430');
        break;
      case 'forest':
        sky(cv, seed, 'forest', { clouds: 0.3 });
        trees(cv, seed, 236, 18, '#122614', 120, 0.9);
        mistBand(cv, seed, 200, 40, '#aac8a0', 0.4);
        glow(cv, 26, 0.6, (L) => L.ellipse(128, 60, 60, 50, '#c8f0a0'));
        break;
      case 'snow': {
        sky(cv, seed, 'snow', { clouds: 0.5 });
        hills(cv, seed, 200, 70, '#8a9ab0', 1, 0.012);
        hills(cv, seed + 3, 226, 40, '#dfe6ee');
        const r = rng(seed);
        for (let i = 0; i < 70; i++) cv.circle(r() * 256, r() * 256, 0.6 + r() * 1.2, '#ffffff', 0.7);
        break;
      }
      case 'grail':
        sky(cv, seed, 'grail', { clouds: 0.3 });
        glow(cv, 14, 0.8, (L) => { for (let i = -6; i <= 6; i++) L.poly([[128 + i * 4, -20], [128 + i * 34 - 10, 260], [128 + i * 34 + 10, 260]], '#fff8d8', 0.4); });
        break;
      case 'chapel': {
        sky(cv, seed, 'hall', { clouds: 0.1 });
        const win = [[88, 180], [88, 60], [128, 20], [168, 60], [168, 180]];
        const cols = ['#c83a3a', '#3a6ac8', '#e8c040', '#3aa860'];
        cv.poly(win, (x, y) => mix(cols[(Math.floor(x / 14) + Math.floor(y / 18)) % 4], '#fff4d0', 0.35));
        for (let x = 88; x <= 168; x += 14) cv.line(x, 30, x, 180, 1.2, '#2a1a10');
        for (let y = 40; y <= 180; y += 18) cv.line(88, y, 168, y, 1.2, '#2a1a10');
        glow(cv, 18, 0.6, (L) => L.poly(win, '#ffe6b0'));
        break;
      }
      case 'abyss':
        sky(cv, seed, 'abyss', { clouds: 0.5, stars: 30 });
        mistBand(cv, seed, 230, 50, '#5a1a3a', 0.8);
        break;
      default:
        sky(cv, seed, FACTION[h.f].sky, { clouds: 0.4 });
    }
  }

  // ── ส่วนประกอบของร่าง ──
  const HX = 128; const HY = 112; // ศูนย์กลางใบหน้า

  function backItem(L, h) {
    switch (h.back) {
      case 'excalibur': sword(L, 208, 250, 178, 30, { w: 7, glow: '#fff0b0', gem: '#3a7ad8', runes: '#ffe08a' }); break;
      case 'sword': sword(L, 204, 246, 190, 46, { w: 6 }); break;
      case 'venomsword': sword(L, 50, 250, 70, 40, { w: 6, blade: '#b8c8b0', glow: '#6aff6a', glowA: 0.5, gold: '#6a4a8a' }); break;
      case 'greatsword': sword(L, 212, 256, 196, 14, { w: 9, blade: '#6a6a74', gold: '#4a3a3a', hilt: '#1a1010' }); break;
      case 'twinswords':
        sword(L, 46, 250, 84, 30, { w: 5.5 });
        sword(L, 210, 250, 172, 30, { w: 5.5, blade: '#c8ccd4' });
        break;
      case 'staff': staff(L, 214, 256, 206, 56, h.orb || '#5fd0ff', { w: 6 }); break;
      case 'bow':
        L.curve([[200, 30], [222, 90], [226, 150], [206, 222]], 5, lit('#8a5a2a', [200, 30, 26, 192]));
        L.line(200, 30, 206, 222, 1, '#f4eed8');
        break;
      case 'spear': spear(L, 212, 256, 196, 22, { w: 5 }); break;
      case 'axe':
        L.line(44, 256, 60, 40, 7, lit('#5a3a1a', [40, 40, 24, 216]));
        L.blob([[60, 44], [30, 30], [16, 60], [24, 96], [56, 80], [64, 60]], lit('#a8b4a0', [16, 30, 48, 66], { spec: 0.6 }));
        L.curve([[26, 36], [16, 62], [26, 94]], 2, '#e8f0e0');
        break;
      default: break;
    }
  }

  function capeShape(L, h) {
    if (!h.cape) return;
    L.blob([[40, 256], [52, 196], [80, 172], [176, 172], [204, 196], [216, 256]], lit(h.cape, [40, 172, 176, 84], { hi: 0.2, lo: -0.5 }));
  }

  function body(L, h) {
    const box = [30, 168, 196, 88];
    const main = h.main;
    const shoulders = [[22, 256], [30, 214], [58, 184], [100, 172], [156, 172], [198, 184], [226, 214], [234, 256]];
    switch (h.attire) {
      case 'plate': {
        L.blob(shoulders, lit(main, box, { spec: 0.35 }));
        // เกราะอก
        L.blob([[92, 256], [90, 200], [104, 180], [152, 180], [166, 200], [164, 256]], lit(main, [90, 180, 76, 76], { hi: 0.45, lo: -0.3, spec: 0.7 }));
        L.curve([[128, 184], [128, 256]], 1.6, shade(main, -0.35), 0.8);
        for (const side of [-1, 1]) {
          const cx = 128 + side * 70;
          L.ellipse(cx, 200, 38, 24, lit(main, [cx - 38, 176, 76, 48], { spec: 0.8 }), 1, undefined, side * 0.25);
          L.curve([[cx - 30, 206 + side * 4], [cx, 214], [cx + 30, 206 - side * 4]], 3, h.trim, 0.9);
          L.curve([[cx - 34, 196 + side * 6], [cx, 184], [cx + 34, 196 - side * 6]], 1.4, shade(main, 0.5), 0.8);
        }
        L.curve([[98, 214], [128, 226], [158, 214]], 3, h.trim);
        break;
      }
      case 'mail': {
        L.blob(shoulders, textured(lit(main, box), makeNoise(99), 0.6, 0.18));
        L.blob([[80, 256], [84, 196], [172, 196], [176, 256]], lit(h.trim, [80, 196, 96, 60]));
        L.rect(80, 218, 96, 7, '#3a2414');
        L.rect(122, 216, 12, 11, lit('#d9a441', [122, 216, 12, 11], { spec: 0.8 }));
        break;
      }
      case 'robe': {
        L.blob(shoulders, lit(main, box, { hi: 0.25 }));
        L.blob([[96, 256], [100, 184], [128, 214], [156, 184], [160, 256]], lit(shade(main, -0.25), [96, 184, 64, 72]));
        L.curve([[98, 180], [128, 216], [158, 180]], 4, h.trim);
        L.curve([[100, 256], [104, 186]], 3, h.trim, 0.8);
        L.curve([[156, 256], [152, 186]], 3, h.trim, 0.8);
        if (h.id === 'merlin') stars(L, 7, 26, [30, 190, 196, 66]);
        break;
      }
      case 'dress': {
        L.blob([[30, 256], [40, 214], [70, 190], [100, 182], [156, 182], [186, 190], [216, 214], [226, 256]], lit(main, box, { hi: 0.3, spec: 0.3 }));
        L.blob([[92, 184], [128, 214], [164, 184], [156, 180], [128, 196], [100, 180]], lit(h.trim, [92, 180, 72, 34]));
        L.curve([[70, 192], [128, 230], [186, 192]], 2.4, h.trim, 0.8);
        break;
      }
      case 'leather': {
        L.blob(shoulders, lit(main, box));
        L.blob([[96, 256], [100, 186], [156, 186], [160, 256]], lit(shade(main, 0.15), [96, 186, 64, 70]));
        for (let y = 196; y < 256; y += 12) L.line(116, y, 140, y + 4, 1.6, shade(main, -0.4), 0.8);
        L.line(60, 188, 180, 250, 7, lit('#5a3a1a', [60, 188, 120, 62]));
        break;
      }
      case 'tunic': {
        L.blob(shoulders, lit(main, box));
        L.poly([[106, 256], [110, 196], [146, 196], [150, 256]], h.trim, 0.9);
        L.poly([[100, 214], [156, 214], [156, 226], [100, 226]], h.trim, 0.9);
        L.curve([[96, 182], [128, 196], [160, 182]], 3, shade(h.trim, 0.2));
        break;
      }
      case 'fur': {
        L.blob(shoulders, lit(main, box));
        const noise = makeNoise(7);
        L.blob([[24, 230], [36, 196], [76, 176], [128, 188], [180, 176], [220, 196], [232, 230], [180, 214], [128, 222], [76, 214]], textured(lit(h.trim, [24, 176, 208, 54]), noise, 0.3, 0.35));
        break;
      }
      case 'monk': {
        L.blob(shoulders, textured(lit('#8a8a94', box), makeNoise(5), 0.6, 0.2));
        L.blob([[46, 256], [60, 196], [100, 180], [128, 190], [156, 180], [196, 196], [210, 256]], lit(main, box, { hi: 0.2 }));
        L.blob([[96, 180], [128, 172], [160, 180], [150, 198], [128, 204], [106, 198]], lit(shade(main, -0.2), [96, 172, 64, 32]));
        break;
      }
      default:
        L.blob(shoulders, lit(main || '#666', box));
    }
  }

  function neck(L, skin) {
    L.poly([[112, 150], [144, 150], [148, 186], [128, 194], [108, 186]], lit(shade(skin, -0.12), [108, 150, 40, 44], { hi: 0.05, lo: -0.3 }));
  }

  function headShape(h) {
    if (h.female) return [[HX, HY - 50], [HX + 30, HY - 40], [HX + 36, HY - 8], [HX + 32, HY + 20], [HX + 18, HY + 40], [HX, HY + 46], [HX - 18, HY + 40], [HX - 32, HY + 20], [HX - 36, HY - 8], [HX - 30, HY - 40]];
    return [[HX, HY - 52], [HX + 32, HY - 42], [HX + 38, HY - 8], [HX + 36, HY + 18], [HX + 24, HY + 40], [HX, HY + 48], [HX - 24, HY + 40], [HX - 36, HY + 18], [HX - 38, HY - 8], [HX - 32, HY - 42]];
  }

  function hairBack(L, h) {
    const c = h.hair;
    const sh = lit(c, [70, 50, 116, 180], { hi: 0.25, lo: -0.45 });
    switch (h.style) {
      case 'long': case 'flowing':
        L.blob([[HX - 44, HY - 30], [HX, HY - 62], [HX + 44, HY - 30], [HX + 52, HY + 40], [HX + 60, HY + 100], [HX + 30, HY + 90], [HX - 30, HY + 90], [HX - 60, HY + 100], [HX - 52, HY + 40]], sh);
        if (h.style === 'flowing') {
          L.blob([[HX + 40, HY + 20], [HX + 90, HY + 40], [HX + 110, HY + 100], [HX + 70, HY + 110], [HX + 50, HY + 70]], sh, 0.9);
          L.blob([[HX - 40, HY + 20], [HX - 88, HY + 50], [HX - 104, HY + 110], [HX - 64, HY + 110], [HX - 50, HY + 70]], sh, 0.9);
        }
        break;
      case 'braid':
        L.blob([[HX - 42, HY - 30], [HX, HY - 60], [HX + 42, HY - 30], [HX + 46, HY + 30], [HX - 46, HY + 30]], sh);
        for (let i = 0; i < 7; i++) L.ellipse(HX + 44 + i * 3, HY + 30 + i * 13, 9 - i * 0.6, 8, lit(c, [HX + 34, HY + 20 + i * 13, 22, 16]));
        break;
      case 'wild':
        L.blob([[HX - 52, HY - 20], [HX - 30, HY - 64], [HX + 10, HY - 70], [HX + 50, HY - 44], [HX + 58, HY + 10], [HX + 52, HY + 50], [HX - 52, HY + 50], [HX - 60, HY + 10]], sh);
        break;
      case 'curly':
        for (let i = 0; i < 14; i++) { const t = (i / 13) * PI + PI; L.circle(HX + Math.cos(t) * 42, HY - 6 + Math.sin(t) * 50, 14, sh); }
        L.circle(HX - 40, HY + 20, 14, sh); L.circle(HX + 40, HY + 20, 14, sh);
        break;
      default: break;
    }
  }

  function hairFront(L, h) {
    const c = h.hair;
    const sh = lit(c, [80, 50, 96, 60], { hi: 0.3, lo: -0.35, spec: 0.3 });
    const strands = (pts, n, w = 1.2) => {
      for (let i = 0; i < n; i++) {
        const dx = (i - n / 2) * 5;
        L.curve(pts.map(([x, y], j) => [x + dx * (1 - j * 0.2), y]), w, shade(c, i % 2 ? 0.35 : -0.35), 0.5);
      }
    };
    switch (h.style) {
      case 'bald':
        L.ellipse(HX - 12, HY - 36, 12, 6, '#ffffff', 0.2);
        L.blob([[HX - 38, HY - 4], [HX - 36, HY - 20], [HX - 30, HY - 10]], c, 0.8);
        L.blob([[HX + 38, HY - 4], [HX + 36, HY - 20], [HX + 30, HY - 10]], c, 0.8);
        return;
      case 'receding':
        L.blob([[HX - 38, HY - 2], [HX - 36, HY - 36], [HX - 18, HY - 50], [HX - 10, HY - 40], [HX - 28, HY - 26], [HX - 30, HY - 4]], sh);
        L.blob([[HX + 38, HY - 2], [HX + 36, HY - 36], [HX + 18, HY - 50], [HX + 10, HY - 40], [HX + 28, HY - 26], [HX + 30, HY - 4]], sh);
        return;
      case 'slick':
        L.blob([[HX - 38, HY - 10], [HX - 34, HY - 44], [HX, HY - 58], [HX + 34, HY - 44], [HX + 38, HY - 10], [HX + 30, HY - 32], [HX + 4, HY - 40], [HX - 26, HY - 32]], sh);
        strands([[HX - 20, HY - 36], [HX, HY - 52], [HX + 26, HY - 44]], 6, 1);
        return;
      case 'short':
        L.blob([[HX - 40, HY - 4], [HX - 38, HY - 40], [HX - 12, HY - 60], [HX + 22, HY - 58], [HX + 40, HY - 38], [HX + 40, HY - 4], [HX + 32, HY - 26], [HX + 8, HY - 36], [HX - 18, HY - 32], [HX - 32, HY - 24]], sh);
        strands([[HX - 26, HY - 30], [HX - 6, HY - 50], [HX + 20, HY - 48]], 7, 1);
        return;
      case 'wavy': case 'long': case 'flowing': case 'braid':
        L.blob([[HX - 42, HY + 4], [HX - 40, HY - 38], [HX - 10, HY - 60], [HX + 24, HY - 58], [HX + 42, HY - 36], [HX + 42, HY + 4], [HX + 34, HY - 18], [HX + 16, HY - 36], [HX - 6, HY - 30], [HX - 26, HY - 34], [HX - 34, HY - 16]], sh);
        strands([[HX - 30, HY - 30], [HX - 8, HY - 52], [HX + 22, HY - 50], [HX + 36, HY - 24]], 8, 1);
        if (h.style !== 'wavy') {
          L.curve([[HX - 38, HY - 10], [HX - 44, HY + 30], [HX - 40, HY + 70]], 8, sh, 1, undefined, 4);
          L.curve([[HX + 38, HY - 10], [HX + 44, HY + 30], [HX + 40, HY + 70]], 8, sh, 1, undefined, 4);
        }
        return;
      case 'wild':
        for (let i = 0; i < 9; i++) {
          const t = -PI * 0.95 + (i / 8) * PI * 0.9;
          L.poly([[HX + Math.cos(t) * 30, HY - 20 + Math.sin(t) * 34], [HX + Math.cos(t) * 56, HY - 22 + Math.sin(t) * 50], [HX + Math.cos(t + 0.2) * 30, HY - 20 + Math.sin(t + 0.2) * 34]], sh);
        }
        L.blob([[HX - 40, HY - 6], [HX - 36, HY - 44], [HX, HY - 58], [HX + 36, HY - 44], [HX + 40, HY - 6], [HX + 20, HY - 34], [HX - 20, HY - 34]], sh);
        return;
      case 'curly':
        for (let i = 0; i < 9; i++) { const t = -PI + (i / 8) * PI; L.circle(HX + Math.cos(t) * 32, HY - 22 + Math.sin(t) * 34, 11, sh); }
        return;
      default: break;
    }
  }

  function face(L, h) {
    const skin = SKIN[h.skin] || h.skin;
    const hs = headShape(h);
    // ใบหู
    if (!['long', 'flowing', 'braid'].includes(h.style) && h.head !== 'hood') {
      for (const s of [-1, 1]) L.ellipse(HX + s * 38, HY + 2, 7, 12, lit(shade(skin, -0.08), [HX + s * 38 - 7, HY - 10, 14, 24]));
    }
    // ผิวหน้า + เงา/ไฮไลต์นุ่มที่ถูกตัดตามรูปหน้า
    const FL = L.layer();
    FL.blob(hs, lit(skin, [HX - 38, HY - 52, 76, 100], { hi: 0.16, lo: -0.3 }));
    const dark = shade(skin, -0.55);
    const S = L.layer();
    S.ellipse(HX + 30, HY + 18, 16, 34, dark, 0.45);
    S.ellipse(HX, HY + 52, 36, 12, dark, 0.5);
    S.ellipse(HX, HY - 50, 44, 14, dark, 0.45);
    for (const sx of [-1, 1]) S.ellipse(HX + sx * 15, HY - 4, 12, 7, dark, 0.28);
    S.ellipse(HX + 22, HY + 14, 8, 12, dark, 0.2);
    S.blur(6);
    S.mask(FL);
    const Hl = L.layer();
    Hl.ellipse(HX - 18, HY + 12, 9, 7, '#ffffff', 0.22);
    Hl.ellipse(HX - 6, HY - 30, 16, 8, '#ffffff', 0.18);
    Hl.line(HX + 1, HY - 2, HX + 2, HY + 18, 2.5, '#ffffff', 0.22);
    Hl.blur(4);
    Hl.mask(FL);
    FL.draw(S);
    FL.draw(Hl);
    L.draw(FL);
    // แก้ม/เงาใต้คาง
    L.ellipse(HX - 20, HY + 18, 10, 6, h.female ? '#ff8a8a' : shade(skin, -0.1), h.female ? 0.25 : 0.2);
    L.ellipse(HX + 20, HY + 18, 10, 6, h.female ? '#ff8a8a' : shade(skin, -0.1), h.female ? 0.25 : 0.2);
    // ตา
    const eyeC = h.eyes || '#4a5a6a';
    for (const s of [-1, 1]) {
      const ex = HX + s * 15; const ey = HY + 2;
      L.poly(spline([[ex - 9, ey], [ex - 2, ey - 5], [ex + 9, ey - 1], [ex + 1, ey + 4]], true, 6), '#f8f4f0');
      L.circle(ex + s * 0.5, ey - 0.3, 4.2, radial(ex, ey - 1.5, 5, [shade(eyeC, 0.4), eyeC, shade(eyeC, -0.6)]));
      L.circle(ex + s * 0.5, ey - 0.3, 1.9, '#0a0608');
      L.circle(ex - 1.4, ey - 2, 1.1, '#ffffff', 0.95);
      L.curve([[ex - 10, ey + 0.5], [ex - 2, ey - 6], [ex + 10, ey - 1.5]], h.female ? 2.2 : 1.6, '#2a1a14');
      if (h.female) L.line(ex + s * 9, ey - 1.5, ex + s * 13, ey - 4.5, 1.4, '#2a1a14');
      L.curve([[ex - 7, ey + 4], [ex, ey + 5.5], [ex + 7, ey + 4]], 0.8, shade(skin, -0.3), 0.6);
    }
    // คิ้ว
    const bc = h.style === 'bald' ? '#3a2a20' : shade(h.hair || '#3a2a20', -0.1);
    const browW = h.brow === 'bushy' ? 4.2 : h.female ? 1.8 : 3;
    for (const s of [-1, 1]) {
      const ex = HX + s * 15;
      let pts;
      switch (h.brow) {
        case 'angry': pts = [[ex - s * 11, HY - 13], [ex, HY - 11], [ex + s * 9, HY - 6]]; break;
        case 'sly': pts = [[ex - s * 11, HY - 10], [ex, HY - 12], [ex + s * 9, HY - 8 - s * 3]]; break;
        case 'arched': pts = [[ex - s * 11, HY - 8], [ex - s * 2, HY - 15], [ex + s * 9, HY - 10]]; break;
        case 'stern': pts = [[ex - s * 11, HY - 10], [ex, HY - 11], [ex + s * 9, HY - 8]]; break;
        case 'bold': pts = [[ex - s * 12, HY - 9], [ex, HY - 13], [ex + s * 10, HY - 10]]; break;
        default: pts = [[ex - s * 11, HY - 9], [ex, HY - 13], [ex + s * 9, HY - 11]];
      }
      if (s < 0) pts = pts.map(([x, y]) => [x, y]);
      L.curve(pts, browW, bc, 1, undefined, browW * 0.5);
    }
    // จมูก
    L.curve([[HX + 2, HY + 4], [HX + 4, HY + 16], [HX + 1, HY + 22]], 1.6, shade(skin, -0.28), 0.8);
    L.ellipse(HX - 4, HY + 23, 3, 1.6, shade(skin, -0.4), 0.6);
    L.ellipse(HX + 5, HY + 23, 3, 1.6, shade(skin, -0.4), 0.6);
    L.ellipse(HX - 3, HY + 16, 2, 5, shade(skin, 0.25), 0.4);
    // ปาก
    const lips = h.lips || shade(skin, -0.35);
    if (h.female) {
      L.blob([[HX - 10, HY + 32], [HX - 3, HY + 29], [HX, HY + 30], [HX + 3, HY + 29], [HX + 10, HY + 32], [HX, HY + 37]], lips);
      L.ellipse(HX - 1, HY + 34, 3, 1, '#ffffff', 0.35);
    } else {
      L.curve([[HX - 9, HY + 32], [HX, HY + 33], [HX + 9, HY + 32]], 1.8, shade(skin, -0.5));
      L.ellipse(HX, HY + 35.5, 6, 2, shade(skin, -0.15), 0.6);
    }
    // หนวดเครา
    const bcol = h.beardColor || h.hair;
    const bsh = lit(bcol, [HX - 40, HY + 10, 80, 60], { hi: 0.25, lo: -0.4 });
    const must = (w) => { L.curve([[HX - 2, HY + 28], [HX - 12, HY + 29], [HX - 18, HY + 36]], w, bsh, 1, undefined, 1); L.curve([[HX + 2, HY + 28], [HX + 12, HY + 29], [HX + 18, HY + 36]], w, bsh, 1, undefined, 1); };
    switch (h.beard) {
      case 'short':
        L.blob([[HX - 36, HY + 6], [HX - 30, HY + 34], [HX - 14, HY + 50], [HX, HY + 54], [HX + 14, HY + 50], [HX + 30, HY + 34], [HX + 36, HY + 6], [HX + 26, HY + 30], [HX + 12, HY + 40], [HX - 12, HY + 40], [HX - 26, HY + 30]], bsh, 0.95);
        must(4.5);
        break;
      case 'full':
        L.blob([[HX - 38, HY + 2], [HX - 34, HY + 40], [HX - 16, HY + 64], [HX, HY + 70], [HX + 16, HY + 64], [HX + 34, HY + 40], [HX + 38, HY + 2], [HX + 26, HY + 30], [HX + 10, HY + 38], [HX - 10, HY + 38], [HX - 26, HY + 30]], bsh);
        must(5);
        break;
      case 'long': case 'wizard': {
        const len = h.beard === 'wizard' ? 120 : 92;
        L.blob([[HX - 38, HY + 2], [HX - 36, HY + 44], [HX - 22, HY + len * 0.8], [HX, HY + len], [HX + 22, HY + len * 0.8], [HX + 36, HY + 44], [HX + 38, HY + 2], [HX + 26, HY + 30], [HX + 10, HY + 38], [HX - 10, HY + 38], [HX - 26, HY + 30]], bsh);
        for (let i = 0; i < 9; i++) L.curve([[HX - 24 + i * 6, HY + 40], [HX - 20 + i * 5, HY + len * 0.6], [HX - 8 + i * 2, HY + len * 0.92]], 1, shade(bcol, i % 2 ? 0.3 : -0.3), 0.6);
        must(6);
        break;
      }
      case 'goatee':
        must(3);
        L.blob([[HX - 8, HY + 38], [HX + 8, HY + 38], [HX + 4, HY + 56], [HX, HY + 60], [HX - 4, HY + 56]], bsh);
        break;
      case 'thin':
        L.curve([[HX - 2, HY + 28], [HX - 14, HY + 30], [HX - 22, HY + 44]], 2, bsh, 1, undefined, 0.6);
        L.curve([[HX + 2, HY + 28], [HX + 14, HY + 30], [HX + 22, HY + 44]], 2, bsh, 1, undefined, 0.6);
        break;
      case 'mustache': must(5.5); break;
      case 'stubble': {
        const r = rng(hash('stub' + h.hair));
        for (let i = 0; i < 260; i++) {
          const a = r() * PI; const rr = 24 + r() * 16;
          const x = HX + Math.cos(a) * rr * 0.95; const y = HY + 12 + Math.sin(a) * rr;
          L.circle(x, y, 0.5, bcol, 0.35);
        }
        break;
      }
      default: break;
    }
  }

  function headwear(L, h) {
    switch (h.head) {
      case 'crown': case 'ironcrown': {
        const g = h.head === 'crown' ? '#e6b84a' : '#7a7680';
        const band = [[HX - 38, HY - 34], [HX + 38, HY - 34], [HX + 36, HY - 46], [HX - 36, HY - 46]];
        const pts = [[HX - 38, HY - 40]];
        for (let i = 0; i <= 8; i++) { const x = HX - 38 + i * 9.5; pts.push([x, HY - (i % 2 ? 50 : 70 - Math.abs(i - 4) * 3)]); }
        pts.push([HX + 38, HY - 40]);
        L.poly(pts, lit(g, [HX - 38, HY - 72, 76, 40], { spec: 0.9 }));
        L.poly(band, lit(g, [HX - 38, HY - 46, 76, 12], { spec: 0.9 }));
        for (const [x, c] of [[HX - 22, '#c8243a'], [HX, '#2a6ad8'], [HX + 22, '#2aa860']]) L.circle(x, HY - 40, 3.4, radial(x - 1, HY - 41, 4, ['#ffffff', c, shade(c, -0.5)]));
        for (let i = 0; i <= 8; i += 2) L.circle(HX - 38 + i * 9.5, HY - 70 + Math.abs(i - 4) * 3, 2.4, g);
        break;
      }
      case 'tiara': case 'circlet': {
        const g = h.head === 'tiara' ? '#e6c060' : '#c8c8d8';
        L.curve([[HX - 38, HY - 30], [HX, HY - 44], [HX + 38, HY - 30]], 3, lit(g, [HX - 38, HY - 46, 76, 18], { spec: 0.9 }));
        if (h.head === 'tiara') L.poly([[HX - 10, HY - 42], [HX, HY - 60], [HX + 10, HY - 42]], lit(g, [HX - 10, HY - 60, 20, 18], { spec: 0.9 }));
        const gem = h.gem || '#3aa860';
        glow(L, 4, 0.8, (G) => G.circle(HX, HY - 44, 5, gem));
        L.circle(HX, HY - 44, 3.6, radial(HX - 1, HY - 45, 4, ['#ffffff', gem, shade(gem, -0.5)]));
        break;
      }
      case 'pearls':
        for (let i = 0; i <= 12; i++) { const t = PI + (i / 12) * PI; L.circle(HX + Math.cos(t) * 40, HY - 26 + Math.sin(t) * 22, 3, radial(HX + Math.cos(t) * 40 - 1, HY - 27 + Math.sin(t) * 22, 3.4, ['#ffffff', '#dfe8f0', '#9aa8b8'])); }
        break;
      case 'hood': {
        const c = h.hood;
        L.blob([[HX - 56, HY + 70], [HX - 50, HY - 20], [HX - 30, HY - 60], [HX, HY - 72], [HX + 30, HY - 60], [HX + 50, HY - 20], [HX + 56, HY + 70], [HX + 40, HY + 40], [HX + 38, HY - 30], [HX, HY - 54], [HX - 38, HY - 30], [HX - 40, HY + 40]], lit(c, [HX - 56, HY - 72, 112, 142], { hi: 0.25, lo: -0.5 }));
        break;
      }
      case 'veil': {
        const c = h.veil;
        L.blob([[HX - 60, HY + 90], [HX - 48, HY - 30], [HX, HY - 66], [HX + 48, HY - 30], [HX + 60, HY + 90], [HX + 40, HY + 20], [HX + 36, HY - 36], [HX, HY - 52], [HX - 36, HY - 36], [HX - 40, HY + 20]], (x, y) => [...rgb(c), 0.85]);
        L.curve([[HX - 38, HY - 34], [HX, HY - 50], [HX + 38, HY - 34]], 2.4, '#c8a040');
        break;
      }
      case 'wizard': {
        const c = h.hat;
        L.blob([[HX - 62, HY - 34], [HX - 30, HY - 50], [HX - 10, HY - 96], [HX + 12, HY - 128], [HX + 40, HY - 132], [HX + 24, HY - 110], [HX + 28, HY - 56], [HX + 62, HY - 36], [HX, HY - 26]], lit(c, [HX - 62, HY - 132, 124, 106], { hi: 0.25, lo: -0.5 }));
        L.curve([[HX - 34, HY - 48], [HX, HY - 54], [HX + 34, HY - 48]], 5, h.trim || '#d8c070');
        stars(L, 11, 14, [HX - 30, HY - 110, 60, 56]);
        sparkle(L, HX + 4, HY - 80, 5, '#fff0b0');
        break;
      }
      case 'holly': {
        for (let i = 0; i < 11; i++) {
          const t = PI + 0.15 + (i / 10) * (PI - 0.3);
          const x = HX + Math.cos(t) * 42; const y = HY - 24 + Math.sin(t) * 36;
          L.blob(transform([[0, -8], [4, -4], [8, -6], [6, 0], [8, 6], [4, 4], [0, 8], [-4, 4], [-8, 6], [-6, 0], [-8, -6], [-4, -4]], { x, y, s: 1.2, rot: t }), lit('#1e5a1e', [x - 10, y - 10, 20, 20], { spec: 0.5 }));
          if (i % 2) L.circle(x + 3, y + 3, 2.6, radial(x + 2, y + 2, 3, ['#ffb0a0', '#d82020']));
        }
        break;
      }
      default: break;
    }
  }

  function greatHelm(L, h) {
    const m = h.main;
    L.blob([[HX - 44, HY + 44], [HX - 46, HY - 20], [HX - 30, HY - 58], [HX, HY - 66], [HX + 30, HY - 58], [HX + 46, HY - 20], [HX + 44, HY + 44], [HX, HY + 54]], lit(m, [HX - 46, HY - 66, 92, 120], { spec: 0.9, hi: 0.5 }));
    L.rect(HX - 36, HY - 4, 72, 9, '#08060a');
    glow(L, 5, 1.2, (G) => G.rect(HX - 32, HY - 2, 64, 5, h.visor));
    L.rect(HX - 30, HY - 1, 60, 3, shade(h.visor, 0.4));
    L.line(HX, HY + 8, HX, HY + 48, 3, shade(m, -0.5));
    for (let i = 0; i < 5; i++) L.circle(HX - 20 + i * 10, HY + 26, 1.8, '#0a080c');
    L.curve([[HX, HY - 66], [HX + 10, HY - 90], [HX - 4, HY - 110], [HX + 18, HY - 124]], 7, h.trim, 1, undefined, 2);
  }

  function frontItem(L, h) {
    switch (h.front) {
      case 'silverhand':
        glow(L, 12, 1, (G) => G.ellipse(186, 214, 26, 30, '#9ad8ff'));
        L.blob([[168, 256], [170, 214], [180, 196], [200, 196], [206, 214], [204, 256]], lit('#dfe8f0', [168, 196, 38, 60], { spec: 1 }));
        for (let i = 0; i < 4; i++) L.line(176 + i * 7, 198, 174 + i * 7, 176, 5, lit('#e8f0f8', [172 + i * 7, 176, 6, 22], { spec: 1 }));
        runeCircle(L, 188, 222, 16, '#9ad8ff', 0.8, 3);
        break;
      case 'keys':
        for (let i = 0; i < 3; i++) {
          const x = 176 + i * 10; const y = 212 + i * 4;
          L.circle(x, y, 5, '#d9a441'); L.circle(x, y, 2.5, h.main);
          L.line(x, y + 4, x, y + 26, 2.4, '#d9a441'); L.rect(x, y + 20, 6, 3, '#d9a441');
        }
        break;
      case 'shield': shield(L, 190, 222, 0.9, '#e8eef4', 'star', { rim: '#3a6ac8', mark: '#3a6ac8' }); break;
      case 'rose':
        L.line(184, 256, 176, 206, 2, '#2a6a2a');
        for (let i = 0; i < 6; i++) { const t = (i / 6) * TAU; L.circle(176 + Math.cos(t) * 6, 202 + Math.sin(t) * 6, 6, lit('#d8243a', [166, 192, 20, 20])); }
        L.circle(176, 202, 5, '#a01020');
        break;
      case 'orb': case 'waterorb': {
        const c = h.orb;
        glow(L, 18, 1.2, (G) => G.circle(128, 222, 22, c));
        L.circle(128, 222, 17, radial(122, 216, 22, ['#ffffff', c, shade(c, -0.6)]));
        if (h.front === 'waterorb') for (let i = 0; i < 3; i++) L.curve([[114, 222 + i * 4], [128, 216 + i * 4], [142, 222 + i * 4]], 1, '#ffffff', 0.5);
        else sparkles(L, 5, 5, [110, 204, 36, 36], '#ffffff', 3);
        for (const s of [-1, 1]) L.blob([[128 + s * 14, 242], [128 + s * 26, 226], [128 + s * 30, 238], [128 + s * 24, 256], [128 + s * 10, 256]], lit(SKIN[h.skin] || h.skin, [100, 226, 56, 30]));
        break;
      }
      case 'dagger': sword(L, 176, 246, 206, 176, { w: 4, gold: '#6a6a4a', hilt: '#2a1a10', guard: 10 }); break;
      case 'threads':
        glow(L, 6, 1, (G) => { for (let i = 0; i < 6; i++) G.curve([[60, 256 - i * 6], [110, 200 - i * 10], [150, 230 - i * 4], [200, 180 + i * 8]], 1.4, '#ff5a8a'); });
        L.ellipse(128, 230, 10, 16, lit('#8a6a4a', [118, 214, 20, 32]));
        break;
      case 'lotus':
        glow(L, 12, 1, (G) => G.circle(128, 226, 20, '#9ff0e0'));
        for (let i = 0; i < 7; i++) { const t = PI + (i / 6) * PI; L.blob(transform([[0, 0], [5, -8], [0, -18], [-5, -8]], { x: 128, y: 234, rot: t + PI / 2 }), lit('#f0f8ff', [118, 214, 20, 22])); }
        L.circle(128, 232, 4, '#ffe890');
        break;
      case 'philter': vial(L, 184, 216, 0.9, '#ff5a9a'); break;
      case 'harp': harp(L, 170, 214, 1.2); for (let i = 0; i < 3; i++) note(L, 204 + i * 10, 176 - i * 12, 0.8, '#fff0b0'); break;
      case 'grail': chalice(L, 128, 222, 1); break;
      case 'beads':
        for (let i = 0; i < 20; i++) { const t = (i / 19) * PI; L.circle(128 + Math.cos(t) * 30, 190 + Math.sin(t) * 40, 2.8, radial(127 + Math.cos(t) * 30, 189 + Math.sin(t) * 40, 3, ['#e0c8a0', '#6a4a2a'])); }
        L.rect(125, 228, 6, 14, '#6a4a2a'); L.rect(121, 232, 14, 4, '#6a4a2a');
        break;
      default: break;
    }
  }

  function questingBeast(cv, seed) {
    heroScene(cv, { scene: 'abyss', f: 'grail' }, seed);
    runeCircle(cv, 128, 170, 110, '#ff4a8a', 0.3, seed, 0.45);
    figure(cv, (L) => {
      const spots = rng(seed + 9);
      // ลำตัวเสือดาวพร้อมลายดอก
      const bodyPts = [[6, 256], [18, 214], [56, 186], [110, 180], [168, 184], [214, 200], [246, 230], [252, 256]];
      L.blob(bodyPts, lit('#b8862e', [6, 180, 246, 76], { spec: 0.25, hi: 0.3 }));
      const Sp = L.layer();
      for (let i = 0; i < 38; i++) {
        const x = 20 + spots() * 220; const y = 192 + spots() * 64; const r = 3 + spots() * 4;
        for (let k = 0; k < 5; k++) { const t = (k / 5) * TAU + spots(); Sp.circle(x + Math.cos(t) * r, y + Math.sin(t) * r, r * 0.45, '#2a1606', 0.85); }
      }
      Sp.mask(L);
      L.draw(Sp);
      // คองูเป็นเกล็ด
      const neck = [[128, 222], [100, 186], [96, 148], [118, 118], [140, 102]];
      const scale = (x, y) => {
        const base = mix('#2e5a2a', '#8ac06a', clamp01((x - 88) / 70));
        const sx = x / 7; const sy = y / 7 + (Math.floor(x / 7) % 2) * 0.5;
        const f = Math.abs((sx - Math.floor(sx)) - 0.5) + Math.abs((sy - Math.floor(sy)) - 0.5);
        return shade(base, f > 0.7 ? -0.35 : 0.05);
      };
      L.curve(neck, 50, scale, 1, undefined, 34);
      L.curve([[118, 214], [96, 182], [94, 150], [112, 124]], 12, '#d8d0a0', 0.7, undefined, 8);
      for (let i = 0; i < 7; i++) L.curve([[98 + i * 2, 206 - i * 13], [112 + i * 2, 204 - i * 13]], 1.4, '#6a6a3a', 0.6);
      // หัวงูใหญ่อ้าปาก
      const head = [[104, 104], [128, 70], [168, 58], [214, 66], [236, 84], [226, 98], [196, 100], [176, 110], [212, 116], [230, 132], [196, 138], [150, 132], [118, 124]];
      L.blob(head, lit('#5a8a44', [104, 58, 132, 80], { spec: 0.55, hi: 0.35 }));
      L.blob([[176, 108], [214, 100], [226, 106], [214, 124], [184, 124]], '#3a0a10');
      L.blob([[180, 110], [212, 106], [206, 120], [186, 120]], '#a02030', 0.8);
      for (let i = 0; i < 6; i++) { L.poly([[184 + i * 7, 104], [187 + i * 7, 113], [190 + i * 7, 103]], '#f6f2e0'); L.poly([[186 + i * 6, 126], [189 + i * 6, 118], [192 + i * 6, 126]], '#f6f2e0'); }
      L.curve([[150, 66], [138, 34], [120, 18]], 8, lit('#3a3024', [118, 18, 34, 50]), 1, undefined, 1.5);
      L.curve([[170, 60], [170, 28], [158, 8]], 7, lit('#3a3024', [156, 8, 16, 52]), 1, undefined, 1.5);
      glow(L, 6, 1.4, (G) => G.ellipse(178, 80, 9, 5, '#ff3a2a'));
      L.ellipse(178, 80, 7, 4.2, radial(177, 79, 7, ['#fff0a0', '#ffb020', '#ff4a10']), 1, undefined, -0.2);
      L.ellipse(178, 80, 1.6, 3.8, '#1a0000', 1, undefined, -0.2);
      L.curve([[164, 74], [178, 70], [192, 76]], 2.4, '#1e3a1a');
      for (let i = 0; i < 5; i++) L.circle(136 + i * 12, 96 + (i % 2) * 6, 2, '#2e5a2a', 0.8);
      // อุ้งเท้าหน้า
      for (const x of [52, 206]) {
        L.blob([[x - 18, 256], [x - 16, 226], [x + 16, 226], [x + 18, 256]], lit('#b8862e', [x - 18, 226, 36, 30]));
        for (let i = 0; i < 4; i++) L.poly([[x - 13 + i * 8, 250], [x - 10 + i * 8, 262], [x - 7 + i * 8, 250]], '#f0e8d0');
      }
    }, { rim: '#ff4a8a', rimA: 0.85 });
    // คลื่นเสียงคำราม
    glow(cv, 4, 0.8, (G) => { for (let i = 0; i < 3; i++) G.curve([[232 + i * 8, 96], [242 + i * 9, 114], [232 + i * 8, 132]], 2.2, '#ff9ac0'); });
    vignette(cv, 0.5);
  }

  /** ปรับโทนเป็นด้านมืดแปดเปื้อน */
  function corrupt(h0) {
    const h = { ...h0, dark: true, scene: 'corrupt', halo: null };
    const taint = (c, k = 0.45) => (c ? mix(shade(c, -0.35), '#3a0a2a', k) : c);
    h.main = taint(h.main); h.trim = '#c01838'; h.cape = h.cape ? '#1a0610' : null;
    h.hat = taint(h.hat); h.hood = taint(h.hood); h.veil = taint(h.veil, 0.3);
    h.hair = taint(h.hair, 0.3); h.beardColor = taint(h.beardColor, 0.3);
    const sk = SKIN[h.skin] || h.skin;
    if (sk) h.skin = mix(shade(sk, -0.12), '#8a8aa0', 0.35);
    h.eyes = '#ff2a1a';
    h.orb = '#ff2a6a';
    if (h.visor) h.visor = '#b030ff';
    return h;
  }

  function darkAura(cv, seed) {
    const r = rng(seed + 77);
    glow(cv, 26, 1, (L) => L.ellipse(HX, HY + 40, 110, 120, '#6a0a3a', 0.9));
    const noise = makeNoise(seed + 5);
    for (let i = 0; i < 16; i++) {
      const x = 20 + r() * 216; const h = 60 + r() * 120;
      const pts = [];
      for (let k = 0; k <= 10; k++) { const t = k / 10; pts.push([x + (noise.n2(i, t * 3) - 0.5) * 30 * t, 256 - h * t]); }
      glow(cv, 5, 0.7, (L) => L.stroke(pts, 6, i % 3 ? '#b0104a' : '#7a20c0', 1, undefined, 1));
    }
  }

  function renderHero(id, dark) {
    const h0 = HERO[id];
    if (!h0) throw new Error(`no design for hero ${id}`);
    const h = dark ? { ...corrupt(h0), id } : { ...h0, id };
    const S = SPECS.heroes;
    const cv = new Canvas(S.w, S.h, S.k);
    const seed = hash(`hero:${id}`);
    if (h.beast) {
      questingBeast(cv, seed);
      if (dark) {
        cv.fill(() => [120, 20, 70, 0.45], 'multiply');
        glow(cv, 6, 1.4, (L) => L.ellipse(178, 80, 10, 6, '#ff1a4a'));
        darkAura(cv, seed);
        vignette(cv, 0.6);
      }
      return cv;
    }
    if (dark) {
      sky(cv, seed, 'abyss', { clouds: 0.6, stars: 20, moon: [196, 48, 20, '#ff3a2a'], eclipse: true });
      darkAura(cv, seed);
    } else heroScene(cv, h, seed);
    const fx = dark ? { glow: '#ff2a5a' } : FACTION[h.f];
    if (h.halo) {
      glow(cv, 20, 1, (L) => L.circle(HX, HY - 10, 70, h.halo, 0.8));
      const ring = spline(Array.from({ length: 12 }, (_, i) => [HX + Math.cos((i / 12) * TAU) * 62, HY - 12 + Math.sin((i / 12) * TAU) * 62]), true, 8);
      cv.stroke([...ring, ring[0]], 3, h.halo, 0.8);
    }
    figure(cv, (L) => {
      backItem(L, h);
      capeShape(L, h);
      if (!h.helm) hairBack(L, h);
      body(L, h);
      if (h.helm) { greatHelm(L, h); return; }
      neck(L, SKIN[h.skin] || h.skin);
      if (h.head === 'hood' || h.head === 'veil') headwear(L, { ...h, head: h.head });
      face(L, h);
      hairFront(L, h);
      if (h.head !== 'hood' && h.head !== 'veil') headwear(L, h);
      else L.curve([[HX - 36, HY - 30], [HX, HY - 46], [HX + 36, HY - 30]], 2, shade(h.hood || h.veil, 0.3), 0.6);
    }, { rim: fx.glow, rimA: 0.75, rimBlur: 7 });
    const F = cv.layer();
    frontItem(F, h);
    cv.draw(F);
    if (dark && !h.helm) {
      // ดวงตาเรืองแสงแห่งความคลั่ง
      glow(cv, 4, 1.6, (L) => { L.ellipse(HX - 15, HY + 2, 6, 3, '#ff2a1a'); L.ellipse(HX + 15, HY + 2, 6, 3, '#ff2a1a'); });
      // รอยร้าวเรืองแดงบนแก้ม
      glow(cv, 2, 1, (L) => {
        L.curve([[HX - 30, HY - 20], [HX - 24, HY - 6], [HX - 28, HY + 8], [HX - 22, HY + 20]], 1.2, '#ff3a3a');
        L.curve([[HX + 26, HY + 10], [HX + 20, HY + 22], [HX + 24, HY + 34]], 1.2, '#ff3a3a');
      });
    }
    vignette(cv, dark ? 0.62 : 0.5, 0.5, 0.42);
    return cv;
  }

  // ═══════════════════════ หลังไพ่ / ผ้าปู / โต๊ะกลม ═══════════════════════

  function renderBack() {
    const B = SPECS.back;
    const cv = new Canvas(B.w, B.h, B.k);
    const noise = makeNoise(hash('back'));
    const W = B.w; const H = B.h;
    cv.fill((x, y) => {
      const d = Math.hypot((x - W / 2) / W, (y - H / 2) / H);
      const n = noise.fbm(x * 0.03, y * 0.03, 4);
      return mix(mix('#1e2a6a', '#070b24', d * 1.6), '#2a3a8a', smooth(0.55, 0.8, n) * 0.4);
    });
    stars(cv, 5, 70, [0, 0, W, H], 0.7);
    const gold = '#e2b24a';
    const frame = (m, w, c) => cv.stroke([[m, m], [W - m, m], [W - m, H - m], [m, H - m], [m, m]], w, c);
    frame(8, 3, gold); frame(15, 1.2, shade(gold, -0.2));
    for (const [x, y] of [[15, 15], [W - 15, 15], [15, H - 15], [W - 15, H - 15]]) {
      cv.circle(x, y, 8, lit(gold, [x - 8, y - 8, 16, 16], { spec: 0.8 }));
      cv.circle(x, y, 3.5, '#1e2a6a');
    }
    // ลายเถาวัลย์ที่หัวและท้าย
    for (const [y, dir] of [[34, 1], [H - 34, -1]]) {
      for (const s of [-1, 1]) {
        cv.curve([[W / 2, y], [W / 2 + s * 24, y + dir * 6], [W / 2 + s * 48, y], [W / 2 + s * 70, y + dir * 8]], 1.6, gold, 0.85, undefined, 0.6);
        cv.circle(W / 2 + s * 24, y + dir * 6, 2.2, gold);
      }
      sparkle(cv, W / 2, y, 6, '#ffe6a0');
    }
    runeCircle(cv, W / 2, H / 2, 88, '#f0cc70', 0.9, 21);
    // โต๊ะกลมและดาบ
    cv.circle(W / 2, H / 2, 46, lit('#6a3a1a', [W / 2 - 46, H / 2 - 46, 92, 92], { spec: 0.3 }));
    cv.circle(W / 2, H / 2, 38, '#1e2a6a');
    for (let i = 0; i < 12; i++) { const t = (i / 12) * TAU; cv.line(W / 2, H / 2, W / 2 + Math.cos(t) * 38, H / 2 + Math.sin(t) * 38, 1, gold, 0.5); }
    sword(cv, W / 2, H / 2 + 58, W / 2, H / 2 - 70, { w: 6, glow: '#fff0b0', gem: '#3a7ad8', runes: '#ffe08a' });
    return cv;
  }

  function renderFelt() {
    const F = SPECS.felt;
    const cv = new Canvas(F.w, F.h, F.k);
    const noise = makeNoise(hash('felt'));
    cv.fill((x, y) => {
      const d = Math.hypot((x - F.w / 2) / (F.w / 2), (y - F.h / 2) / (F.h / 2));
      const n = noise.fbm(x * 0.006, y * 0.012, 4);
      const grain = noise.n2(x * 0.02, y * 0.4) * 0.12;
      let c = mix('#3a2418', '#170c08', Math.min(1, d * 0.85));
      c = mix(c, '#5a3a24', smooth(0.5, 0.75, n) * 0.35 + grain);
      return c;
    });
    for (let i = 0; i < 3; i++) runeCircle(cv, F.w / 2, F.h / 2, 120 + i * 70, '#e0b050', 0.06, 40 + i, 0.62);
    return cv;
  }

  /** แผนที่โต๊ะกลมมนตรา: 4 โซนวงแหวน + ศูนย์กลาง (ใช้เป็นพื้นของแผงโซนในเกม) */
  const ZONE_ART = [
    { id: 'throne', a: -PI / 2, c: '#c8962a' },
    { id: 'bastion', a: 0, c: '#6a2a8a' },
    { id: 'marches', a: PI / 2, c: '#8a2a1e' },
    { id: 'sanctuary', a: PI, c: '#1e7a8a' },
  ];
  function renderTable() {
    const T = SPECS.table;
    const cv = new Canvas(T.w, T.h, T.k);
    const cx = T.w / 2; const cy = T.h / 2;
    const noise = makeNoise(hash('table'));
    cv.circle(cx, cy, 250, (x, y) => {
      const r = Math.hypot(x - cx, y - cy);
      const ring = noise.n2(r * 0.18, 3) * 0.2 + noise.fbm(x * 0.01, y * 0.01, 3) * 0.3;
      return mix('#5a3418', '#2a160a', clamp01(ring + r / 500));
    });
    for (const z of ZONE_ART) {
      const pts = [[cx, cy]];
      for (let i = 0; i <= 24; i++) { const t = z.a - PI / 4 + (i / 24) * (PI / 2); pts.push([cx + Math.cos(t) * 236, cy + Math.sin(t) * 236]); }
      cv.poly(pts, radial(cx, cy, 236, [[0, [0, 0, 0]], [0.35, shade(z.c, -0.5)], [1, z.c]]), 0.55);
    }
    for (let i = 0; i < 4; i++) { const t = PI / 4 + i * PI / 2; cv.line(cx + Math.cos(t) * 80, cy + Math.sin(t) * 80, cx + Math.cos(t) * 244, cy + Math.sin(t) * 244, 3, '#e2b24a', 0.8); }
    const rim = spline(Array.from({ length: 16 }, (_, i) => [cx + Math.cos((i / 16) * TAU) * 246, cy + Math.sin((i / 16) * TAU) * 246]), true, 8);
    cv.stroke([...rim, rim[0]], 5, lit('#e2b24a', [cx - 246, cy - 246, 492, 492], { spec: 0.6 }));
    runeCircle(cv, cx, cy, 236, '#f0cc70', 0.5, 77);
    glow(cv, 30, 1, (L) => L.circle(cx, cy, 78, '#b88aff', 0.8));
    cv.circle(cx, cy, 76, radial(cx, cy, 76, ['#fff4ff', '#a070ff', '#2a1050']));
    runeCircle(cv, cx, cy, 70, '#ffffff', 0.6, 78);
    return cv;
  }

  /** เรนเดอร์ภาพตามประเภท คืนภาพ 8-bit RGBA ขนาดจริงพร้อมบันทึก */
  function render(kind, id) {
    if (kind === 'cards') return renderCard(id).toImage();
    if (kind === 'heroes') return renderHero(id).toImage();
    if (kind === 'dark') return renderHero(id, true).toImage();
    if (kind === 'threats') return renderThreat(id).toImage();
    if (kind === 'misc' && id === 'back') return renderBack().toImage();
    if (kind === 'misc' && id === 'felt') return renderFelt().toImage();
    if (kind === 'misc' && id === 'table') return renderTable().toImage();
    throw new Error(`unknown art ${kind}/${id}`);
  }

  return { VERSION, SPECS, CARD_KEYS: Object.keys(CARD), HERO_IDS: Object.keys(HERO), THREAT_IDS: Object.keys(THREAT), MISC_IDS: ['back', 'felt', 'table'], render, renderCard, renderHero, renderThreat, renderBack, renderFelt, renderTable };
}));
