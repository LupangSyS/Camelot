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

  /** การ์ดตัวละคร: ภาพ → ชื่อ → ฝ่าย/เพศ/เลือด → ทักษะ */
  function hero(M, artUrl, id, o = {}) {
    const h = M.heroes[id];
    const skills = h.skills.map((s) => {
      const sk = M.skills[s];
      return `<p><b>${esc(sk.name)}</b>${sk.lord ? ' <span class="badge host">ประมุข</span>' : ''} ${esc(sk.desc.replace(/^\((สกิลประมุข|จอมเวทแห่งอวาลอน)\)\s*/, ''))}</p>`;
    }).join('');
    const pick = o.pick ? `pick" data-act="hero" data-id="${esc(id)}` : '';
    const dk = M.dark && M.dark[id];
    const dark = dk ? `<div class="cf-dark" title="เมื่อเลือดเหลือ 1 หรือนาฬิกาหายนะถึง -5 เลือกจุติด้านมืดได้ 1 ครั้ง"><b>🌑 ด้านมืด: ${esc(dk.name)}</b> <small>${esc(dk.en)}</small>${dk.skills.map((s2) => `<p><b>${esc(M.skills[s2].name)}</b> ${esc(M.skills[s2].desc)}</p>`).join('')}</div>` : '';
    return `<div class="hcf k-${h.kingdom} ${o.cls || ''} ${pick}">
      <div class="hcf-art"${bg(artUrl('heroes', id))}>${artUrl('heroes', id) ? '' : `<span>${esc(h.en[0])}</span>`}</div>
      <div class="cf-name">${esc(h.name)}<small class="cf-en">${esc(h.en)} · ${esc(h.title)}</small></div>
      <div class="cf-type">${esc(M.kingdoms[h.kingdom].icon)} ${esc(M.kingdoms[h.kingdom].name)} · ${h.gender === 'f' ? 'หญิง' : 'ชาย'} · <span class="hcf-hp">${'❤'.repeat(h.hp)}</span></div>
      <div class="cf-text">${skills}${o.pick ? '' : dark}</div></div>`;
  }

  root.CardFace = { card, hero, typeLine, TYPE };
}(typeof self !== 'undefined' ? self : this));
