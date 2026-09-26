'use strict';

// ทดสอบระบบขั้นสูง: ผู้แฝงตัว (โกลาหล/พิธีชิงมงกุฎ), สภาโต๊ะกลม, ด้านมืด, ลิขิตชะตา และภัยพิบัติ

const test = require('node:test');
const assert = require('node:assert');
const { Game, GameOver } = require('../server/game/engine');
const { DECREES, THREATS, DESTINIES, CHAOS_MAX } = require('../server/game/advanced');
const { DARK, HEROES } = require('../server/game/heroes');

const bots = (n) => Array.from({ length: n }, (_, i) => ({ pid: `p${i}`, name: `P${i}`, isBot: true }));
const card = (g, key, suit) => [...g.cardById.values()].find((c) => c.key === key && (!suit || c.suit === suit) && !g.players.some((p) => p.hand.includes(c) || Object.values(p.equip).includes(c)));
const byRole = (g, role) => g.players.find((p) => p.role === role);

async function setup(n = 6, hero = 'kay', opts = {}) {
  const g = new Game({ players: bots(n), botDelay: 0, ...opts });
  g.players.forEach((p) => g.setHero(p, hero, true));
  if (g.adv) await g.setupAdvanced();
  g.ts = { player: g.players[0], attacksUsed: 0, usedAttack: false, used: new Set(), weaves: 0, moved: 0, vow: null, vowBroken: false, bardic: new Map() };
  return g;
}

test('every hero has a dark side with defined skills; decrees, threats and destinies are complete', () => {
  const { SKILLS } = require('../server/game/heroes');
  for (const id of Object.keys(HEROES)) {
    assert.ok(DARK[id], `dark side for ${id}`);
    for (const s of DARK[id].skills) assert.ok(SKILLS[s], s);
  }
  assert.ok(Object.keys(DECREES).length >= 8);
  assert.ok(Object.values(DECREES).some((d) => d.king < 0), 'some decrees favour the Coven');
  assert.strictEqual(Object.keys(THREATS).length, 4);
  assert.strictEqual(Object.keys(DESTINIES).length, 8);
});

test('setup: every player gets a secret destiny; the Renegade picks a facade; classic mode stays classic', async () => {
  const g = await setup(8);
  for (const p of g.players) assert.ok(DESTINIES[p.dest.id]);
  const tr = byRole(g, 'traitor');
  assert.ok(['crown', 'coven'].includes(tr.facade));
  const view = g.viewFor(g.players.find((p) => p !== tr).pid);
  assert.strictEqual(view.adv.mine.chaos, null, 'only the Renegade sees chaos tokens');
  assert.ok(view.players.every((p) => p.destiny === null), 'destinies stay secret');
  const c = new Game({ players: bots(5), botDelay: 0, advanced: false });
  assert.strictEqual(c.viewFor('p0').adv, null);
});

test('high council: the King must propose, stones are cast openly, and a passed decree takes effect', async () => {
  const g = await setup(6);
  const lord = byRole(g, 'lord');
  g.decreeDeck = ['curfew', 'martial_law'];
  // everyone votes white (bots vote by role; force a pass by making all loyal-leaning)
  for (const p of g.players) if (p.role !== 'lord') p.role = 'loyalist';
  await g.council();
  assert.ok(g.lastVote && g.lastVote.pass, 'passed');
  assert.ok(['curfew', 'martial_law'].includes(g.decree));
  const a = g.players.find((p) => p !== lord);
  if (g.decree === 'martial_law') {
    assert.strictEqual(g.attackRange(a), 2, 'martial law: range +1');
    assert.strictEqual(g.cardTargets(a, 'elixir', []), false, 'no drinking elixirs');
  } else {
    assert.ok(!g.playUsables(a).some((u) => u.special === 'move'), 'curfew: no movement');
  }
});

test('inquisition jails a suspect who then skips the draw phase', async () => {
  const g = await setup(5);
  const suspect = g.players.find((p) => p.role !== 'lord');
  for (const p of g.players) p.rebelScore = p === suspect ? 9 : -1;
  for (const p of g.players) if (p !== suspect && p.role !== 'lord') p.role = 'loyalist';
  await g.enactDecree('inquisition', byRole(g, 'lord'));
  assert.strictEqual(suspect.jailedRound, g.round);
});

test('dark awakening: at 1 HP a hero may flip to the dark side, heal 1 and swap skills', async () => {
  const g = await setup(5, 'lancelot');
  const p = g.players[1];
  p.hp = 2;
  await g.damage(null, p, 1, null);
  assert.ok(p.awakened, 'bot chose to awaken');
  assert.strictEqual(p.hp, 2, 'healed 1 on awakening');
  assert.ok(g.hasSkill(p, 'abyssal_blade'));
  assert.ok(!g.hasSkill(p, 'peerless'), 'light skills are gone');
  assert.ok(g.heroName(p).includes(DARK.lancelot.name));
  g.ts.player = p;
  g.ts.attacksUsed = 5;
  assert.ok(g.canUseAttack(p), 'Abyssal Blade strikes without limit');
});

test('destinies: the Wanderer completes after visiting every zone; the Scholar after 4 weaves', async () => {
  const g = await setup(5);
  const p = g.players[0];
  p.dest = { id: 'wanderer', progress: 1, done: false, failed: false };
  p.visited = new Set([p.zone]);
  for (const z of ['throne', 'bastion', 'marches', 'sanctuary', 'nexus']) { p.zone = z; g.visitZone(p); }
  assert.ok(p.dest.done && p.boons.stride);
  const q = g.players[1];
  q.dest = { id: 'arcane_scholar', progress: 0, done: false, failed: false };
  for (let i = 0; i < 4; i++) g.destinyProgress(q, 'arcane_scholar', 1);
  assert.ok(q.dest.done && q.boons.weave);
});

test('cataclysm: the dragon breathes each turn, can be fought with cards, and the slayer is rewarded', async () => {
  const g = await setup(5);
  g.threatDeck = ['dragon'];
  await g.spawnThreat();
  assert.strictEqual(g.threat.id, 'dragon');
  assert.strictEqual(g.threat.maxHp, 10);
  const p = g.players[0];
  const hp = p.hp;
  await g.turnEndAdvanced(p);
  assert.strictEqual(p.hp, hp - 1, 'fire breath');
  g.threat.hp = 2;
  const fire = card(g, 'strike', 'diamond');
  p.hand.push(fire);
  const u = g.playUsables(p).find((x) => x.adv === 'threat');
  await g.performAdvanced(p, u, [fire], []);
  assert.strictEqual(g.threat, null, 'Ignis card deals 2 and slays it');
  assert.ok(p.boons.dragonflame);
  assert.strictEqual(await g.damage(null, p, 2, null, 'fire'), 0, 'dragonflame scale: immune to fire');
});

test('usurper: chaos grows with every death; spending it redirects a strike on the King', async () => {
  const g = await setup(6);
  const tr = byRole(g, 'traitor');
  const lord = byRole(g, 'lord');
  const victims = g.players.filter((p) => p !== tr && p !== lord);
  for (const v of victims.slice(0, 2)) { v.alive = false; await g.onDeathAdvanced(v, null); }
  assert.strictEqual(tr.chaos, 2);
  lord.hp = 1;
  const attacker = victims.slice(2).find((p) => p.alive);
  const t = await g.chaosRedirect(attacker, lord);
  assert.notStrictEqual(t, lord, 'strike diverted away from the King');
  assert.strictEqual(tr.chaos, 0);
});

test('usurpation rite: 4 chaos + Excalibur → declare, survive a round, win outright', async () => {
  const g = await setup(6);
  const tr = byRole(g, 'traitor');
  tr.chaos = CHAOS_MAX;
  tr.equip.weapon = card(g, 'excalibur');
  g.ts.player = tr;
  const rite = g.playUsables(tr).find((u) => u.adv === 'rite');
  assert.ok(rite, 'rite is available');
  await g.performAdvanced(tr, rite, [], []);
  assert.ok(tr.revealed);
  assert.strictEqual(g.viewFor(g.players.find((p) => p !== tr).pid).players[tr.seat].role, 'traitor', 'the Usurper is revealed to all');
  await assert.rejects(g.turnStartAdvanced(tr), (e) => e instanceof GameOver && e.result.winnerRole === 'traitor' && e.result.winners[0] === tr.pid);
  // losing the sword breaks the rite
  const h = await setup(6);
  const t2 = byRole(h, 'traitor');
  h.rite = { seat: t2.seat };
  await h.turnStartAdvanced(t2);
  assert.strictEqual(h.rite, null);
});

test('full advanced games with bots finish cleanly and conserve cards', async () => {
  const errors = [];
  const orig = console.error;
  console.error = (...a) => errors.push(a.join(' '));
  try {
    for (let i = 0; i < 60; i++) {
      const g = new Game({ players: bots(4 + (i % 7)), botDelay: 0, maxRounds: 100 });
      const r = await g.run();
      assert.ok(r && r.text);
      const all = [...g.deck, ...g.discard, ...g.players.flatMap((p) => [...p.hand, ...Object.values(p.equip).filter(Boolean), ...p.judgeZone])];
      assert.strictEqual(all.length, 108);
      assert.strictEqual(new Set(all.map((c) => c.id)).size, 108);
    }
  } finally {
    console.error = orig;
  }
  assert.deepStrictEqual(errors, []);
});
