'use strict';

// สำรับการ์ดคำสั่งและมหาเวท (Arcane Deck) ทั้งหมด 108 ใบ
// ทุกใบมี "ธาตุ" กำกับ 1 ใน 4 ธาตุ ซึ่งตรงกับดอกไพ่:
//   ♣ ศักดิ์สิทธิ์ (Holy)  ♦ อัคคี (Flame)  ♠ พายุ/เวทมนตร์ (Arcane)  ♥ เงามืด (Shadow)

const SUIT_SYMBOL = { spade: '♠', heart: '♥', club: '♣', diamond: '♦' };
const SUIT_NAME = { spade: 'ธาตุพายุ ♠', heart: 'ธาตุเงามืด ♥', club: 'ธาตุศักดิ์สิทธิ์ ♣', diamond: 'ธาตุอัคคี ♦' };
const ELEMENTS = {
  club: { name: 'ศักดิ์สิทธิ์', en: 'Holy', symbol: '♣', desc: 'การรักษา ชำระล้าง และเสริมเกราะ' },
  diamond: { name: 'อัคคี', en: 'Flame', symbol: '♦', desc: 'ความเสียหายรุนแรงและการเผาผลาญยุทโธปกรณ์' },
  spade: { name: 'พายุ/เวทมนตร์', en: 'Arcane', symbol: '♠', desc: 'การควบคุมระยะ การขัดขวาง และคำสาป' },
  heart: { name: 'เงามืด', en: 'Shadow', symbol: '♥', desc: 'การดูดพลัง การขโมยการ์ด และมายาภาพ' },
};
const RANK_STR = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

const CARD_INFO = {
  // ── ศิลปะการต่อสู้และมนตราพื้นฐาน (Basic Arts) ──
  strike: { type: 'basic', name: 'ศรเวท', en: 'Arcane Strike', short: 'โจมตี 1 คนในระยะ ต้องใช้「ม่านบาเรีย」ไม่งั้นเสียเลือด 1 · ♦ เผาอุปกรณ์', desc: 'เลือกผู้เล่น 1 คนในระยะโจมตี เป้าหมายต้องใช้ "ม่านบาเรีย" มิฉะนั้นได้รับความเสียหาย 1 (ใช้ได้ 1 ครั้งต่อเทิร์น) — ศรเวทธาตุอัคคี (♦) คือ "Flame Strike" หากโจมตีโดน จะเผาการ์ดยุทโธปกรณ์ของเป้าหมายทิ้ง 1 ชิ้น' },
  aegis: { type: 'basic', name: 'ม่านบาเรีย', en: 'Aegis Barrier', short: 'หักล้างการโจมตีหรือศรเวทที่เล็งมาที่คุณ 1 ครั้ง', desc: 'ร่ายทันทีเพื่อหักล้างการโจมตีจาก "ศรเวท" หรือ "ห่าศรดวงดาว" 1 ครั้ง' },
  elixir: { type: 'basic', name: 'น้ำอมฤตแห่งอวาลอน', en: 'Elixir of Avalon', short: 'ฟื้นเลือด 1 หรือชุบชีวิตผู้ที่กำลังสิ้นชีพ', desc: 'ในเทิร์นตัวเอง: ฟื้นฟูเลือด 1 / เมื่อมีผู้เล่นเลือดเหลือ 0: ใช้เพื่อชุบชีวิตกลับมาที่เลือด 1' },

  // ── เวทฉับพลัน (Instant Spells) ──
  blink: { type: 'trick', name: 'เคลื่อนย้ายพริบตา', en: 'Blink', short: 'หยิบการ์ด 1 ใบจากมือหรืออุปกรณ์ของผู้เล่นในระยะ 1', desc: 'หยิบการ์ด 1 ใบจากมือหรือโซนอุปกรณ์ของผู้เล่นอื่นที่อยู่ในระยะ 1 ช่อง มาไว้ในมือ' },
  dispel: { type: 'trick', name: 'เพลิงชำระล้าง', en: 'Dispel', short: 'สลายผลมหาเวทหรือคำสาป 1 ใบต่อเป้าหมาย 1 คน', desc: 'สลายผลของการ์ดเวทมนตร์ 1 ใบต่อเป้าหมาย 1 คนทันที (ใช้สลาย "เพลิงชำระล้าง" ของผู้อื่นได้)' },
  meteor: { type: 'trick', name: 'ห่าศรดวงดาว', en: 'Meteor Shower', short: 'ผู้เล่นอื่นทุกคนต้องใช้「ม่านบาเรีย」 ไม่งั้นเสียเลือด 1 (ธาตุไฟ)', desc: 'อัญเชิญฝนดาวตกใส่ผู้เล่นอื่นทุกคน แต่ละคนต้องใช้ "ม่านบาเรีย" มิฉะนั้นได้รับความเสียหายธาตุไฟ 1' },
  blessing: { type: 'trick', name: 'สวดมนต์ศักดิ์สิทธิ์', en: 'Divine Blessing', short: 'จั่วการ์ด 2 ใบ', desc: 'จั่วการ์ดจากกองกลาง 2 ใบขึ้นมือทันที' },
  siren: { type: 'trick', name: 'เสียงเพรียกแห่งไซเรน', en: "Siren's Call", short: 'สั่งคนมีอาวุธใช้「ศรเวท」ใส่คนที่คุณเลือก ไม่ทำ = มอบอาวุธให้คุณ', desc: 'สั่งให้ผู้เล่น A ที่มีอาวุธ ใช้ "ศรเวท" โจมตีผู้เล่น B ที่คุณเลือก หากไม่ทำ A ต้องมอบอาวุธให้คุณ' },
  blood_duel: { type: 'trick', name: 'พันธนาการโลหิต', en: 'Blood Duel', short: 'ผลัดกันทิ้ง「ศรเวท」 ใครหมดก่อนเสียเลือด 1', desc: 'ท้าดวลผู้เล่น 1 คน ผลัดกันทิ้ง "ศรเวท" (เริ่มจากเป้าหมาย) ฝ่ายที่ไม่มีทิ้งก่อนได้รับความเสียหาย 1' },

  // ── คำสาปหน่วงเวลา (Delayed Curses) ──
  blood_moon: { type: 'delayed', name: 'คำสาปจันทราสีเลือด', en: 'Blood Moon Cataclysm', short: 'วนรอบวง ตัดสินได้ ♠2-9 อุกกาบาตทมิฬทำดาเมจ 3', desc: 'คำสาปหน่วงเวลา: วางหน้าตนเอง เมื่อถึงเทิร์นให้เปิดการ์ดตัดสิน หากได้ ♠ 2-9 อุกกาบาตทมิฬระเบิดทำความเสียหาย 3 มิฉะนั้นลอยไปหาผู้เล่นคนถัดไป' },
  petrify: { type: 'delayed', name: 'ผนึกศิลาบรรพกาล', en: 'Petrification', short: 'ร่ายใส่ผู้อื่น ตัดสินไม่ใช่ ♣ กลายเป็นหิน ข้ามช่วงร่ายเวท', desc: 'คำสาปหน่วงเวลา: ร่ายใส่ผู้เล่นอื่น เมื่อถึงเทิร์นให้เปิดการ์ดตัดสิน หากไม่ใช่ธาตุศักดิ์สิทธิ์ (♣) ร่างกายกลายเป็นหิน ข้ามช่วงร่ายเวทและทำศึก' },

  // ── ศาสตราวุธ (Weapons) ──
  excalibur: { type: 'equip', slot: 'weapon', range: 3, name: 'ดาบเอ็กซ์คาลิเบอร์', en: 'Excalibur', short: 'เป้าหมายต้องใช้「ม่านบาเรีย」 2 ใบจึงป้องกันได้', desc: 'ระยะ 3: เป้าหมายของ "ศรเวท" ต้องใช้ "ม่านบาเรีย" ถึง 2 ใบจึงจะป้องกันได้' },
  rhongomyniad: { type: 'equip', slot: 'weapon', range: 4, name: 'หอกรอนโกมิเนียด', en: 'Rhongomyniad', short: '「ศรเวท」ของคุณทะลวงเกราะและเครื่องรางทั้งหมด', desc: 'ระยะ 4: "ศรเวท" ของคุณละเลยเกราะและเครื่องรางป้องกันทั้งหมดของเป้าหมาย' },
  carnwennan: { type: 'equip', slot: 'weapon', range: 1, name: 'กริชพรางเงาคาร์นเวนแนน', en: 'Carnwennan', short: 'ใช้「ศรเวท」ได้ไม่จำกัดครั้ง', desc: 'ระยะ 1: ใช้ "ศรเวท" ได้ไม่จำกัดจำนวนครั้งในแต่ละเทิร์น' },
  merlin_staff: { type: 'equip', slot: 'weapon', range: 2, name: 'ไม้เท้าแห่งเมอร์ลิน', en: 'Staff of Merlin', short: 'ใช้การ์ดธาตุศักดิ์สิทธิ์♣/เงามืด♥ในมือเป็น「ศรเวท」ได้', desc: 'ระยะ 2: ใช้การ์ดธาตุศักดิ์สิทธิ์ (♣) หรือเงามืด (♥) ในมือเป็น "ศรเวท" ได้ตลอดเวลา' },

  // ── เครื่องรางและเกราะ (Wards & Armor) ──
  pridwen: { type: 'equip', slot: 'armor', name: 'โล่พริตเวน', en: 'Pridwen Shield', short: 'ต้องใช้「ม่านบาเรีย」? ตัดสิน ถ้าได้ ♥/♦ นับเป็นม่านบาเรีย', desc: 'เมื่อต้องใช้ "ม่านบาเรีย" สามารถเปิดการ์ดตัดสิน หากได้ธาตุสีแดง (♥/♦) ถือว่าสร้างม่านสะท้อนสำเร็จ' },
  mantle: { type: 'equip', slot: 'armor', name: 'ผ้าคลุมล่องหนแห่งอวาลอน', en: 'Mantle of Invisibility', short: 'มนตราเป้าหมายเดี่ยว (พริบตา/พันธนาการ/ไซเรน/ผนึกศิลา) เล็งคุณไม่ได้', desc: 'การ์ดมนตราประเภทเป้าหมายเดี่ยว (เคลื่อนย้ายพริบตา, พันธนาการโลหิต, เสียงเพรียกแห่งไซเรน, ผนึกศิลาบรรพกาล) ไม่สามารถเล็งเป้ามาที่คุณได้' },
  dragonscale: { type: 'equip', slot: 'armor', name: 'เกราะเกล็ดมังกรขาว', en: 'Dragonscale Mail', short: 'ความเสียหายธาตุไฟและสายฟ้าที่ได้รับ -1', desc: 'ลดความเสียหายจากศรเวทอัคคี (♦), ห่าศรดวงดาว และคำสาปจันทราสีเลือด ลง 1 หน่วยเสมอ' },

  // ── สัตว์เทวะพาหนะ (Mythic Mounts) ──
  gryphon: { type: 'equip', slot: 'offHorse', name: 'กริฟฟอนสวรรค์', en: 'Sky Gryphon', short: 'มนต์เหินเวหา: คุณนับระยะไปหาทุกคน -1', desc: 'มนต์เหินเวหา: ลดระยะห่างจากคุณไปยังผู้เล่นทุกคนลง 1 ช่อง' },
  unicorn: { type: 'equip', slot: 'defHorse', name: 'ยูนิคอร์นหมอก', en: 'Mist Unicorn', short: 'คนอื่นนับระยะมาหาคุณ +1 · รอดจากคำสาปฟื้นเลือด 1', desc: 'มนต์พรางมิติ: ผู้เล่นอื่นนับระยะมาหาคุณ +1 และเมื่อคุณตัดสินคำสาปหน่วงเวลาแล้วรอดพ้น ฟื้นฟูเลือด 1' },
};

// จำนวนการ์ดแต่ละชนิดแยกตามธาตุ (S=♠ C=♣ H=♥ D=♦) — แต้มถูกแจกเรียงต่อกันภายในแต่ละธาตุ
const DECK_SPEC = {
  strike: 'S8 C8 H7 D7',
  aegis: 'S5 C2 H4 D4',
  elixir: 'C5 H3',
  blink: 'S3 H3 D1',
  dispel: 'S3 C4',
  meteor: 'D4',
  blessing: 'C3 H3',
  siren: 'S1 H1 D1',
  blood_duel: 'S1 H2 D2',
  blood_moon: 'S2 D1',
  petrify: 'S1 H1 D3',
  excalibur: 'C1',
  rhongomyniad: 'D1',
  carnwennan: 'S1 D1',
  merlin_staff: 'S1',
  pridwen: 'C2',
  mantle: 'H1',
  dragonscale: 'D1',
  gryphon: 'S1 H1 D1',
  unicorn: 'C2 H1',
};

const SUIT_LETTER = { S: 'spade', H: 'heart', C: 'club', D: 'diamond' };

function buildDeck() {
  const cards = [];
  const next = { spade: 0, heart: 0, club: 0, diamond: 0 };
  let id = 1;
  for (const [key, spec] of Object.entries(DECK_SPEC)) {
    for (const tok of spec.split(/\s+/)) {
      const suit = SUIT_LETTER[tok[0]];
      for (let n = Number(tok.slice(1)); n > 0; n--) {
        const rank = (next[suit]++ % 13) + 1;
        cards.push({ id: id++, key, suit, rank });
      }
    }
  }
  return cards;
}

function colorOf(c) {
  if (!c) return null;
  if (c.color !== undefined) return c.color;
  return c.suit === 'heart' || c.suit === 'diamond' ? 'red' : 'black';
}
const isRed = (c) => colorOf(c) === 'red';
const isBlack = (c) => colorOf(c) === 'black';

function cardStr(c) {
  if (!c) return '';
  return `${CARD_INFO[c.key].name}${SUIT_SYMBOL[c.suit] || ''}${RANK_STR[c.rank] || ''}`;
}

module.exports = { CARD_INFO, SUIT_SYMBOL, SUIT_NAME, ELEMENTS, RANK_STR, DECK_SPEC, buildDeck, colorOf, isRed, isBlack, cardStr };
