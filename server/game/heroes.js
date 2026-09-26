'use strict';

// ยอดคนแห่งคาเมลอต: ฮีโร่ 25 ตัว แบ่งเป็น 4 ขั้วอำนาจ

const KINGDOMS = {
  crown: { name: 'ราชสำนัก', en: 'The Crown & Round Table', icon: '♛' },
  coven: { name: 'ลัทธิเร้นลับ', en: 'Shadow Coven & Rebel Blood', icon: '☾' },
  avalon: { name: 'วิหารอวาลอน', en: 'Avalon Sanctuary & Mystic Fey', icon: '✧' },
  grail: { name: 'ผู้พิทักษ์จอก', en: 'Grail Seekers & Mythic Ancients', icon: '♆' },
};

const ROLES = {
  lord: { name: 'กษัตริย์', en: 'The High King', goal: 'กำจัด "ลัทธิเงามืด" และ "ผู้แฝงตัว" ให้หมดสิ้น' },
  loyalist: { name: 'อัศวินผู้ภักดี', en: 'Holy Knight', goal: 'ปกป้องกษัตริย์ไม่ให้สิ้นพระชนม์ และกำจัดศัตรูทั้งหมดของคาเมลอต' },
  rebel: { name: 'ลัทธิเงามืด', en: 'Shadow Coven', goal: 'สังหารกษัตริย์ให้สำเร็จ (ไม่ว่าตนเองจะเหลือรอดกี่คน)' },
  traitor: { name: 'ผู้แฝงตัว', en: 'Dark Infiltrator', goal: 'กำจัดทุกคนจนเหลือดวลกับกษัตริย์ แล้วสังหารกษัตริย์เป็นคนสุดท้าย (ต้านทานคำสาปได้ 1 ครั้ง)' },
};

const SKILLS = {
  // ── ราชสำนักและอัศวินโต๊ะกลม ──
  exalted: { name: 'พระราชโองการศักดิ์สิทธิ์', en: 'Exalted Command', desc: 'เมื่อผู้เล่นอื่นใช้การ์ดธาตุศักดิ์สิทธิ์ (♣) ผู้นั้นเลือกมอบพรรักษาให้อาเธอร์ฟื้นฟูเลือด 1 ได้ แม้อยู่นอกเทิร์น (1 ครั้งต่อเทิร์น)' },
  sword_stone: { name: 'ดาบในศิลา', en: 'Sword in the Stone', lord: true, desc: '(สกิลประมุข) เมื่อสังหารผู้เล่นอื่นสำเร็จ เลือกการ์ดยุทโธปกรณ์ 1 ชิ้นจากสุสานขึ้นมือ' },
  peerless: { name: 'เพลงดาบไร้พ่าย', en: 'Peerless Valor', desc: 'เมื่อใช้ "ศรเวท" โจมตี ทิ้งการ์ดในมือ 1 ใบเพื่อทำให้การโจมตีนั้นใช้ "ม่านบาเรีย" ป้องกันไม่ได้' },
  berserk: { name: 'เกราะมังกรคลั่ง', en: 'Berserk Resilience', desc: 'ทุกครั้งที่เสียเลือด 1 หน่วย จั่วการ์ด 1 ใบ' },
  solar: { name: 'พลังสุริยัน', en: 'Solar Zenith', desc: 'ขณะจำนวนการ์ดในมือ ≥ เลือดปัจจุบัน ระยะโจมตี +1 และ "ศรเวท" ทำความเสียหาย 2' },
  prosthetic: { name: 'แขนกลประกายแสง', en: 'Arcane Prosthetic', desc: 'ติดตั้งอาวุธได้พร้อมกัน 2 ชิ้น และใช้ความสามารถของอาวุธทั้งสองผสานกัน (ระยะใช้ค่าที่ไกลที่สุด)' },
  logistics: { name: 'สรรพเสบียงแห่งราชสำนัก', en: 'Royal Logistics', desc: 'ช่วงจั่วการ์ด เลือกเปิดการ์ด 4 ใบบนกองแทนการจั่ว: เก็บเข้ามือ 2 ใบ มอบการ์ดยุทโธปกรณ์หรือมนตรา 1 ใบให้ผู้เล่นอื่น ที่เหลือใส่ใต้กอง' },
  devotion: { name: 'เกราะพิทักษ์คำสัตย์', en: 'Shield of Devotion', desc: 'เมื่อผู้เล่นอื่นในระยะ 1 ตกเป็นเป้าหมายของ "ศรเวท" ทิ้งการ์ด 1 ใบเพื่อย้ายเป้าหมายมาที่ตนเองแทน' },
  glamour: { name: 'พระบารมีราชินี', en: 'Royal Glamour', desc: 'ผู้เล่นชายที่ใช้ "ศรเวท" ใส่คุณ ต้องทิ้งการ์ดในมือเพิ่ม 1 ใบเป็นเครื่องบรรณาการ มิฉะนั้นการโจมตีไร้ผล' },
  heartstrings: { name: 'สานไมตรี', en: 'Heartstrings', active: true, desc: 'ช่วงร่ายเวท (1 ครั้ง/เทิร์น) มอบการ์ดในมือ 1 ใบให้ผู้เล่นอื่น แล้วผู้นั้นฟื้นฟูเลือด 1' },

  // ── ลัทธิเร้นลับและทายาททรยศ ──
  venom: { name: 'คมดาบอาบยาพิษ', en: 'Venomous Strike', desc: 'ผู้เล่นที่ได้รับความเสียหายจาก "ศรเวท" ของคุณติดสถานะ "ต้องพิษ" ใช้ "น้ำอมฤต" ไม่ได้จนจบเทิร์นของคุณ' },
  betrayal: { name: 'บัญชาทรยศ', en: 'Betrayal Call', desc: 'เมื่อใช้ "ศรเวท" ใส่กษัตริย์ จั่วการ์ด 1 ใบก่อนคิดผล' },
  shadow_glamour: { name: 'มายาภาพลวงตา', en: 'Shadow Glamour', active: true, desc: 'ช่วงร่ายเวท (1 ครั้ง/เทิร์น) สุ่มหยิบการ์ดในมือผู้เล่น 1 คนมา 1 ใบ แล้วมอบการ์ดในมือคุณ 1 ใบคืนให้เขา' },
  soul_curse: { name: 'สาปแช่งวิญญาณ', en: 'Soul Curse', desc: 'หลังได้รับความเสียหาย ผู้ทำความเสียหายต้องเลือก: ทิ้งการ์ดในมือ 2 ใบ หรือเสียเลือด 1' },
  scandal: { name: 'มนต์เปิดโปงพิรุธ', en: 'Scandal Monger', active: true, desc: 'ช่วงร่ายเวท (1 ครั้ง/เทิร์น) บังคับให้ผู้เล่น 1 คนเปิดการ์ดในมือทั้งหมด หากไม่มี "ม่านบาเรีย" เขาได้รับความเสียหาย 1' },
  retribution: { name: 'ทมิฬกลืนพลัง', en: 'Dark Retribution', desc: 'หลังได้รับความเสียหายจากการ์ด การ์ดใบนั้นลอยเข้าสู่มือคุณแทนที่จะลงสุสาน' },
  incite: { name: 'ปลุกระดมกบฏ', en: 'Incite Rebellion', active: true, desc: 'ช่วงร่ายเวท (1 ครั้ง/เทิร์น) ทิ้งการ์ดอาวุธ 1 ชิ้น สั่งให้ผู้เล่น 2 คนเปิดศึก "พันธนาการโลหิต" กัน (คนแรกเป็นผู้ท้า)' },
  twinfang: { name: 'ดาบคู่สังหาร', en: 'Twinfang Mastery', desc: 'ใช้ "ศรเวท" ได้ 2 ครั้งต่อเทิร์น' },
  dolorous: { name: 'ดาบสองคมต้องสาป', en: 'Dolorous Blow', desc: 'เมื่อ "ศรเวท" ของคุณโจมตีโดน สละเลือดตนเอง 1 เพื่อให้ทำความเสียหาย 3' },
  fate_swap: { name: 'คาถาสลับชะตา', en: 'Fate Swap', desc: 'เมื่อคำสาปหน่วงเวลามาอยู่หน้าคุณ ทิ้งการ์ด 1 ใบเพื่อย้ายคำสาปนั้นไปหน้าผู้เล่นอื่นในระยะ 1' },

  // ── วิหารมนตราแห่งอวาลอน ──
  omniscience: { name: 'เนตรล่วงรู้อนาคต', en: 'Omniscience', desc: 'ช่วงเริ่มเทิร์น ดูการ์ด 5 ใบบนกองจั่ว เลือกทิ้งลงสุสานบางส่วน ที่เหลือวางกลับบนกองตามลำดับที่เลือก' },
  transmute: { name: 'ธาตุแปรเปลี่ยน', en: 'Transmutation', desc: 'ใช้การ์ดธาตุพายุ (♠) หรือศักดิ์สิทธิ์ (♣) ในมือเป็น "เพลิงชำระล้าง" ได้' },
  boon: { name: 'พรแห่งสายน้ำ', en: 'Boon of the Depths', desc: 'ช่วงจั่วการ์ด จั่ว 3 ใบแทน 2 ใบ แล้วมอบการ์ดในมือ 1 ใบให้ผู้เล่นอื่น' },
  watery_grave: { name: 'จมดิ่งสู่วังวน', en: 'Watery Grave', active: true, desc: 'ช่วงร่ายเวท ทิ้งการ์ดธาตุพายุ (♠) 1 ใบ เพื่อทิ้งอุปกรณ์ 1 ชิ้นของผู้เล่นอื่นลงสุสาน' },
  veil: { name: 'ม่านหมอกนิรันดร์', en: 'Veil of Mist', desc: 'ผู้เล่นอื่นนับระยะมาหาคุณ +1 เสมอ และขณะไม่มีอุปกรณ์ "ศรเวท" ธาตุอัคคี (♦) ไม่มีผลต่อคุณ' },
  volley: { name: 'ศรมนตราไร้เงา', en: 'Phantom Volley', desc: 'ระยะโจมตีพื้นฐานเป็น 3 โดยไม่ต้องมีอาวุธ และการนับระยะของคุณไม่สนใจ "ยูนิคอร์นหมอก" ของเป้าหมาย' },
  philter: { name: 'สายใยน้ำเมามนตรา', en: 'Love Philter', desc: 'เริ่มเกม เลือกผูกชะตากับผู้เล่น 1 คน เมื่อผู้นั้นฟื้นฟูเลือด คุณฟื้นฟูเลือด 1 ตามไปด้วย' },
  bardic: { name: 'ลำนำแห่งวีรชน', en: 'Bardic Inspiration', desc: 'เมื่อมีผู้เล่นใช้มหาเวทฉับพลัน ทิ้งการ์ด 1 ใบเพื่อจั่ว 2 ใบ (2 ครั้งต่อเทิร์น)' },

  // ── ผู้พิทักษ์จอกศักดิ์สิทธิ์และสิ่งลี้ลับ ──
  grail_touch: { name: 'สัมผัสแห่งจอกศักดิ์สิทธิ์', en: "Grail's Touch", active: true, desc: 'ช่วงร่ายเวท (1 ครั้ง/เทิร์น) เสียเลือด 1 ให้ผู้เล่นอื่น 1 คนจั่ว 2 ใบและลบล้างคำสาปทั้งหมดของเขา' },
  sanctuary: { name: 'กายาสิทธิ์', en: 'Sanctuary', desc: 'ไม่ตกเป็นเป้าหมายของคำสาปหน่วงเวลาใดๆ' },
  truth_seeker: { name: 'สัจธรรมชี้นำ', en: 'Truth Seeker', desc: 'เมื่อคุณเปิดการ์ดตัดสิน เปิดเพิ่มอีก 1 ใบแล้วเลือกใบที่ดีที่สุดมาใช้' },
  ascetic: { name: 'สมาธิบริสุทธิ์', en: 'Ascetic Vow', desc: 'ในเทิร์นที่ไม่ได้ใช้ "ศรเวท" เก็บการ์ดในมือเกินเลือดได้อีก 2 ใบในช่วงสละพลัง' },
  decapitation: { name: 'ศีรษะคืนร่าง', en: 'Decapitation Feat', desc: 'ครั้งแรกของเกมที่เลือดเหลือ 0 จะไม่ตาย ฟื้นเลือดกลับมาเป็น 2 ทันทีพร้อมจั่ว 2 ใบ' },
  challenge: { name: 'ท้าดวลเกียรติยศ', en: "Knight's Challenge", desc: 'เป้าหมายของ "ศรเวท" ของคุณต้องทิ้ง "ม่านบาเรีย" และการ์ดอาวุธ 1 ชิ้นจึงจะป้องกันได้' },
  cacophony: { name: 'เสียงเพรียกกลืนวิญญาณ', en: 'Barking Cacophony', desc: 'ช่วงเริ่มเทิร์น ผู้เล่นทุกคนในระยะ 1 ต้องสุ่มทิ้งการ์ดในมือ 1 ใบ มิฉะนั้นคุณจั่วการ์ด 1 ใบต่อคนที่ไม่ทิ้ง' },
  rend: { name: 'กัดขย้ำเกราะเวท', en: 'Rend Armor', desc: 'เมื่อ "ศรเวท" ของคุณโจมตีโดน ทำลายการ์ดยุทโธปกรณ์ 1 ชิ้นของเป้าหมาย' },

  // ── ร่ายมนตร์ผสาน (ทุกฮีโร่ฝ่ายอวาลอน) ──
  overcharge: { name: 'ร่ายมนตร์ผสาน', en: 'Spell Overcharge', desc: '(จอมเวทแห่งอวาลอน) ผสานรูนเป็นมหาเวทได้ 2 ครั้งต่อเทิร์น (ปกติ 1 ครั้ง) และการผสานไม่นับโควตาการโจมตี' },
};

const HEROES = {
  arthur: { name: 'กษัตริย์อาเธอร์', en: 'King Arthur', title: 'The Chosen Monarch', kingdom: 'crown', hp: 4, gender: 'm', skills: ['exalted', 'sword_stone'] },
  lancelot: { name: 'เซอร์ลานเซล็อต', en: 'Sir Lancelot', title: 'Champion of the Lake', kingdom: 'crown', hp: 4, gender: 'm', skills: ['peerless', 'berserk'] },
  gawain: { name: 'เซอร์กาเวน', en: 'Sir Gawain', title: 'Solar Champion', kingdom: 'crown', hp: 4, gender: 'm', skills: ['solar'] },
  bedivere: { name: 'เซอร์เบดิเวียร์', en: 'Sir Bedivere', title: 'Knight of the Silver Hand', kingdom: 'crown', hp: 4, gender: 'm', skills: ['prosthetic'] },
  kay: { name: 'เซอร์เคย์', en: 'Sir Kay', title: 'The Grand Seneschal', kingdom: 'crown', hp: 4, gender: 'm', skills: ['logistics'] },
  gareth: { name: 'เซอร์แกเร็ธ', en: 'Sir Gareth', title: 'The Pure Gallant', kingdom: 'crown', hp: 4, gender: 'm', skills: ['devotion'] },
  guinevere: { name: 'ราชินีกวินิเวียร์', en: 'Queen Guinevere', title: 'Sovereign Grace', kingdom: 'crown', hp: 3, gender: 'f', skills: ['glamour', 'heartstrings'] },

  mordred: { name: 'มอร์เดร็ด', en: 'Mordred', title: 'The Usurper Prince', kingdom: 'coven', hp: 4, gender: 'm', skills: ['venom', 'betrayal'] },
  morgan: { name: 'มอร์กาน่า เลอ เฟย์', en: 'Morgan le Fay', title: 'High Sorceress', kingdom: 'coven', hp: 3, gender: 'f', skills: ['shadow_glamour', 'soul_curse'] },
  agravain: { name: 'เซอร์อักราแวน', en: 'Sir Agravain', title: 'The Whispering Blade', kingdom: 'coven', hp: 4, gender: 'm', skills: ['scandal'] },
  black_knight: { name: 'อัศวินดำ', en: 'The Black Knight', title: 'The Undying Bulwark', kingdom: 'coven', hp: 4, gender: 'm', skills: ['retribution'] },
  lot: { name: 'ราชาล็อตแห่งออร์กนีย์', en: 'King Lot', title: 'The Rebellion Lord', kingdom: 'coven', hp: 4, gender: 'm', skills: ['incite'] },
  balin: { name: 'เซอร์บาลิน', en: 'Sir Balin', title: 'Knight of Two Swords', kingdom: 'coven', hp: 4, gender: 'm', skills: ['twinfang', 'dolorous'] },
  morgause: { name: 'มอร์กอส', en: 'Morgause', title: 'Weaver of Shadows', kingdom: 'coven', hp: 3, gender: 'f', skills: ['fate_swap'] },

  merlin: { name: 'เมอร์ลิน มหาจอมเวท', en: 'Merlin', title: 'The Archmage', kingdom: 'avalon', hp: 3, gender: 'm', skills: ['omniscience', 'transmute', 'overcharge'] },
  nimue: { name: 'นิเวีย สตรีแห่งทะเลสาบ', en: 'Nimue', title: 'Lady of the Lake', kingdom: 'avalon', hp: 3, gender: 'f', skills: ['boon', 'watery_grave', 'overcharge'] },
  viviane: { name: 'วิเวียน มหาปุโรหิต', en: 'Lady Viviane', title: 'Mystic Matriarch', kingdom: 'avalon', hp: 3, gender: 'f', skills: ['veil', 'overcharge'] },
  tristan: { name: 'เซอร์ทริสตัน', en: 'Sir Tristan', title: 'The Melodic Archer', kingdom: 'avalon', hp: 4, gender: 'm', skills: ['volley', 'overcharge'] },
  isolde: { name: 'เจ้าหญิงอิโซลเด', en: 'Princess Isolde', title: 'The White Hand', kingdom: 'avalon', hp: 3, gender: 'f', skills: ['philter', 'overcharge'] },
  taliesin: { name: 'ทาเลียซิน', en: 'Taliesin', title: 'The Arcane Bard', kingdom: 'avalon', hp: 3, gender: 'm', skills: ['bardic', 'overcharge'] },

  galahad: { name: 'เซอร์กาลาฮัด', en: 'Sir Galahad', title: 'The Pure Soul', kingdom: 'grail', hp: 4, gender: 'm', skills: ['grail_touch', 'sanctuary'] },
  percival: { name: 'เซอร์เพอร์ซิวัล', en: 'Sir Percival', title: 'Knight of the Innocent Heart', kingdom: 'grail', hp: 4, gender: 'm', skills: ['truth_seeker'] },
  bors: { name: 'เซอร์บอร์ส', en: 'Sir Bors the Younger', title: 'The Unyielding Penitent', kingdom: 'grail', hp: 4, gender: 'm', skills: ['ascetic'] },
  green_knight: { name: 'อัศวินมรกต', en: 'The Green Knight', title: 'The Immortal Giant', kingdom: 'grail', hp: 5, gender: 'm', skills: ['decapitation', 'challenge'] },
  questing_beast: { name: 'เควสติ้งบีสต์', en: 'The Questing Beast', title: 'Abyssal Chimera', kingdom: 'grail', hp: 4, gender: 'm', skills: ['cacophony', 'rend'] },
};

// กษัตริย์เลือกได้จาก อาเธอร์ + ฮีโร่สุ่มอีก 3 ตัว
const LORD_HEROES = ['arthur'];

module.exports = { KINGDOMS, ROLES, SKILLS, HEROES, LORD_HEROES };
