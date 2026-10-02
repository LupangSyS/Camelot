'use strict';

const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { buildAll, manifestFor, allSlots, ART_DIR } = require('../scripts/build-art');
const { createServer } = require('../server');

test('every hero, card type, card back, table and felt has saved high-resolution artwork', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(ART_DIR, 'manifest.json'), 'utf8'));
  for (const [kind, id] of allSlots()) {
    const rel = `${kind}/${id}.png`;
    assert.ok(manifest.items[`${kind}/${id}`], `manifest lists ${rel}`);
    const buf = fs.readFileSync(path.join(ART_DIR, rel));
    assert.deepStrictEqual([...buf.subarray(1, 4)].map((b) => String.fromCharCode(b)).join(''), 'PNG');
    assert.strictEqual(crypto.createHash('sha256').update(buf).digest('hex'), manifest.sha256[rel], `${rel} fingerprint`);
    if (kind === 'heroes') assert.strictEqual(buf.readUInt32BE(16), 256, `${rel} is 256px wide`);
  }
});

test('saved artwork is exactly what the generator draws (tamper check)', () => {
  const a = buildAll();
  // วาดซ้ำบางภาพเพื่อยืนยันว่าผลลัพธ์กำหนดได้แน่นอน
  const again = buildAll(['heroes/merlin', 'cards/strike', 'misc/back']);
  for (const rel of Object.keys(again)) assert.ok(a[rel].equals(again[rel]), `${rel} renders deterministically`);
  for (const [rel, buf] of Object.entries(a)) {
    assert.ok(fs.readFileSync(path.join(ART_DIR, rel)).equals(buf), `${rel} was modified — run npm run build:art`);
  }
  const expected = JSON.stringify(manifestFor(a), null, 2) + '\n';
  assert.strictEqual(fs.readFileSync(path.join(ART_DIR, 'manifest.json'), 'utf8'), expected, 'manifest.json is generated');
  const onDisk = fs.readdirSync(ART_DIR, { recursive: true }).filter((f) => f.endsWith('.png')).map((f) => f.split(path.sep).join('/')).filter((f) => !f.startsWith('custom/'));
  assert.deepStrictEqual(onDisk.sort(), Object.keys(a).sort(), 'no extra images in public/art');
});

test('art and card database are read-only over HTTP', async () => {
  const { server, rooms } = createServer({});
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const db = await (await fetch(`${base}/api/cards`)).json();
    assert.strictEqual(Object.values(db.deck).reduce((s, l) => s + l.length, 0), 108);
    const img = await fetch(`${base}/art/heroes/merlin.png`);
    assert.strictEqual(img.status, 200);
    assert.strictEqual(img.headers.get('content-type'), 'image/png');
    for (const [method, url] of [['PUT', '/art/heroes/merlin.png'], ['POST', '/art/heroes/merlin.png'], ['DELETE', '/art/heroes/merlin.png'], ['POST', '/api/cards'], ['POST', '/api/studio/save']]) {
      const r = await fetch(base + url, { method, body: method === 'DELETE' ? undefined : 'x' });
      assert.strictEqual(r.status, 404, `${method} ${url} is not writable`);
    }
    const after = fs.readFileSync(path.join(ART_DIR, 'heroes', 'merlin.png'));
    assert.ok(after.equals(Buffer.from(await img.arrayBuffer())));
  } finally {
    for (const r of rooms.rooms.values()) rooms.destroy(r);
    await new Promise((r) => server.close(r));
  }
});

test('custom AI art in public/art/custom overrides generated art without touching it', () => {
  const os = require('os');
  const { mergedManifest } = require('../server/customArt');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'art-'));
  fs.copyFileSync(path.join(ART_DIR, 'manifest.json'), path.join(tmp, 'manifest.json'));
  fs.mkdirSync(path.join(tmp, 'custom', 'heroes'), { recursive: true });
  fs.writeFileSync(path.join(tmp, 'custom', 'heroes', 'merlin.webp'), Buffer.from('fake-image'));
  fs.writeFileSync(path.join(tmp, 'custom', 'heroes', 'bad name!.png'), Buffer.from('x'));
  const m = mergedManifest(tmp);
  assert.match(m.items['heroes/merlin'], /^custom\/heroes\/merlin\.webp\?v=[0-9a-f]{10}$/);
  assert.ok(m.custom['heroes/merlin']);
  assert.ok(m.items['heroes/arthur'].startsWith('heroes/arthur.png'), 'others keep generated art');
  assert.strictEqual(Object.keys(m.custom).length, 1, 'odd file names are ignored');
  fs.rmSync(tmp, { recursive: true, force: true });
});
