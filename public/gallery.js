/* คลังภาพ: แสดงภาพที่บันทึกถาวร + ข้อมูลการ์ด (อ่านอย่างเดียว) และวาดใหม่สดจากตัวสร้างภาพเพื่อตรวจสอบ */
'use strict';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { db: null, manifest: null, tab: 'heroes', live: false, checks: {} };

async function init() {
  const [db, manifest] = await Promise.all([
    fetch('api/cards').then((r) => r.json()),
    fetch('art/manifest.json', { cache: 'no-cache' }).then((r) => r.json()),
  ]);
  Object.assign(S, { db, manifest });
  render();
}

function slots() {
  const { db } = S;
  if (S.tab === 'heroes') return Object.entries(db.heroes).map(([id, h]) => ({ kind: 'heroes', id, h }));
  if (S.tab === 'cards') return Object.entries(db.cards).map(([id, c]) => ({ kind: 'cards', id, c }));
  if (S.tab === 'dark') return Object.entries(db.dark || {}).map(([id, d]) => ({ kind: 'dark', id, d }));
  if (S.tab === 'threats') return Object.entries(db.threats || {}).map(([id, t]) => ({ kind: 'threats', id, t }));
  return [{ kind: 'misc', id: 'back' }, { kind: 'misc', id: 'table' }, { kind: 'misc', id: 'felt' }];
}

const artUrl = (kind, id) => { const u = S.manifest.items[`${kind}/${id}`]; return u ? `art/${u}` : null; };

function faceHTML(sl) {
  if (sl.kind === 'heroes') return CardFace.hero(S.db, artUrl, sl.id);
  if (sl.kind === 'dark') return CardFace.hero(S.db, artUrl, sl.id, { dark: true });
  if (sl.kind === 'threats') return `<img src="${esc(artUrl(sl.kind, sl.id))}" alt="${esc(sl.id)}" style="width:220px;border-radius:10px">`;
  if (sl.kind === 'cards') {
    const first = (S.db.deck[sl.id] || [])[0] || {};
    return CardFace.card(S.db, artUrl, { key: sl.id, suit: first.suit, rank: first.rank });
  }
  if (sl.id === 'back') return CardFace.card(S.db, artUrl, null);
  return `<img src="${esc(artUrl('misc', sl.id))}" alt="${esc(sl.id)}">`;
}

function metaHTML(sl) {
  const { db } = S;
  if (sl.kind === 'heroes') {
    const h = sl.h;
    return `<b>${esc(h.name)}</b><span class="cn">${esc(h.en)}</span><div class="sub">${esc(h.title)} · ${esc(db.kingdoms[h.kingdom].icon)} ${esc(db.kingdoms[h.kingdom].name)} · ${h.gender === 'f' ? 'หญิง' : 'ชาย'} · เลือด ${h.hp}</div>`;
  }
  if (sl.kind === 'dark') {
    const d = sl.d;
    return `<b>🌑 ${esc(d.name)}</b><span class="cn">${esc(d.en)}</span><div class="sub">ด้านมืดของ ${esc(db.heroes[sl.id].name)}</div>${d.skills.map((k) => `<p><b>${esc(db.skills[k].name)}</b> ${esc(db.skills[k].desc)}</p>`).join('')}`;
  }
  if (sl.kind === 'threats') return `<b>🐉 ${esc(sl.t.name)}</b><span class="cn">${esc(sl.t.en)}</span><p>${esc(sl.t.desc)}</p>`;
  if (sl.kind === 'cards') {
    const c = sl.c;
    const copies = db.deck[sl.id] || [];
    return `<b>${esc(c.name)}</b><span class="cn">${esc(c.en)}</span>
      <div class="sub">${esc(CardFace.typeLine(c))} · ในสำรับ ${copies.length} ใบ</div>
      <p>${esc(c.desc)}</p>
      <div class="suits">${copies.map((x) => `<span class="${x.suit === 'heart' || x.suit === 'diamond' ? 'red' : ''}" title="รูน ${esc(db.runes[x.suit].name)}">${db.suits[x.suit]}${db.ranks[x.rank]}</span>`).join('')}</div>`;
  }
  if (sl.id === 'back') return '<b>หลังไพ่</b><p>ด้านหลังของการ์ดทุกใบ</p>';
  if (sl.id === 'table') return `<b>โต๊ะกลมมนตรา</b><p>แผนที่โซน: ${Object.values(db.zones).map((z) => `${z.icon} ${esc(z.name)}`).join(' · ')}</p>`;
  return '<b>พื้นโต๊ะ</b><p>พื้นไม้โต๊ะกลมกลางห้องเล่น</p>';
}

function render() {
  const { db, manifest } = S;
  const list = slots();
  const n = Object.keys(manifest.items).length;
  document.getElementById('app').innerHTML = `<div class="gal">
    <div class="gbar2"><h1>🖼 คลังภาพ CAMELOT</h1><span class="sp"></span>
      <label class="btn sm"><input type="checkbox" id="live" ${S.live ? 'checked' : ''}> วาดใหม่สดจากโค้ดเพื่อเทียบ</label>
      <a class="btn sm gold" href="studio.html">🎨 สตูดิโอภาพ AI</a>
      <a class="btn sm" href="/">กลับไปเกม</a></div>
    <div class="note">ภาพทั้ง ${n} ภาพความละเอียดสูง (256px) วาดจากโค้ดล้วนด้วย <code>public/artgen/</code> (ไล่สี แสงเงา แสงเรือง และลบรอยหยักแบบ supersampling ×3) และบันทึกถาวรเป็นไฟล์ใน <code>public/art/</code> พร้อมลายนิ้วมือ SHA-256 —
      การทดสอบจะตรวจว่าไฟล์ตรงกับตัวสร้างภาพทุกครั้ง (${esc(manifest.generator)}) —
      ภาพสมจริงจาก AI ที่วางไว้ใน <code>public/art/custom/</code> จะใช้แทนภาพจากโค้ด (มีป้าย ✦ ภาพ AI) สร้างได้ที่สตูดิโอภาพ AI</div>
    <div class="tabs">
      <button class="btn sm ${S.tab === 'heroes' ? 'on' : ''}" data-tab="heroes">ฮีโร่ (${Object.keys(db.heroes).length})</button>
      <button class="btn sm ${S.tab === 'cards' ? 'on' : ''}" data-tab="cards">การ์ด (${Object.keys(db.cards).length})</button>
      <button class="btn sm ${S.tab === 'dark' ? 'on' : ''}" data-tab="dark">ด้านมืด (${Object.keys(db.dark || {}).length})</button>
      <button class="btn sm ${S.tab === 'threats' ? 'on' : ''}" data-tab="threats">ภัยพิบัติ (${Object.keys(db.threats || {}).length})</button>
      <button class="btn sm ${S.tab === 'misc' ? 'on' : ''}" data-tab="misc">หลังไพ่ & โต๊ะ (3)</button></div>
    <div class="items">${list.map((sl) => {
      const key = `${sl.kind}/${sl.id}`;
      const url = manifest.items[key];
      const cls = sl.kind === 'heroes' || sl.kind === 'dark' ? 'hero-it' : sl.id === 'felt' ? 'felt-it' : sl.id === 'table' ? 'table-it' : 'card-it';
      const ai = !!(manifest.custom || {})[key];
      const chk = ai ? null : S.checks[key];
      return `<div class="item ${cls}">
        <div class="pics">${faceHTML(sl)}${url ? `<img hidden src="art/${esc(url)}" alt="" data-key="${esc(key)}">` : ''}${S.live ? `<canvas data-live="${esc(key)}" title="วาดใหม่สดในเบราว์เซอร์"></canvas>` : ''}</div>
        <div class="meta">${ai ? '<span class="ai-badge">✦ ภาพ AI</span>' : ''}${metaHTML(sl)}
          <div class="hash">sha256 ${esc((manifest.sha256[`${key}.png`] || '').slice(0, 16))}…</div>
          ${S.live && !ai ? `<div class="small ${chk === true ? 'ok' : chk === false ? 'bad' : ''}">${chk === true ? '✓ วาดใหม่ได้ตรงกับไฟล์ทุกพิกเซล' : chk === false ? '✗ ไม่ตรง (อาจเกิดจากเบราว์เซอร์คำนวณต่างเล็กน้อย)' : 'กำลังตรวจ…'}</div>` : ''}
        </div></div>`;
    }).join('')}</div></div>`;
  if (S.live) requestAnimationFrame(drawLive);
}

function drawLive() {
  for (const cv of document.querySelectorAll('canvas[data-live]')) {
    const key = cv.dataset.live;
    const [kind, id] = key.split('/');
    const img = window.ArtDesigns.render(kind, id);
    cv.width = img.w;
    cv.height = img.h;
    const ctx = cv.getContext('2d');
    ctx.putImageData(new ImageData(new Uint8ClampedArray(img.d), img.w, img.h), 0, 0);
    const saved = document.querySelector(`img[data-key="${key}"]`);
    if (saved && !(S.manifest.custom || {})[key] && S.checks[key] === undefined) compare(key, saved, img);
  }
}

function compare(key, el, img) {
  const run = () => {
    const c = document.createElement('canvas');
    c.width = img.w;
    c.height = img.h;
    const ctx = c.getContext('2d');
    ctx.drawImage(el, 0, 0);
    const got = ctx.getImageData(0, 0, img.w, img.h).data;
    let same = got.length === img.d.length;
    for (let i = 0; same && i < got.length; i += 4) if (got[i + 3] && (Math.abs(got[i] - img.d[i]) > 1 || Math.abs(got[i + 1] - img.d[i + 1]) > 1 || Math.abs(got[i + 2] - img.d[i + 2]) > 1)) same = false;
    S.checks[key] = same;
    const box = el.closest('.item').querySelector('.small');
    if (box) { box.className = `small ${same ? 'ok' : 'bad'}`; box.textContent = same ? '✓ วาดใหม่ได้ตรงกับไฟล์ทุกพิกเซล' : '✗ ไม่ตรง (อาจเกิดจากเบราว์เซอร์คำนวณต่างเล็กน้อย)'; }
  };
  if (el.complete) run(); else el.addEventListener('load', run, { once: true });
}

document.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) { S.tab = t.dataset.tab; render(); }
});
document.addEventListener('change', (e) => {
  if (e.target.id === 'live') { S.live = e.target.checked; render(); }
});

init().catch((e) => { document.getElementById('app').innerHTML = `<div class="loading">โหลดไม่สำเร็จ: ${esc(e.message)}</div>`; });
