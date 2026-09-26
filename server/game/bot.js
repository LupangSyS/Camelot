'use strict';

// บอท: เดาฝ่ายจากพฤติกรรม (rebelScore) แล้วเล่นตามบทบาท
// รู้จักระบบใหม่ทั้งหมด: โซนโต๊ะกลม, ผสานรูน, แถบชะตา, สัตยาบัน และร่างวิญญาณ

const { CARD_INFO } = require('./cards');

const VALUE = { elixir: 9, dispel: 7, blessing: 7, aegis: 6, strike: 4, blood_duel: 4, blink: 5, petrify: 5, meteor: 3, siren: 3, blood_moon: 1 };
const value = (c) => (c ? VALUE[c.key] ?? 2 : 0);
const pickRandom = (a) => a[Math.floor(Math.random() * a.length)];

/** ลัทธิเงามืดที่ยังเหลืออยู่ (นับจากสัดส่วนบทบาทที่เปิดเผย ลบด้วยผู้ที่สิ้นชีพและเปิดบทบาทแล้ว) */
function rebelsLeft(g) {
  return g.players.filter((p) => p.role === 'rebel').length - g.players.filter((p) => !p.alive && p.role === 'rebel').length;
}

function traitorsLeft(g) {
  return g.players.filter((p) => p.role === 'traitor' && p.alive).length;
}

function isEnemy(g, me, t) {
  if (!t || me === t) return false;
  const alive = g.alive().length;
  switch (me.role) {
    case 'lord':
    case 'loyalist': {
      if (t.role === 'lord') return false;
      if (t.rebelScore > 0) return true;
      // ลัทธิเงามืดหมดแล้ว: ถ้าจำนวนผู้ต้องสงสัยเท่ากับผู้แฝงตัวที่เหลือ ก็รู้ได้ทันทีว่าเป็นใคร
      if (rebelsLeft(g) === 0) {
        const suspects = g.alive().filter((q) => q.role !== 'lord' && q !== me);
        if (suspects.length > 0 && suspects.length <= traitorsLeft(g)) return true;
      }
      return false;
    }
    case 'rebel':
      return t.role === 'lord' || t.rebelScore < 0;
    case 'traitor':
      // ผู้แฝงตัว: ปกป้องกษัตริย์จนเหลือดวลกันสองคน → กำจัดลัทธิเงามืดก่อน แล้วค่อยหันดาบใส่อัศวิน
      if (alive <= 2) return true;
      if (t.role === 'lord') return false;
      // ลัทธิเงามืดหมดแล้ว: ยังแกล้งภักดีต่อ และลอบสังหารอัศวินเฉพาะเมื่อได้เปรียบ (เลือดน้อยจนปิดได้ หรือเลือดเราสูงกว่า)
      if (rebelsLeft(g) === 0) return t.hp <= 2 || t.hp < me.hp || t.rebelScore > 0;
      {
        // รักษาสมดุล: ช่วยกษัตริย์เฉพาะเมื่อพระองค์ตกอยู่ในอันตราย และเล็งเฉพาะลัทธิเงามืดที่เผยตัวชัดเจน
        const lord = g.players.find((q) => q.role === 'lord');
        const danger = lord && lord.hp <= Math.ceil(lord.maxHp / 2);
        return t.rebelScore > (danger ? 0 : 2);
      }
    default:
      return false;
  }
}

function isFriend(g, me, t) {
  if (!t) return false;
  if (me === t) return true;
  switch (me.role) {
    case 'lord':
    case 'loyalist':
      // เมื่อลัทธิเงามืดหมดแล้ว ผู้แฝงตัวยังซ่อนอยู่ในหมู่อัศวิน — ไว้ใจได้เพียงกษัตริย์เท่านั้น
      return t.role === 'lord' || (t.rebelScore < 0 && rebelsLeft(g) > 0);
    case 'rebel':
      return t.role !== 'lord' && t.rebelScore > 1;
    case 'traitor':
      return t.role === 'lord' && g.alive().length > 2;
    default:
      return false;
  }
}

/** เป้าหมายที่สัตยาบันของบอทอนุญาตให้ทำร้าย */
function vowAllows(g, p, t) {
  const ts = g.ts;
  if (!ts || ts.player !== p || !ts.vow || ts.vowBroken) return true;
  if (ts.vow === 'mercy') return false;
  if (ts.vow === 'valor') return g.highestHp(p).has(t);
  return true;
}

/** เลือกศัตรูที่ดีที่สุดจากรายการที่นั่ง; ถ้าไม่มีศัตรูที่รู้ อาจสุ่มโจมตี (กันเกมไม่คืบ) */
function chooseEnemies(g, me, seats, max = 1, aggressive = true) {
  const ps = seats.map((s) => g.players[s]).filter((t) => vowAllows(g, me, t));
  // เป้าหมายหลักของลัทธิเงามืดคือกษัตริย์ — เว้นแต่ปิดชีพอัศวินได้ในการโจมตีเดียว
  const prio = (t) => (me.role === 'rebel' && t.role === 'lord' ? -10 : 0) + (t.hp <= 1 ? -20 : 0) + t.hp;
  let en = ps.filter((t) => isEnemy(g, me, t)).sort((a, b) => prio(a) - prio(b));
  if (!en.length && aggressive) {
    const neutral = ps.filter((t) => !isFriend(g, me, t));
    // ยิ่งความมืดใกล้กลืนคาเมลอต ฝ่ายกษัตริย์ยิ่งต้องเสี่ยงโจมตี
    // ยิ่งความมืดใกล้กลืนคาเมลอต (หรือเหลือแต่ผู้แฝงตัวซ่อนอยู่) ฝ่ายกษัตริย์ยิ่งต้องเสี่ยงโจมตี
    const endgame = rebelsLeft(g) === 0 ? 0.35 : 0;
    const urgency = me.role === 'rebel' ? 0.7 : me.role === 'traitor' ? 0.35 : Math.min(0.9, 0.35 + endgame + Math.max(0, -g.track) * 0.06);
    if (neutral.length && Math.random() < urgency) en = [pickRandom(neutral)];
  }
  return en.slice(0, max).map((t) => t.seat);
}

function cheapest(cards, n) {
  return [...cards].sort((a, b) => value(a) - value(b)).slice(0, n);
}

/** ประเมินโซน: ถ้ายืนที่ zone จะตีศัตรูได้กี่คน และศัตรูตีเราได้กี่คน */
function zoneScore(g, p, zone, wantAttack) {
  const old = p.zone;
  p.zone = zone;
  let s = 0;
  // ไม่รู้ว่าใครเป็นศัตรู แต่ต้องกดดัน (ช่วงท้ายเกม): เข้าใกล้ผู้ต้องสงสัยที่ไม่ใช่มิตร
  const hunt = wantAttack && (rebelsLeft(g) === 0 || g.track <= -4 || g.alive().length <= 3);
  for (const q of g.others(p)) {
    if (hunt && !isEnemy(g, p, q) && !isFriend(g, p, q) && g.inAttackRange(p, q)) s += 0.7;
    if (isEnemy(g, p, q)) {
      if (wantAttack && g.inAttackRange(p, q)) s += 2;
      if (g.inAttackRange(q, p)) s -= p.hp <= 2 ? 2 : 0.6;
    } else if (isFriend(g, p, q) && q.role === 'lord' && p.role === 'loyalist' && g.distance(p, q) <= 1) s += 0.8;
  }
  p.zone = old;
  return s;
}

function bestZone(g, p, zones, wantAttack) {
  let best = null;
  let bs = -Infinity;
  for (const z of zones) {
    const s = zoneScore(g, p, z, wantAttack) + Math.random() * 0.1;
    if (s > bs) { bs = s; best = z; }
  }
  return { zone: best, score: bs };
}

function play(g, p, req) {
  const us = req.usables;
  if (req.spectral) {
    const u = us[0];
    if (!u) return { end: true };
    const t = u.targets.candidates.map((s) => g.players[s]).find((q) => !isFriend(g, p, q)) || g.players[u.targets.candidates[0]];
    return { usable: u.id, targets: [t.seat] };
  }
  const byAs = (k) => us.filter((u) => u.as === k);
  const cardOf = (u) => u.cardIds && g.cardById.get(u.cardIds[0]);
  const direct = (u) => !u.skill && u.cardIds && cardOf(u).key === u.as;
  const go = (u, cards = u.cardIds || [], targets = []) => ({ usable: u.id, cards, targets });
  const mercy = g.ts && g.ts.vow === 'mercy' && !g.ts.vowBroken;
  const hasStrike = byAs('strike').length > 0;

  // อุปกรณ์
  for (const u of us) {
    if (!u.cardIds || u.skill) continue;
    const c = cardOf(u);
    const info = CARD_INFO[c.key];
    if (info.type !== 'equip') continue;
    const cur = p.equip[info.slot];
    if (!cur) return go(u);
    if (info.slot === 'weapon' && (info.range || 1) > (CARD_INFO[cur.key].range || 1)) return go(u);
  }
  // ฟื้นฟู
  if (p.hp < p.maxHp) {
    const u = byAs('elixir').find(direct);
    if (u) return go(u);
  }
  const bl = byAs('blessing')[0];
  if (bl) return go(bl);

  // เคลื่อนที่: หาโซนที่ตีศัตรูได้ หรือหลบเมื่อเลือดน้อย
  const mv = us.find((u) => u.special === 'move');
  if (mv) {
    const here = zoneScore(g, p, p.zone, hasStrike && !mercy);
    const { score } = bestZone(g, p, require('./engine').adjacentZones(p.zone), hasStrike && !mercy);
    if (score > here + 0.5) return go(mv);
  }

  const skill = (id) => us.find((u) => u.skill === id && !u.as);
  const hand = p.hand;

  // ทักษะที่เป็นประโยชน์
  let u = skill('heartstrings');
  if (u) {
    const t = u.targets.candidates.map((s) => g.players[s]).filter((q) => isFriend(g, p, q) && q.hp < q.maxHp).sort((a, b) => a.hp - b.hp)[0];
    if (t) return go(u, cheapest(hand, 1).map((c) => c.id), [t.seat]);
  }
  u = skill('grail_touch');
  if (u && p.hp >= 3) {
    const t = u.targets.candidates.map((s) => g.players[s]).find((q) => isFriend(g, p, q) && (q.judgeZone.length || q.hand.length < 2));
    if (t) return go(u, [], [t.seat]);
  }
  if (!mercy) {
    for (const id of ['shadow_glamour', 'scandal']) {
      u = skill(id);
      if (!u) continue;
      const t = chooseEnemies(g, p, u.targets.candidates, 1, id === 'shadow_glamour');
      if (t.length) return go(u, [], t);
    }
    u = skill('watery_grave');
    if (u) {
      const t = chooseEnemies(g, p, u.targets.candidates, 1, false);
      if (t.length) return go(u, cheapest(u.pick.pool.map((id) => g.cardById.get(id)), 1).map((c) => c.id), t);
    }
    u = skill('incite');
    if (u) {
      const en = u.targets.candidates.filter((s) => isEnemy(g, p, g.players[s]) && vowAllows(g, p, g.players[s]));
      if (en.length >= 2) return go(u, [u.pick.pool[0]], en.slice(0, 2));
    }
  }

  // ผสานรูน
  const weave = (id) => us.find((x) => x.weave === id);
  const runeCards = (x) => {
    const pool = x.pick.pool.map((id) => g.cardById.get(id));
    const [a, b] = x.runes;
    const first = cheapest(pool.filter((c) => c.suit === a), 1)[0];
    const second = cheapest(pool.filter((c) => c.suit === b && c !== first), 1)[0];
    return first && second ? [first, second] : null;
  };
  const affordable = (cs, limit) => cs && value(cs[0]) + value(cs[1]) <= limit;
  const tryWeave = (id, limit, pickT) => {
    const x = weave(id);
    if (!x) return null;
    const cs = runeCards(x);
    if (!affordable(cs, limit)) return null;
    let t = [];
    if (x.targets) {
      t = pickT(x.targets.candidates);
      if (!t || !t.length) return null;
    }
    return go(x, cs.map((c) => c.id), t);
  };
  const threatened = g.others(p).some((q) => isEnemy(g, p, q) && g.inAttackRange(q, p));
  let w = null;
  if (p.hp <= 2 && threatened) w = tryWeave('spikes', 12, () => []) || tryWeave('bulwark', 12, () => [p.seat]);
  if (!w) {
    const friendCursed = (c) => { const t = c.map((s) => g.players[s]).find((q) => isFriend(g, p, q) && q.judgeZone.length); return t ? [t.seat] : null; };
    w = tryWeave('cleanse', 12, friendCursed);
  }
  if (!w && !mercy) {
    const en = (c) => chooseEnemies(g, p, c, 1, false);
    w = tryWeave('inferno', 10, en) || tryWeave('drain', 10, en) || tryWeave('firebolt', 9, en)
      || tryWeave('theft', 8, (c) => chooseEnemies(g, p, c.filter((s) => g.players[s].hand.length >= 2), 1, false))
      || tryWeave('seal', 8, en) || tryWeave('shatter', 7, (c) => chooseEnemies(g, p, c, 1, false));
  }
  if (!w && p.role === 'lord' && threatened) w = tryWeave('bulwark', 9, () => [p.seat]);
  if (w) return w;

  // แถบชะตา
  const ritual = us.find((x) => x.special === 'ritual');
  const quest = us.find((x) => x.special === 'quest');
  const spare = hand.length > p.hp || cheapest(hand, 2).every((c) => value(c) <= 3);
  if (ritual && p.role === 'rebel' && (p.hp >= 3 || g.track <= -7)) {
    const revealed = p.rebelScore > 2;
    if (Math.random() < (g.track <= -6 ? 0.9 : g.track <= -3 ? 0.55 : revealed ? 0.45 : 0.2)) {
      const hearts = hand.filter((c) => c.suit === 'heart' && value(c) <= 5);
      const cs = hearts.length ? cheapest(hearts, 1) : cheapest(hand, 1);
      return go(ritual, cs.map((c) => c.id));
    }
  }
  const fodder = hand.filter((c) => c.key !== 'strike' || !hasStrike);
  // ผู้แฝงตัวแพ้ถ้าสุริยุปราคาสมบูรณ์ จึงต้านความมืดด้วย (แต่ไม่ช่วยให้จอกปรากฏ เพราะกษัตริย์จะอมตะ)
  const questChance = p.role === 'traitor' ? (g.track <= -6 ? 0.85 : g.track <= -3 ? 0.35 : 0)
    : (p.role === 'lord' || p.role === 'loyalist') ? (g.track <= -7 ? 0.8 : g.track <= -4 ? 0.45 : g.track >= 4 ? 0.05 : 0.1) : 0;
  if (quest && fodder.length >= 2 && (spare || g.track <= -6) && Math.random() < questChance) {
    const clubs = fodder.filter((c) => c.suit === 'club');
    const cs = clubs.length >= 2 && cheapest(clubs, 2).every((c) => value(c) <= 5) ? cheapest(clubs, 2) : cheapest(fodder, 2);
    return go(quest, cs.map((c) => c.id));
  }

  if (!mercy) {
    // มหาเวทใส่ศัตรู
    for (const k of ['petrify', 'blink', 'blood_duel']) {
      for (const x of byAs(k)) {
        const t = chooseEnemies(g, p, x.targets.candidates, 1, k !== 'blood_duel');
        if (t.length) return go(x, x.cardIds, t);
      }
    }
    const sr = byAs('siren')[0];
    if (sr) {
      for (const a of sr.targets.candidates) {
        const b = chooseEnemies(g, p, sr.targets.second[a], 1, false);
        if (b.length && b[0] !== a) return go(sr, sr.cardIds, [a, b[0]]);
      }
    }
    const mt = byAs('meteor')[0];
    if (mt && !(g.ts && g.ts.vow === 'valor')) {
      const others = g.others(p);
      const foes = others.filter((t) => isEnemy(g, p, t)).length;
      const pals = others.filter((t) => isFriend(g, p, t)).length;
      if (foes >= pals || Math.random() < 0.3) return go(mt);
    }
    const bm = byAs('blood_moon')[0];
    if (bm && Math.random() < 0.3) return go(bm);

    // ศรเวท
    const attacks = [...byAs('strike')].sort((a, b) => (a.skill ? 1 : 0) - (b.skill ? 1 : 0));
    for (const x of attacks) {
      const t = chooseEnemies(g, p, x.targets.candidates, x.targets.max);
      if (!t.length) continue;
      return go(x, x.cardIds || [], t);
    }
  }
  return { end: true };
}

function respond(g, p, req) {
  const ch = req.choices;
  const ctx = req.ctx || {};
  const take = (c) => (c.pick ? { choice: c.id, cards: cheapest(p.hand.filter((x) => c.pick.pool.includes(x.id)), c.pick.min).map((x) => x.id) } : { choice: c.id });
  const best = () => {
    const sp = ch.filter((c) => c.special === 'armor');
    if (sp.length) return take(sp[0]);
    const cards = ch.filter((c) => c.cardIds).sort((a, b) => value(g.cardById.get(a.cardIds[0])) - value(g.cardById.get(b.cardIds[0])));
    if (cards.length) return take(cards[0]);
    const other = ch.find((c) => c.pick || c.special);
    return other ? take(other) : { pass: true };
  };
  switch (req.kind) {
    case 'aegis':
    case 'strike': {
      if (ctx.use) {
        const t = g.players[ctx.targetSeat];
        if (ctx.reason === 'siren') return isFriend(g, p, t) && g.weapons(p).length ? { pass: true } : best();
        return isFriend(g, p, t) ? { pass: true } : best();
      }
      return best();
    }
    case 'elixir': {
      const t = g.players[ctx.dyingSeat];
      if (t === p || isFriend(g, p, t)) return best();
      return { pass: true };
    }
    case 'dispel': {
      const t = g.players[ctx.targetSeat];
      const harmful = !['blessing'].includes(ctx.trickKey);
      if (!ctx.negated && harmful && isFriend(g, p, t)) return best();
      if (ctx.negated && harmful && isEnemy(g, p, t) && Math.random() < 0.5) return best();
      if (!ctx.negated && !harmful && isEnemy(g, p, t) && Math.random() < 0.3) return best();
      return { pass: true };
    }
    default:
      return { pass: true };
  }
}

function select(g, p, req) {
  const items = req.items;
  const n = Math.max(req.min, 0);
  const byValue = (desc) => [...items].sort((a, b) => (desc ? value(b.card) - value(a.card) : value(a.card) - value(b.card)));
  switch (req.kind) {
    case 'discard':
    case 'challenge':
      return { refs: byValue(false).slice(0, n).map((i) => i.ref) };
    case 'glamour':
    case 'peerless': {
      const cheap = byValue(false)[0];
      if (!cheap) return { refs: [] };
      if (req.kind === 'peerless' && value(cheap.card) > 4) return { refs: [] };
      return { refs: [cheap.ref] };
    }
    case 'bardic': {
      const cheap = byValue(false)[0];
      return { refs: cheap && value(cheap.card) <= 4 ? [cheap.ref] : [] };
    }
    case 'logistics_keep':
    case 'sword_stone':
      return { refs: byValue(true).slice(0, Math.max(1, n)).map((i) => i.ref) };
    case 'logistics_gift': {
      const friends = g.others(p).filter((q) => isFriend(g, p, q));
      return { refs: friends.length && items.length ? [items[0].ref] : [] };
    }
    case 'gift_card':
      return { refs: byValue(false).slice(0, 1).map((i) => i.ref) };
    case 'omniscience':
      return { refs: items.filter((i) => value(i.card) <= 2).map((i) => i.ref) };
    case 'truth_seeker': {
      const good = items.find((i) => require('./engine').judgeGood(req.ctx && req.ctx.reason, i.card));
      return { refs: [(good || items[0]).ref] };
    }
    case 'whisper':
      return { refs: [] };
    case 'take': {
      const t = g.players[req.targetSeat];
      if (t && isFriend(g, p, t)) {
        const j = items.find((i) => i.zone === 'judge');
        if (j) return { refs: [j.ref] };
      }
      const eq = items.filter((i) => i.zone === 'equip');
      if (eq.length && Math.random() < 0.5) return { refs: [pickRandom(eq).ref] };
      return { refs: [pickRandom(items).ref] };
    }
    default:
      return { refs: items.slice(0, n).map((i) => i.ref) };
  }
}

function players(g, p, req) {
  const ps = req.candidates.map((s) => g.players[s]);
  switch (req.kind) {
    case 'fate_swap': {
      const en = ps.filter((q) => isEnemy(g, p, q));
      if (en.length && p.hand.length) return { seats: [en[0].seat] };
      return { seats: [] };
    }
    case 'philter': {
      const lord = ps.find((q) => q.role === 'lord');
      if (lord && p.role !== 'rebel') return { seats: [lord.seat] };
      return { seats: [pickRandom(ps).seat] };
    }
    case 'gift':
    case 'mercy': {
      const f = ps.filter((q) => isFriend(g, p, q)).sort((a, b) => a.hp - b.hp);
      const pick = f[0] || ps.find((q) => q === p) || ps.find((q) => !isEnemy(g, p, q)) || ps[0];
      return { seats: [pick.seat] };
    }
    default:
      return { seats: req.candidates.slice(0, req.min) };
  }
}

function vow(g, p, req) {
  const has = (id) => req.options.some((o) => o.id === id);
  const hand = p.hand;
  const strikes = hand.filter((c) => c.key === 'strike').length;
  if (has('valor') && strikes) {
    const top = g.highestHp(p);
    if ([...top].some((t) => isEnemy(g, p, t) && g.inAttackRange(p, t)) && Math.random() < 0.7) return { option: 'valor' };
  }
  if (has('mercy') && p.role === 'traitor' && rebelsLeft(g) === 0 && p.hp <= p.maxHp - 2 && !strikes) return { option: 'mercy' };
  const woundedFriend = g.alive().some((q) => isFriend(g, p, q) && q.hp < q.maxHp);
  if (has('mercy') && !strikes && hand.length <= 3 && woundedFriend && Math.random() < 0.25) return { option: 'mercy' };
  if (has('tithe') && p.hp >= 3 && hand.length <= 2 && Math.random() < 0.4) return { option: 'tithe' };
  return { option: 'none' };
}

function option(g, p, req) {
  const has = (id) => req.options.some((o) => o.id === id);
  const ctx = req.ctx || {};
  switch (req.kind) {
    case 'vow':
      return vow(g, p, req);
    case 'move': {
      const { zone } = bestZone(g, p, req.options.map((o) => o.id), p.hand.some((c) => c.key === 'strike'));
      return { option: zone };
    }
    case 'telekinesis': {
      const t = g.players[req.targetSeat];
      const friend = isFriend(g, p, t);
      let best = req.options[0].id;
      let bs = -Infinity;
      for (const o of req.options) {
        const old = t.zone;
        t.zone = o.id;
        let s = 0;
        for (const q of g.others(t)) {
          const threat = g.inAttackRange(q, t) ? 1 : 0;
          if (isEnemy(g, p, q)) s += friend ? -threat : 0;
          if (isFriend(g, p, q)) s += friend ? 0 : threat - (g.inAttackRange(t, q) ? 1 : 0);
        }
        t.zone = old;
        if (s > bs) { bs = s; best = o.id; }
      }
      return { option: best };
    }
    case 'cacophony': {
      const src = g.players[req.sourceSeat];
      return { option: isFriend(g, p, src) || p.hand.length <= 1 ? 'refuse' : 'discard' };
    }
    case 'soul_curse':
      return { option: p.hp <= 2 ? 'discard' : 'hp' };
    case 'prosthetic':
      return { option: 'weapon' };
    case 'exalted':
    case 'devotion': {
      const t = g.players[ctx.targetSeat];
      if (req.kind === 'devotion' && p.hp <= 1) return { option: 'no' };
      return { option: isFriend(g, p, t) ? 'yes' : 'no' };
    }
    case 'dolorous': {
      const t = g.players[ctx.targetSeat];
      return { option: p.hp >= 3 && t && (isEnemy(g, p, t) || t.hp <= 3) ? 'yes' : 'no' };
    }
    case 'flicker': {
      const t = g.players[ctx.judgeSeat];
      const good = require('./engine').judgeGood(ctx.reason, ctx.judgeCard);
      const want = isFriend(g, p, t) ? !good : isEnemy(g, p, t) && good;
      return { option: want ? 'yes' : 'no' };
    }
    case 'spectral_shield': {
      const t = g.players[ctx.targetSeat];
      return { option: isFriend(g, p, t) && p.role !== 'traitor' ? 'yes' : 'no' };
    }
    case 'logistics':
      return { option: 'yes' };
    case 'rend':
      return { option: 'yes' };
    default:
      if (has('yes')) return { option: 'yes' };
      return { option: req.defaultOption || req.options[0].id };
  }
}

function decide(g, p, req) {
  switch (req.type) {
    case 'hero': return { hero: pickRandom(req.heroes) };
    case 'play': return play(g, p, req);
    case 'respond': return respond(g, p, req);
    case 'select': return select(g, p, req);
    case 'players': return players(g, p, req);
    case 'option': return option(g, p, req);
    default: return null;
  }
}

module.exports = { decide, isEnemy, isFriend, rebelsLeft };
