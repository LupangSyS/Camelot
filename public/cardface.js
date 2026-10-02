/* หน้าการ์ดและการ์ดตัวละคร (ภาพ → ชื่อ → ประเภท → ผลของการ์ด) ใช้ร่วมกันระหว่างเกมและคลังภาพ */
(function (root) {
  'use strict';

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const TYPE = { basic: 'ศิลปะการต่อสู้พื้นฐาน', trick: 'มหาเวทฉับพลัน', delayed: 'คำสาปหน่วงเวลา', equip: 'ยุทโธปกรณ์' };
  const SLOT = { weapon: 'ศาสตราวุธ', weapon2: 'ศาสตราวุธ', armor: 'เครื่องราง/เกราะ', defHorse: 'พาหนะรับ +1', offHorse: 'พาหนะบุก -1' };
  const ELEMENT = { club: 'Aegis', diamond: 'Ignis', spade: 'Aether', heart: 'Umbra' };
  const bg = (url) => (url ? ` style="background-image:url('${esc(url)}')"` : '');

  function typeLine(info) {
    if (info.type !== 'equip') return TYPE[info.type];
    return `${SLOT[info.slot]}${info.range ? ` · ระยะ ${info.range}` : ''}`;
  }

  /**
   * @param {object} M  ข้อมูลเกม (cards, suits, ranks, heroes, skills, kingdoms)
   * @param {(kind:string,id:string)=>string|null} artUrl
   * @param {object|null} c การ์ด {key, suit, rank, as} หรือ null = หลังไพ่
   * @param {{cls?:string, attrs?:string, mini?:boolean}} [o]
   */
  function card(M, artUrl, c, o = {}) {
    const cls = o.cls || '';
    const attrs = o.attrs || '';
    if (!c) {
      const back = artUrl('misc', 'back');
      return `<div class="card cf back ${o.mini ? 'mini' : ''} ${cls}" ${attrs}${bg(back)}>${back ? '' : '⚜'}</div>`;
    }
    const shown = c.as && c.as !== c.key ? c.as : c.key;
    const info = M.cards[shown];
    const base = M.cards[c.key];
    const red = c.suit === 'heart' || c.suit === 'diamond';
    const corner = c.suit ? `<div class="cf-corner ${red ? 'red' : ''}" title="รูน ${ELEMENT[c.suit]}">${M.ranks[c.rank] || ''}<br>${M.suits[c.suit] || ''}</div>` : '';
    const range = !o.mini && info.range ? `<div class="cf-range">⚔${info.range}</div>` : '';
    const conv = shown !== c.key ? `<div class="cf-as">จาก ${esc(base.name)}</div>` : '';
    const art = artUrl('cards', shown);
    const head = `<div class="cf-art"${bg(art)}>${corner}${range}${conv}</div><div class="cf-name">${esc(info.name)}</div>`;
    if (o.mini) return `<div class="card cf mini t-${info.type} ${cls}" ${attrs} title="${esc(`${info.name}: ${info.desc}`)}">${head}</div>`;
    return `<div class="card cf t-${info.type} ${cls}" ${attrs} title="${esc(`${info.name}: ${info.desc}`)}">
      ${head}<div class="cf-type">${esc(typeLine(info))}</div><div class="cf-text">${esc(info.short || info.desc)}</div></div>`;
  }

  /**
   * การ์ดฮีโร่แบบกรอบตามขั้วอำนาจ: หัว (เลือด · ชื่อ · ความหายาก) → ภาพ → ริบบิ้น → ทักษะ + คำคม → ท้าย (เลือด · รหัส · ตราฝ่าย)
   * @param {{pick?:boolean, cls?:string, dark?:boolean, art?:string}} [o] dark = แสดงด้านมืด, art = บังคับใช้ภาพนี้ (สตูดิโอ)
   */
  function hero(M, artUrl, id, o = {}) {
    const h = M.heroes[id];
    const lore = (M.lore && M.lore[id]) || {};
    const dk = M.dark && M.dark[id];
    const dark = !!(o.dark && dk);
    const k = M.kingdoms[h.kingdom];
    const skillIds = dark ? dk.skills : h.skills;
    const skills = skillIds.map((s) => {
      const sk = M.skills[s];
      return `<p><b>${esc(sk.name)}</b>${sk.lord ? ' <span class="hc-lord">ประมุข</span>' : ''}: ${esc(sk.desc.replace(/^\((สกิลประมุข|จอมเวทแห่งอวาลอน)\)\s*/, ''))}</p>`;
    }).join('');
    const pick = o.pick ? `pick" data-act="hero" data-id="${esc(id)}` : '';
    const art = o.art || (dark && artUrl('dark', id)) || artUrl('heroes', id);
    const rar = M.rarity && M.rarity[lore.rarity || 'rare'];
    const serial = String(Object.keys(M.heroes).indexOf(id) + 1).padStart(2, '0');
    const name = dark ? dk.en : h.en;
    const thName = dark ? dk.name : h.name;
    const darkInfo = dk && !dark && !o.pick
      ? `<div class="hc-darkside" title="เมื่อเลือดเหลือ 1 หรือนาฬิกาหายนะถึง -5 เลือกจุติด้านมืดได้ 1 ครั้ง"><b>🌑 ด้านมืด: ${esc(dk.name)}</b>${dk.skills.map((s2) => `<p><b>${esc(M.skills[s2].name)}</b>: ${esc(M.skills[s2].desc)}</p>`).join('')}</div>`
      : '';
    return `<div class="hcf f-${dark ? 'dark' : h.kingdom} r-${esc(lore.rarity || 'rare')} ${o.cls || ''} ${pick}">
      <div class="hc-head"><span class="hc-hp" title="พลังชีวิต">${h.hp}</span>
        <div class="hc-names"><b>${esc(name)}</b><small>${esc(thName)}</small></div>
        <span class="hc-rar">${esc(rar ? rar.name : 'RARE')}</span></div>
      <div class="hc-art"${bg(art)}>${art ? '' : `<span>${esc(h.en[0])}</span>`}<i class="g tl"></i><i class="g tr"></i><i class="g bl"></i><i class="g br"></i></div>
      <div class="hc-ribbon"><i>${esc(k.icon)}</i><span><b>✦ ${esc(h.title)}</b> · <b>${esc(k.name)} ✦</b></span><i>${h.gender === 'f' ? '♀' : '♂'}</i></div>
      <div class="hc-text">${skills}${darkInfo}${lore.quote ? `<div class="hc-div">◆</div><q>${esc(lore.quote)}</q>` : ''}</div>
      <div class="hc-foot"><span class="hc-stat hp">❤ ${h.hp}</span><span class="hc-serial">CAMELOT • ${serial}</span><span class="hc-stat fac" title="${esc(k.en)}">${esc(k.icon)}</span></div>
    </div>`;
  }

  root.CardFace = { card, hero, typeLine, TYPE };
}(typeof self !== 'undefined' ? self : this));
