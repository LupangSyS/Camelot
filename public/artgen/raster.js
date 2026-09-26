/* Painter — ตัววาดภาพความละเอียดสูง (ใช้ได้ทั้ง Node และเบราว์เซอร์)
   • วาดที่ความละเอียด k เท่า (supersampling) แล้วย่อลงด้วยการเฉลี่ย → ขอบเรียบไม่แตกเป็นขั้นบันได
   • เติมสีด้วย "เชดเดอร์" รายพิกเซล: ไล่สีเชิงเส้น/รัศมี, แสงเงา, พื้นผิวจาก fractal noise
   • เลเยอร์ + เบลอ สำหรับแสงเรือง (glow/bloom) และเงานุ่ม
   ทุกอย่างกำหนดผลได้แน่นอน (deterministic): ข้อมูลเดิม → พิกเซลเดิมทุกครั้ง */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ArtRaster = factory();
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ───────────── สี ─────────────
  const cache = new Map();
  function rgb(c) {
    if (Array.isArray(c)) return c;
    let v = cache.get(c);
    if (!v) {
      const h = c.replace('#', '');
      v = [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
      cache.set(c, v);
    }
    return v;
  }
  function mix(a, b, t) {
    const x = rgb(a); const y = rgb(b);
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const out = [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t];
    if (x.length > 3 || y.length > 3) { const xa = x[3] ?? 1; const ya = y[3] ?? 1; out.push(xa + (ya - xa) * t); }
    return out;
  }
  function shade(c, k) {
    const x = rgb(c);
    return k >= 0 ? mix(x, [255, 255, 255], k) : mix(x, [0, 0, 0], -k);
  }
  /** ไล่สีหลายจุด: stops = [[t, color], ...] */
  function ramp(stops, t) {
    if (t <= stops[0][0]) return rgb(stops[0][1]);
    for (let i = 1; i < stops.length; i++) {
      if (t <= stops[i][0]) {
        const [t0, c0] = stops[i - 1]; const [t1, c1] = stops[i];
        return mix(c0, c1, (t - t0) / (t1 - t0 || 1));
      }
    }
    return rgb(stops[stops.length - 1][1]);
  }
  const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
  const smooth = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

  // ───────────── noise ─────────────
  function makeNoise(seed) {
    const r = rng(seed);
    const perm = new Uint8Array(512);
    const p = Array.from({ length: 256 }, (_, i) => i);
    for (let i = 255; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
    const val = new Float32Array(256);
    for (let i = 0; i < 256; i++) val[i] = r();
    const fade = (t) => t * t * (3 - 2 * t);
    function n2(x, y) {
      const xi = Math.floor(x); const yi = Math.floor(y);
      const xf = x - xi; const yf = y - yi;
      const X = xi & 255; const Y = yi & 255;
      const a = val[perm[X + perm[Y]]]; const b = val[perm[X + 1 + perm[Y]]];
      const c = val[perm[X + perm[Y + 1]]]; const d = val[perm[X + 1 + perm[Y + 1]]];
      const u = fade(xf); const v = fade(yf);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    }
    function fbm(x, y, oct = 4) {
      let s = 0; let amp = 0.5; let f = 1; let norm = 0;
      for (let i = 0; i < oct; i++) { s += amp * n2(x * f, y * f); norm += amp; amp *= 0.5; f *= 2.03; }
      return s / norm;
    }
    return { n2, fbm };
  }

  // ───────────── เรขาคณิต ─────────────
  /** เส้นโค้ง Catmull-Rom ผ่านทุกจุด (closed = วงปิด) → รายการจุดละเอียด */
  function spline(pts, closed = true, seg = 10) {
    const out = [];
    const n = pts.length;
    const get = (i) => (closed ? pts[(i + n) % n] : pts[Math.max(0, Math.min(n - 1, i))]);
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = get(i - 1); const p1 = get(i); const p2 = get(i + 1); const p3 = get(i + 2);
      for (let s = 0; s < seg; s++) {
        const t = s / seg; const t2 = t * t; const t3 = t2 * t;
        out.push([
          0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
          0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        ]);
      }
    }
    if (!closed) out.push(pts[n - 1]);
    return out;
  }
  /** เบซิเยร์กำลังสอง/สาม */
  function bezier(p0, p1, p2, p3, seg = 16) {
    const out = [];
    for (let i = 0; i <= seg; i++) {
      const t = i / seg; const u = 1 - t;
      if (p3) out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
      else out.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
    return out;
  }
  function transform(pts, { x = 0, y = 0, s = 1, sx, sy, rot = 0, flip = false, cx = 0, cy = 0 } = {}) {
    const c = Math.cos(rot); const sn = Math.sin(rot);
    const kx = (sx ?? s) * (flip ? -1 : 1); const ky = sy ?? s;
    return pts.map(([px, py]) => {
      const dx = (px - cx) * kx; const dy = (py - cy) * ky;
      return [x + dx * c - dy * sn, y + dx * sn + dy * c];
    });
  }

  // ───────────── ผืนผ้าใบ ─────────────
  class Canvas {
    /** @param {number} w ความกว้างจริงของผลลัพธ์ @param {number} h @param {number} [k] ตัวคูณ supersampling */
    constructor(w, h, k = 1) {
      this.W = w; this.H = h; this.k = k;
      this.w = Math.round(w * k); this.h = Math.round(h * k);
      this.d = new Float32Array(this.w * this.h * 4); // premultiplied RGBA 0..255
      this.resetBounds();
    }
    layer() { return new Canvas(this.W, this.H, this.k); }
    /** ขอบเขตพิกเซลที่ถูกวาด (ใช้เร่งการผสมเลเยอร์) */
    resetBounds() { this.x0 = this.w; this.y0 = this.h; this.x1 = -1; this.y1 = -1; }
    touch(xa, ya, xb, yb) {
      if (xa < this.x0) this.x0 = Math.max(0, xa);
      if (ya < this.y0) this.y0 = Math.max(0, ya);
      if (xb > this.x1) this.x1 = Math.min(this.w - 1, xb);
      if (yb > this.y1) this.y1 = Math.min(this.h - 1, yb);
    }
    empty() { return this.x1 < this.x0 || this.y1 < this.y0; }
    /** ล้างเฉพาะส่วนที่ถูกวาด */
    clear() {
      if (this.empty()) return this;
      for (let y = this.y0; y <= this.y1; y++) this.d.fill(0, (y * this.w + this.x0) * 4, (y * this.w + this.x1 + 1) * 4);
      this.resetBounds();
      return this;
    }
    scratch() {
      if (!this._scratch) this._scratch = this.layer();
      return this._scratch;
    }

    /** ผสมพิกเซลจริง (หน่วยพิกเซลภายใน) */
    blend(i, r, g, b, a, mode) {
      const d = this.d;
      if (mode === 'add') {
        d[i] = Math.min(255, d[i] + r * a); d[i + 1] = Math.min(255, d[i + 1] + g * a); d[i + 2] = Math.min(255, d[i + 2] + b * a);
        return;
      }
      if (mode === 'multiply') {
        const ia = 1 - a;
        d[i] = d[i] * (ia + a * r / 255); d[i + 1] = d[i + 1] * (ia + a * g / 255); d[i + 2] = d[i + 2] * (ia + a * b / 255);
        return;
      }
      const ia = 1 - a;
      d[i] = r * a + d[i] * ia; d[i + 1] = g * a + d[i + 1] * ia; d[i + 2] = b * a + d[i + 2] * ia; d[i + 3] = 255 * a + d[i + 3] * ia;
    }

    /** เติมทั้งภาพด้วยเชดเดอร์ fn(x, y) → [r,g,b(,a)] (x, y เป็นพิกัดเชิงตรรกะ) */
    fill(fn, mode) {
      const k = this.k;
      this.touch(0, 0, this.w - 1, this.h - 1);
      for (let y = 0; y < this.h; y++) {
        for (let x = 0; x < this.w; x++) {
          const c = fn((x + 0.5) / k, (y + 0.5) / k);
          if (!c) continue;
          const a = c[3] === undefined ? 1 : c[3];
          if (a > 0) this.blend((y * this.w + x) * 4, c[0], c[1], c[2], Math.min(1, a), mode);
        }
      }
      return this;
    }

    /** วาดรูปหลายเหลี่ยม (scanline, even-odd) ด้วยสีหรือเชดเดอร์ */
    poly(pts, paint, a = 1, mode) {
      if (!pts.length || a <= 0) return this;
      const k = this.k;
      const P = pts.map((p) => [p[0] * k, p[1] * k]);
      let minY = Infinity; let maxY = -Infinity;
      for (const p of P) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
      const fn = typeof paint === 'function' ? paint : null;
      const col = fn ? null : rgb(paint);
      const y0 = Math.max(0, Math.floor(minY)); const y1 = Math.min(this.h - 1, Math.ceil(maxY));
      if (y1 < y0) return this;
      let minX = Infinity; let maxX = -Infinity;
      for (const p of P) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; }
      if (maxX < 0 || minX >= this.w) return this;
      this.touch(Math.floor(minX), y0, Math.ceil(maxX), y1);
      const xs = [];
      for (let y = y0; y <= y1; y++) {
        const sy = y + 0.5;
        xs.length = 0;
        for (let i = 0; i < P.length; i++) {
          const p0 = P[i]; const p1 = P[(i + 1) % P.length];
          if ((p0[1] <= sy && p1[1] > sy) || (p1[1] <= sy && p0[1] > sy)) xs.push(p0[0] + ((sy - p0[1]) * (p1[0] - p0[0])) / (p1[1] - p0[1]));
        }
        xs.sort((p, q) => p - q);
        for (let j = 0; j + 1 < xs.length; j += 2) {
          const xa = Math.max(0, Math.ceil(xs[j] - 0.5)); const xb = Math.min(this.w, Math.ceil(xs[j + 1] - 0.5));
          for (let x = xa; x < xb; x++) {
            let c = col; let al = a;
            if (fn) { c = fn((x + 0.5) / k, sy / k); if (!c) continue; if (c[3] !== undefined) al = a * c[3]; }
            if (al > 0) this.blend((y * this.w + x) * 4, c[0], c[1], c[2], Math.min(1, al), mode);
          }
        }
      }
      return this;
    }
    /** รูปร่างโค้งเรียบจากจุดควบคุม */
    blob(pts, paint, a = 1, mode) { return this.poly(spline(pts, true, 8), paint, a, mode); }
    ellipse(cx, cy, rx, ry, paint, a = 1, mode, rot = 0) {
      const n = Math.max(24, Math.ceil((rx + ry) * this.k * 0.8));
      const pts = [];
      const c = Math.cos(rot); const s = Math.sin(rot);
      for (let i = 0; i < n; i++) {
        const t = (i / n) * Math.PI * 2;
        const x = Math.cos(t) * rx; const y = Math.sin(t) * ry;
        pts.push([cx + x * c - y * s, cy + x * s + y * c]);
      }
      return this.poly(pts, paint, a, mode);
    }
    circle(cx, cy, r, paint, a = 1, mode) { return this.ellipse(cx, cy, r, r, paint, a, mode); }
    rect(x, y, w, h, paint, a = 1, mode) { return this.poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], paint, a, mode); }
    /** เส้นหนา w (ปลายมน) เรียวได้ด้วย w1 */
    line(x0, y0, x1, y1, w, paint, a = 1, mode, w1) {
      const dx = x1 - x0; const dy = y1 - y0;
      const len = Math.hypot(dx, dy) || 1e-6;
      const ha = w / 2; const hb = (w1 ?? w) / 2;
      const nx = -dy / len; const ny = dx / len;
      this.poly([[x0 + nx * ha, y0 + ny * ha], [x1 + nx * hb, y1 + ny * hb], [x1 - nx * hb, y1 - ny * hb], [x0 - nx * ha, y0 - ny * ha]], paint, a, mode);
      if (ha * this.k > 0.8) this.circle(x0, y0, ha, paint, a, mode);
      if (hb * this.k > 0.8) this.circle(x1, y1, hb, paint, a, mode);
      return this;
    }
    /** ลากเส้นตามจุด (ความหนาเรียวจาก w ถึง w1) — ใช้ layer ภายในเพื่อไม่ให้รอยต่อทับซ้อนเข้มขึ้น */
    stroke(pts, w, paint, a = 1, mode, w1) {
      const L = this.scratch();
      const n = pts.length - 1;
      for (let i = 0; i < n; i++) {
        const t0 = i / n; const t1 = (i + 1) / n;
        const wa = w + ((w1 ?? w) - w) * t0; const wb = w + ((w1 ?? w) - w) * t1;
        L.line(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], wa, paint, 1, undefined, wb);
      }
      this.draw(L, a, mode);
      L.clear();
      return this;
    }
    curve(pts, w, paint, a = 1, mode, w1) { return this.stroke(spline(pts, false, 10), w, paint, a, mode, w1); }

    /** วางเลเยอร์ทับ (ขนาดเดียวกัน) */
    draw(src, a = 1, mode) {
      if (src.empty()) return this;
      const s = src.d; const d = this.d;
      this.touch(src.x0, src.y0, src.x1, src.y1);
      for (let y = src.y0; y <= src.y1; y++) {
      const end = (y * this.w + src.x1 + 1) * 4;
      for (let i = (y * this.w + src.x0) * 4; i < end; i += 4) {
        const sa = s[i + 3] / 255 * a;
        if (mode === 'add') {
          if (s[i] + s[i + 1] + s[i + 2] <= 0) continue;
          d[i] = Math.min(255, d[i] + s[i] * a); d[i + 1] = Math.min(255, d[i + 1] + s[i + 1] * a); d[i + 2] = Math.min(255, d[i + 2] + s[i + 2] * a);
          continue;
        }
        if (sa <= 0) continue;
        const ia = 1 - sa;
        d[i] = s[i] * a + d[i] * ia; d[i + 1] = s[i + 1] * a + d[i + 1] * ia; d[i + 2] = s[i + 2] * a + d[i + 2] * ia; d[i + 3] = s[i + 3] * a + d[i + 3] * ia;
      }
      }
      return this;
    }
    /** ใช้เลเยอร์เป็นหน้ากาก: เก็บเฉพาะส่วนที่ mask ทึบ */
    mask(m) {
      const d = this.d; const s = m.d;
      for (let i = 0; i < d.length; i += 4) {
        const f = s[i + 3] / 255;
        d[i] *= f; d[i + 1] *= f; d[i + 2] *= f; d[i + 3] *= f;
      }
      return this;
    }
    /** เงา/แสงเรือง: คัดลอกรูปร่างเป็นสีเดียว */
    silhouette(color, a = 1) {
      const out = this.layer(); const c = rgb(color);
      const s = this.d; const d = out.d;
      if (this.empty()) return out;
      out.touch(this.x0, this.y0, this.x1, this.y1);
      for (let y = this.y0; y <= this.y1; y++) {
        const end = (y * this.w + this.x1 + 1) * 4;
        for (let i = (y * this.w + this.x0) * 4; i < end; i += 4) {
          const al = s[i + 3] / 255 * a;
          d[i] = c[0] * al; d[i + 1] = c[1] * al; d[i + 2] = c[2] * al; d[i + 3] = 255 * al;
        }
      }
      return out;
    }
    offset(dx, dy) {
      const out = this.layer();
      const ox = Math.round(dx * this.k); const oy = Math.round(dy * this.k);
      if (this.empty()) return out;
      out.touch(this.x0 + ox, this.y0 + oy, this.x1 + ox, this.y1 + oy);
      for (let y = 0; y < this.h; y++) {
        const sy = y - oy; if (sy < 0 || sy >= this.h) continue;
        for (let x = 0; x < this.w; x++) {
          const sx = x - ox; if (sx < 0 || sx >= this.w) continue;
          const t = (y * this.w + x) * 4; const s = (sy * this.w + sx) * 4;
          out.d[t] = this.d[s]; out.d[t + 1] = this.d[s + 1]; out.d[t + 2] = this.d[s + 2]; out.d[t + 3] = this.d[s + 3];
        }
      }
      return out;
    }
    /** เบลอแบบ box 3 รอบ (ใกล้เคียง gaussian) รัศมีเป็นหน่วยเชิงตรรกะ */
    blur(radius) {
      const r = Math.max(1, Math.round(radius * this.k));
      if (this.empty()) return this;
      const { w } = this;
      // ขยายขอบเขตตามรัศมี (3 รอบ) แล้วเบลอเฉพาะส่วนนั้น
      const pad = r * 3 + 1;
      const X0 = Math.max(0, this.x0 - pad); const Y0 = Math.max(0, this.y0 - pad);
      const X1 = Math.min(this.w - 1, this.x1 + pad); const Y1 = Math.min(this.h - 1, this.y1 + pad);
      this.touch(X0, Y0, X1, Y1);
      const bw = X1 - X0 + 1; const bh = Y1 - Y0 + 1;
      const win = r * 2 + 1;
      const line = new Float32Array(Math.max(bw, bh) * 4);
      const d = this.d;
      const inv = 1 / win;
      const pass = (horiz) => {
        const n = horiz ? bw : bh; const m = horiz ? bh : bw;
        const step = horiz ? 4 : w * 4;
        for (let j = 0; j < m; j++) {
          const base = horiz ? ((Y0 + j) * w + X0) * 4 : (Y0 * w + X0 + j) * 4;
          for (let i = 0, s = base; i < n; i++, s += step) {
            const q = i * 4;
            line[q] = d[s]; line[q + 1] = d[s + 1]; line[q + 2] = d[s + 2]; line[q + 3] = d[s + 3];
          }
          let a0 = 0; let a1 = 0; let a2 = 0; let a3 = 0;
          for (let i = -r; i <= r; i++) {
            const q = (i < 0 ? 0 : i >= n ? n - 1 : i) * 4;
            a0 += line[q]; a1 += line[q + 1]; a2 += line[q + 2]; a3 += line[q + 3];
          }
          const last = (n - 1) * 4;
          for (let i = 0, s = base; i < n; i++, s += step) {
            d[s] = a0 * inv; d[s + 1] = a1 * inv; d[s + 2] = a2 * inv; d[s + 3] = a3 * inv;
            const add = i + r + 1; const sub = i - r;
            const qa = add >= n ? last : add * 4; const qs = sub < 0 ? 0 : sub * 4;
            a0 += line[qa] - line[qs]; a1 += line[qa + 1] - line[qs + 1]; a2 += line[qa + 2] - line[qs + 2]; a3 += line[qa + 3] - line[qs + 3];
          }
        }
      };
      for (let it = 0; it < 3; it++) { pass(true); pass(false); }
      return this;
    }
    /** ย่อกลับเป็นขนาดจริง (เฉลี่ย k×k) แล้วคืนภาพ 8-bit RGBA แบบ straight alpha */
    toImage() {
      const { W, H, k } = this;
      const out = { w: W, h: H, d: new Uint8ClampedArray(W * H * 4) };
      const kk = k * k;
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let r = 0; let g = 0; let b = 0; let a = 0;
          for (let j = 0; j < k; j++) {
            for (let i = 0; i < k; i++) {
              const s = ((y * k + j) * this.w + (x * k + i)) * 4;
              r += this.d[s]; g += this.d[s + 1]; b += this.d[s + 2]; a += this.d[s + 3];
            }
          }
          const t = (y * W + x) * 4;
          a /= kk;
          if (a > 0.5) {
            const f = 255 / a;
            out.d[t] = Math.round(r / kk * f); out.d[t + 1] = Math.round(g / kk * f); out.d[t + 2] = Math.round(b / kk * f);
          }
          out.d[t + 3] = Math.round(a);
        }
      }
      return out;
    }
  }

  // ───────────── เชดเดอร์สำเร็จรูป ─────────────
  /** รับได้ทั้ง [สี, สี, ...] (เว้นระยะเท่ากัน) และ [[ตำแหน่ง, สี], ...] */
  function toStops(stops) {
    const isPair = (s) => Array.isArray(s) && s.length === 2 && typeof s[0] === 'number' && typeof s[1] !== 'number';
    return stops.every(isPair) ? stops : stops.map((c, i) => [i / (stops.length - 1), c]);
  }
  /** ไล่สีเชิงเส้นจาก (x0,y0) ถึง (x1,y1) */
  function linear(x0, y0, x1, y1, stops) {
    const dx = x1 - x0; const dy = y1 - y0; const L2 = dx * dx + dy * dy || 1;
    const st = toStops(stops);
    return (x, y) => ramp(st, ((x - x0) * dx + (y - y0) * dy) / L2);
  }
  function radial(cx, cy, r, stops, sy = 1) {
    const st = toStops(stops);
    return (x, y) => ramp(st, Math.hypot(x - cx, (y - cy) / sy) / r);
  }
  /** เชดเดอร์แสงเงาแบบโลหะ/ผ้า: base สี, แสงจากมุมซ้ายบน, พร้อมเงาด้านขวาล่าง */
  function lit(base, box, o = {}) {
    const [bx, by, bw, bh] = box;
    const hi = o.hi ?? 0.35; const lo = o.lo ?? -0.45;
    const lx = o.lx ?? -0.6; const ly = o.ly ?? -0.8;
    const spec = o.spec || 0;
    return (x, y) => {
      const u = ((x - bx) / bw - 0.5) * 2; const v = ((y - by) / bh - 0.5) * 2;
      const t = -(u * lx + v * ly) * 0.5 + 0.5; // 1 = หันเข้าหาแสง
      let c = shade(base, lo + (hi - lo) * clamp01(t));
      if (spec) {
        const s = Math.max(0, 1 - Math.hypot(u - lx * 0.45, v - ly * 0.45) * 1.6);
        c = mix(c, [255, 255, 255], s * s * spec);
      }
      return c;
    };
  }
  /** พื้นผิวจาก noise ทับบนเชดเดอร์อื่น */
  function textured(fn, noise, scale, amt) {
    return (x, y) => {
      const c = typeof fn === 'function' ? fn(x, y) : rgb(fn);
      const n = (noise.fbm(x * scale, y * scale, 3) - 0.5) * amt;
      return [c[0] + n * 255, c[1] + n * 255, c[2] + n * 255, c[3]];
    };
  }

  return { Canvas, hash, rng, rgb, mix, shade, ramp, clamp01, smooth, makeNoise, spline, bezier, transform, linear, radial, lit, textured };
}));
