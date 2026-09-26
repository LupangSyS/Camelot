'use strict';

// CAMELOT: ARCANE REALM — กฎเกม (async state machine: ทุกการตัดสินใจคือ prompt ที่ await)
//
// ระบบหลัก
//   • โต๊ะกลมมนตรา: ระยะคำนวณจาก "โซน" ที่ฮีโร่ยืน ไม่ใช่ที่นั่ง  (ZONES)
//   • ผสานรูน: การ์ดทุกใบคืออักขระรูนตามธาตุ นำ 2 ใบมาผสานเป็นมหาเวท  (WEAVES)
//   • นาฬิกาหายนะ/จอกศักดิ์สิทธิ์: แถบ -10…+10 ที่เป็นเงื่อนไขชนะคู่ขนาน
//   • วิญญาณแห่งอวาลอน: ผู้ตายไม่ตกรอบ กลายเป็นวิญญาณที่มีเด็ควิญญาณ
//   • สัตยาบัน/พันธสัญญา: ประกาศต้นเทิร์นเพื่อรับพลัง แลกกับข้อผูกมัด

const { CARD_INFO, SUIT_SYMBOL, buildDeck, colorOf, isRed, isBlack, cardStr } = require('./cards');
const { HEROES, SKILLS, LORD_HEROES, ROLES } = require('./heroes');
const bot = require('./bot');

const ROLE_TABLE = {
  2: ['lord', 'rebel'],
  3: ['lord', 'rebel', 'traitor'],
  4: ['lord', 'loyalist', 'rebel', 'traitor'],
  5: ['lord', 'loyalist', 'rebel', 'rebel', 'traitor'],
  6: ['lord', 'loyalist', 'rebel', 'rebel', 'rebel', 'traitor'],
  7: ['lord', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'traitor'],
  8: ['lord', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'traitor'],
  9: ['lord', 'loyalist', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'traitor'],
  10: ['lord', 'loyalist', 'loyalist', 'loyalist', 'rebel', 'rebel', 'rebel', 'rebel', 'traitor', 'traitor'],
};

const PHASE_NAMES = {
  setup: 'เลือกฮีโร่', start: 'รุ่งอรุณ', judge: 'ผนึกคำสาป', draw: 'เบิกมนตรา',
  play: 'ร่ายเวทและทำศึก', discard: 'สละพลัง', finish: 'สนธยา', spectral: 'เทิร์นวิญญาณ', over: 'จบเกม',
};

// ── โต๊ะกลมมนตรา ──  วงแหวนรอบนอก 4 โซน (เรียงตามเข็มนาฬิกา) + ศูนย์กลางมนตรา
const ZONES = {
  throne: { name: 'วงแหวนบัลลังก์', en: 'The High Throne', icon: '♛' },
  bastion: { name: 'หอคอยเงามืด', en: 'Shadow Bastion', icon: '☾' },
  marches: { name: 'ทุ่งสงคราม', en: 'The Outer Marches', icon: '⚔' },
  sanctuary: { name: 'วิหารอวาลอน', en: 'Sanctuary Zone', icon: '✧' },
  nexus: { name: 'ศูนย์กลางมนตรา', en: 'Nexus Core', icon: '✺' },
};
const RING = ['throne', 'bastion', 'marches', 'sanctuary'];
/** ระยะพื้นฐานระหว่างโซน: โซนเดียวกัน 1 · ศูนย์กลาง↔ทุกโซน 1 · วงแหวนติดกัน 2 · ฝั่งตรงข้าม 3 */
function zoneDistance(a, b) {
  if (a === b || a === 'nexus' || b === 'nexus') return 1;
  const d = Math.abs(RING.indexOf(a) - RING.indexOf(b));
  return Math.min(d, 4 - d) === 1 ? 2 : 3;
}
function adjacentZones(z) {
  if (z === 'nexus') return [...RING];
  const i = RING.indexOf(z);
  return [RING[(i + 3) % 4], RING[(i + 1) % 4], 'nexus'];
}

// ── ผสานรูน ── ธาตุของการ์ด = อักขระรูน
const RUNES = {
  diamond: { name: 'Ignis', th: 'อัคคี' },
  club: { name: 'Aegis', th: 'พิทักษ์' },
  spade: { name: 'Aether', th: 'กระแสจิต' },
  heart: { name: 'Umbra', th: 'เงามืด' },
};
const WEAVES = {
  inferno: { runes: ['diamond', 'diamond'], name: 'มหาเพลิงผลาญ', en: 'Inferno', harmful: true, desc: 'เป้าหมายในระยะโจมตีต้องใช้ม่านบาเรีย มิฉะนั้นได้รับความเสียหายธาตุไฟ 2 (ทะลุเกราะ)' },
  firebolt: { runes: ['diamond', 'spade'], name: 'ศรเพลิงวิถีไกล', en: 'Long-range Firebolt', harmful: true, desc: 'ยิงข้ามโซนใส่ผู้เล่นคนใดก็ได้ ต้องใช้ม่านบาเรีย มิฉะนั้นได้รับความเสียหายธาตุไฟ 1' },
  shatter: { runes: ['diamond', 'club'], name: 'ระเบิดล้างเกราะ', en: 'Shatter', harmful: true, desc: 'ทำลายอุปกรณ์ 1 ชิ้นของผู้เล่นในระยะ 2' },
  drain: { runes: ['diamond', 'heart'], name: 'เพลิงดูดวิญญาณ', en: 'Soul Drain', harmful: true, desc: 'เป้าหมายในระยะโจมตีต้องใช้ม่านบาเรีย มิฉะนั้นได้รับความเสียหาย 1 และคุณฟื้นฟูเลือด 1' },
  bulwark: { runes: ['club', 'club'], name: 'ปราการศักดิ์สิทธิ์', en: 'Sanctified Bulwark', desc: 'มอบม่านป้องกันแก่ตนเองหรือผู้เล่นในระยะ 1: ป้องกันความเสียหายครั้งถัดไป (อยู่จนถึงเทิร์นถัดไปของเขา)' },
  cleanse: { runes: ['club', 'spade'], name: 'แสงชำระคำสาป', en: 'Cleansing Light', desc: 'ลบล้างคำสาปทั้งหมดของผู้เล่น 1 คน แล้วผู้นั้นจั่ว 1 ใบ' },
  spikes: { runes: ['club', 'heart'], name: 'เกราะหนามทมิฬ', en: 'Cursed Spikes', desc: 'ป้องกันความเสียหายครั้งถัดไปของคุณ และผู้ทำความเสียหายต้องสุ่มทิ้งการ์ด 1 ใบ' },
  telekinesis: { runes: ['spade', 'spade'], name: 'คลื่นจิตผลัก/ดึง', en: 'Telekinesis', harmful: true, desc: 'ผลักหรือดึงผู้เล่นในระยะ 2 ไปยังโซนที่ติดกับโซนเดิมของเขา' },
  theft: { runes: ['spade', 'heart'], name: 'หัตถ์มายาข้ามมิติ', en: 'Mind Theft', harmful: true, desc: 'สุ่มหยิบการ์ดในมือ 1 ใบของผู้เล่นใดก็ได้ (ไม่จำกัดระยะ)' },
  seal: { runes: ['heart', 'heart'], name: 'ผนึกอัมบรา', en: 'Seal of Umbra', harmful: true, desc: 'ผู้เล่นในระยะ 2 สุ่มทิ้งการ์ดในมือ 1 ใบ และถูกผนึกทักษะจนจบเทิร์นถัดไปของเขา' },
};

// ── สัตยาบันและพันธสัญญา ──
const VOWS = {
  valor: { name: 'สัตยาบันแห่งความกล้า', en: 'Vow of Valor', kind: 'vow', desc: 'เทิร์นนี้จะเล่นการ์ด/เวททำร้ายเฉพาะผู้เล่นที่มีเลือดสูงสุด → ศรเวททำความเสียหาย +1 และป้องกันไม่ได้' },
  mercy: { name: 'สัตยาบันแห่งความเมตตา', en: 'Vow of Mercy', kind: 'vow', desc: 'เทิร์นนี้จะไม่ทำความเสียหายใส่ใครเลย → จบเทิร์นฟื้นฟูเลือดรวม 2 ให้ตนเองหรือผู้เล่นอื่น 1 คน' },
  tithe: { name: 'พันธสัญญาโลหิต', en: 'Blood Tithe', kind: 'pact', desc: 'สละเลือด 1 ทันที → จั่วการ์ด 3 ใบ' },
};

// ── เด็ควิญญาณ ──
const SPECTRAL = {
  whisper: { name: 'เสียงกระซิบจากสายหมอก', en: 'Whispering Fog', desc: 'แอบดูการ์ดในมือของผู้เล่นที่ยังมีชีวิต 1 คน (ใช้ในเทิร์นวิญญาณ) แล้วส่งสัญญาณใบ้ให้เพื่อนทางแชท' },
  flicker: { name: 'เปลี่ยนผันชะตา', en: 'Flicker Fate', desc: 'เมื่อมีการเปิดการ์ดตัดสิน สั่งให้เปิดใหม่อีก 1 ครั้ง' },
  shield: { name: 'สละไอวิญญาณ', en: 'Spectral Shield', desc: 'เมื่อผู้เล่นกำลังจะได้รับความเสียหายถึงตาย รับความเสียหายนั้นแทน (ป้องกันได้ 1 ครั้ง)' },
};
const SPECTRAL_ORDER = ['whisper', 'flicker', 'shield'];

const TRACK_MIN = -10;
const TRACK_MAX = 10;

const HARMFUL = new Set(['strike', 'blood_duel', 'blink', 'petrify', 'siren', 'meteor']);
const SINGLE_TARGET = new Set(['blink', 'blood_duel', 'siren', 'petrify']);
const JUDGE_NAMES = { petrify: CARD_INFO.petrify.name, blood_moon: CARD_INFO.blood_moon.name, pridwen: CARD_INFO.pridwen.name };

/** ผลตัดสินแบบใด "ดีต่อผู้ถูกตัดสิน" (ใช้กับ สัจธรรมชี้นำ / เปลี่ยนผันชะตา) */
function judgeGood(reason, c) {
  if (!c) return false;
  switch (reason) {
    case 'petrify': return c.suit === 'club';
    case 'blood_moon': return !(c.suit === 'spade' && c.rank >= 2 && c.rank <= 9);
    case 'pridwen': return isRed(c);
    default: return true;
  }
}

class GameOver extends Error {
  constructor(result) { super('game over'); this.result = result; }
}
class GameAborted extends Error {
  constructor() { super('game aborted'); }
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const uniq = (arr) => new Set(arr).size === arr.length;
const strip = (c) => (c ? { id: c.id, key: c.key, suit: c.suit, rank: c.rank, as: c.asKey || undefined } : null);
const emptyEquip = () => ({ weapon: null, weapon2: null, armor: null, defHorse: null, offHorse: null });

class Game {
  /**
   * @param {object} o
   * @param {{pid:string,name:string,isBot?:boolean}[]} o.players ลำดับที่นั่ง
   * @param {Function} [o.onUpdate] เรียกทุกครั้งที่สถานะเปลี่ยน
   * @param {number} [o.botDelay] หน่วงเวลาบอท (ms)
   * @param {object} [o.timeouts] { play, respond, negate, disconnected }
   * @param {number} [o.maxRounds] จำกัดจำนวนรอบ (0 = ไม่จำกัด) — ใช้ในการทดสอบ
   */
  constructor(o) {
    const n = o.players.length;
    if (!ROLE_TABLE[n]) throw new Error('จำนวนผู้เล่นต้องอยู่ระหว่าง 2-10 คน');
    this.onUpdate = o.onUpdate || (() => {});
    this.onEvent = o.onEvent || (() => {});
    this.botDelay = o.botDelay ?? 700;
    // จังหวะหยุดสั้นๆ หลังเหตุการณ์สำคัญ ให้ผู้เล่นดูแอนิเมชันทัน (0 = ไม่หยุด ใช้ในการทดสอบ)
    this.pace = o.pace ?? 0;
    this.id = Math.random().toString(36).slice(2, 10);
    this.tableSeq = 0;
    this.timeouts = { play: 90000, respond: 25000, negate: 12000, disconnected: 12000, ...(o.timeouts || {}) };
    this.maxRounds = o.maxRounds || 0;
    const roles = shuffle([...ROLE_TABLE[n]]);
    this.players = o.players.map((p, i) => ({
      pid: p.pid, name: p.name, isBot: !!p.isBot, connected: true, seat: i, role: roles[i],
      hero: null, hp: 0, maxHp: 0, gender: 'm', kingdom: '', alive: true, ghost: false,
      hand: [], equip: emptyEquip(), judgeZone: [], zone: 'marches',
      rebelScore: 0, ward: null, poisonedBy: null, sealTurns: 0, fallen: false, curseWard: false,
      decapUsed: false, philter: null, spectral: [], immortalTurns: 0, vow: null,
    }));
    const lordSeat = this.players.find((p) => p.role === 'lord').seat;
    for (const p of this.players) {
      const k = (p.seat - lordSeat + n) % n;
      p.zone = RING[k % 4];
    }
    const deck = buildDeck();
    this.cardById = new Map(deck.map((c) => [c.id, c]));
    this.deck = shuffle(deck);
    this.discard = [];
    this.pending = new Map();
    this.promptSeq = 0;
    this.logs = [];
    this.logSeq = 0;
    this.table = [];
    this.ts = null;
    this.round = 0;
    this.phase = 'setup';
    this.result = null;
    this.aborted = false;
    this.track = 0;
    this.grailFound = false;
    this.whispers = new Map(); // pid -> { seat, cards } ที่วิญญาณเห็นล่าสุด (ส่วนตัว)
  }

  // ════════════════════════════ utilities ════════════════════════════

  update() { this.onUpdate(); }

  /** เหตุการณ์ในเกมสำหรับให้บอทพูดคุย (ไม่มีผลต่อกติกา) */
  emit(type, data = {}) {
    try { this.onEvent({ type, ...data }); } catch (e) { console.error('event handler error', e); }
  }

  log(text) {
    this.logs.push({ id: ++this.logSeq, text });
    if (this.logs.length > 300) this.logs.splice(0, this.logs.length - 300);
    this.update();
  }

  pause(ms) {
    if (!this.pace || this.aborted) return Promise.resolve();
    return new Promise((r) => { const t = setTimeout(r, ms * this.pace); if (t.unref) t.unref(); });
  }

  pushTable(p, v, targets = [], label) {
    this.table.push({
      id: ++this.tableSeq,
      seat: p ? p.seat : null,
      as: v.key,
      cards: v.real.map(strip),
      targets,
      label: label || null,
    });
    if (this.table.length > 8) this.table.shift();
  }

  player(pid) { return this.players.find((p) => p.pid === pid); }
  alive() { return this.players.filter((p) => p.alive); }
  ghosts() { return this.players.filter((p) => p.ghost); }
  orderFrom(p) {
    const n = this.players.length;
    const out = [];
    for (let i = 0; i < n; i++) {
      const q = this.players[(p.seat + i) % n];
      if (q.alive) out.push(q);
    }
    return out;
  }
  others(p) { return this.orderFrom(p).filter((q) => q !== p); }
  nextAlive(p) {
    const n = this.players.length;
    for (let i = 1; i <= n; i++) {
      const q = this.players[(p.seat + i) % n];
      if (q.alive) return q;
    }
    return null;
  }
  /** ผู้เล่นคนถัดไปที่ยังอยู่ในวง (มีชีวิตหรือเป็นวิญญาณ) */
  nextSeat(p) {
    const n = this.players.length;
    for (let i = 1; i <= n; i++) {
      const q = this.players[(p.seat + i) % n];
      if (q.alive || q.ghost) return q;
    }
    return p;
  }

  hasSkill(p, id) {
    if (!p || !p.alive || !p.hero) return false;
    if (p.sealTurns > 0) return false;
    if (!HEROES[p.hero].skills.includes(id)) return false;
    if (SKILLS[id].lord && p.role !== 'lord') return false;
    return true;
  }
  equipCards(p) { return Object.values(p.equip).filter(Boolean); }
  hasAnyCard(p, withJudge = true) {
    return p.hand.length > 0 || this.equipCards(p).length > 0 || (withJudge && p.judgeZone.length > 0);
  }
  weapons(p) { return [p.equip.weapon, p.equip.weapon2].filter(Boolean); }
  hasWeapon(p, key) { return this.weapons(p).some((w) => w.key === key); }
  armorKey(p) { return p.equip.armor ? p.equip.armor.key : null; }
  isFlame(v) { return !!v && v.suit === 'diamond'; }
  solarActive(p) { return this.hasSkill(p, 'solar') && p.hand.length >= p.hp; }
  attackRange(p) {
    let r = Math.max(1, ...this.weapons(p).map((w) => CARD_INFO[w.key].range || 1));
    if (this.hasSkill(p, 'volley')) r = Math.max(r, 3);
    if (this.solarActive(p)) r++;
    return r;
  }
  distance(a, b) {
    if (a === b) return 0;
    let d = zoneDistance(a.zone, b.zone);
    if (b.equip.defHorse && !this.hasSkill(a, 'volley')) d++;
    if (this.hasSkill(b, 'veil')) d++;
    if (a.equip.offHorse) d--;
    return Math.max(1, d);
  }
  inAttackRange(a, b) { return a !== b && b.alive && this.distance(a, b) <= this.attackRange(a); }
  canBeAttacked(t) { return t.alive; }
  hasMantle(t) { return this.armorKey(t) === 'mantle'; }
  attackLimit(p) { return this.hasSkill(p, 'twinfang') ? 2 : 1; }
  canUseAttack(p) {
    return this.hasWeapon(p, 'carnwennan') || this.ts.attacksUsed < this.attackLimit(p);
  }
  canCurse(t, key) {
    if (!t.alive || this.hasSkill(t, 'sanctuary')) return false;
    if (t.judgeZone.some((c) => c.asKey === key)) return false;
    return true;
  }
  highestHp(p) {
    const others = this.others(p);
    const top = Math.max(...others.map((q) => q.hp));
    return new Set(others.filter((q) => q.hp === top));
  }

  makeV(key, real) {
    let color = null;
    let suit = null;
    if (real.length) {
      const cs = real.map(colorOf);
      color = cs.every((c) => c === cs[0]) ? cs[0] : null;
      suit = real.every((c) => c.suit === real[0].suit) ? real[0].suit : null;
    }
    return { key, real, color, suit, rank: real.length === 1 ? real[0].rank : null };
  }
  vName(v) {
    const name = CARD_INFO[v.key].name;
    if (!v.real.length) return `「${name}」`;
    if (v.real.length === 1 && v.real[0].key === v.key) return `「${cardStr(v.real[0])}」`;
    return `「${name}」(จาก ${v.real.map(cardStr).join(', ')})`;
  }

  drawOne() {
    if (!this.deck.length) {
      this.deck = shuffle(this.discard);
      this.discard = [];
      if (this.deck.length) this.log('สับสุสานกลับเป็นกองจั่ว');
    }
    return this.deck.pop() || null;
  }
  draw(p, n) {
    let got = 0;
    for (let i = 0; i < n; i++) {
      const c = this.drawOne();
      if (!c) break;
      p.hand.push(c);
      got++;
    }
    this.update();
    return got;
  }
  toDiscard(cards) {
    for (const c of cards) {
      if (!c) continue;
      delete c.asKey;
      this.discard.push(c);
    }
  }
  /** นำการ์ดออกจากพื้นที่ของเจ้าของ */
  removeCard(c) {
    for (const p of this.players) {
      const hi = p.hand.indexOf(c);
      if (hi >= 0) { p.hand.splice(hi, 1); return p; }
      for (const slot of Object.keys(p.equip)) {
        if (p.equip[slot] === c) { p.equip[slot] = null; return p; }
      }
      const ji = p.judgeZone.indexOf(c);
      if (ji >= 0) { p.judgeZone.splice(ji, 1); return p; }
    }
    return null;
  }
  discardCards(cards) {
    cards.forEach((c) => this.removeCard(c));
    this.toDiscard(cards);
  }
  obtain(p, c) {
    this.removeCard(c);
    delete c.asKey;
    p.hand.push(c);
  }
  randomHand(p) { return p.hand.length ? p.hand[Math.floor(Math.random() * p.hand.length)] : null; }

  noteHostile(src, t, amount = 1) {
    if (!src || src === t) return;
    if (t.role === 'lord') src.rebelScore += 2 * amount;
    else if (t.rebelScore > 0) src.rebelScore -= amount;
    else if (t.rebelScore < 0) src.rebelScore += amount;
  }
  noteFriendly(src, t) {
    if (!src || src === t) return;
    if (t.role === 'lord') src.rebelScore -= 2;
    else if (t.rebelScore > 0) src.rebelScore += 1;
    else if (t.rebelScore < 0) src.rebelScore -= 1;
  }

  // ════════════════════════════ prompts ════════════════════════════

  ask(p, req) {
    if (this.aborted) return Promise.reject(new GameAborted());
    const old = this.pending.get(p.pid);
    if (old) old.finish(null);
    return new Promise((resolve, reject) => {
      const id = ++this.promptSeq;
      req.id = id;
      const tmo = req.timeout || (req.type === 'play' ? this.timeouts.play : this.timeouts.respond);
      delete req.timeout;
      req.deadline = Date.now() + tmo;
      const entry = { id, p, req, timers: [], reject };
      entry.finish = (raw) => {
        if (this.pending.get(p.pid) !== entry) return;
        entry.timers.forEach(clearTimeout);
        this.pending.delete(p.pid);
        let ans = raw ? this.normalize(req, raw) : null;
        if (!ans) ans = this.normalize(req, this.fallback(req));
        this.update();
        resolve(ans);
      };
      this.pending.set(p.pid, entry);
      if (p.isBot) {
        this.scheduleBot(entry);
      } else {
        entry.timers.push(setTimeout(() => entry.finish(this.timeoutAnswer(p, req)), tmo));
        if (!p.connected) this.addDisconnectTimer(entry);
      }
      this.update();
    });
  }
  scheduleBot(entry) {
    const run = () => entry.finish(this.botAnswer(entry.p, entry.req));
    if (!this.botDelay) { setImmediate(run); return; }
    entry.timers.push(setTimeout(run, this.botDelay * (0.6 + Math.random() * 0.8)));
  }
  addDisconnectTimer(entry) {
    entry.timers.push(setTimeout(() => entry.finish(this.timeoutAnswer(entry.p, entry.req)), this.timeouts.disconnected));
  }
  botAnswer(p, req) {
    try { return bot.decide(this, p, req); } catch (e) { console.error('bot error', e); return null; }
  }
  timeoutAnswer(p, req) {
    if (req.type === 'play') return { end: true };
    if (req.kind === 'vow') return { option: 'none' };
    return this.botAnswer(p, req);
  }
  fallback(req) {
    switch (req.type) {
      case 'play': return { end: true };
      case 'respond': return { pass: true };
      case 'select': return { refs: req.items.slice(0, req.min).map((i) => i.ref) };
      case 'players': return { seats: req.candidates.slice(0, req.min) };
      case 'option': return { option: req.defaultOption || req.options[0].id };
      case 'hero': return { hero: req.heroes[0] };
      default: return null;
    }
  }
  /** ตรวจการเลือกการ์ดตามเงื่อนไข pick (จำนวน, กอง, และรูนที่ต้องใช้) */
  pickOk(cards, pick) {
    if (!uniq(cards) || cards.length < pick.min || cards.length > pick.max || !cards.every((c) => pick.pool.includes(c))) return false;
    if (pick.suits) {
      const got = cards.map((id) => this.cardById.get(id).suit).sort();
      const want = [...pick.suits].sort();
      if (got.join() !== want.join()) return false;
    }
    return true;
  }
  normalize(req, a) {
    if (!a || typeof a !== 'object') return null;
    const arr = (x) => (Array.isArray(x) ? x : []);
    const inRange = (n, spec) => n >= spec.min && n <= spec.max;
    switch (req.type) {
      case 'play': {
        if (a.end) return { end: true };
        const u = req.usables.find((x) => x.id === a.usable);
        if (!u) return null;
        let cards = [];
        if (u.cardIds) cards = u.cardIds;
        else if (u.pick) {
          cards = arr(a.cards);
          if (!this.pickOk(cards, u.pick)) return null;
        }
        let targets = [];
        if (u.targets) {
          targets = arr(a.targets);
          if (!uniq(targets) || !inRange(targets.length, u.targets)) return null;
          if (u.targets.second) {
            if (!u.targets.candidates.includes(targets[0])) return null;
            if (!(u.targets.second[targets[0]] || []).includes(targets[1])) return null;
          } else if (!targets.every((t) => u.targets.candidates.includes(t))) return null;
        }
        return { usable: u, cards, targets };
      }
      case 'respond': {
        if (a.pass) return { pass: true };
        const ch = req.choices.find((x) => x.id === a.choice);
        if (!ch) return null;
        let cards = ch.cardIds || [];
        if (ch.pick) {
          cards = arr(a.cards);
          if (!this.pickOk(cards, ch.pick)) return null;
        }
        return { choice: ch, cards };
      }
      case 'select': {
        const refs = arr(a.refs);
        if (!uniq(refs) || !inRange(refs.length, req) || !refs.every((r) => req.items.some((i) => i.ref === r))) return null;
        return { refs };
      }
      case 'players': {
        const seats = arr(a.seats);
        if (!uniq(seats) || !inRange(seats.length, req) || !seats.every((s) => req.candidates.includes(s))) return null;
        return { seats };
      }
      case 'option': {
        const o = req.options.find((x) => x.id === a.option);
        return o ? { option: o.id } : null;
      }
      case 'hero':
        return req.heroes.includes(a.hero) ? { hero: a.hero } : null;
      default:
        return null;
    }
  }

  /** คำตอบจากไคลเอนต์ — คืนข้อความ error ถ้าไม่ถูกต้อง */
  submit(pid, promptId, data) {
    const entry = this.pending.get(pid);
    if (!entry || entry.id !== promptId) return 'คำสั่งนี้หมดอายุแล้ว';
    if (!this.normalize(entry.req, data)) return 'การเลือกไม่ถูกต้อง';
    entry.finish(data);
    return null;
  }

  /** ถามหลายคนพร้อมกัน คนแรกที่ตอบ (ไม่ผ่าน) ชนะ */
  askRace(players, reqFn) {
    if (!players.length) return Promise.resolve(null);
    return new Promise((resolve) => {
      let remaining = players.length;
      let done = false;
      const ids = new Map();
      players.forEach((q) => {
        const req = reqFn(q);
        const pr = this.ask(q, req);
        ids.set(q, req.id);
        pr.then((ans) => {
          if (done) return;
          const yes = ans && !ans.pass && !(ans.option && ans.option !== 'yes');
          if (yes) {
            done = true;
            for (const o of players) {
              const e = this.pending.get(o.pid);
              if (o !== q && e && e.id === ids.get(o)) e.finish({ pass: true, option: 'no' });
            }
            resolve({ player: q, ans });
          } else if (--remaining === 0) {
            done = true;
            resolve(null);
          }
        }, () => { if (!done) { done = true; resolve(null); } });
      });
    });
  }

  confirm(p, kind, title, yes = 'ใช้', no = 'ไม่ใช้', ctx) {
    return this.ask(p, { type: 'option', kind, title, ctx, options: [{ id: 'yes', label: yes }, { id: 'no', label: no }], defaultOption: 'no' })
      .then((a) => a.option === 'yes');
  }

  async chooseOwn(p, { min, max, zones = ['hand'], exclude = [], filter, title, kind = 'discard' }) {
    const pool = [];
    if (zones.includes('hand')) pool.push(...p.hand);
    if (zones.includes('equip')) pool.push(...this.equipCards(p));
    const list = pool.filter((c) => !exclude.includes(c) && (!filter || filter(c)));
    if (!list.length || max <= 0) return [];
    const items = list.map((c) => ({ ref: 'c' + c.id, card: strip(c), zone: p.hand.includes(c) ? 'hand' : 'equip' }));
    const ans = await this.ask(p, { type: 'select', kind, title, items, min: Math.min(min, list.length), max: Math.min(max, list.length) });
    return ans.refs.map((r) => this.cardById.get(Number(r.slice(1))));
  }

  async chooseCardFrom(chooser, target, { hand = true, equip = true, judge = true, title, kind = 'take', only } = {}) {
    const items = [];
    const map = new Map();
    if (hand) {
      shuffle([...target.hand]).forEach((c, i) => {
        const ref = 'h' + i;
        map.set(ref, c);
        items.push({ ref, card: chooser === target ? strip(c) : null, zone: 'hand' });
      });
    }
    if (equip) {
      for (const c of this.equipCards(target)) {
        if (only && !only.includes(c)) continue;
        map.set('e' + c.id, c);
        items.push({ ref: 'e' + c.id, card: strip(c), zone: 'equip' });
      }
    }
    if (judge) {
      for (const c of target.judgeZone) {
        map.set('j' + c.id, c);
        items.push({ ref: 'j' + c.id, card: strip(c), zone: 'judge' });
      }
    }
    if (!items.length) return null;
    const ans = await this.ask(chooser, { type: 'select', kind, title, items, min: 1, max: 1, targetSeat: target.seat });
    return map.get(ans.refs[0]) || null;
  }

  async chooseZone(chooser, target, title, kind = 'zone') {
    const zs = adjacentZones(target.zone);
    const a = await this.ask(chooser, {
      type: 'option', kind, title, targetSeat: target.seat,
      options: zs.map((z) => ({ id: z, label: `${ZONES[z].icon} ${ZONES[z].name}` })), defaultOption: zs[0],
    });
    return a.option;
  }

  // ════════════════════════════ main flow ════════════════════════════

  async run() {
    try {
      await this.chooseHeroes();
      for (const p of this.players) this.draw(p, p.role === 'lord' ? 5 : 4);
      this.log('แจกการ์ดคนละ 4 ใบ (กษัตริย์ 5 ใบ) — ศึกชิงบัลลังก์มนตราเริ่มขึ้น!');
      let cur = this.players.find((p) => p.role === 'lord');
      for (;;) {
        if (cur.role === 'lord') {
          this.round++;
          if (this.maxRounds && this.round > this.maxRounds) {
            throw new GameOver({ winnerRole: null, winners: [], text: 'เสมอ (ครบจำนวนรอบ)' });
          }
          if (this.eclipseRate()) await this.moveTrack(-this.eclipseRate(), `🌘 สุริยุปราคาคืบคลาน (เริ่มรอบที่ ${this.round})`);
        }
        if (cur.ghost) await this.spectralTurn(cur);
        else await this.runTurn(cur);
        cur = this.nextSeat(cur);
      }
    } catch (e) {
      if (e instanceof GameOver) this.finish(e.result);
      else if (e instanceof GameAborted) { /* ถูกยกเลิก */ }
      else {
        console.error('game engine error', e);
        this.finish({ winnerRole: null, winners: [], text: 'เกมสิ้นสุดเนื่องจากข้อผิดพลาดของระบบ' });
      }
    }
    return this.result;
  }

  finish(result) {
    this.result = result;
    this.emit('gameover', { result });
    this.phase = 'over';
    for (const e of [...this.pending.values()]) { e.timers.forEach(clearTimeout); }
    this.pending.clear();
    this.log(`🏁 จบเกม: ${result.text}`);
    this.update();
  }

  abort() {
    this.aborted = true;
    for (const e of [...this.pending.values()]) {
      e.timers.forEach(clearTimeout);
      e.reject(new GameAborted());
    }
    this.pending.clear();
  }

  setConnected(pid, connected) {
    const p = this.player(pid);
    if (!p) return;
    p.connected = connected;
    const e = this.pending.get(pid);
    if (e && !connected && !p.isBot) this.addDisconnectTimer(e);
    this.update();
  }

  setBot(pid) {
    const p = this.player(pid);
    if (!p || p.isBot) return;
    p.isBot = true;
    const e = this.pending.get(pid);
    if (e) this.scheduleBot(e);
    this.update();
  }

  async chooseHeroes() {
    const lord = this.players.find((p) => p.role === 'lord');
    const pool = shuffle(Object.keys(HEROES).filter((h) => !LORD_HEROES.includes(h)));
    const lordChoices = [...LORD_HEROES, pool.pop(), pool.pop(), pool.pop()];
    this.log(`${lord.name} คือกษัตริย์แห่งคาเมลอต กำลังเลือกฮีโร่...`);
    const a = await this.ask(lord, { type: 'hero', title: 'คุณคือกษัตริย์ผู้ครองบัลลังก์! เลือกฮีโร่', heroes: lordChoices, timeout: 45000 });
    this.setHero(lord, a.hero);
    const rest = [...pool, ...lordChoices.filter((h) => h !== a.hero)];
    shuffle(rest);
    const others = this.players.filter((p) => p !== lord);
    const k = Math.max(1, Math.min(3, Math.floor(rest.length / Math.max(1, others.length))));
    const lordHero = HEROES[lord.hero];
    await Promise.all(others.map((p) => {
      const opts = rest.splice(0, k);
      return this.ask(p, {
        type: 'hero', title: `เลือกฮีโร่ (กษัตริย์เลือก ${lordHero.name})`, heroes: opts, timeout: 45000,
      }).then((ans) => this.setHero(p, ans.hero, true));
    }));
    for (const p of others) this.log(`${p.name} เลือก ${HEROES[p.hero].name}`);
    for (const p of this.players) {
      if (!this.hasSkill(p, 'philter')) continue;
      const cands = this.others(p).map((q) => q.seat);
      const ans = await this.ask(p, { type: 'players', kind: 'philter', title: `${SKILLS.philter.name}: เลือกผู้เล่นที่จะผูกชะตาด้วย`, candidates: cands, min: 1, max: 1 });
      p.philter = ans.seats[0];
      this.log(`${p.name} ผูกชะตากับ ${this.players[p.philter].name} ด้วย ${SKILLS.philter.name}`);
    }
    this.emit('start');
  }

  setHero(p, id, quiet) {
    const h = HEROES[id];
    p.hero = id;
    p.maxHp = h.hp + (p.role === 'lord' ? 1 : 0);
    p.hp = p.maxHp;
    p.gender = h.gender;
    p.kingdom = h.kingdom;
    if (!quiet) this.log(`${p.name} เลือก ${h.name}`);
  }

  async runTurn(p) {
    this.ts = {
      player: p, attacksUsed: 0, usedAttack: false, used: new Set(), weaves: 0, moved: false,
      vow: null, vowBroken: false, damaged: false, exalted: false, bardic: new Map(),
    };
    this.table = [];
    p.ward = null;
    this.log(`── เทิร์นของ ${p.name} (${HEROES[p.hero].name}) @ ${ZONES[p.zone].name} ──`);
    this.emit('turn', { player: p });
    await this.pause(500);

    // รุ่งอรุณ
    this.phase = 'start';
    await this.declareVow(p);
    if (!p.alive) return;
    if (this.hasSkill(p, 'omniscience')) await this.doOmniscience(p);
    if (this.hasSkill(p, 'cacophony')) await this.doCacophony(p);
    if (!p.alive) return;

    // ผนึกคำสาป
    this.phase = 'judge';
    let skipPlay = false;
    for (const c of [...p.judgeZone].reverse()) {
      if (!p.alive) return;
      if (!p.judgeZone.includes(c)) continue;
      const key = c.asKey;
      this.removeCard(c);
      this.log(`${p.name} ตัดสิน「${CARD_INFO[key].name}」`);
      const negated = await this.askNegate(key, p, null);
      if (key === 'petrify') {
        if (!negated) {
          const j = await this.judge(p, 'petrify');
          if (!judgeGood('petrify', j)) {
            if (this.resistCurse(p)) { /* ต้านทานแล้ว */ } else { skipPlay = true; this.log(`🗿 ${p.name} กลายเป็นหิน ต้องข้ามช่วงร่ายเวทและทำศึก`); }
          } else { this.log('ผลเป็นธาตุศักดิ์สิทธิ์ ♣ คำสาปสลายไป'); this.survivedCurse(p); }
          this.toDiscard([j]);
        }
        this.toDiscard([c]);
      } else if (key === 'blood_moon') {
        let hit = false;
        if (!negated) {
          const j = await this.judge(p, 'blood_moon');
          hit = !judgeGood('blood_moon', j);
          this.toDiscard([j]);
          if (hit && this.resistCurse(p)) { this.toDiscard([c]); continue; }
          if (!hit) this.survivedCurse(p);
        }
        if (hit) {
          this.toDiscard([c]);
          this.log(`🌑 อุกกาบาตทมิฬจากจันทราสีเลือดระเบิดใส่ ${p.name}!`);
          this.emit('lightning', { target: p });
          await this.damage(null, p, 3, null, 'thunder');
        } else {
          await this.passBloodMoon(p, c);
        }
      }
    }
    if (!p.alive) return;

    // เบิกมนตรา
    this.phase = 'draw';
    await this.drawPhase(p);
    if (!p.alive) return;

    // ร่ายเวทและทำศึก
    if (!skipPlay) {
      this.phase = 'play';
      await this.playPhase(p);
      if (!p.alive) return;
    }

    // สละพลัง
    this.phase = 'discard';
    let limit = Math.max(0, p.hp);
    if (this.hasSkill(p, 'ascetic') && !this.ts.usedAttack) limit += 2;
    const excess = p.hand.length - limit;
    if (excess > 0) {
      const cards = await this.chooseOwn(p, { min: excess, max: excess, title: `ช่วงสละพลัง: ทิ้งการ์ด ${excess} ใบ (เก็บได้ ${limit} ใบ)` });
      this.discardCards(cards);
      this.log(`${p.name} ทิ้ง ${cards.map(cardStr).join(', ')}`);
    }

    // สนธยา
    this.phase = 'finish';
    await this.endOfTurn(p);
  }

  async endOfTurn(p) {
    const ts = this.ts;
    if (ts.vow === 'mercy' && !ts.vowBroken && p.alive) {
      const cands = this.alive().filter((q) => q.hp < q.maxHp);
      if (cands.length) {
        const ans = await this.ask(p, {
          type: 'players', kind: 'mercy', title: `${VOWS.mercy.name} สำเร็จ! เลือกผู้รับพรฟื้นฟูเลือด 2 (ตนเองหรือผู้อื่น)`,
          candidates: cands.map((q) => q.seat), min: 1, max: 1,
        });
        const t = this.players[ans.seats[0]];
        this.log(`🕊 ${p.name} รักษาสัตยาบันแห่งความเมตตา — ${t.name} ได้รับพร`);
        this.heal(t, 2, p);
      } else this.log(`🕊 ${p.name} รักษาสัตยาบันแห่งความเมตตาได้ แต่ไม่มีใครบาดเจ็บ`);
    }
    for (const q of this.players) if (q.poisonedBy === p.seat) q.poisonedBy = null;
    if (p.sealTurns > 0 && --p.sealTurns === 0) {
      p.fallen = false;
      this.log(`${p.name} หลุดพ้นจากผนึก ทักษะกลับคืนมา`);
    }
    if (p.immortalTurns > 0) p.immortalTurns--;
    p.vow = null;
  }

  // ── คำสาป ──

  /** ผู้แฝงตัวต้านทานคำสาปได้ 1 ครั้งต่อเกม */
  resistCurse(p) {
    if (p.role !== 'traitor' || p.curseWard) return false;
    p.curseWard = true;
    this.log(`✴ พลังลึกลับในกายของ ${p.name} ต้านทานคำสาปได้!`);
    return true;
  }
  survivedCurse(p) {
    if (p.equip.defHorse && p.equip.defHorse.key === 'unicorn' && p.hp < p.maxHp) {
      this.log(`${CARD_INFO.unicorn.name} ของ ${p.name} ฟื้นฟูพลังหลังรอดจากคำสาป`);
      this.heal(p, 1, null);
    }
  }

  /** วางคำสาปหน้าเป้าหมาย พร้อมให้ มอร์กอส สลับชะตา */
  async placeCurse(c, key, t, source) {
    if (!this.canCurse(t, key)) { this.toDiscard([c]); return; }
    if (this.hasSkill(t, 'fate_swap') && this.hasAnyCard(t, false)) {
      const cands = this.others(t).filter((q) => this.distance(t, q) <= 1 && this.canCurse(q, key));
      if (cands.length) {
        const a = await this.ask(t, {
          type: 'players', kind: 'fate_swap', title: `${SKILLS.fate_swap.name}: ทิ้งการ์ด 1 ใบเพื่อย้าย「${CARD_INFO[key].name}」ไปหน้าผู้อื่น? (ข้าม = ไม่ใช้)`,
          candidates: cands.map((q) => q.seat), min: 0, max: 1, ctx: { curse: key },
        });
        if (a.seats.length) {
          const [d] = await this.chooseOwn(t, { min: 1, max: 1, zones: ['hand', 'equip'], title: `${SKILLS.fate_swap.name}: เลือกการ์ดที่จะทิ้ง` });
          if (d) {
            this.discardCards([d]);
            const nt = this.players[a.seats[0]];
            this.log(`${t.name} ใช้ ${SKILLS.fate_swap.name} ย้าย「${CARD_INFO[key].name}」ไปหน้า ${nt.name}`);
            this.noteHostile(t, nt);
            t = nt;
          }
        }
      }
    }
    c.asKey = key;
    t.judgeZone.push(c);
    if (key === 'petrify' && source) { this.emit('indulgence', { source, target: t }); this.noteHostile(source, t); }
  }

  async passBloodMoon(from, c) {
    let q = this.nextAlive(from);
    while (q && q !== from) {
      if (this.canCurse(q, 'blood_moon')) {
        this.log(`จันทราสีเลือดลอยไปยัง ${q.name}`);
        await this.placeCurse(c, 'blood_moon', q, null);
        return;
      }
      q = this.nextAlive(q);
    }
    if (from.alive && this.canCurse(from, 'blood_moon')) {
      c.asKey = 'blood_moon';
      from.judgeZone.push(c);
    } else this.toDiscard([c]);
  }

  // ── สัตยาบัน ──

  async declareVow(p) {
    const opts = [{ id: 'none', label: 'ไม่ประกาศ' }];
    if (this.alive().length > 1) opts.push({ id: 'valor', label: `⚔ ${VOWS.valor.name}` });
    opts.push({ id: 'mercy', label: `🕊 ${VOWS.mercy.name}` });
    if (p.hp > 1) opts.push({ id: 'tithe', label: `🩸 ${VOWS.tithe.name}` });
    const a = await this.ask(p, {
      type: 'option', kind: 'vow', title: 'รุ่งอรุณ: ประกาศสัตยาบันหรือพันธสัญญาหรือไม่?', options: opts, defaultOption: 'none',
      timeout: 20000,
    });
    if (a.option === 'none') return;
    const v = VOWS[a.option];
    this.log(`📜 ${p.name} ประกาศ ${v.name}: ${v.desc}`);
    this.emit('vow', { source: p, vow: a.option });
    if (a.option === 'tithe') {
      await this.loseHp(p, 1);
      if (p.alive) { this.draw(p, 3); this.log(`${p.name} จั่ว 3 ใบจากพันธสัญญาโลหิต`); }
      return;
    }
    this.ts.vow = a.option;
    p.vow = a.option;
  }

  /** ตรวจการละเมิดสัตยาบันเมื่อทำสิ่งที่เป็นอันตรายต่อเป้าหมาย */
  checkVow(p, targets, damaging) {
    const ts = this.ts;
    if (!ts || ts.player !== p || !ts.vow || ts.vowBroken) return;
    if (ts.vow === 'valor') {
      const top = this.highestHp(p);
      if (targets.some((t) => t !== p && !top.has(t))) this.breakVow(p);
    } else if (ts.vow === 'mercy' && damaging && targets.some((t) => t !== p)) {
      this.breakVow(p);
    }
  }
  breakVow(p) {
    const ts = this.ts;
    ts.vowBroken = true;
    p.vow = null;
    p.fallen = true;
    const shown = shuffle([...p.hand]).slice(0, 2);
    p.sealTurns = Math.max(p.sealTurns, 2);
    this.log(`⛓ ${p.name} ละเมิด${VOWS[ts.vow].name}! ติดตราบาป (Fallen): เปิดการ์ดในมือ ${shown.length ? shown.map(cardStr).join(', ') : '(ไม่มี)'} และสูญเสียทักษะ 1 รอบ`);
    this.emit('broken', { source: p });
  }
  valorActive(p) { return this.ts && this.ts.player === p && this.ts.vow === 'valor' && !this.ts.vowBroken; }

  // ── ทักษะช่วงเริ่มเทิร์น ──

  async doOmniscience(p) {
    const top = [];
    for (let i = 0; i < 5; i++) { const c = this.drawOne(); if (c) top.push(c); }
    if (!top.length) return;
    this.log(`${p.name} ใช้ทักษะ ${SKILLS.omniscience.name} มองเห็นการ์ด ${top.length} ใบบนกอง`);
    const ans = await this.ask(p, {
      type: 'select', kind: 'omniscience', title: `${SKILLS.omniscience.name}: เลือกการ์ดที่จะ "ทิ้งลงสุสาน" (ที่เหลือวางกลับบนกอง ใบซ้ายสุดอยู่บนสุด)`,
      items: top.map((c) => ({ ref: 'c' + c.id, card: strip(c) })), min: 0, max: top.length,
    });
    const gone = new Set(ans.refs);
    const rest = top.filter((c) => !gone.has('c' + c.id));
    const thrown = top.filter((c) => gone.has('c' + c.id));
    for (let i = rest.length - 1; i >= 0; i--) this.deck.push(rest[i]);
    this.toDiscard(thrown);
    this.log(`${p.name} ทิ้ง ${thrown.length} ใบ และวาง ${rest.length} ใบกลับบนกอง`);
  }

  async doCacophony(p) {
    let gain = 0;
    const near = this.others(p).filter((q) => this.distance(p, q) <= 1);
    if (!near.length) return;
    this.log(`🐉 ${p.name} ใช้ทักษะ ${SKILLS.cacophony.name}!`);
    for (const q of near) {
      if (!q.alive) continue;
      let choice = 'refuse';
      if (q.hand.length) {
        const a = await this.ask(q, {
          type: 'option', kind: 'cacophony', title: `${p.name} (${SKILLS.cacophony.name}): สุ่มทิ้งการ์ดในมือ 1 ใบ หรือปล่อยให้เขาจั่ว 1 ใบ`,
          options: [{ id: 'discard', label: 'สุ่มทิ้ง 1 ใบ' }, { id: 'refuse', label: `ให้ ${p.name} จั่ว 1 ใบ` }], defaultOption: 'discard', sourceSeat: p.seat,
        });
        choice = a.option;
      }
      if (choice === 'discard') {
        const c = this.randomHand(q);
        this.discardCards([c]);
        this.log(`${q.name} สุ่มทิ้ง ${cardStr(c)}`);
      } else gain++;
    }
    if (gain) { this.draw(p, gain); this.log(`${p.name} จั่ว ${gain} ใบ`); }
  }

  // ── เบิกมนตรา ──

  async drawPhase(p) {
    if (this.hasSkill(p, 'logistics') && (await this.confirm(p, 'logistics', `ใช้ทักษะ ${SKILLS.logistics.name}? (เปิด 4 ใบแทนการจั่ว)`))) {
      const shown = [];
      for (let i = 0; i < 4; i++) { const c = this.drawOne(); if (c) shown.push(c); }
      this.log(`${p.name} ใช้ทักษะ ${SKILLS.logistics.name} เปิด ${shown.map(cardStr).join(', ')}`);
      const keepN = Math.min(2, shown.length);
      const k = await this.ask(p, {
        type: 'select', kind: 'logistics_keep', title: `${SKILLS.logistics.name}: เลือกการ์ด ${keepN} ใบเก็บเข้ามือ`,
        items: shown.map((c) => ({ ref: 'c' + c.id, card: strip(c) })), min: keepN, max: keepN,
      });
      const keep = shown.filter((c) => k.refs.includes('c' + c.id));
      p.hand.push(...keep);
      let rest = shown.filter((c) => !keep.includes(c));
      const giftable = rest.filter((c) => CARD_INFO[c.key].type !== 'basic');
      const others = this.others(p);
      if (giftable.length && others.length) {
        const g = await this.ask(p, {
          type: 'select', kind: 'logistics_gift', title: `${SKILLS.logistics.name}: เลือกการ์ดยุทโธปกรณ์/มนตรา 1 ใบมอบให้พันธมิตร (หรือไม่เลือก)`,
          items: giftable.map((c) => ({ ref: 'c' + c.id, card: strip(c) })), min: 0, max: 1,
        });
        if (g.refs.length) {
          const gift = giftable.find((c) => 'c' + c.id === g.refs[0]);
          const who = await this.ask(p, { type: 'players', kind: 'gift', title: `มอบ ${cardStr(gift)} ให้ใคร?`, candidates: others.map((q) => q.seat), min: 1, max: 1 });
          const t = this.players[who.seats[0]];
          t.hand.push(gift);
          rest = rest.filter((c) => c !== gift);
          this.noteFriendly(p, t);
          this.log(`${p.name} มอบ ${cardStr(gift)} ให้ ${t.name}`);
        }
      }
      this.deck.unshift(...rest);
      return;
    }
    const n = this.hasSkill(p, 'boon') ? 3 : 2;
    this.draw(p, n);
    this.log(`${p.name} จั่ว ${n} ใบ`);
    if (this.hasSkill(p, 'boon') && p.hand.length) {
      const [c] = await this.chooseOwn(p, { min: 1, max: 1, kind: 'gift_card', title: `${SKILLS.boon.name}: เลือกการ์ด 1 ใบมอบให้ผู้เล่นอื่น` });
      const others = this.others(p);
      if (c && others.length) {
        const who = await this.ask(p, { type: 'players', kind: 'gift', title: `${SKILLS.boon.name}: มอบการ์ดให้ใคร?`, candidates: others.map((q) => q.seat), min: 1, max: 1 });
        const t = this.players[who.seats[0]];
        this.obtain(t, c);
        this.noteFriendly(p, t);
        this.log(`${p.name} ใช้ ${SKILLS.boon.name} มอบการ์ด 1 ใบให้ ${t.name}`);
      }
    }
  }

  async playPhase(p) {
    for (let guard = 0; guard < 150 && p.alive; guard++) {
      const usables = this.playUsables(p);
      const ans = await this.ask(p, { type: 'play', title: 'ช่วงร่ายเวทและทำศึกของคุณ', usables });
      if (ans.end) break;
      await this.performUsable(p, ans.usable, ans.cards, ans.targets);
      this.update();
    }
  }

  // ════════════════════════════ play-phase options ════════════════════════════

  cardTargets(p, key, cards) {
    const others = this.others(p);
    const seats = (list) => list.map((q) => q.seat);
    const spec = (list, max = 1) => (list.length ? { min: 1, max, candidates: seats(list) } : false);
    switch (key) {
      case 'strike': {
        if (!this.canUseAttack(p)) return false;
        const flame = cards && cards.length && cards.every((c) => c.suit === 'diamond');
        const list = others.filter((q) => this.inAttackRange(p, q) && !(flame && this.veilBlocks(q)));
        return spec(list);
      }
      case 'elixir': return p.hp < p.maxHp && p.poisonedBy == null ? null : false;
      case 'aegis': case 'dispel': return false;
      case 'blink': return spec(others.filter((q) => this.hasAnyCard(q, false) && this.distance(p, q) <= 1 && !this.hasMantle(q)));
      case 'blood_duel': return spec(others.filter((q) => !this.hasMantle(q)));
      case 'meteor': case 'blessing': return null;
      case 'siren': {
        const second = {};
        const firsts = [];
        for (const a of others) {
          if (!this.weapons(a).length || this.hasMantle(a)) continue;
          const bs = this.alive().filter((b) => b !== a && this.inAttackRange(a, b)).map((b) => b.seat);
          if (bs.length) { second[a.seat] = bs; firsts.push(a.seat); }
        }
        return firsts.length ? { min: 2, max: 2, candidates: firsts, second } : false;
      }
      case 'petrify':
        return spec(others.filter((q) => this.canCurse(q, 'petrify') && !this.hasMantle(q)));
      case 'blood_moon': return this.canCurse(p, 'blood_moon') ? null : false;
      default: return CARD_INFO[key].type === 'equip' ? null : false;
    }
  }
  veilBlocks(t) { return this.hasSkill(t, 'veil') && this.equipCards(t).length === 0; }

  weaveTargets(p, id) {
    const others = this.others(p);
    const seats = (list) => list.map((q) => q.seat);
    const spec = (list) => (list.length ? { min: 1, max: 1, candidates: seats(list) } : false);
    switch (id) {
      case 'inferno': case 'drain': return spec(others.filter((q) => this.inAttackRange(p, q)));
      case 'firebolt': return spec(others);
      case 'shatter': return spec(others.filter((q) => this.equipCards(q).length && this.distance(p, q) <= 2));
      case 'bulwark': return spec(this.orderFrom(p).filter((q) => (q === p || this.distance(p, q) <= 1) && !q.ward));
      case 'cleanse': return spec(this.orderFrom(p));
      case 'spikes': return p.ward ? false : null;
      case 'telekinesis': case 'seal': {
        const list = others.filter((q) => this.distance(p, q) <= 2 && (id !== 'seal' || q.hand.length || q.sealTurns === 0));
        return spec(list);
      }
      case 'theft': return spec(others.filter((q) => q.hand.length));
      default: return false;
    }
  }

  playUsables(p) {
    const out = [];
    const ts = this.ts;
    const hand = p.hand;
    const he = [...hand, ...this.equipCards(p)];
    const addCard = (c, as, via) => {
      const t = this.cardTargets(p, as, [c]);
      if (t === false) return;
      const nm = CARD_INFO[as].name;
      out.push({
        id: `${via || 'c'}:${c.id}:${as}`, cardIds: [c.id], as, skill: via || null, targets: t,
        label: via ? `${via === 'merlin_staff' ? CARD_INFO.merlin_staff.name : SKILLS[via].name}: ใช้เป็น ${nm}` : `ใช้ ${nm}`,
      });
    };
    for (const c of hand) addCard(c, c.key);
    if (this.hasWeapon(p, 'merlin_staff')) hand.filter((c) => (c.suit === 'club' || c.suit === 'heart') && c.key !== 'strike').forEach((c) => addCard(c, 'strike', 'merlin_staff'));
    const others = this.others(p);
    const sk = (id, extra) => out.push({ id: 'skill:' + id, skill: id, label: SKILLS[id].name, button: true, ...extra });

    // ── การเคลื่อนที่บนโต๊ะกลม ──
    if (!ts.moved) out.push({ id: 'move', label: `🧭 เคลื่อนที่ (จาก ${ZONES[p.zone].name})`, button: true, special: 'move' });

    // ── ผสานรูน ──
    const weaveCap = this.hasSkill(p, 'overcharge') ? 2 : 1;
    if (ts.weaves < weaveCap && hand.length >= 2) {
      const count = {};
      for (const c of hand) count[c.suit] = (count[c.suit] || 0) + 1;
      for (const [id, w] of Object.entries(WEAVES)) {
        const [a, b] = w.runes;
        if (a === b ? (count[a] || 0) < 2 : !(count[a] && count[b])) continue;
        const t = this.weaveTargets(p, id);
        if (t === false) continue;
        out.push({
          id: 'weave:' + id, weave: id, button: true, runes: w.runes,
          label: `ᚱ ${w.name} (${SUIT_SYMBOL[a]}+${SUIT_SYMBOL[b]})`,
          pick: { min: 2, max: 2, pool: hand.filter((c) => c.suit === a || c.suit === b).map((c) => c.id), suits: w.runes },
          targets: t || undefined,
        });
      }
    }

    // ── แถบชะตา ──
    if (!ts.used.has('track') && hand.length >= 1) {
      if (p.hp > 1) out.push({ id: 'ritual', special: 'ritual', button: true, label: '🌑 พิธีกรรมสังเวย (เสียเลือด 1 + ทิ้ง 1 ใบ: แถบ -1, ใบ ♥ = -2)', pick: { min: 1, max: 1, pool: hand.map((c) => c.id) } });
      if (!this.grailFound && hand.length >= 2) out.push({ id: 'quest', special: 'quest', button: true, label: '🏆 ออกแสวงบุญ (ทิ้ง 2 ใบ: แถบ +1, ♣♣ = +2)', pick: { min: 2, max: 2, pool: hand.map((c) => c.id) } });
    }

    // ── ทักษะฮีโร่ ──
    if (this.hasSkill(p, 'heartstrings') && !ts.used.has('heartstrings') && hand.length && others.length) {
      sk('heartstrings', { pick: { min: 1, max: 1, pool: hand.map((c) => c.id) }, targets: { min: 1, max: 1, candidates: others.map((q) => q.seat) } });
    }
    if (this.hasSkill(p, 'shadow_glamour') && !ts.used.has('shadow_glamour')) {
      const c = others.filter((q) => q.hand.length);
      if (c.length) sk('shadow_glamour', { targets: { min: 1, max: 1, candidates: c.map((q) => q.seat) } });
    }
    if (this.hasSkill(p, 'scandal') && !ts.used.has('scandal')) {
      const c = others.filter((q) => q.hand.length);
      if (c.length) sk('scandal', { targets: { min: 1, max: 1, candidates: c.map((q) => q.seat) } });
    }
    if (this.hasSkill(p, 'incite') && !ts.used.has('incite')) {
      const wpn = he.filter((c) => CARD_INFO[c.key].slot === 'weapon');
      if (wpn.length && others.length >= 2) sk('incite', { pick: { min: 1, max: 1, pool: wpn.map((c) => c.id) }, targets: { min: 2, max: 2, candidates: others.map((q) => q.seat), ordered: true } });
    }
    if (this.hasSkill(p, 'watery_grave')) {
      const sp = he.filter((c) => c.suit === 'spade');
      const c = others.filter((q) => this.equipCards(q).length);
      if (sp.length && c.length) sk('watery_grave', { pick: { min: 1, max: 1, pool: sp.map((x) => x.id) }, targets: { min: 1, max: 1, candidates: c.map((q) => q.seat) } });
    }
    if (this.hasSkill(p, 'grail_touch') && !ts.used.has('grail_touch') && p.hp > 0 && others.length) {
      sk('grail_touch', { targets: { min: 1, max: 1, candidates: others.map((q) => q.seat) } });
    }
    return out;
  }

  async performUsable(p, u, cardIds, seats) {
    const targets = seats.map((s) => this.players[s]);
    const real = cardIds.map((id) => this.cardById.get(id));
    if (u.special === 'move') return this.doMove(p);
    if (u.special === 'ritual' || u.special === 'quest') return this.doTrack(p, u.special, real);
    if (u.weave) return this.doWeave(p, u.weave, real, targets[0]);
    if (u.as) {
      if (u.skill) this.log(`${p.name} ใช้ ${u.skill === 'merlin_staff' ? CARD_INFO.merlin_staff.name : `ทักษะ ${SKILLS[u.skill].name}`}`);
      await this.useCard(p, this.makeV(u.as, real), targets);
    } else {
      await this.useSkill(p, u.skill, real, targets);
    }
  }

  async doMove(p) {
    this.ts.moved = true;
    const z = await this.chooseZone(p, p, `🧭 เคลื่อนที่: เลือกโซนปลายทาง (ตอนนี้อยู่ ${ZONES[p.zone].name})`, 'move');
    p.zone = z;
    this.log(`🧭 ${p.name} เคลื่อนไปยัง ${ZONES[z].icon} ${ZONES[z].name}`);
    this.emit('move', { source: p });
  }

  async doTrack(p, kind, cards) {
    this.ts.used.add('track');
    this.discardCards(cards);
    const bonusSuit = kind === 'ritual' ? 'heart' : 'club';
    const step = cards.every((c) => c.suit === bonusSuit) ? 2 : 1;
    const before = this.track;
    this.track = Math.max(TRACK_MIN, Math.min(TRACK_MAX, this.track + (kind === 'ritual' ? -step : step)));
    if (kind === 'ritual') {
      this.log(`🌑 ${p.name} ทำพิธีกรรมสังเวยด้วยโลหิตและ ${cards.map(cardStr).join(', ')} แถบหายนะเลื่อน ${before} → ${this.track}`);
      const lord = this.players.find((q) => q.role === 'lord');
      this.noteHostile(p, lord);
      await this.checkTrack();
      await this.loseHp(p, 1);
    } else {
      this.log(`🏆 ${p.name} ออกแสวงบุญ (${cards.map(cardStr).join(', ')}) แถบจอกศักดิ์สิทธิ์เลื่อน ${before} → ${this.track}`);
      const lord = this.players.find((q) => q.role === 'lord');
      if (lord !== p) p.rebelScore -= 1;
    }
    this.emit(kind, { source: p });
    await this.pause(700);
    await this.checkTrack();
  }

  /** ความเร็วของสุริยุปราคา: เริ่มคืบรอบที่ 5 ทีละ 1, ตั้งแต่รอบ 16 ทีละ 2, ตั้งแต่รอบ 24 ทีละ 3 */
  eclipseRate() { return this.round < 5 ? 0 : this.round < 16 ? 1 : this.round < 24 ? 2 : 3; }

  async moveTrack(delta, why) {
    const before = this.track;
    this.track = Math.max(TRACK_MIN, Math.min(TRACK_MAX, this.track + delta));
    if (this.track !== before) this.log(`${delta < 0 ? '🌑' : '🏆'} ${why}: แถบชะตา ${before} → ${this.track}`);
    await this.checkTrack();
  }

  async checkTrack() {
    if (this.track <= TRACK_MIN) {
      const pids = this.players.filter((p) => p.role === 'rebel').map((p) => p.pid);
      throw new GameOver({ winnerRole: 'rebel', winners: pids, text: 'สุริยุปราคาสมบูรณ์! ความมืดกลืนกินคาเมลอต — ลัทธิเงามืดชนะ' });
    }
    if (this.track >= TRACK_MAX && !this.grailFound) {
      this.grailFound = true;
      this.track = 0;
      const lord = this.players.find((p) => p.role === 'lord');
      this.log('✨ จอกศักดิ์สิทธิ์ปรากฏ! พรแห่งแสงสว่างแผ่ทั่วคาเมลอต — แถบกลับสู่จุดสมดุล (จอกปรากฏได้ครั้งเดียว การแสวงบุญสิ้นสุดลง)');
      this.emit('grail', {});
      for (const q of this.alive()) {
        if (q.role !== 'rebel') continue;
        const lost = q.hp - Math.max(1, Math.floor(q.hp / 2));
        if (lost > 0) {
          q.hp -= lost;
          this.log(`☀ แสงแห่งจอกเผาผลาญเงามืดในกาย ${q.name}: เสียเลือด ${lost} (${q.hp}/${q.maxHp})`);
        }
      }
      if (lord.alive) {
        lord.immortalTurns = this.ts && this.ts.player === lord ? 2 : 1;
        this.log(`👑 ${lord.name} ได้รับสถานะอมตะ — เลือดไม่ลดต่ำกว่า 1 จนจบเทิร์นถัดไปของพระองค์`);
      }
      this.update();
      await this.pause(1200);
    }
  }

  // ════════════════════════════ ผสานรูน ════════════════════════════

  async doWeave(p, id, cards, t) {
    const w = WEAVES[id];
    this.ts.weaves++;
    this.discardCards(cards);
    this.pushTable(p, { key: cards[0].key, real: cards }, t ? [t.seat] : [], `ᚱ ${w.name}`);
    this.update();
    await this.pause(1000);
    this.log(`ᚱ ${p.name} ผสานรูน ${cards.map((c) => RUNES[c.suit].name).join(' + ')} ร่าย「${w.name}」${t ? ` → ${t.name}` : ''}`);
    this.emit('weave', { source: p, target: t, weave: id });
    if (t && w.harmful) {
      this.checkVow(p, [t], ['inferno', 'firebolt', 'drain'].includes(id));
      this.noteHostile(p, t);
    }
    await this.bardic(p);
    switch (id) {
      case 'inferno': case 'firebolt': case 'drain': {
        if (!t.alive) break;
        const dodged = await this.requestDodges(t, 1, { title: `${p.name} ร่าย「${w.name}」ใส่คุณ ใช้「ม่านบาเรีย」หรือรับความเสียหาย`, source: p, reason: 'weave', ignoreArmor: id === 'inferno' });
        if (dodged) { this.log(`${t.name} ป้องกัน「${w.name}」ได้`); break; }
        const dealt = await this.damage(p, t, id === 'inferno' ? 2 : 1, null, id === 'drain' ? null : 'fire', { ignoreArmor: id === 'inferno' });
        if (id === 'drain' && dealt > 0 && p.alive) this.heal(p, 1, null);
        break;
      }
      case 'shatter': {
        const c = await this.chooseCardFrom(p, t, { hand: false, judge: false, title: `${w.name}: เลือกอุปกรณ์ของ ${t.name} ที่จะทำลาย` });
        if (c) { this.discardCards([c]); this.log(`💥 ${cardStr(c)} ของ ${t.name} ถูกทำลาย`); }
        break;
      }
      case 'bulwark':
        t.ward = 'bulwark';
        if (t !== p) this.noteFriendly(p, t);
        this.log(`🛡 ${t.name} ได้รับปราการศักดิ์สิทธิ์ (ป้องกันความเสียหายครั้งถัดไป)`);
        break;
      case 'spikes':
        p.ward = 'spikes';
        this.log(`🌵 ${p.name} ห่อหุ้มกายด้วยเกราะหนามทมิฬ`);
        break;
      case 'cleanse': {
        const cs = [...t.judgeZone];
        this.discardCards(cs);
        t.poisonedBy = null;
        this.draw(t, 1);
        if (t !== p) this.noteFriendly(p, t);
        this.log(`✨ ${t.name} ได้รับการชำระ${cs.length ? ` ลบล้างคำสาป ${cs.length} อย่าง` : ''} และจั่ว 1 ใบ`);
        break;
      }
      case 'telekinesis': {
        const z = await this.chooseZone(p, t, `${w.name}: ผลัก/ดึง ${t.name} ไปยังโซนใด? (ตอนนี้ ${ZONES[t.zone].name})`, 'telekinesis');
        t.zone = z;
        this.log(`🌀 ${t.name} ถูกคลื่นจิตพัดไปยัง ${ZONES[z].icon} ${ZONES[z].name}`);
        break;
      }
      case 'theft': {
        const c = this.randomHand(t);
        if (c) { this.obtain(p, c); this.emit('robbed', { source: p, target: t }); this.log(`${p.name} ขโมยการ์ดในมือ 1 ใบของ ${t.name}`); }
        break;
      }
      case 'seal': {
        const c = this.randomHand(t);
        if (c) { this.discardCards([c]); this.log(`${t.name} สุ่มทิ้ง ${cardStr(c)}`); }
        t.sealTurns = Math.max(t.sealTurns, this.ts && this.ts.player === t ? 2 : 1);
        this.log(`⛓ ทักษะของ ${t.name} ถูกผนึกจนจบเทิร์นถัดไปของเขา`);
        break;
      }
      default: break;
    }
  }

  // ════════════════════════════ card effects ════════════════════════════

  /** หลังใช้การ์ด: พระราชโองการ (♣ รักษาอาเธอร์) */
  async afterUse(user, v) {
    if (!user.alive || v.suit !== 'club') return;
    if (this.ts && this.ts.exalted) return;
    for (const a of this.alive()) {
      if (a === user || !this.hasSkill(a, 'exalted') || a.hp >= a.maxHp) continue;
      if (await this.confirm(user, 'exalted', `${SKILLS.exalted.name}: มอบพรรักษาจากการ์ดธาตุศักดิ์สิทธิ์ให้ ${a.name} ฟื้นฟูเลือด 1?`, 'มอบพร', 'ไม่มอบ', { targetSeat: a.seat })) {
        if (this.ts) this.ts.exalted = true;
        this.log(`👑 ${user.name} มอบพรศักดิ์สิทธิ์แด่ ${a.name} (${SKILLS.exalted.name})`);
        this.heal(a, 1, user);
      }
      return;
    }
  }

  /** ลำนำแห่งวีรชน (ทาเลียซิน) */
  async bardic(caster) {
    for (const t of this.orderFrom(caster)) {
      if (!this.hasSkill(t, 'bardic') || !this.hasAnyCard(t, false)) continue;
      const bm = this.ts ? this.ts.bardic : new Map();
      if ((bm.get(t.pid) || 0) >= 2) continue;
      const [c] = await this.chooseOwn(t, { min: 0, max: 1, zones: ['hand', 'equip'], kind: 'bardic', title: `${SKILLS.bardic.name}: ${caster.name} ร่ายมหาเวท — ทิ้งการ์ด 1 ใบเพื่อจั่ว 2 ใบ? (ไม่เลือก = ไม่ใช้)` });
      if (!c) continue;
      bm.set(t.pid, (bm.get(t.pid) || 0) + 1);
      this.discardCards([c]);
      this.draw(t, 2);
      this.log(`🎵 ${t.name} ใช้ทักษะ ${SKILLS.bardic.name} ทิ้ง ${cardStr(c)} จั่ว 2 ใบ`);
    }
  }

  async useCard(user, v, targets) {
    for (const c of v.real) this.removeCard(c);
    const info = CARD_INFO[v.key];
    this.pushTable(user, v, targets.map((t) => t.seat));
    this.update();
    await this.pause(1100);
    const tnames = targets.length ? ` → ${targets.map((t) => t.name).join(', ')}` : '';
    this.log(`${user.name} ใช้ ${this.vName(v)}${tnames}`);
    if (HARMFUL.has(v.key)) this.checkVow(user, v.key === 'meteor' ? this.others(user) : targets.slice(0, 1), ['strike', 'blood_duel', 'meteor'].includes(v.key));

    if (info.type === 'equip') { await this.equipCard(user, v.real[0]); await this.afterUse(user, v); return; }
    if (info.type === 'delayed') {
      const t = v.key === 'blood_moon' ? user : targets[0];
      await this.placeCurse(v.real[0], v.key, t, v.key === 'petrify' ? user : null);
      await this.afterUse(user, v);
      return;
    }
    this.toDiscard(v.real);
    for (const t of targets) if (HARMFUL.has(v.key)) this.noteHostile(user, t);
    await this.afterUse(user, v);
    if (info.type === 'trick') await this.bardic(user);

    switch (v.key) {
      case 'strike':
        this.ts.attacksUsed++;
        if (user === this.ts.player) this.ts.usedAttack = true;
        await this.resolveAttack(user, v, targets);
        break;
      case 'elixir':
        this.heal(user, 1, user);
        break;
      case 'blink': {
        const t = targets[0];
        if (await this.askNegate(v.key, t, user)) break;
        if (!t.alive || !this.hasAnyCard(t, false)) break;
        const c = await this.chooseCardFrom(user, t, { judge: false, title: `${CARD_INFO.blink.name}: เลือกการ์ดของ ${t.name} ที่จะหยิบ` });
        if (!c) break;
        const zone = t.hand.includes(c) ? 'hand' : 'other';
        this.emit('robbed', { source: user, target: t });
        this.obtain(user, c);
        this.log(`${user.name} หยิบ${zone === 'hand' ? 'การ์ดในมือ 1 ใบ' : cardStr(c)}จาก ${t.name} ในพริบตา`);
        break;
      }
      case 'blood_duel': {
        const t = targets[0];
        if (await this.askNegate('blood_duel', t, user)) break;
        await this.resolveDuel(user, t, v);
        break;
      }
      case 'meteor': {
        for (const q of this.others(user)) {
          if (!q.alive || !user.alive) continue;
          if (await this.askNegate(v.key, q, user)) continue;
          const title = `${user.name} อัญเชิญ「${CARD_INFO.meteor.name}」 ใช้「${CARD_INFO.aegis.name}」หรือรับความเสียหายธาตุไฟ 1`;
          const ok = await this.requestDodges(q, 1, { title, source: user, reason: 'meteor' });
          if (!ok) await this.damage(user, q, 1, v, 'fire');
        }
        break;
      }
      case 'blessing':
        if (await this.askNegate('blessing', user, user)) break;
        this.draw(user, 2);
        this.log(`${user.name} จั่ว 2 ใบ`);
        break;
      case 'siren': {
        const [a, b] = targets;
        if (await this.askNegate('siren', a, user)) break;
        if (!a.alive || !this.weapons(a).length) break;
        let used = null;
        if (b.alive && this.inAttackRange(a, b)) {
          used = await this.requestCard(a, 'strike', {
            title: `${user.name} ใช้「${CARD_INFO.siren.name}」: ใช้ ศรเวท ใส่ ${b.name} มิฉะนั้นต้องมอบอาวุธให้ ${user.name}`,
            sourceSeat: user.seat, targetSeat: b.seat, reason: 'siren', use: true,
          });
        }
        if (used) {
          this.noteHostile(a, b);
          await this.resolveAttack(a, used, [b]);
        } else if (this.weapons(a).length && user.alive) {
          const w = this.weapons(a)[0];
          this.obtain(user, w);
          this.log(`${user.name} ได้ ${cardStr(w)} ของ ${a.name}`);
        }
        break;
      }
      default:
        break;
    }
  }

  async equipCard(p, c) {
    const slot = CARD_INFO[c.key].slot;
    let target = slot;
    if (slot === 'weapon' && this.hasSkill(p, 'prosthetic') && p.equip.weapon) {
      target = 'weapon2';
      if (p.equip.weapon2) {
        const a = await this.ask(p, {
          type: 'option', kind: 'prosthetic', title: `${SKILLS.prosthetic.name}: แทนที่อาวุธชิ้นใด?`,
          options: [{ id: 'weapon', label: CARD_INFO[p.equip.weapon.key].name }, { id: 'weapon2', label: CARD_INFO[p.equip.weapon2.key].name }], defaultOption: 'weapon',
        });
        target = a.option;
      }
    }
    const old = p.equip[target];
    if (old) this.discardCards([old]);
    p.equip[target] = c;
  }

  async resolveAttack(user, v, targets) {
    for (const t0 of targets) {
      if (!t0.alive || !user.alive) continue;
      let t = t0;
      for (const g of this.orderFrom(t)) {
        if (g === t || g === user || !this.hasSkill(g, 'devotion') || !this.hasAnyCard(g, false) || this.distance(g, t) > 1) continue;
        const ok = await this.confirm(g, 'devotion', `${SKILLS.devotion.name}: ทิ้งการ์ด 1 ใบเพื่อรับ「ศรเวท」ของ ${user.name} แทน ${t.name}?`, 'ปกป้อง', 'ไม่', { targetSeat: t.seat, sourceSeat: user.seat });
        if (!ok) continue;
        const [c] = await this.chooseOwn(g, { min: 1, max: 1, zones: ['hand', 'equip'], title: `${SKILLS.devotion.name}: เลือกการ์ดที่จะทิ้ง` });
        if (!c) continue;
        this.discardCards([c]);
        this.log(`🛡 ${g.name} ใช้ทักษะ ${SKILLS.devotion.name} ก้าวเข้ารับการโจมตีแทน ${t.name}`);
        this.noteFriendly(g, t);
        t = g;
        break;
      }
      await this.attackHit(user, v, t);
    }
  }

  async attackHit(user, v, t) {
    if (!t.alive || !user.alive) return;
    this.emit('attack', { source: user, target: t });
    const flame = this.isFlame(v);
    const ignoreArmor = this.hasWeapon(user, 'rhongomyniad');
    if (flame && this.veilBlocks(t)) { this.log(`ม่านหมอกของ ${t.name} ทำให้ศรเวทอัคคีไร้ผล`); return; }
    if (this.hasSkill(t, 'glamour') && user.gender === 'm') {
      const [c] = await this.chooseOwn(user, { min: 0, max: 1, kind: 'glamour', title: `${SKILLS.glamour.name}: ทิ้งการ์ดในมือ 1 ใบเป็นเครื่องบรรณาการแด่ ${t.name} มิฉะนั้นการโจมตีไร้ผล` });
      if (!c) { this.log(`${user.name} ไม่อาจทำร้าย ${t.name} ได้ (${SKILLS.glamour.name})`); return; }
      this.discardCards([c]);
      this.log(`${user.name} ถวาย ${cardStr(c)} เป็นเครื่องบรรณาการ`);
    }
    if (this.hasSkill(user, 'betrayal') && t.role === 'lord') {
      this.draw(user, 1);
      this.log(`${user.name} ใช้ทักษะ ${SKILLS.betrayal.name} จั่ว 1 ใบ`);
    }
    let noDodge = this.valorActive(user);
    if (noDodge) this.log(`⚔ สัตยาบันแห่งความกล้า: ${t.name} ป้องกันไม่ได้!`);
    if (!noDodge && this.hasSkill(user, 'peerless') && user.hand.length) {
      const [c] = await this.chooseOwn(user, { min: 0, max: 1, kind: 'peerless', title: `${SKILLS.peerless.name}: ทิ้งการ์ด 1 ใบเพื่อให้ ${t.name} ใช้ม่านบาเรียไม่ได้? (ไม่เลือก = ไม่ใช้)` });
      if (c) { this.discardCards([c]); noDodge = true; this.log(`${user.name} ใช้ทักษะ ${SKILLS.peerless.name}! ${t.name} ป้องกันไม่ได้`); }
    }
    const challenge = this.hasSkill(user, 'challenge');
    const weaponCards = () => [...t.hand, ...this.equipCards(t)].filter((c) => CARD_INFO[c.key].slot === 'weapon');
    if (!noDodge && challenge && !weaponCards().length) {
      noDodge = true;
      this.log(`${t.name} ไม่มีอาวุธจะรับคำท้า (${SKILLS.challenge.name}) — ป้องกันไม่ได้`);
    }
    let hit = noDodge;
    if (!noDodge && t.alive) {
      const need = this.hasWeapon(user, 'excalibur') ? 2 : 1;
      const dodged = await this.requestDodges(t, need, {
        title: `${user.name} ใช้「ศรเวท」ใส่คุณ${need > 1 ? ' (เอ็กซ์คาลิเบอร์: ต้องใช้ ม่านบาเรีย 2 ใบ)' : ''}`,
        source: user, ignoreArmor, reason: 'strike',
      });
      hit = !dodged;
      if (dodged && challenge) {
        const [w] = await this.chooseOwn(t, { min: 1, max: 1, zones: ['hand', 'equip'], filter: (c) => CARD_INFO[c.key].slot === 'weapon', title: `${SKILLS.challenge.name}: ทิ้งอาวุธ 1 ชิ้นเพื่อป้องกันให้สำเร็จ` });
        if (w) { this.discardCards([w]); this.log(`${t.name} ทิ้ง ${cardStr(w)} รับคำท้าอัศวินมรกต`); } else hit = true;
      }
    }
    if (!hit || !t.alive) return;
    let amount = 1;
    if (this.solarActive(user)) { amount = 2; this.log(`☀ ${SKILLS.solar.name}: ศรเวทของ ${user.name} ทำความเสียหาย 2`); }
    if (this.valorActive(user)) amount++;
    if (this.hasSkill(user, 'dolorous') && user.hp > 1 && amount < 3 &&
      (await this.confirm(user, 'dolorous', `${SKILLS.dolorous.name}: สละเลือด 1 เพื่อให้การโจมตีนี้ทำความเสียหาย 3?`, 'สละเลือด', 'ไม่', { targetSeat: t.seat }))) {
      this.log(`🩸 ${user.name} ใช้ทักษะ ${SKILLS.dolorous.name}!`);
      await this.loseHp(user, 1);
      amount = 3;
    }
    const dealt = await this.damage(user, t, amount, v, flame ? 'fire' : null, { ignoreArmor });
    if (dealt > 0 && this.hasSkill(user, 'venom') && t.alive) {
      t.poisonedBy = user.seat;
      this.log(`☠ ${t.name} ติดพิษของ ${user.name} (ใช้น้ำอมฤตไม่ได้จนจบเทิร์นของ ${user.name})`);
    }
    if (flame && t.alive && user.alive && this.equipCards(t).length) {
      const c = await this.chooseCardFrom(user, t, { hand: false, judge: false, title: `Flame Strike: เลือกอุปกรณ์ของ ${t.name} ที่จะเผา` });
      if (c) { this.discardCards([c]); this.log(`🔥 เปลวเพลิงเผา ${cardStr(c)} ของ ${t.name}`); }
    }
    if (this.hasSkill(user, 'rend') && t.alive && user.alive && this.equipCards(t).length &&
      (await this.confirm(user, 'rend', `${SKILLS.rend.name}: ทำลายอุปกรณ์ 1 ชิ้นของ ${t.name}?`))) {
      const c = await this.chooseCardFrom(user, t, { hand: false, judge: false, title: `${SKILLS.rend.name}: เลือกอุปกรณ์ที่จะทำลาย` });
      if (c) { this.discardCards([c]); this.log(`${user.name} ขย้ำ ${cardStr(c)} ของ ${t.name} แหลก`); }
    }
  }

  async resolveDuel(source, target, v) {
    if (!target.alive || !source.alive) return;
    let cur = target;
    let other = source;
    for (let guard = 0; guard < 200; guard++) {
      const c = await this.requestCard(cur, 'strike', {
        title: `พันธนาการโลหิตกับ ${other.name}: ทิ้ง「ศรเวท」 มิฉะนั้นได้รับความเสียหาย 1`,
        sourceSeat: other.seat, reason: 'duel',
      });
      if (!c) {
        await this.damage(other, cur, 1, v);
        return;
      }
      [cur, other] = [other, cur];
    }
  }

  // ════════════════════════════ responses ════════════════════════════

  responseChoices(p, key, ctx = {}) {
    const out = [];
    const hand = p.hand;
    const add = (c, as, via) => out.push({
      id: `${via || 'c'}:${c.id}`, cardIds: [c.id], as, skill: via || null,
      label: via ? `${via === 'merlin_staff' ? CARD_INFO.merlin_staff.name : SKILLS[via].name} (เป็น ${CARD_INFO[as].name})` : CARD_INFO[as].name,
    });
    if (key === 'elixir' && p.poisonedBy != null && ctx.dyingSeat === p.seat) return out;
    for (const c of hand) if (c.key === key) add(c, key);
    if (key === 'aegis') {
      if (!ctx.ignoreArmor && !ctx.armorTried && this.armorKey(p) === 'pridwen') {
        out.push({ id: 'armor', special: 'armor', label: `${CARD_INFO.pridwen.name} (ตัดสิน)`, button: true });
      }
    } else if (key === 'strike') {
      if (this.hasWeapon(p, 'merlin_staff')) hand.filter((c) => (c.suit === 'club' || c.suit === 'heart') && c.key !== 'strike').forEach((c) => add(c, 'strike', 'merlin_staff'));
    } else if (key === 'dispel') {
      if (this.hasSkill(p, 'transmute')) hand.filter((c) => isBlack(c) && c.key !== 'dispel').forEach((c) => add(c, 'dispel', 'transmute'));
    }
    return out;
  }

  /** ขอให้ผู้เล่นใช้/ตอบสนองด้วยการ์ดชนิด key คืนค่า virtual card หรือ null */
  async requestCard(p, key, ctx = {}) {
    let armorTried = false;
    for (let guard = 0; guard < 10 && p.alive; guard++) {
      const choices = this.responseChoices(p, key, { ...ctx, armorTried });
      if (!choices.length) return null;
      const pub = {
        sourceSeat: ctx.source ? ctx.source.seat : ctx.sourceSeat, targetSeat: ctx.targetSeat, dyingSeat: ctx.dyingSeat,
        forSeat: ctx.forSeat, reason: ctx.reason, use: !!ctx.use,
      };
      const ans = await this.ask(p, {
        type: 'respond', kind: key, title: ctx.title || `ใช้「${CARD_INFO[key].name}」หรือไม่?`, choices, ctx: pub,
        passLabel: ctx.passLabel || 'ไม่ใช้',
      });
      if (ans.pass) return null;
      const ch = ans.choice;
      if (ch.special === 'armor') {
        armorTried = true;
        this.log(`${p.name} ยกโล่พริตเวน`);
        const j = await this.judge(p, 'pridwen');
        const red = isRed(j);
        this.toDiscard([j]);
        if (red) { this.log('ผลเป็นธาตุสีแดง ม่านสะท้อนสำเร็จ!'); return this.makeV('aegis', []); }
        this.log('ผลเป็นธาตุสีดำ โล่ไม่ตอบสนอง');
        continue;
      }
      const real = ans.cards.map((id) => this.cardById.get(id));
      const v = this.makeV(ch.as, real);
      this.discardCards(real);
      this.pushTable(p, v, []);
      this.update();
      await this.pause(800);
      this.log(`${p.name} ${ctx.use ? 'ใช้' : 'ตอบสนองด้วย'} ${this.vName(v)}${ch.skill ? ` (${ch.skill === 'merlin_staff' ? CARD_INFO.merlin_staff.name : SKILLS[ch.skill].name})` : ''}`);
      if (key === 'strike' && this.ts && p === this.ts.player) this.ts.usedAttack = true;
      await this.afterUse(p, v);
      return v;
    }
    return null;
  }

  async requestDodges(t, need, ctx) {
    for (let i = 0; i < need; i++) {
      const title = need > 1 ? `${ctx.title} [${i + 1}/${need}]` : ctx.title;
      const c = await this.requestCard(t, 'aegis', { ...ctx, title });
      if (!c) return false;
    }
    return true;
  }

  async askNegate(trickKey, target, source) {
    let negated = false;
    const tname = CARD_INFO[trickKey].name;
    for (let guard = 0; guard < 30; guard++) {
      const holders = this.alive().filter((q) => this.responseChoices(q, 'dispel').length);
      if (!holders.length) break;
      const title = negated
        ? `「${tname}」ต่อ ${target.name} ถูกสลายอยู่ ใช้「เพลิงชำระล้าง」สลายการสลายหรือไม่?`
        : `ใช้「เพลิงชำระล้าง」สลาย「${tname}」ที่มีผลต่อ ${target.name} หรือไม่?`;
      const r = await this.askRace(holders, (q) => ({
        type: 'respond', kind: 'dispel', title, choices: this.responseChoices(q, 'dispel'),
        ctx: { trickKey, targetSeat: target.seat, sourceSeat: source ? source.seat : null, negated },
        hideWaiting: true, timeout: this.timeouts.negate,
      }));
      if (!r) break;
      const { player: q, ans } = r;
      const real = ans.cards.map((id) => this.cardById.get(id));
      this.discardCards(real);
      this.pushTable(q, this.makeV('dispel', real), [target.seat]);
      this.update();
      await this.pause(900);
      this.log(`${q.name} ใช้「เพลิงชำระล้าง」${negated ? 'สลายเพลิงชำระล้าง' : `สลาย「${tname}」ต่อ ${target.name}`}`);
      negated = !negated;
      if (source && source !== q) this.emit('negated', { source: q, target: source, trickKey });
      await this.bardic(q);
    }
    return negated;
  }

  /** เปิดการ์ดตัดสิน (reason: petrify | blood_moon | pridwen) */
  async judge(p, reason) {
    const rname = JUDGE_NAMES[reason] || reason;
    let c = this.drawOne();
    if (!c) return null;
    if (this.hasSkill(p, 'truth_seeker')) {
      const c2 = this.drawOne();
      if (c2) {
        this.log(`${p.name} ใช้ทักษะ ${SKILLS.truth_seeker.name} เปิด ${cardStr(c)} และ ${cardStr(c2)}`);
        const a = await this.ask(p, {
          type: 'select', kind: 'truth_seeker', title: `${SKILLS.truth_seeker.name}: เลือกผลตัดสิน [${rname}] ที่จะใช้`,
          items: [c, c2].map((x) => ({ ref: 'c' + x.id, card: strip(x) })), min: 1, max: 1, ctx: { reason },
        });
        const pick = a.refs[0] === 'c' + c2.id ? c2 : c;
        this.toDiscard([pick === c ? c2 : c]);
        c = pick;
      }
    }
    this.log(`${p.name} ตัดสิน [${rname}]: ${cardStr(c)}`);
    this.pushTable(p, this.makeV(c.key, [c]), [], `ตัดสิน: ${rname}`);
    this.update();
    await this.pause(1500);
    // วิญญาณแห่งอวาลอน: เปลี่ยนผันชะตา
    const seers = this.ghosts().filter((g) => g.spectral.includes('flicker'));
    const r = await this.askRace(seers, (g) => ({
      type: 'option', kind: 'flicker', title: `👻 ${SPECTRAL.flicker.name}: ผลตัดสิน [${rname}] ของ ${p.name} คือ ${cardStr(c)} — สั่งเปิดใหม่?`,
      options: [{ id: 'yes', label: 'เปิดใหม่' }, { id: 'no', label: 'ปล่อยไว้' }], defaultOption: 'no',
      ctx: { judgeSeat: p.seat, reason, judgeCard: strip(c) }, hideWaiting: true, timeout: this.timeouts.negate,
    }));
    if (r) {
      const g = r.player;
      g.spectral.splice(g.spectral.indexOf('flicker'), 1);
      const nc = this.drawOne();
      if (nc) {
        this.toDiscard([c]);
        c = nc;
        this.log(`👻 วิญญาณของ ${g.name} ${SPECTRAL.flicker.name}! ผลตัดสินใหม่: ${cardStr(c)}`);
        this.pushTable(g, this.makeV(c.key, [c]), [], SPECTRAL.flicker.name);
        this.update();
        await this.pause(1000);
      }
    }
    return c;
  }

  // ════════════════════════════ skills ════════════════════════════

  async useSkill(p, id, cards, targets) {
    const name = SKILLS[id].name;
    const t = targets[0];
    switch (id) {
      case 'heartstrings':
        this.ts.used.add(id);
        cards.forEach((c) => this.obtain(t, c));
        this.log(`💞 ${p.name} ใช้ทักษะ ${name} มอบการ์ด 1 ใบให้ ${t.name}`);
        this.noteFriendly(p, t);
        this.heal(t, 1, p);
        break;
      case 'shadow_glamour': {
        this.ts.used.add(id);
        const c = this.randomHand(t);
        if (!c) break;
        this.obtain(p, c);
        this.checkVow(p, [t], false);
        this.log(`🎭 ${p.name} ใช้ทักษะ ${name} หยิบการ์ดจากมือ ${t.name}`);
        const [back] = await this.chooseOwn(p, { min: 1, max: 1, kind: 'gift_card', title: `${name}: เลือกการ์ด 1 ใบมอบคืนให้ ${t.name}` });
        if (back) this.obtain(t, back);
        break;
      }
      case 'scandal': {
        this.ts.used.add(id);
        this.log(`👁 ${p.name} ใช้ทักษะ ${name} เปิดโปงมือของ ${t.name}: ${t.hand.map(cardStr).join(', ') || '(ว่าง)'}`);
        this.pushTable(t, { key: t.hand[0] ? t.hand[0].key : 'aegis', real: [...t.hand] }, [], `เปิดโปง: ${t.name}`);
        this.update();
        await this.pause(1400);
        if (!t.hand.some((c) => c.key === 'aegis')) {
          this.checkVow(p, [t], true);
          this.noteHostile(p, t);
          await this.damage(p, t, 1, null);
        } else this.log(`${t.name} มีม่านบาเรีย รอดพ้นจากข้อครหา`);
        break;
      }
      case 'incite': {
        this.ts.used.add(id);
        this.discardCards(cards);
        const [a, b] = targets;
        this.log(`⚑ ${p.name} ใช้ทักษะ ${name}: ${a.name} ต้องเปิดศึกพันธนาการโลหิตกับ ${b.name}`);
        this.pushTable(a, this.makeV('blood_duel', []), [b.seat], name);
        if (!(await this.askNegate('blood_duel', b, a))) await this.resolveDuel(a, b, null);
        break;
      }
      case 'watery_grave': {
        this.discardCards(cards);
        const c = await this.chooseCardFrom(p, t, { hand: false, judge: false, title: `${name}: เลือกอุปกรณ์ของ ${t.name} ที่จะจมสู่วังวน` });
        this.checkVow(p, [t], false);
        this.noteHostile(p, t);
        if (c) { this.discardCards([c]); this.log(`🌊 ${p.name} ใช้ทักษะ ${name} ส่ง ${cardStr(c)} ของ ${t.name} จมสู่ก้นทะเลสาบ`); }
        break;
      }
      case 'grail_touch': {
        this.ts.used.add(id);
        this.log(`🏆 ${p.name} ใช้ทักษะ ${name} มอบพรแก่ ${t.name}`);
        await this.loseHp(p, 1);
        if (!t.alive) break;
        this.draw(t, 2);
        const cs = [...t.judgeZone];
        this.discardCards(cs);
        t.poisonedBy = null;
        this.noteFriendly(p, t);
        this.log(`${t.name} จั่ว 2 ใบ${cs.length ? ` และคำสาป ${cs.length} อย่างถูกลบล้าง` : ''}`);
        break;
      }
      default:
        break;
    }
  }

  // ════════════════════════════ health ════════════════════════════

  heal(p, n, src, chain = true) {
    if (!p.alive) return;
    const before = p.hp;
    p.hp = Math.min(p.maxHp, p.hp + n);
    if (p.hp > before) {
      this.log(`${p.name} ฟื้นฟูเลือด ${p.hp - before} (${p.hp}/${p.maxHp})`);
      if (src) this.noteFriendly(src, p);
      if (chain) this.philterEcho(p);
    }
  }
  philterEcho(p) {
    for (const iso of this.alive()) {
      if (iso === p || iso.philter !== p.seat || !this.hasSkill(iso, 'philter') || iso.hp >= iso.maxHp) continue;
      this.log(`💕 ${SKILLS.philter.name}: ${iso.name} ฟื้นฟูตาม ${p.name}`);
      this.heal(iso, 1, null, false);
    }
  }

  async loseHp(p, n) {
    if (!p.alive) return;
    p.hp -= n;
    if (p.immortalTurns > 0 && p.hp < 1) p.hp = 1;
    this.log(`${p.name} เสียเลือด ${n} (${p.hp}/${p.maxHp})`);
    if (this.hasSkill(p, 'berserk')) { this.draw(p, n); this.log(`${p.name} ใช้ทักษะ ${SKILLS.berserk.name} จั่ว ${n} ใบ`); }
    if (p.hp <= 0) await this.dying(p, null);
  }

  /** คืนค่าความเสียหายที่เกิดจริง */
  async damage(source, target, amount, v, nature, opts = {}) {
    if (!target.alive) return 0;
    if (this.ts && source === this.ts.player && source !== target) {
      this.ts.damaged = true;
      if (this.ts.vow === 'mercy') this.checkVow(source, [target], true);
    }
    if (nature && this.armorKey(target) === 'dragonscale' && !opts.ignoreArmor) {
      amount--;
      this.log(`${CARD_INFO.dragonscale.name} ของ ${target.name} ลดความเสียหายลง 1`);
      if (amount <= 0) return 0;
    }
    if (target.ward) {
      const w = target.ward;
      target.ward = null;
      this.log(`${w === 'spikes' ? '🌵 เกราะหนามทมิฬ' : '🛡 ปราการศักดิ์สิทธิ์'} ของ ${target.name} ป้องกันความเสียหายไว้ได้`);
      if (w === 'spikes' && source && source !== target && source.alive && source.hand.length) {
        const c = this.randomHand(source);
        this.discardCards([c]);
        this.log(`หนามทมิฬทิ่มแทง ${source.name} ต้องทิ้ง ${cardStr(c)}`);
      }
      return 0;
    }
    if (target.hp - amount <= 0 && target.immortalTurns <= 0) {
      const guards = this.ghosts().filter((g) => g.spectral.includes('shield'));
      const r = await this.askRace(guards, (g) => ({
        type: 'option', kind: 'spectral_shield', title: `👻 ${SPECTRAL.shield.name}: ${target.name} กำลังจะรับความเสียหาย ${amount} ถึงตาย — รับแทน?`,
        options: [{ id: 'yes', label: 'รับแทน' }, { id: 'no', label: 'ไม่' }], defaultOption: 'no',
        ctx: { targetSeat: target.seat, sourceSeat: source ? source.seat : null }, hideWaiting: true, timeout: this.timeouts.negate,
      }));
      if (r) {
        const g = r.player;
        g.spectral.splice(g.spectral.indexOf('shield'), 1);
        this.log(`👻 วิญญาณของ ${g.name} สละไอวิญญาณรับความเสียหายแทน ${target.name}!`);
        this.emit('saved', { source: g, target });
        return 0;
      }
    }
    target.hp -= amount;
    if (target.immortalTurns > 0 && target.hp < 1) { target.hp = 1; this.log(`👑 สถานะอมตะคุ้มครอง ${target.name}`); }
    const natureName = nature === 'thunder' ? 'อุกกาบาต' : nature === 'fire' ? 'ธาตุไฟ' : '';
    this.log(`💥 ${target.name} ได้รับความเสียหาย${natureName} ${amount}${source ? ` จาก ${source.name}` : ''} (${target.hp}/${target.maxHp})`);
    this.noteHostile(source, target, amount);
    this.update();
    if (target.hp > 0) this.emit('damage', { source, target, amount });
    await this.pause(800);
    if (this.hasSkill(target, 'berserk')) { this.draw(target, amount); this.log(`${target.name} ใช้ทักษะ ${SKILLS.berserk.name} จั่ว ${amount} ใบ`); }
    if (target.hp <= 0) await this.dying(target, source);
    if (!target.alive) return amount;

    if (this.hasSkill(target, 'retribution') && v && v.real.length) {
      const got = v.real.filter((c) => this.discard.includes(c));
      if (got.length) {
        got.forEach((c) => { this.discard.splice(this.discard.indexOf(c), 1); target.hand.push(c); });
        this.log(`${target.name} ใช้ทักษะ ${SKILLS.retribution.name} กลืน ${got.map(cardStr).join(', ')} เข้ามือ`);
      }
    }
    if (this.hasSkill(target, 'soul_curse') && source && source !== target && source.alive) {
      let choice = 'hp';
      if (source.hand.length >= 2) {
        const a = await this.ask(source, {
          type: 'option', kind: 'soul_curse', title: `${target.name} ใช้ ${SKILLS.soul_curse.name}: เลือก`,
          options: [{ id: 'discard', label: 'ทิ้งการ์ดในมือ 2 ใบ' }, { id: 'hp', label: 'เสียเลือด 1' }], defaultOption: 'discard',
        });
        choice = a.option;
      }
      this.log(`🜏 ${target.name} สาปแช่ง ${source.name}`);
      if (choice === 'discard') {
        const cs = await this.chooseOwn(source, { min: 2, max: 2, title: `${SKILLS.soul_curse.name}: ทิ้งการ์ดในมือ 2 ใบ` });
        this.discardCards(cs);
        this.log(`${source.name} ทิ้ง ${cs.map(cardStr).join(', ')}`);
      } else {
        await this.loseHp(source, 1);
      }
    }
    return amount;
  }

  async dying(target, source) {
    if (this.hasSkill(target, 'decapitation') && !target.decapUsed) {
      target.decapUsed = true;
      target.hp = 2;
      this.log(`🟢 ศีรษะของ ${target.name} กลิ้งกลับคืนร่าง! (${SKILLS.decapitation.name}) ฟื้นเลือดเป็น 2 และจั่ว 2 ใบ`);
      this.draw(target, 2);
      this.emit('saved', { source: target, target });
      return;
    }
    this.log(`🩸 ${target.name} วิญญาณใกล้แตกดับ! ต้องการ น้ำอมฤต ${1 - target.hp} ขวด`);
    this.emit('dying', { target, source });
    const start = this.ts && this.ts.player.alive ? this.ts.player : target;
    for (const s of this.orderFrom(start)) {
      while (target.hp <= 0 && s.alive) {
        const need = 1 - target.hp;
        const c = await this.requestCard(s, 'elixir', {
          title: s === target ? `คุณใกล้สิ้นชีพ! ดื่ม「น้ำอมฤต」ช่วยตัวเอง? (ต้องการ ${need})` : `${target.name} ใกล้สิ้นชีพ! ใช้「น้ำอมฤต」ช่วยหรือไม่? (ต้องการ ${need})`,
          dyingSeat: target.seat, reason: 'dying',
        });
        if (!c) break;
        target.hp += 1;
        this.noteFriendly(s, target);
        this.log(`${s.name} ชุบชีวิต ${target.name} (${target.hp}/${target.maxHp})`);
        this.philterEcho(target);
        if (s !== target) this.emit('saved', { source: s, target });
      }
      if (target.hp > 0) break;
    }
    if (target.hp > 0) {
      target.hp = Math.min(target.hp, target.maxHp);
      return;
    }
    await this.kill(target, source);
  }

  async kill(target, source) {
    target.alive = false;
    target.ghost = true;
    target.hp = 0;
    target.ward = null;
    target.poisonedBy = null;
    target.sealTurns = 0;
    target.spectral = [...SPECTRAL_ORDER];
    this.log(`☠️ ${target.name} (${HEROES[target.hero].name}) สิ้นชีพ — บทบาท: ${ROLES[target.role].name} · กลายเป็นวิญญาณแห่งอวาลอน 👻`);
    this.emit('death', { target, source });
    const all = [...target.hand, ...this.equipCards(target), ...target.judgeZone];
    target.hand = [];
    target.equip = emptyEquip();
    target.judgeZone = [];
    this.toDiscard(all);
    for (const q of this.players) if (q.poisonedBy === target.seat) q.poisonedBy = null;
    this.update();
    await this.pause(1400);
    this.checkVictory();
    if (target.role === 'rebel') await this.moveTrack(2, `การล่มสลายของ ${target.name} (ลัทธิเงามืด)`);
    else if (target.role === 'loyalist') await this.moveTrack(-1, `การพลีชีพของ ${target.name} (อัศวินผู้ภักดี)`);
    if (source && source.alive) {
      if (target.role === 'rebel') {
        this.log(`${source.name} กำจัดลัทธิเงามืด ได้รางวัลจั่วการ์ดมหาเวท 3 ใบ`);
        this.draw(source, 3);
      } else if (target.role === 'loyalist' && source.role === 'lord') {
        this.log('⚖ ตราบาปสังหารสายเลือดเดียวกัน! กษัตริย์ต้องทิ้งการ์ดในมือและอุปกรณ์ทั้งหมด');
        this.discardCards([...source.hand, ...this.equipCards(source)]);
      }
      if (this.hasSkill(source, 'sword_stone')) {
        const eq = this.discard.filter((c) => CARD_INFO[c.key].type === 'equip');
        if (eq.length) {
          const a = await this.ask(source, {
            type: 'select', kind: 'sword_stone', title: `${SKILLS.sword_stone.name}: เลือกยุทโธปกรณ์ 1 ชิ้นจากสุสาน`,
            items: eq.slice(-12).map((c) => ({ ref: 'c' + c.id, card: strip(c) })), min: 1, max: 1,
          });
          const c = eq.find((x) => 'c' + x.id === a.refs[0]);
          if (c) {
            this.discard.splice(this.discard.indexOf(c), 1);
            source.hand.push(c);
            this.log(`⚔ ${source.name} ถอนดาบในศิลา ได้ ${cardStr(c)} ขึ้นมือ`);
          }
        }
      }
    }
    this.update();
  }

  checkVictory() {
    const lord = this.players.find((p) => p.role === 'lord');
    const al = this.alive();
    const pidsOf = (roles) => this.players.filter((p) => roles.includes(p.role)).map((p) => p.pid);
    if (!lord.alive) {
      if (al.length === 1 && al[0].role === 'traitor') {
        throw new GameOver({ winnerRole: 'traitor', winners: [al[0].pid], text: `ผู้แฝงตัว ${al[0].name} ยึดบัลลังก์คาเมลอตได้สำเร็จ!` });
      }
      throw new GameOver({ winnerRole: 'rebel', winners: pidsOf(['rebel']), text: 'กษัตริย์สิ้นพระชนม์! ลัทธิเงามืดชนะ' });
    }
    if (!al.some((p) => p.role === 'rebel' || p.role === 'traitor')) {
      throw new GameOver({ winnerRole: 'lord', winners: pidsOf(['lord', 'loyalist']), text: 'คาเมลอตรอดพ้น! กษัตริย์และอัศวินผู้ภักดีชนะ' });
    }
  }

  // ════════════════════════════ วิญญาณแห่งอวาลอน ════════════════════════════

  async spectralTurn(p) {
    this.ts = null;
    this.table = [];
    this.phase = 'spectral';
    p.spectralTurns = (p.spectralTurns || 0) + 1;
    const pool = SPECTRAL_ORDER.filter((k) => !p.spectral.includes(k));
    if (pool.length && p.spectral.length < 2 && p.spectralTurns % 3 === 0) {
      const k = pool[Math.floor(Math.random() * pool.length)];
      p.spectral.push(k);
      this.log(`👻 วิญญาณของ ${p.name} ได้รับการ์ดวิญญาณ「${SPECTRAL[k].name}」`);
    }
    if (!p.spectral.includes('whisper')) { this.update(); return; }
    const living = this.alive().filter((q) => q.hand.length);
    if (!living.length) return;
    const ans = await this.ask(p, {
      type: 'play', title: '👻 เทิร์นวิญญาณ: ใช้การ์ดวิญญาณหรือผ่าน', spectral: true,
      usables: [{ id: 'spectral:whisper', label: `🌫 ${SPECTRAL.whisper.name}`, button: true, targets: { min: 1, max: 1, candidates: living.map((q) => q.seat) } }],
    });
    if (ans.end) return;
    const t = this.players[ans.targets[0]];
    p.spectral.splice(p.spectral.indexOf('whisper'), 1);
    this.log(`🌫 วิญญาณของ ${p.name} กระซิบผ่านสายหมอก แอบดูมือของ ${t.name}`);
    this.whispers.set(p.pid, { seat: t.seat, cards: t.hand.map(strip) });
    this.emit('whisper', { source: p, target: t });
    await this.ask(p, {
      type: 'select', kind: 'whisper', title: `🌫 มือของ ${t.name} (เห็นเฉพาะคุณ) — ส่งสัญญาณให้เพื่อนทางแชทได้`,
      items: t.hand.map((c) => ({ ref: 'c' + c.id, card: strip(c) })), min: 0, max: 0, targetSeat: t.seat,
    });
  }

  // ════════════════════════════ views ════════════════════════════

  viewFor(pid) {
    const me = this.player(pid);
    const over = this.phase === 'over';
    const pe = me && this.pending.get(me.pid);
    const ts = this.ts;
    return {
      phase: this.phase,
      phaseName: PHASE_NAMES[this.phase],
      round: this.round,
      turnSeat: ts ? ts.player.seat : null,
      gameId: this.id,
      mySeat: me ? me.seat : null,
      deckCount: this.deck.length,
      discardCount: this.discard.length,
      track: this.track,
      trackMin: TRACK_MIN,
      trackMax: TRACK_MAX,
      grailFound: this.grailFound,
      eclipseRate: this.eclipseRate(),
      vow: ts && ts.vow ? { seat: ts.player.seat, id: ts.vow, broken: ts.vowBroken } : null,
      players: this.players.map((p) => ({
        seat: p.seat, pid: p.pid, name: p.name, hero: p.hero, hp: p.hp, maxHp: p.maxHp, alive: p.alive, ghost: p.ghost,
        kingdom: p.kingdom, gender: p.gender, isBot: p.isBot, connected: p.connected, zone: p.zone,
        handCount: p.hand.length,
        equip: Object.fromEntries(Object.entries(p.equip).map(([k, c]) => [k, strip(c)])),
        judge: p.judgeZone.map(strip),
        role: over || p === me || p.role === 'lord' || !p.alive ? p.role : null,
        distance: me && me.alive && p.alive && p !== me ? this.distance(me, p) : null,
        inRange: me && me.alive && p.alive && p !== me ? this.inAttackRange(me, p) : false,
        status: {
          ward: p.ward, poisoned: p.poisonedBy != null, sealed: p.sealTurns > 0, fallen: p.fallen,
          immortal: p.immortalTurns > 0, vow: p.vow, spectral: p.ghost ? p.spectral.length : 0,
        },
      })),
      hand: me ? me.hand.map(strip) : [],
      spectral: me && me.ghost ? me.spectral : null,
      whisper: me && this.whispers.get(me.pid) || null,
      table: this.table,
      log: this.logs.slice(-80),
      waiting: [...this.pending.values()].map((e) => (e.req.hideWaiting
        ? { seat: null, title: 'รอผู้เล่นตัดสินใจตอบโต้…', deadline: e.req.deadline }
        : { seat: e.p.seat, title: e.req.title, deadline: e.req.deadline })),
      prompt: pe ? pe.req : null,
      result: this.result,
    };
  }
}

module.exports = { Game, ROLE_TABLE, ZONES, RING, WEAVES, RUNES, VOWS, SPECTRAL, zoneDistance, adjacentZones, judgeGood, GameOver, GameAborted };
