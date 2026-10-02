'use strict';
// นำภาพจาก public/art/custom/inbox/ เข้าเกม: ชื่อไฟล์ = เลขลำดับใน PROMPTS.md (01–74) หรือรหัส (arthur)
// ครอปตามสัดส่วนช่องภาพ (ฮีโร่ 1:1, การ์ด/ภัยพิบัติ 5:4), --trim ตัดขอบ 6% (ลายน้ำ), ย่อด้านยาวเหลือ 1024 แล้วบันทึกเป็น WEBP
// ใช้ Playwright (Chromium) ที่ติดตั้งไว้ทั้งระบบ: node scripts/import-art.js [--trim]
const fs = require('fs'); const path = require('path');
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(path.join(require('child_process').execSync('npm root -g').toString().trim(), 'playwright'))); }
const ROOT = path.join(__dirname, '..', 'public', 'art', 'custom');
const order = [...fs.readFileSync(path.join(ROOT, 'PROMPTS.md'), 'utf8').matchAll(/^### \d+ · .* — `(\w+)\/(\w+)`$/gm)].map((m) => ({ kind: m[1], id: m[2] }));
const trim = process.argv.includes('--trim') ? 0.06 : 0;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  for (const f of fs.readdirSync(ROOT + '/inbox')) {
    const ext = path.extname(f).toLowerCase(); if (!['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) continue;
    const base = path.basename(f, ext).toLowerCase();
    const slot = /^\d+$/.test(base) ? order[Number(base) - 1] : order.find((o) => o.id === base && o.kind === 'heroes') || order.find((o) => o.id === base);
    if (!slot) { console.log('skip (unknown):', f); continue; }
    const aspect = slot.kind === 'heroes' || slot.kind === 'dark' ? 1 : 5 / 4;
    const data = 'data:image/' + (ext === '.png' ? 'png' : ext === '.webp' ? 'webp' : 'jpeg') + ';base64,' + fs.readFileSync(ROOT + '/inbox/' + f).toString('base64');
    const out = await p.evaluate(async ({ data, aspect, trim }) => {
      const img = new Image(); img.src = data; await img.decode();
      let w = img.naturalWidth * (1 - trim), h = img.naturalHeight * (1 - trim);
      if (w / h > aspect) w = h * aspect; else h = w / aspect;
      const sx = (img.naturalWidth * (1 - trim) - w) / 2; const sy = Math.max(0, (img.naturalHeight * (1 - trim) - h) * 0.3);
      const k = Math.min(1, 1024 / Math.max(w, h)); const cv = document.createElement('canvas');
      cv.width = Math.round(w * k); cv.height = Math.round(h * k);
      const c = cv.getContext('2d'); c.imageSmoothingQuality = 'high'; c.drawImage(img, sx, sy, w, h, 0, 0, cv.width, cv.height);
      return { url: cv.toDataURL('image/webp', 0.9), w: cv.width, h: cv.height, src: [img.naturalWidth, img.naturalHeight] };
    }, { data, aspect, trim });
    const dest = `${ROOT}/${slot.kind}/${slot.id}.webp`;
    fs.writeFileSync(dest, Buffer.from(out.url.split(',')[1], 'base64'));
    fs.unlinkSync(ROOT + '/inbox/' + f);
    console.log(`${f} → ${slot.kind}/${slot.id}.webp ${out.src.join('x')} → ${out.w}x${out.h} ${fs.statSync(dest).size} bytes`);
  }
  await b.close();
})();
