'use strict';

// ภาพ AI / ภาพกำหนดเอง: วางไฟล์ไว้ที่ public/art/custom/<kind>/<id>.(webp|png|jpg|jpeg)
// แล้วเซิร์ฟเวอร์จะใช้แทนภาพที่วาดจากโค้ดโดยอัตโนมัติ (ภาพจากโค้ดยังเป็นตัวสำรองเสมอ)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const KINDS = ['heroes', 'dark', 'cards', 'threats', 'misc'];
const EXT = ['.webp', '.png', '.jpg', '.jpeg'];

/** สแกนโฟลเดอร์ custom แล้วคืน { 'heroes/merlin': 'custom/heroes/merlin.webp?v=hash' } */
function scanCustomArt(artDir) {
  const out = {};
  for (const kind of KINDS) {
    const dir = path.join(artDir, 'custom', kind);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      const ext = path.extname(f).toLowerCase();
      if (!EXT.includes(ext)) continue;
      const id = path.basename(f, path.extname(f));
      if (!/^[a-z0-9_]+$/.test(id)) continue;
      const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex').slice(0, 10);
      out[`${kind}/${id}`] = `custom/${kind}/${f}?v=${hash}`;
    }
  }
  return out;
}

/** manifest ที่รวมภาพกำหนดเองทับภาพจากโค้ด */
function mergedManifest(artDir) {
  const base = JSON.parse(fs.readFileSync(path.join(artDir, 'manifest.json'), 'utf8'));
  const custom = scanCustomArt(artDir);
  return { ...base, items: { ...base.items, ...custom }, custom: Object.fromEntries(Object.keys(custom).map((k) => [k, true])) };
}

module.exports = { scanCustomArt, mergedManifest, KINDS, EXT };
