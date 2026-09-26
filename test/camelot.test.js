'use strict';

// ทดสอบระบบเฉพาะของ CAMELOT: โต๊ะกลมมนตรา, ผสานรูน, แถบชะตา, วิญญาณแห่งอวาลอน, สัตยาบัน และทักษะฮีโร่สำคัญ

const test = require('node:test');
const assert = require('node:assert');
const { Game, GameOver, WEAVES, zoneDistance, adjacentZones } = require('../server/game/engine');

const bots = (n) => Array.from({ length: n }, (_, i) => ({ pid: `p${i}`, name: `P${i}`, isBot: true }));
const card = (g, key, suit) => [...g.cardById.values()].find((c) => c.key === key && (!suit || c.suit === suit) && !g.players.some((p) => p.hand.includes(c)));

function setup(n = 5, hero = 'kay') {
  const g = new Game({ players: bots(n), botDelay: 0 });
  g.players.forEach((p) => g.setHero(p, hero, true));
  g.ts = { player: g.players[0], attacksUsed: 0, usedAttack: false, used: new Set(), weaves: 0, moved: false, vow: null, vowBroken: false, bardic: new Map() };
  return g;
}
const byRole = (g, role) => g.players.find((p) => p.role === role);

test('round table zones: geometry and adjacency', () => {
  assert.strictEqual(zoneDistance('throne', 'throne'), 1);
  assert.strictEqual(zoneDistance('throne', 'nexus'), 1);
  assert.strictEqual(zoneDistance('throne', 'sanctuary'), 2);
  assert.strictEqual(zoneDistance('throne', 'marches'), 3);
  assert.deepStrictEqual(adjacentZones('nexus').sort(), ['bastion', 'marches', 'sanctuary', 'throne']);
  assert.deepStrictEqual(adjacentZones('throne').sort(), ['bastion', 'nexus', 'sanctuary']);
  const g = new Game({ players: bots(8), botDelay: 0 });
  const lord = byRole(g, 'lord');
  assert.strictEqual(lord.zone, 'throne', 'the King starts on the High Throne');
  const count = {};
  for (const p of g.players) count[p.zone] = (count[p.zone] || 0) + 1;
  assert.deepStrictEqual(Object.values(count), [2, 2, 2, 2], 'players spread evenly around the table');
});

test('rune weaving: every pair of runes is a spell and picks are validated by element', () => {
  assert.strictEqual(Object.keys(WEAVES).length, 10);
  const combos = new Set(Object.values(WEAVES).map((w) => [...w.runes].sort().join('+')));
  assert.strictEqual(combos.size, 10, 'all 10 rune pairs are distinct spells');
  const g = setup();
  const p = g.players[0];
  const d1 = card(g, 'strike', 'diamond');
  const d2 = card(g, 'aegis', 'diamond');
  const s1 = card(g, 'aegis', 'spade');
  p.hand = [d1, d2, s1];
  g.players.forEach((q) => { q.zone = 'throne'; });
  const us = g.playUsables(p);
  const inferno = us.find((u) => u.weave === 'inferno');
  const firebolt = us.find((u) => u.weave === 'firebolt');
  assert.ok(inferno && firebolt, 'weaves offered for runes in hand');
  assert.ok(!us.some((u) => u.weave === 'seal'), 'no Umbra runes → no Seal of Umbra');
  assert.ok(g.pickOk([d1.id, d2.id], inferno.pick));
  assert.ok(!g.pickOk([d1.id, s1.id], inferno.pick), 'Inferno needs Ignis + Ignis');
  assert.ok(g.pickOk([s1.id, d2.id], firebolt.pick));
});

test('weave: Sanctified Bulwark blocks the next damage', async () => {
  const g = setup();
  const [a, b] = g.players;
  a.hand = [card(g, 'aegis', 'club'), card(g, 'elixir', 'club')];
  b.zone = a.zone;
  await g.doWeave(a, 'bulwark', [...a.hand], b);
  assert.strictEqual(b.ward, 'bulwark');
  const hp = b.hp;
  const dealt = await g.damage(a, b, 2, null);
  assert.strictEqual(dealt, 0);
  assert.strictEqual(b.hp, hp);
  assert.strictEqual(b.ward, null, 'ward is consumed');
});

test('doom track: ritual costs blood, ♥ doubles it, and -10 wins for the Coven', async () => {
  const g = setup();
  const p = g.players[1];
  const hp = p.hp;
  await g.doTrack(p, 'ritual', [card(g, 'blink', 'heart')]);
  assert.strictEqual(g.track, -2);
  assert.strictEqual(p.hp, hp - 1, 'the sacrifice costs 1 HP');
  g.ts.used.clear();
  await g.doTrack(p, 'quest', [card(g, 'strike', 'club'), card(g, 'aegis', 'club')]);
  assert.strictEqual(g.track, 0, 'Holy ♣♣ quest moves +2');
  g.track = -9;
  await assert.rejects(g.moveTrack(-1, 'test'), (e) => e instanceof GameOver && e.result.winnerRole === 'rebel');
});

test('holy grail: at +10 the Coven loses half its life and the King becomes immortal — once per game', async () => {
  const g = setup(6);
  const lord = byRole(g, 'lord');
  const rebels = g.players.filter((p) => p.role === 'rebel');
  g.track = 9;
  await g.moveTrack(1, 'test');
  assert.ok(g.grailFound);
  assert.strictEqual(g.track, 0);
  for (const r of rebels) assert.strictEqual(r.hp, 2, 'rebels drop to half');
  assert.ok(lord.immortalTurns > 0);
  lord.hp = 1;
  await g.damage(null, lord, 3, null);
  assert.strictEqual(lord.hp, 1, 'immortal King cannot fall below 1');
  assert.ok(!g.playUsables(g.players[0]).some((u) => u.special === 'quest'), 'the Quest closes after the Grail is found');
});

test('spectral knights: the fallen become ghosts, take spectral turns and share the victory', async () => {
  const g = setup(5);
  const loyal = byRole(g, 'loyalist');
  for (const p of g.players) g.draw(p, 3);
  await g.kill(loyal, null);
  assert.ok(!loyal.alive && loyal.ghost);
  assert.deepStrictEqual(loyal.spectral, ['whisper', 'flicker', 'shield']);
  assert.strictEqual(g.nextSeat(g.players[(loyal.seat + g.players.length - 1) % g.players.length]), loyal, 'ghosts keep their seat in turn order');
  await g.spectralTurn(loyal);
  assert.ok(!loyal.spectral.includes('whisper'), 'bot ghost used Whispering Fog');
  assert.ok(g.viewFor(loyal.pid).whisper, 'the ghost privately sees the hand');
  assert.strictEqual(g.viewFor(g.players.find((p) => p !== loyal).pid).whisper, null, 'nobody else sees it');
  // Spectral Shield: a lethal hit on a friend is absorbed
  const lord = byRole(g, 'lord');
  lord.hp = 1;
  loyal.rebelScore = 0;
  const dealt = await g.damage(null, lord, 1, null);
  assert.strictEqual(dealt, 0);
  assert.ok(lord.alive);
  assert.ok(!loyal.spectral.includes('shield'));
  // winners include the ghost
  for (const p of g.players) if (p.role === 'rebel' || p.role === 'traitor') { p.alive = false; p.ghost = true; }
  assert.throws(() => g.checkVictory(), (e) => e instanceof GameOver && e.result.winners.includes(loyal.pid));
});

test('vows: breaking Valor brands you Fallen; keeping Mercy heals 2', async () => {
  const g = setup(5);
  const [a, b, c] = g.players;
  for (const p of g.players) p.hp = 3;
  b.hp = 4; c.hp = 2;
  g.ts.vow = 'valor';
  a.vow = 'valor';
  g.checkVow(a, [b], true);
  assert.strictEqual(g.ts.vowBroken, false, 'striking the healthiest keeps the vow');
  g.checkVow(a, [c], true);
  assert.ok(g.ts.vowBroken && a.fallen && a.sealTurns > 0, 'striking someone weaker breaks it');
  assert.strictEqual(g.hasSkill(a, 'logistics'), false, 'Fallen heroes lose their skills');

  const h = setup(4);
  const p = h.players[0];
  for (const q of h.players) q.hp = q.maxHp;
  p.hp = 1;
  h.ts.vow = 'mercy';
  await h.endOfTurn(p);
  assert.strictEqual(p.hp, 3, 'Mercy blesses the wounded with 2 HP');
});

test('hero skills: Green Knight survives his first death, Renegade resists one curse', async () => {
  const g = setup(5);
  const gk = g.players[1];
  g.setHero(gk, 'green_knight', true);
  gk.hp = 1;
  await g.damage(null, gk, 3, null);
  assert.ok(gk.alive);
  assert.strictEqual(gk.hp, 2);
  assert.ok(gk.decapUsed);

  const traitor = byRole(g, 'traitor');
  assert.strictEqual(g.resistCurse(traitor), true);
  assert.strictEqual(g.resistCurse(traitor), false, 'only once per game');
  assert.strictEqual(g.resistCurse(byRole(g, 'lord')), false);
});

test('hero skills: Galahad is immune to curses, Viviane veils herself from flame', () => {
  const g = setup(5);
  const [a, b] = g.players;
  g.setHero(b, 'galahad', true);
  assert.strictEqual(g.canCurse(b, 'petrify'), false);
  g.setHero(b, 'viviane', true);
  a.zone = b.zone;
  assert.strictEqual(g.distance(a, b), 2, 'Veil of Mist adds 1 distance');
  assert.ok(g.veilBlocks(b));
  b.equip.armor = card(g, 'mantle');
  assert.ok(!g.veilBlocks(b), 'no longer veiled while equipped');
});

test('renegade: never feeds the Eclipse, the Eclipse stops once the Coven is gone, and Mercy is not offered in a duel', async () => {
  const bot = require('../server/game/bot');
  const g = setup(6);
  const traitor = byRole(g, 'traitor');
  for (const p of g.players) g.draw(p, 4);
  g.ts.player = traitor;
  g.track = -8;
  for (let i = 0; i < 30; i++) {
    const a = bot.decide(g, traitor, { type: 'play', usables: g.playUsables(traitor) });
    if (a.end) break;
    assert.notStrictEqual(a.usable, 'ritual', 'the Renegade never performs a Dark Ritual');
  }
  g.round = 10;
  assert.ok(g.eclipseRate() > 0);
  for (const p of g.players) if (p.role === 'rebel') { p.alive = false; p.ghost = true; }
  assert.strictEqual(g.eclipseRate(), 0, 'no Coven left alive → the Eclipse stops creeping');
  // the Renegade treats loyal knights as enemies only after the Coven is gone, and never the King before the final duel
  const lord = byRole(g, 'lord');
  assert.strictEqual(bot.isEnemy(g, traitor, lord), false);
  for (const p of g.players) if (p !== lord && p !== traitor) { p.alive = false; p.ghost = true; }
  assert.strictEqual(bot.isEnemy(g, traitor, lord), true, 'one-on-one with the King: strike');
  g.ts.player = traitor;
  const ans = [];
  const orig = g.ask.bind(g);
  g.ask = (p, req) => { ans.push(req); return orig(p, req); };
  await g.declareVow(traitor);
  assert.ok(!ans[0].options.some((o) => o.id === 'mercy'), 'no Vow of Mercy in a duel');
});
