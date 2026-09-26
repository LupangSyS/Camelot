'use strict';

// ระบบขั้นสูง (Advanced Mechanics & The Usurper Overhaul)
//   1. ผู้แฝงตัว: ตราสัญลักษณ์ปลอม, ไอความโกลาหล และพิธีชิงมงกุฎเลือด
//   2. สภาโต๊ะกลมและพระราชกำหนด (โหวตทุกรอบ)
//   3. จุติวีรชนสองด้าน (ด้านมืดแปดเปื้อน)
//   4. การ์ดลิขิตชะตา (ภารกิจลับส่วนตัว)
//   5. ภัยพิบัติแห่งบริทาเนีย (ศัตรูส่วนรวมทุก 3 รอบ)
// ติดตั้งเป็นเมธอดของ Game — เปิดใช้เมื่อ game.adv เป็นจริง

const { CARD_INFO, cardStr } = require('./cards');
const { HEROES, SKILLS, DARK } = require('./heroes');

const FACADES = {
  crown: { name: 'ตราราชสำนัก', desc: 'แสร้งเป็นฝ่ายกษัตริย์: ออกแสวงบุญได้ด้วยการ์ดเพียง 1 ใบ และพรจอกศักดิ์สิทธิ์ไม่เผาผลาญคุณ' },
  coven: { name: 'ตราเงามืด', desc: 'แสร้งเป็นลัทธิเงามืด: ทำพิธีกรรมสังเวยได้โดยไม่เสียเลือด' },
};

const CHAOS_MAX = 4;
const LEGENDARY = ['excalibur', 'pridwen', 'rhongomyniad'];
const CHAOS = {
  peek: { cost: 1, name: 'เนตรโกลาหล', desc: 'จ่าย 1: แอบดูการ์ดในมือของผู้เล่น 1 คน' },
  redirect: { cost: 2, name: 'เบี่ยงคมดาบ', desc: 'จ่าย 2: เมื่อ "ศรเวท" เล็งกษัตริย์ ย้ายเป้าหมายไปยังผู้เล่นอื่นแทน' },
  seize: { cost: 3, name: 'ชิงศาสตราตำนาน', desc: 'จ่าย 3: ยึดเอ็กซ์คาลิเบอร์ / โล่พริตเวน / หอกรอนโกมิเนียด จากใครก็ได้มาสวมใส่ทันที' },
  rite: { cost: 0, name: 'พิธีชิงมงกุฎเลือด', desc: 'มีไอความโกลาหลครบ 4 และสวมเอ็กซ์คาลิเบอร์: ประกาศพิธี (เปิดเผยตัวตน) หากยังรอดและยังถือดาบอยู่เมื่อถึงเทิร์นถัดไปของคุณ ชนะทันที' },
};

const DECREES = {
  martial_law: { name: 'กฎอัยการศึก', en: 'Martial Law', desc: 'รอบนี้ระยะโจมตีของทุกคน +1 แต่ห้ามดื่มน้ำอมฤตฟื้นเลือด (ยกเว้นชุบชีวิต)', king: 0 },
  grand_feast: { name: 'งานเลี้ยงฉลองสิเน่หา', en: 'Grand Feast', desc: 'ทุกคนฟื้นฟูเลือด 1 แต่ต้องเปิดเผยการ์ดในมือแบบสุ่ม 1 ใบ', king: 2 },
  inquisition: { name: 'ไต่สวนคนนอกรีต', en: 'Inquisition', desc: 'สภาโหวตเลือกผู้ต้องสงสัย 1 คน ผู้นั้นถูกคุมขัง ข้ามช่วงเบิกมนตราในรอบนี้', king: 2 },
  royal_levy: { name: 'ภาษีหลวง', en: 'Royal Levy', desc: 'ผู้เล่นทุกคนที่ถือการ์ด 4 ใบขึ้นไป ต้องถวายการ์ด 1 ใบแด่กษัตริย์', king: 2 },
  pilgrimage: { name: 'ปีแห่งการแสวงบุญ', en: 'Year of Pilgrimage', desc: 'รอบนี้การออกแสวงบุญเลื่อนแถบชะตาเพิ่มอีก 1 ช่อง', king: 1 },
  curfew: { name: 'เคอร์ฟิวมนตรา', en: 'Arcane Curfew', desc: 'รอบนี้ห้ามเคลื่อนที่บนโต๊ะกลม และห้ามผลัก/ดึงด้วยคลื่นจิต', king: 1 },
  arcane_surge: { name: 'คลื่นมนตราทะลัก', en: 'Arcane Surge', desc: 'รอบนี้ทุกคนผสานรูนได้เพิ่มอีก 1 ครั้งต่อเทิร์น', king: 0 },
  eclipse_festival: { name: 'เทศกาลจันทราสีเลือด', en: 'Blood Moon Festival', desc: 'รอบนี้พิธีกรรมสังเวยไม่ต้องสละเลือด', king: -2 },
  open_roads: { name: 'เปิดประตูเมือง', en: 'Open Roads', desc: 'รอบนี้ทุกคนเคลื่อนที่บนโต๊ะกลมได้ 2 ครั้งต่อเทิร์น', king: -1 },
  trial_by_combat: { name: 'ตัดสินด้วยคมดาบ', en: 'Trial by Combat', desc: 'รอบนี้ "พันธนาการโลหิต" ทำความเสียหาย 2 และศรเวทของทุกคนใช้ได้เพิ่ม 1 ครั้ง', king: -2 },
};

const THREATS = {
  dragon: { name: 'มังกรแดงตื่นชีพ', en: 'The Awakening of Vermithrax', boss: true, desc: 'พลังชีวิต = ผู้เล่นที่รอด × 2 · จบเทิร์นของทุกคน ผู้เล่นคนนั้นโดนลมหายใจเพลิง 1 · สละการ์ดใดก็ได้เพื่อโจมตีมังกร (♦ = 2) · ผู้ปิดฉากได้ "เกล็ดมังกรเพลิง" (ไฟไม่ระคาย + เลือดสูงสุด +1)' },
  saxons: { name: 'กองทัพแซกซอนบุก', en: 'The Saxon Warband', boss: true, desc: 'พลังชีวิต = ผู้เล่นที่รอด + 3 · ทุกต้นรอบ ผู้ที่ยืนอยู่ในทุ่งสงครามหรือศูนย์กลางมนตราโดนโจมตี 1 · สละการ์ดเพื่อโจมตี (♦ = 2) · ผู้ปิดฉากจั่ว 3 ใบและฟื้นเลือด 1' },
  wild_hunt: { name: 'การล่าแห่งเทพพงไพร', en: 'The Wild Hunt', rounds: 2, desc: '2 รอบ: ต้นเทิร์นของทุกคนเปิดการ์ดตัดสิน ถ้าได้ ♠ โดนธนูพรานผี 1' },
  blight: { name: 'แผ่นดินต้องสาป', en: 'The Blighted Land', rounds: 2, desc: '2 รอบ: ขีดจำกัดการ์ดในมือของทุกคน −1 และน้ำอมฤตที่ดื่มในเทิร์นตัวเองไม่ฟื้นเลือด' },
};

const DESTINIES = {
  forbidden_love: { name: 'ตราบาปแห่งรักต้องห้าม', desc: 'อยู่รอดถึงต้นรอบที่ 6 โดยไม่เคยทำร้ายฮีโร่หญิงหรือเซอร์ลานเซล็อต', reward: 'เลือดสูงสุด +1 และฟื้นเลือด 1 (แหวนทองคำขาว)' },
  grail_pilgrim: { name: 'ผู้แสวงหาจอกศักดิ์สิทธิ์', desc: 'ใช้การ์ดธาตุศักดิ์สิทธิ์ (♣) ครบ 4 ใบ (ใช้ ตอบสนอง ผสานรูน หรือแสวงบุญ)', reward: 'ได้วัตถุโบราณระดับเทวะ 1 ชิ้นจากกองจั่วหรือสุสาน' },
  blood_feud: { name: 'สายเลือดแค้นแห่งออร์กนีย์', desc: 'ทำความเสียหายแก่ผู้เล่นที่นั่งฝั่งตรงข้ามคุณ 2 ครั้ง', reward: 'จั่ว 3 ใบ และศรเวทของคุณทะลุเกราะตลอดเกม' },
  dragon_slayer: { name: 'ผู้สังหารมังกร', desc: 'ปิดฉากผู้เล่นที่มีเลือดเริ่มต้นสูงสุดในวง (หรือปิดฉากภัยพิบัติ)', reward: 'ไม่ตกเป็นเป้าหมายของคำสาปหน่วงเวลาอีกต่อไป' },
  arcane_scholar: { name: 'ปราชญ์แห่งรูน', desc: 'ผสานรูนสำเร็จ 4 ครั้ง', reward: 'จั่ว 2 ใบ และผสานรูนได้เพิ่ม 1 ครั้งต่อเทิร์นตลอดเกม' },
  wanderer: { name: 'ผู้พเนจรแห่งโต๊ะกลม', desc: 'ไปยืนให้ครบทั้ง 5 โซนของโต๊ะกลม', reward: 'นับระยะไปหาทุกคน −1 ตลอดเกม (ฝีเท้าพเนจร)' },
  martyr: { name: 'ผู้พลีชีพที่ไม่ยอมตาย', desc: 'ได้รับความเสียหายรวม 5 หน่วยและยังมีชีวิตอยู่', reward: 'ฟื้นเลือด 2 และจั่ว 1 ใบ' },
  oathkeeper: { name: 'ผู้รักษาคำสัตย์', desc: 'รักษาสัตยาบัน (ความกล้าหรือความเมตตา) สำเร็จ 2 ครั้ง', reward: 'เลือดสูงสุด +1 และฟื้นเลือด 1' },
};
const DESTINY_GOAL = { grail_pilgrim: 4, blood_feud: 2, arcane_scholar: 4, wanderer: 5, martyr: 5, oathkeeper: 2 };

function shuffleArr(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function install(Game, H) {
  const { strip, GameOver, ZONES, adjacentZones } = H;
  const P = Game.prototype;

  // ═══════════════ เริ่มเกม ═══════════════

  P.setupAdvanced = async function setupAdvanced() {
    this.decreeDeck = shuffleArr(Object.keys(DECREES));
    this.threatDeck = shuffleArr(Object.keys(THREATS));
    const topHp = Math.max(...this.players.map((p) => p.maxHp));
    this.giantSeats = this.players.filter((p) => p.maxHp === topHp).map((p) => p.seat);
    const dests = shuffleArr(Object.keys(DESTINIES));
    const n = this.players.length;
    this.players.forEach((p, i) => {
      const id = dests[i % dests.length];
      p.dest = { id, progress: 0, done: false, failed: false };
      if (id === 'blood_feud') p.dest.target = (p.seat + Math.floor(n / 2)) % n;
      p.visited = new Set([p.zone]);
      if (id === 'wanderer') p.dest.progress = 1;
    });
    this.log('📜 ทุกคนได้รับการ์ดลิขิตชะตาลับคนละ 1 ใบ');
    await Promise.all(this.players.filter((p) => p.role === 'traitor').map(async (p) => {
      const a = await this.ask(p, {
        type: 'option', kind: 'facade', title: 'แฝงตัวสองหน้า: เลือกตราสัญลักษณ์ปลอมที่จะใช้ตลอดเกม (เป็นความลับ)',
        options: Object.entries(FACADES).map(([id, f]) => ({ id, label: `${f.name} — ${f.desc}` })), defaultOption: 'crown',
      });
      p.facade = a.option;
    }));
  };

  // ═══════════════ ต้นรอบ: ภัยพิบัติ + สภา ═══════════════

  P.roundStartAdvanced = async function roundStartAdvanced() {
    // ลิขิตชะตา: รักต้องห้าม
    if (this.round >= 6) for (const p of this.alive()) if (p.dest && p.dest.id === 'forbidden_love' && !p.dest.failed) this.completeDestiny(p);
    const th = this.threat;
    if (th) {
      if (th.id === 'saxons') {
        const hit = this.alive().filter((p) => p.zone === 'marches' || p.zone === 'nexus');
        if (hit.length) this.log(`⚔ ${THREATS.saxons.name} บุกโจมตีผู้ที่อยู่ใน${ZONES.marches.name}และ${ZONES.nexus.name}!`);
        for (const p of hit) await this.damage(null, p, 1, null);
      }
      if (th.rounds) {
        th.left--;
        if (th.left <= 0) { this.log(`🌤 ${THREATS[th.id].name} ผ่านพ้นไปแล้ว`); this.threat = null; }
      }
    }
    if (!this.threat && this.round >= 3 && this.round % 3 === 0) await this.spawnThreat();
    await this.council();
  };

  P.spawnThreat = async function spawnThreat() {
    if (!this.threatDeck.length) this.threatDeck = shuffleArr(Object.keys(THREATS));
    const id = this.threatDeck.pop();
    const t = THREATS[id];
    const n = this.alive().length;
    this.threat = { id, hp: 0, maxHp: 0, left: t.rounds || 0 };
    if (t.boss) {
      this.threat.maxHp = id === 'dragon' ? n * 2 : n + 3;
      this.threat.hp = this.threat.maxHp;
    }
    this.log(`🐉 ภัยพิบัติแห่งบริทาเนีย: ${t.name} — ${t.desc}`);
    this.pushTable(null, { key: 'meteor', real: [] }, [], `ภัยพิบัติ: ${t.name}`);
    this.emit('threat', { threat: id });
    this.update();
    await this.pause(1600);
  };

  P.council = async function council() {
    const lord = this.players.find((p) => p.role === 'lord');
    this.decree = null;
    if (!lord.alive) return;
    if (this.decreeDeck.length < 2) this.decreeDeck = shuffleArr(Object.keys(DECREES));
    const two = [this.decreeDeck.pop(), this.decreeDeck.pop()];
    this.phase = 'council';
    this.log(`🏛 เฟสสภาโต๊ะกลม: กษัตริย์เปิดพระราชกำหนด「${DECREES[two[0]].name}」และ「${DECREES[two[1]].name}」`);
    const a = await this.ask(lord, {
      type: 'option', kind: 'decree_pick', title: '🏛 สภาโต๊ะกลม: เลือกพระราชกำหนด 1 ฉบับเสนอต่อสภา',
      options: two.map((id) => ({ id, label: `${DECREES[id].name} — ${DECREES[id].desc}` })), defaultOption: two[0],
      decrees: two,
    });
    const id = a.option;
    const d = DECREES[id];
    this.log(`🏛 กษัตริย์เสนอ「${d.name}」: ${d.desc} — ทุกคนลงหินมนตรา`);
    const voters = this.alive();
    const votes = await Promise.all(voters.map((p) => this.ask(p, {
      type: 'option', kind: 'vote', title: `🗳 ลงมติ「${d.name}」: ${d.desc}`, decree: id,
      options: [{ id: 'white', label: '⚪ หินขาว (เห็นชอบ)' }, { id: 'black', label: '⚫ หินดำ (คัดค้าน)' }], defaultOption: 'white', timeout: 20000,
    }).then((v) => ({ p, v: v.option }))));
    const white = votes.filter((x) => x.v === 'white');
    const black = votes.filter((x) => x.v === 'black');
    let pass = white.length > black.length;
    if (white.length === black.length) pass = votes.find((x) => x.p === lord).v === 'white';
    for (const { p, v } of votes) {
      if (p === lord) continue;
      if (v === 'white') this.noteFriendly(p, lord); else if (DECREES[id].king > 0) p.rebelScore += 1;
    }
    this.lastVote = { decree: id, white: white.map((x) => x.p.seat), black: black.map((x) => x.p.seat), pass };
    this.log(`🗳 ผลโหวต ⚪ ${white.length} (${white.map((x) => x.p.name).join(', ') || '-'}) · ⚫ ${black.length} (${black.map((x) => x.p.name).join(', ') || '-'}) → ${pass ? 'ผ่าน! มีผลตลอดรอบนี้' : 'ตกไป'}`);
    this.emit('vote', { decree: id, pass, votes });
    this.update();
    await this.pause(1200);
    if (!pass) return;
    this.decree = id;
    await this.enactDecree(id, lord);
  };

  P.enactDecree = async function enactDecree(id, lord) {
    if (id === 'grand_feast') {
      for (const p of this.alive()) {
        this.heal(p, 1, null);
        const c = this.randomHand(p);
        if (c) this.log(`🍷 ${p.name} เปิดเผยการ์ด ${cardStr(c)} กลางงานเลี้ยง`);
      }
    } else if (id === 'royal_levy') {
      for (const p of this.alive()) {
        if (p === lord || p.hand.length < 4) continue;
        const [c] = await this.chooseOwn(p, { min: 1, max: 1, kind: 'levy', title: `ภาษีหลวง: เลือกการ์ด 1 ใบถวายแด่ ${lord.name}` });
        if (c) { this.obtain(lord, c); this.log(`💰 ${p.name} ถวายการ์ด 1 ใบแด่กษัตริย์`); }
      }
    } else if (id === 'inquisition') {
      const voters = this.alive();
      const tally = new Map();
      const ballots = await Promise.all(voters.map((p) => {
        const cands = this.alive().filter((q) => q !== p && q.role !== 'lord').map((q) => q.seat);
        if (!cands.length) return Promise.resolve(null);
        return this.ask(p, { type: 'players', kind: 'inquisition', title: '⚖ ไต่สวนคนนอกรีต: โหวตผู้ต้องสงสัยที่จะถูกคุมขัง', candidates: cands, min: 1, max: 1 })
          .then((a) => ({ p, seat: a.seats[0] }));
      }));
      for (const b of ballots) if (b) tally.set(b.seat, (tally.get(b.seat) || 0) + 1 + (b.p === lord ? 0.5 : 0));
      let best = null;
      for (const [seat, n] of tally) if (!best || n > best[1]) best = [seat, n];
      if (best) {
        const t = this.players[best[0]];
        t.jailedRound = this.round;
        this.log(`⛓ สภาตัดสินคุมขัง ${t.name} — ข้ามช่วงเบิกมนตราในรอบนี้ (${ballots.filter(Boolean).map((b) => `${b.p.name}→${this.players[b.seat].name}`).join(', ')})`);
      }
    }
  };

  // ═══════════════ ต้น/ท้ายเทิร์น ═══════════════

  P.turnStartAdvanced = async function turnStartAdvanced(p) {
    // พิธีชิงมงกุฎเลือด: สำเร็จเมื่อรอดมาถึงเทิร์นถัดไปพร้อมดาบ
    if (this.rite && this.rite.seat === p.seat) {
      if (this.hasWeapon(p, 'excalibur')) {
        throw new GameOver({ winnerRole: 'traitor', winners: [p.pid], text: `👑 พิธีชิงมงกุฎเลือดสำเร็จ! ${p.name} ผู้แฝงตัวยึดบัลลังก์คาเมลอตด้วยเอ็กซ์คาลิเบอร์` });
      }
      this.rite = null;
    }
    if (this.threat && this.threat.id === 'wild_hunt') {
      const j = await this.judge(p, 'wild_hunt');
      const hit = j && j.suit === 'spade';
      this.toDiscard([j]);
      if (hit) { this.log(`🏹 ธนูพรานผีแห่งการล่าเทพพงไพรปักร่าง ${p.name}!`); await this.damage(null, p, 1, null); }
    }
    if (p.alive && this.track <= -5) await this.maybeAwaken(p, 'doom');
  };

  P.turnEndAdvanced = async function turnEndAdvanced(p) {
    const ts = this.ts;
    if (ts && ts.vow && ts.vow !== 'tithe' && !ts.vowBroken) this.destinyProgress(p, 'oathkeeper', 1);
    if (this.threat && this.threat.id === 'dragon' && p.alive) {
      this.log(`🔥 ${THREATS.dragon.name} พ่นลมหายใจเพลิงใส่ ${p.name}!`);
      await this.damage(null, p, 1, null, 'fire');
    }
  };

  P.drawLimitAdjust = function drawLimitAdjust() {
    return this.threat && this.threat.id === 'blight' ? -1 : 0;
  };

  // ═══════════════ จุติด้านมืด ═══════════════

  P.maybeAwaken = async function maybeAwaken(p, why) {
    if (!this.adv || p.awakened || !p.alive || !DARK[p.hero]) return;
    const d = DARK[p.hero];
    const ok = await this.confirm(p, 'awaken', `${why === 'doom' ? '🌑 นาฬิกาหายนะถึงระดับวิกฤต' : '🩸 เลือดของคุณเหลือ 1'} — ปลดปล่อยสัญชาตญาณมืด พลิกเป็น「${d.name}」? (ฟื้นเลือด 1 · ทักษะด้านมืด: ${d.skills.map((s) => SKILLS[s].name).join(', ')} แทนทักษะเดิมทั้งหมด)`, 'จุติด้านมืด', 'ไม่');
    if (!ok) return;
    p.awakened = true;
    this.log(`🌑 ${p.name} ปลดปล่อยสัญชาตญาณมืด! ${HEROES[p.hero].name} พลิกเป็น「${d.name}」(${d.skills.map((s) => SKILLS[s].name).join(', ')})`);
    this.emit('awaken', { source: p });
    this.heal(p, 1, null);
    this.update();
    await this.pause(1200);
  };

  // ═══════════════ ลิขิตชะตา ═══════════════

  P.destinyProgress = function destinyProgress(p, id, n = 1) {
    if (!this.adv || !p || !p.dest || p.dest.id !== id || p.dest.done || p.dest.failed) return;
    p.dest.progress += n;
    if (p.dest.progress >= DESTINY_GOAL[id]) this.completeDestiny(p);
  };

  P.completeDestiny = function completeDestiny(p) {
    const d = p.dest;
    if (!d || d.done || d.failed || !p.alive) return;
    d.done = true;
    const info = DESTINIES[d.id];
    this.log(`🌟 ${p.name} ทำลิขิตชะตา「${info.name}」สำเร็จ! รางวัล: ${info.reward}`);
    this.emit('destiny', { source: p, destiny: d.id });
    switch (d.id) {
      case 'forbidden_love': case 'oathkeeper': p.maxHp++; this.heal(p, 1, null); break;
      case 'grail_pilgrim': {
        const pool = [...this.deck, ...this.discard].filter((c) => CARD_INFO[c.key].type === 'equip' && (LEGENDARY.includes(c.key) || c.key === 'merlin_staff' || c.key === 'mantle'));
        const c = pool[Math.floor(Math.random() * pool.length)];
        if (c) {
          const from = this.deck.includes(c) ? this.deck : this.discard;
          from.splice(from.indexOf(c), 1);
          p.hand.push(c);
          this.log(`${p.name} ได้รับ ${cardStr(c)}`);
        } else this.draw(p, 2);
        break;
      }
      case 'blood_feud': this.draw(p, 3); p.boons.pierce = true; break;
      case 'dragon_slayer': p.boons.curseImmune = true; for (const c of [...p.judgeZone]) { this.removeCard(c); this.toDiscard([c]); } break;
      case 'arcane_scholar': this.draw(p, 2); p.boons.weave = true; break;
      case 'wanderer': p.boons.stride = true; break;
      case 'martyr': this.heal(p, 2, null); this.draw(p, 1); break;
      default: break;
    }
    this.update();
  };

  P.visitZone = function visitZone(p) {
    if (!this.adv || !p.visited) return;
    if (!p.visited.has(p.zone)) {
      p.visited.add(p.zone);
      this.destinyProgress(p, 'wanderer', 1);
    }
  };

  P.countClubs = function countClubs(p, cards) {
    const n = cards.filter((c) => c && c.suit === 'club').length;
    if (n) this.destinyProgress(p, 'grail_pilgrim', n);
  };

  /** ติดตามผลของความเสียหายต่อระบบขั้นสูง */
  P.afterDamageAdvanced = async function afterDamageAdvanced(source, target, dealt) {
    if (!this.adv || dealt <= 0) return;
    if (source && source !== target) {
      if (target.hero === 'lancelot' || target.gender === 'f') {
        if (source.dest && source.dest.id === 'forbidden_love' && !source.dest.done) source.dest.failed = true;
      }
      if (source.dest && source.dest.id === 'blood_feud' && source.dest.target === target.seat) this.destinyProgress(source, 'blood_feud', 1);
      if (this.hasSkill(source, 'vampiric') && source.alive) { this.draw(source, 1); this.log(`${source.name} ใช้ทักษะ ${SKILLS.vampiric.name} จั่ว 1 ใบ`); }
    }
    if (target.alive) {
      this.destinyProgress(target, 'martyr', dealt);
      if (target.hp === 1) await this.maybeAwaken(target, 'hp');
    }
  };

  P.onDeathAdvanced = async function onDeathAdvanced(target, source) {
    if (!this.adv) return;
    for (const t of this.alive()) {
      if (t.role === 'traitor' && t.chaos < CHAOS_MAX) {
        t.chaos++;
        if (!t.isBot) this.log(`🌀 ไอความโกลาหลสะสมในเงามืด...`);
      }
      if (t !== source && this.hasSkill(t, 'soul_reap')) {
        this.log(`💀 ${t.name} ใช้ทักษะ ${SKILLS.soul_reap.name}`);
        this.heal(t, 1, null);
        this.draw(t, 2);
      }
    }
    if (this.rite && this.rite.seat === target.seat) { this.rite = null; this.log('พิธีชิงมงกุฎเลือดล่มสลายพร้อมผู้ประกอบพิธี'); }
    for (const p of this.players) if (p.dest && p.dest.id === 'blood_feud' && p.dest.target === target.seat && !p.dest.done) p.dest.failed = true;
    if (source && source.alive && this.giantSeats && this.giantSeats.includes(target.seat)) this.completeDestinyIf(source, 'dragon_slayer');
  };
  P.completeDestinyIf = function completeDestinyIf(p, id) {
    if (p.dest && p.dest.id === id) this.completeDestiny(p);
  };

  // ═══════════════ ตัวเลือกช่วงร่ายเวท ═══════════════

  P.advancedUsables = function advancedUsables(p) {
    const out = [];
    if (!this.adv) return out;
    const ts = this.ts;
    const others = this.others(p);
    const he = [...p.hand, ...this.equipCards(p)];
    const th = this.threat;
    if (th && THREATS[th.id].boss && th.hp > 0 && he.length) {
      out.push({ id: 'threat', adv: 'threat', button: true, label: `⚔ โจมตี${THREATS[th.id].name} (${th.hp}/${th.maxHp})`, pick: { min: 1, max: 1, pool: he.map((c) => c.id) } });
    }
    if (p.role === 'traitor' && p.chaos > 0) {
      const withHand = others.filter((q) => q.hand.length);
      if (p.chaos >= CHAOS.peek.cost && withHand.length) out.push({ id: 'chaos:peek', adv: 'peek', button: true, label: `🌀 ${CHAOS.peek.name} (−1)`, targets: { min: 1, max: 1, candidates: withHand.map((q) => q.seat) } });
      if (p.chaos >= CHAOS.seize.cost) {
        const holders = others.filter((q) => this.equipCards(q).some((c) => LEGENDARY.includes(c.key)));
        if (holders.length) out.push({ id: 'chaos:seize', adv: 'seize', button: true, label: `🌀 ${CHAOS.seize.name} (−3)`, targets: { min: 1, max: 1, candidates: holders.map((q) => q.seat) } });
      }
      if (p.chaos >= CHAOS_MAX && this.hasWeapon(p, 'excalibur') && !this.rite) out.push({ id: 'chaos:rite', adv: 'rite', button: true, label: `👑 ${CHAOS.rite.name}` });
    }
    const skill = (id, extra) => out.push({ id: 'dark:' + id, adv: 'dark', skill: id, button: true, label: `🌑 ${SKILLS[id].name}`, ...extra });
    if (this.hasSkill(p, 'chrono_ruin') && !ts.used.has('chrono_ruin')) {
      const c = others.filter((q) => (q.lastDrawn || []).some((x) => q.hand.includes(x)));
      if (c.length) skill('chrono_ruin', { targets: { min: 1, max: 1, candidates: c.map((q) => q.seat) } });
    }
    if (this.hasSkill(p, 'dark_nova') && !ts.used.has('dark_nova') && p.hp > 1 && others.some((q) => this.distance(p, q) <= 1)) skill('dark_nova');
    if (this.hasSkill(p, 'hex_storm') && !ts.used.has('hex_storm') && he.length) skill('hex_storm', { pick: { min: 1, max: 1, pool: he.map((c) => c.id) } });
    return out;
  };

  P.performAdvanced = async function performAdvanced(p, u, cards, targets) {
    const t = targets[0];
    switch (u.adv) {
      case 'threat': {
        const th = this.threat;
        if (!th) return;
        const c = cards[0];
        this.discardCards([c]);
        const dmg = c.suit === 'diamond' ? 2 : 1;
        th.hp = Math.max(0, th.hp - dmg);
        this.log(`⚔ ${p.name} สละ ${cardStr(c)} โจมตี${THREATS[th.id].name} −${dmg} (${th.hp}/${th.maxHp})`);
        this.emit('threatHit', { source: p });
        if (th.hp <= 0) await this.slayThreat(p);
        return;
      }
      case 'peek':
        p.chaos -= CHAOS.peek.cost;
        this.log(`🌀 ${p.name} ใช้พลังโกลาหลบางอย่าง...`);
        this.whispers.set(p.pid, { seat: t.seat, cards: t.hand.map(strip) });
        await this.ask(p, { type: 'select', kind: 'whisper', title: `🌀 เนตรโกลาหล: มือของ ${t.name} (เห็นเฉพาะคุณ)`, items: t.hand.map((c) => ({ ref: 'c' + c.id, card: strip(c) })), min: 0, max: 0, targetSeat: t.seat });
        return;
      case 'seize': {
        const legend = this.equipCards(t).filter((c) => LEGENDARY.includes(c.key));
        const c = legend.length === 1 ? legend[0] : await this.chooseCardFrom(p, t, { hand: false, judge: false, only: legend, title: `${CHAOS.seize.name}: เลือกศาสตราตำนานของ ${t.name}` });
        if (!c) return;
        p.chaos -= CHAOS.seize.cost;
        this.removeCard(c);
        await this.equipCard(p, c);
        this.noteHostile(p, t);
        this.log(`🌀 ${p.name} ฉีกม่านโกลาหล ชิง ${cardStr(c)} ของ ${t.name} มาสวมใส่!`);
        this.emit('robbed', { source: p, target: t });
        return;
      }
      case 'rite':
        this.rite = { seat: p.seat, round: this.round };
        p.revealed = true;
        this.log(`👑 ${p.name} เผยตัวเป็นผู้แฝงตัว และประกาศพิธีชิงมงกุฎเลือด! หากยังรอดและยังถือเอ็กซ์คาลิเบอร์เมื่อถึงเทิร์นถัดไป จะยึดบัลลังก์ได้ทันที — ทำลายหรือชิงดาบให้ได้!`);
        this.emit('rite', { source: p });
        this.update();
        await this.pause(1500);
        return;
      case 'dark':
        await this.useDarkSkill(p, u.skill, cards, t);
        return;
      default:
    }
  };

  P.slayThreat = async function slayThreat(p) {
    const th = this.threat;
    this.threat = null;
    this.log(`🏆 ${p.name} ปิดฉาก${THREATS[th.id].name}!`);
    this.emit('threatSlain', { source: p, threat: th.id });
    if (th.id === 'dragon') {
      p.boons.dragonflame = true;
      p.maxHp++;
      this.heal(p, 1, null);
      this.log(`${p.name} ได้รับ "เกล็ดมังกรเพลิง": ไม่ได้รับความเสียหายธาตุไฟ และเลือดสูงสุด +1`);
    } else {
      this.draw(p, 3);
      this.heal(p, 1, null);
    }
    this.completeDestinyIf(p, 'dragon_slayer');
    this.update();
  };

  P.useDarkSkill = async function useDarkSkill(p, id, cards, t) {
    const name = SKILLS[id].name;
    this.ts.used.add(id);
    switch (id) {
      case 'chrono_ruin': {
        const gone = (t.lastDrawn || []).filter((c) => t.hand.includes(c));
        this.discardCards(gone);
        this.checkVow(p, [t], false);
        this.noteHostile(p, t);
        this.log(`⏳ ${p.name} ใช้ ${name} ย้อนกาลเวลา ${t.name} ต้องทิ้ง ${gone.map(cardStr).join(', ')}`);
        break;
      }
      case 'dark_nova': {
        const near = this.others(p).filter((q) => this.distance(p, q) <= 1);
        this.log(`💥 ${p.name} ใช้ ${name}!`);
        this.checkVow(p, near, true);
        await this.loseHp(p, 1);
        for (const q of near) if (q.alive && p.alive) await this.damage(p, q, 1, null);
        break;
      }
      case 'hex_storm':
        this.discardCards(cards);
        this.log(`🌪 ${p.name} ใช้ ${name}!`);
        for (const q of this.others(p)) {
          const c = this.randomHand(q);
          if (c) { this.discardCards([c]); this.log(`${q.name} ทิ้ง ${cardStr(c)}`); }
        }
        break;
      default:
    }
  };

  /** ผู้แฝงตัวใช้ 2 โทเคนเบี่ยงศรเวทที่เล็งกษัตริย์ */
  P.chaosRedirect = async function chaosRedirect(user, t) {
    if (!this.adv || t.role !== 'lord') return t;
    for (const tr of this.alive()) {
      if (tr.role !== 'traitor' || tr === user || tr.chaos < CHAOS.redirect.cost) continue;
      const cands = this.alive().filter((q) => q !== user && q !== t);
      if (!cands.length) continue;
      const a = await this.ask(tr, {
        type: 'players', kind: 'redirect', title: `🌀 ${CHAOS.redirect.name}: ${user.name} ใช้「ศรเวท」ใส่กษัตริย์ — จ่าย 2 โทเคนเพื่อย้ายเป้าหมาย? (ข้าม = ไม่ใช้)`,
        candidates: cands.map((q) => q.seat), min: 0, max: 1, sourceSeat: user.seat,
      });
      if (!a.seats.length) continue;
      tr.chaos -= CHAOS.redirect.cost;
      const nt = this.players[a.seats[0]];
      this.log(`🌀 เงามืดบิดเบือนวิถีศร! 「ศรเวท」ของ ${user.name} เบี่ยงจากกษัตริย์ไปหา ${nt.name}`);
      return nt;
    }
    return t;
  };

  // ═══════════════ มุมมอง ═══════════════

  P.advancedView = function advancedView(me) {
    if (!this.adv) return null;
    const th = this.threat;
    return {
      decree: this.decree,
      lastVote: this.lastVote || null,
      threat: th ? { ...th } : null,
      rite: this.rite ? { seat: this.rite.seat } : null,
      mine: me ? {
        chaos: me.role === 'traitor' ? me.chaos : null,
        facade: me.facade,
        dest: me.dest ? { ...me.dest } : null,
      } : null,
    };
  };
}

module.exports = { install, FACADES, CHAOS, CHAOS_MAX, DECREES, THREATS, DESTINIES, DESTINY_GOAL, LEGENDARY };
