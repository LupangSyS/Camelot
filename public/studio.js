/* สตูดิโอภาพการ์ด AI — สร้างภาพสมจริงด้วยโมเดลภาพของ Google (Gemini / Imagen) ผ่านคีย์ API ของผู้ใช้เอง
   • คีย์เก็บในเบราว์เซอร์นี้เท่านั้น (localStorage) และส่งตรงไปยัง Google — ไม่ผ่านเซิร์ฟเวอร์เกม
   • ภาพที่ได้: ดูตัวอย่างในกรอบการ์ดจริง แล้วบันทึกลงเครื่อง → นำไปวางที่ public/art/custom/<ประเภท>/<id>.webp ใน repo
     เซิร์ฟเวอร์จะใช้ภาพนั้นแทนภาพที่วาดจากโค้ดโดยอัตโนมัติ */
'use strict';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* ignore */ } },
};

const KINDS = {
  heroes: { name: 'ฮีโร่', aspect: '1:1' },
  dark: { name: 'ด้านมืด', aspect: '1:1' },
  cards: { name: 'การ์ด', aspect: '5:4' },
  threats: { name: 'ภัยพิบัติ', aspect: '5:4' },
};

const STYLES = {
  arcane: { name: 'Arthurian Arcane Realism', text: 'photorealistic dark-fantasy painting, Arthurian legend, arcane magic, hyper-detailed armor and fabric textures, volumetric god rays, cinematic rim lighting, shallow depth of field' },
  oil: { name: 'Classical Oil Painting', text: 'classical oil painting in the style of Pre-Raphaelite masters, rich glazes, visible brushwork, dramatic chiaroscuro, museum-quality fantasy art' },
  concept: { name: 'Cinematic Concept Art', text: 'AAA game cinematic concept art, epic fantasy, ultra-detailed digital painting, dramatic atmosphere, unreal engine 5 lighting, 8k render quality' },
  glass: { name: 'Mythic Stained Glass', text: 'luminous medieval stained-glass and gold-leaf illumination style, jewel tones, glowing lead lines, sacred mythic mood' },
  grim: { name: 'Grimdark Realism', text: 'grimdark photorealism, gritty weathered textures, smoke and embers, moody desaturated palette with intense accent colors, cinematic' },
};

const FACTION_MOOD = {
  crown: 'regal palette of royal gold, sapphire blue and crimson, noble heroic mood',
  coven: 'sinister palette of blood crimson, black and venom purple, treacherous shadowy mood',
  avalon: 'mystical palette of starlight cyan, silver and deep teal, ethereal enchanted mood',
  grail: 'sacred palette of ivory, emerald and soft holy gold light, pure transcendent mood',
};

const CARD_LOOK = {
  strike: 'a glowing arcane longsword slashing through the air leaving a trail of blue magical energy, rune circle behind',
  aegis: 'a translucent hexagonal magical barrier dome deflecting flaming arrows at night',
  elixir: 'a glowing crystal vial of crimson healing elixir of Avalon standing on a misty lake shore',
  blink: 'two swirling violet and cyan teleportation portals with a cloaked figure dissolving into sparkles between them',
  dispel: 'a pillar of purifying white-gold flame shattering dark magical chains',
  meteor: 'a rain of blazing meteors falling on a silhouetted castle under a dark red sky',
  blessing: 'an open holy prayer book radiating heavenly light beams and floating sparks',
  siren: 'a beautiful siren with red hair singing on sea rocks under the moon, glowing musical notes',
  blood_duel: 'two crossed swords bound by glowing crimson blood chains over a red rune circle',
  blood_moon: 'a giant blood-red moon over a dark forest with a black meteor falling',
  petrify: 'a knight turning into cracked stone statue, glowing green runes at his feet, misty ruins',
  excalibur: 'the legendary sword Excalibur embedded in a mossy stone, radiating golden holy light at dawn',
  rhongomyniad: 'a radiant spear of light Rhongomyniad crackling with lightning across a stormy sky',
  carnwennan: 'the shadow dagger Carnwennan wreathed in purple smoke, starry night',
  merlin_staff: 'Merlin\'s gnarled wizard staff topped with a glowing blue crystal orb, constellations and runes around it',
  pridwen: 'the holy round shield Pridwen bearing the image of the Virgin, glowing golden, castle at sunset',
  mantle: 'a ghostly invisibility cloak fading into mist, faint glowing eyes inside the hood',
  dragonscale: 'a shimmering white dragon-scale armor cuirass on a stand in a snowy mountain hall',
  gryphon: 'a majestic sky gryphon with eagle head and lion body soaring over mountains at sunrise',
  unicorn: 'a white unicorn with a glowing golden horn standing in a misty moonlit forest',
};
const THREAT_LOOK = {
  dragon: 'the colossal red dragon Vermithrax breathing a torrent of fire over a burning medieval castle at night',
  saxons: 'a vast Saxon warband with spears, torches and war banners advancing on a burning village at dusk',
  wild_hunt: 'the spectral Wild Hunt, ghostly antlered riders on glowing phantom horses galloping across a moonlit sky',
  blight: 'a cursed blighted land, withered black trees, sickly green glowing fog, dead fields under a dark sky',
};

const S = {
  db: null, manifest: null, kind: 'heroes', id: null, style: store.get('studio_style') || 'arcane',
  model: store.get('studio_model') || 'gemini-2.5-flash-image', key: store.get('studio_key') || '',
  size: store.get('studio_size') || '1024', fmt: store.get('studio_fmt') || 'webp', autoSave: store.get('studio_auto') === '1',
  prompt: '', edited: false, images: {}, busy: false, batch: null, status: '', statusCls: '',
};

async function init() {
  const [db, manifest] = await Promise.all([
    fetch('api/cards').then((r) => r.json()),
    fetch('art/manifest.json', { cache: 'no-cache' }).then((r) => r.json()),
  ]);
  Object.assign(S, { db, manifest });
  S.id = ids()[0];
  S.prompt = buildPrompt();
  render();
}

function ids() {
  const { db } = S;
  if (S.kind === 'heroes' || S.kind === 'dark') return Object.keys(db.heroes);
  if (S.kind === 'cards') return Object.keys(db.cards);
  return Object.keys(db.threats || {});
}

function label(kind, id) {
  const { db } = S;
  if (kind === 'heroes') return db.heroes[id].name;
  if (kind === 'dark') return db.dark[id].name;
  if (kind === 'cards') return db.cards[id].name;
  return db.threats[id].name;
}

function buildPrompt(kind = S.kind, id = S.id) {
  const { db } = S;
  const style = STYLES[S.style].text;
  const tail = 'textless, no text, no letters, no logo, no watermark, no border, no frame, no card template, ultra-detailed, 4K resolution';
  if (kind === 'heroes' || kind === 'dark') {
    const h = db.heroes[id];
    const look = (db.lore[id] || {}).look || `${h.en}, ${h.title}`;
    const comp = 'single character portrait, centered, head to waist, facing the viewer, detailed face';
    if (kind === 'dark') {
      const d = db.dark[id];
      return `${look}, now corrupted into their dark side "${d.en}": glowing red eyes, cracked skin with molten crimson veins, blackened and blood-red corrupted armor, swirling purple-crimson dark flame aura, eclipsed blood moon sky. ${comp}. ${style}, sinister black and crimson palette. ${tail}`;
    }
    return `${look}. ${comp}. ${style}, ${FACTION_MOOD[h.kingdom]}. ${tail}`;
  }
  if (kind === 'cards') {
    const c = db.cards[id];
    return `Fantasy card illustration of "${c.en}": ${CARD_LOOK[id] || c.desc}. Wide scene composition. ${style}. ${tail}`;
  }
  return `Epic disaster scene "${db.threats[id].en}": ${THREAT_LOOK[id] || db.threats[id].desc}. Wide cinematic composition. ${style}. ${tail}`;
}

const slotKey = (kind = S.kind, id = S.id) => `${kind}/${id}`;
function savedUrl(kind, id) { const u = S.manifest.items[`${kind}/${id}`]; return u ? `art/${u}` : null; }
function artFor(kind, id) { return S.images[`${kind}/${id}`] || savedUrl(kind, id); }

function previewHTML() {
  const { db, kind, id } = S;
  const art = (k, i) => (k === kind && i === id ? artFor(kind, id) : savedUrl(k, i));
  if (kind === 'heroes' || kind === 'dark') {
    const artUrl = (k, i) => (kind === 'dark' && k === 'dark' ? art('dark', i) : k === 'heroes' && kind === 'heroes' ? art('heroes', i) : savedUrl(k, i));
    return CardFace.hero(db, artUrl, id, { dark: kind === 'dark' });
  }
  if (kind === 'cards') {
    return CardFace.card(db, (k, i) => (k === 'cards' ? art('cards', i) : savedUrl(k, i)), { key: id });
  }
  const u = artFor(kind, id);
  return `<div class="threat" style="width:300px;min-height:200px;background-image:url('${esc(u)}')"><b>🐉 ${esc(db.threats[id].name)}</b></div>`;
}

function render() {
  const { db } = S;
  const list = ids();
  const custom = S.manifest.custom || {};
  const fresh = S.images[slotKey()];
  const ext = S.fmt === 'png' ? 'png' : S.fmt === 'jpg' ? 'jpg' : 'webp';
  document.getElementById('app').innerHTML = `<div class="studio">
    <div class="st-bar"><h1>🎨 สตูดิโอภาพการ์ด AI</h1><span class="sp"></span>
      <a class="btn sm" href="gallery.html">🖼 คลังภาพ</a><a class="btn sm" href="/">กลับไปเกม</a></div>

    <div style="display:grid;gap:14px">
      <div class="st-panel">
        <h2>✦ เลือกการ์ดที่จะสร้างภาพ <small>สีเขียว = มีภาพ AI ในเกมแล้ว</small></h2>
        <div class="row">${Object.entries(KINDS).map(([k, v]) => `<button class="btn sm ${S.kind === k ? 'gold' : ''}" data-kind="${k}">${v.name}</button>`).join('')}</div>
        <div class="slots">${list.map((i) => `<button class="${custom[`${S.kind}/${i}`] ? 'has' : ''} ${i === S.id ? 'on' : ''} ${S.images[`${S.kind}/${i}`] ? 'has' : ''}" data-id="${esc(i)}">${esc(label(S.kind, i))}</button>`).join('')}</div>
      </div>

      <div class="st-panel">
        <h2>✦ Image Prompt <small>ภาพล้วน ไม่มีตัวอักษรหรือกรอบ — กรอบการ์ดใส่ให้อัตโนมัติ</small></h2>
        <textarea id="prompt">${esc(S.prompt)}</textarea>
        <div class="grid2">
          <label class="f">สไตล์ภาพ<select id="style">${Object.entries(STYLES).map(([k, v]) => `<option value="${k}" ${S.style === k ? 'selected' : ''}>${esc(v.name)}</option>`).join('')}</select></label>
          <label class="f">สัดส่วนภาพ<select id="aspect" disabled><option>${KINDS[S.kind].aspect} (ตามช่องภาพของการ์ด)</option></select></label>
        </div>
        <div class="row"><button class="btn sm" data-act="reprompt">↺ สร้าง prompt ใหม่จากข้อมูลการ์ด</button></div>
        <div class="row">
          <button class="btn gen" data-act="gen" ${S.busy ? 'disabled' : ''}>🖌 ${S.busy ? 'กำลังสร้าง…' : 'GENERATE ภาพ AI'}</button>
          <button class="btn save" data-act="save" ${fresh ? '' : 'disabled'}>💾 บันทึกลงเครื่อง</button>
          <label class="btn sm">📁 อัปโหลดภาพของคุณ<input type="file" id="upload" accept="image/*" hidden></label>
        </div>
        <div class="row">
          <button class="btn sm" data-act="batch" ${S.busy ? 'disabled' : ''}>⚡ สร้างทั้งหมดในหมวด${esc(KINDS[S.kind].name)} (${list.length})</button>
          ${S.batch ? '<button class="btn sm" data-act="stop">⏹ หยุด</button>' : ''}
          <label class="chk"><input type="checkbox" id="auto" ${S.autoSave ? 'checked' : ''}> บันทึกอัตโนมัติหลังสร้างแต่ละใบ</label>
        </div>
        <div class="st-status ${S.statusCls}">${esc(S.status)}</div>
      </div>

      <div class="st-panel">
        <h2>✦ โมเดลและคีย์ API <small>คีย์อยู่ในเบราว์เซอร์นี้เท่านั้น ส่งตรงถึง Google</small></h2>
        <div class="grid2">
          <label class="f">Google AI API key<input type="password" id="key" value="${esc(S.key)}" placeholder="AIza…" autocomplete="off"></label>
          <label class="f">โมเดลภาพ<input type="text" id="model" value="${esc(S.model)}" list="models"></label>
          <datalist id="models"><option value="gemini-2.5-flash-image"><option value="imagen-4.0-generate-001"><option value="imagen-4.0-ultra-generate-001"></datalist>
          <label class="f">ขนาดไฟล์ที่บันทึก<select id="size">${['native', '1024', '2048', '4096'].map((v) => `<option value="${v}" ${S.size === v ? 'selected' : ''}>${v === 'native' ? 'ตามที่โมเดลสร้าง' : `${v}px (ด้านยาว)`}</option>`).join('')}</select></label>
          <label class="f">ชนิดไฟล์<select id="fmt">${['webp', 'jpg', 'png'].map((v) => `<option value="${v}" ${S.fmt === v ? 'selected' : ''}>${v.toUpperCase()}</option>`).join('')}</select></label>
        </div>
        <div class="st-note">รับคีย์ฟรีได้ที่ <b>aistudio.google.com</b> → Get API key (การสร้างภาพอาจมีค่าใช้จ่ายตามแพ็กเกจของคุณ) ·
          โมเดลที่ชื่อขึ้นต้นด้วย <code>imagen</code> ใช้ API แบบ Imagen ส่วนที่เหลือใช้ Gemini ·
          ขนาด 2048/4096px คือการขยายภาพตอนบันทึก (เหมาะกับงานพิมพ์) — ในเกมการ์ดแสดงประมาณ 300px จึงใช้ 1024px ก็คมชัดแล้ว</div>
      </div>
    </div>

    <div style="display:grid;gap:14px">
      <div class="st-panel"><h2>✦ ตัวอย่างบนการ์ดจริง</h2><div class="preview">${previewHTML()}</div>
        ${fresh ? `<img class="raw" src="${esc(fresh)}" alt="ภาพที่สร้าง">` : ''}</div>
      <div class="st-panel">
        <h2>✦ นำภาพเข้าเกม</h2>
        <div class="st-note">1) กด <b>บันทึกลงเครื่อง</b> → ได้ไฟล์ <code>${esc(S.id)}.${ext}</code><br>
          2) ใน GitHub เปิด repo <b>Camelot</b> → โฟลเดอร์ <code>public/art/custom/${esc(S.kind)}/</code> → <b>Add file → Upload files</b> แล้ว commit<br>
          3) Render จะ deploy ใหม่ ภาพจะแสดงในเกมแทนภาพเดิมทันที (ลบไฟล์ออก = กลับไปใช้ภาพที่วาดจากโค้ด)<br>
          ชื่อไฟล์ต้องตรงกับรหัสการ์ด เช่น <code>public/art/custom/heroes/merlin.webp</code>, <code>public/art/custom/dark/mordred.webp</code>, <code>public/art/custom/cards/excalibur.webp</code></div>
      </div>
    </div>
  </div>`;
}

function setStatus(text, cls = '') { S.status = text; S.statusCls = cls; const el = document.querySelector('.st-status'); if (el) { el.textContent = text; el.className = `st-status ${cls}`; } }

/** เรียกโมเดลภาพของ Google คืน dataURL */
async function callModel(prompt, aspect) {
  if (!S.key) throw new Error('กรุณาใส่ Google AI API key ก่อน');
  const base = 'https://generativelanguage.googleapis.com/v1beta/models/';
  const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': S.key };
  let res; let json;
  if (/^imagen/i.test(S.model)) {
    res = await fetch(`${base}${encodeURIComponent(S.model)}:predict`, {
      method: 'POST', headers,
      body: JSON.stringify({ instances: [{ prompt }], parameters: { sampleCount: 1, aspectRatio: aspect === '5:4' ? '4:3' : aspect } }),
    });
    json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((json.error && json.error.message) || `HTTP ${res.status}`);
    const p = (json.predictions || [])[0];
    if (!p || !p.bytesBase64Encoded) throw new Error('โมเดลไม่ได้ส่งภาพกลับมา (อาจถูกตัวกรองเนื้อหา) ลองปรับ prompt');
    return `data:${p.mimeType || 'image/png'};base64,${p.bytesBase64Encoded}`;
  }
  res = await fetch(`${base}${encodeURIComponent(S.model)}:generateContent`, {
    method: 'POST', headers,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: aspect } },
    }),
  });
  json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json.error && json.error.message) || `HTTP ${res.status}`);
  const parts = ((((json.candidates || [])[0] || {}).content || {}).parts) || [];
  const img = parts.find((p) => p.inlineData || p.inline_data);
  if (!img) {
    const txt = parts.map((p) => p.text).filter(Boolean).join(' ');
    throw new Error(`โมเดลไม่ได้ส่งภาพกลับมา${txt ? `: ${txt.slice(0, 160)}` : ''}`);
  }
  const d = img.inlineData || img.inline_data;
  return `data:${d.mimeType || d.mime_type || 'image/png'};base64,${d.data}`;
}

async function generateOne(kind, id, prompt) {
  const t0 = Date.now();
  setStatus(`กำลังสร้างภาพ「${label(kind, id)}」…`);
  const url = await callModel(prompt, KINDS[kind].aspect);
  S.images[`${kind}/${id}`] = url;
  setStatus(`สร้างภาพ「${label(kind, id)}」สำเร็จ (${((Date.now() - t0) / 1000).toFixed(1)} วินาที)`, 'ok');
  if (S.autoSave) await saveImage(kind, id);
}

/** แปลงขนาด/ชนิดไฟล์ด้วย canvas แล้วดาวน์โหลด */
async function saveImage(kind = S.kind, id = S.id) {
  const src = S.images[`${kind}/${id}`];
  if (!src) return;
  const img = await new Promise((resolve, reject) => { const i = new Image(); i.onload = () => resolve(i); i.onerror = reject; i.src = src; });
  let w = img.naturalWidth; let h = img.naturalHeight;
  if (S.size !== 'native') { const k = Number(S.size) / Math.max(w, h); w = Math.round(w * k); h = Math.round(h * k); }
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, w, h);
  const ext = S.fmt === 'png' ? 'png' : S.fmt === 'jpg' ? 'jpg' : 'webp';
  const mime = ext === 'png' ? 'image/png' : ext === 'jpg' ? 'image/jpeg' : 'image/webp';
  const blob = await new Promise((r) => cv.toBlob(r, mime, 0.92));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${id}.${ext}`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  setStatus(`บันทึก ${id}.${ext} (${w}×${h}) แล้ว → วางที่ public/art/custom/${kind}/`, 'ok');
}

async function runBatch() {
  const kind = S.kind;
  const list = ids();
  S.batch = { stop: false };
  S.busy = true;
  render();
  let done = 0;
  for (const id of list) {
    if (S.batch.stop) break;
    try { await generateOne(kind, id, buildPrompt(kind, id)); done++; } catch (e) { setStatus(`「${label(kind, id)}」ล้มเหลว: ${e.message}`, 'err'); }
    if (S.kind === kind) { S.id = id; S.prompt = buildPrompt(kind, id); render(); }
    await new Promise((r) => setTimeout(r, 1500));
  }
  S.batch = null;
  S.busy = false;
  render();
  setStatus(`สร้างภาพเสร็จ ${done}/${list.length} ใบ`, 'ok');
}

document.addEventListener('click', async (e) => {
  const k = e.target.closest('[data-kind]');
  if (k) { S.kind = k.dataset.kind; S.id = ids()[0]; S.prompt = buildPrompt(); S.edited = false; S.status = ''; render(); return; }
  const s = e.target.closest('[data-id]');
  if (s) { S.id = s.dataset.id; S.prompt = buildPrompt(); S.edited = false; if (!S.batch) S.status = ''; render(); return; }
  const a = e.target.closest('[data-act]');
  if (!a) return;
  switch (a.dataset.act) {
    case 'reprompt': S.prompt = buildPrompt(); render(); break;
    case 'gen':
      S.busy = true; render();
      try { await generateOne(S.kind, S.id, S.prompt); } catch (err) { setStatus(`สร้างไม่สำเร็จ: ${err.message}`, 'err'); }
      S.busy = false; { const st = [S.status, S.statusCls]; render(); setStatus(...st); }
      break;
    case 'save': await saveImage(); break;
    case 'batch': runBatch(); break;
    case 'stop': if (S.batch) S.batch.stop = true; break;
    default:
  }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.id === 'prompt') { S.prompt = t.value; S.edited = true; }
  if (t.id === 'key') { S.key = t.value.trim(); store.set('studio_key', S.key); }
  if (t.id === 'model') { S.model = t.value.trim(); store.set('studio_model', S.model); }
});
document.addEventListener('change', (e) => {
  const t = e.target;
  if (t.id === 'style') { S.style = t.value; store.set('studio_style', t.value); if (!S.edited) { S.prompt = buildPrompt(); render(); } }
  if (t.id === 'size') { S.size = t.value; store.set('studio_size', t.value); }
  if (t.id === 'fmt') { S.fmt = t.value; store.set('studio_fmt', t.value); render(); }
  if (t.id === 'auto') { S.autoSave = t.checked; store.set('studio_auto', t.checked ? '1' : '0'); }
  if (t.id === 'upload' && t.files[0]) {
    const r = new FileReader();
    r.onload = () => { S.images[slotKey()] = r.result; render(); setStatus('โหลดภาพของคุณแล้ว — ตรวจดูในกรอบการ์ด แล้วกดบันทึก', 'ok'); };
    r.readAsDataURL(t.files[0]);
  }
});

init().catch((e) => { document.getElementById('app').innerHTML = `<div class="loading">โหลดไม่สำเร็จ: ${esc(e.message)}</div>`; });
