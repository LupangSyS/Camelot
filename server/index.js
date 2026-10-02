'use strict';

const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const { RoomManager, META } = require('./rooms');
const { buildDeck } = require('./game/cards');
const { mergedManifest } = require('./customArt');

function createServer(opts = {}) {
  const app = express();
  const publicDir = path.join(__dirname, '..', 'public');
  const server = http.createServer(app);
  const io = new Server(server, { pingInterval: 10000, pingTimeout: 8000 });
  // manifest ภาพ: ภาพจากโค้ด + ภาพ AI ที่วางไว้ใน public/art/custom (สแกนครั้งเดียวตอนเปิดเซิร์ฟเวอร์)
  const artManifest = mergedManifest(path.join(publicDir, 'art'));
  app.get('/art/manifest.json', (req, res) => { res.set('Cache-Control', 'no-cache'); res.json(artManifest); });
  app.use(express.static(publicDir));
  app.get('/health', (req, res) => res.json({ ok: true }));
  // ฐานข้อมูลการ์ด (อ่านอย่างเดียว) พร้อมรายการไพ่แต่ละใบในสำรับ
  const deck = {};
  for (const c of buildDeck()) (deck[c.key] = deck[c.key] || []).push({ suit: c.suit, rank: c.rank });
  const cardDb = { ...META, deck };
  app.get('/api/cards', (req, res) => res.json(cardDb));
  const rooms = new RoomManager(io, opts);
  io.on('connection', (socket) => rooms.handle(socket));
  return { app, server, io, rooms };
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  const botDelay = process.env.BOT_DELAY !== undefined ? Number(process.env.BOT_DELAY) : undefined;
  const { server } = createServer({ botDelay });
  server.listen(port, () => console.log(`CAMELOT: Arcane Realm พร้อมที่ http://localhost:${port}`));
}

module.exports = { createServer };
