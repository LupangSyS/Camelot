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

  // ── ทักษะด้านมืด (ปลุกเมื่อจุติ) ──
  abyssal_blade: { name: 'ดาบห้วงเหว', en: 'Abyssal Blade', dark: true, desc: 'ใช้ "ศรเวท" ได้ไม่จำกัดครั้ง ทุกศรเวททำความเสียหาย +1 แต่ทุกครั้งที่ใช้ศรเวท คุณเสียเลือด 1' },
  chrono_ruin: { name: 'ย้อนกาลล่มสลาย', en: 'Chronomancy of Ruin', dark: true, active: true, desc: 'ช่วงร่ายเวท (1 ครั้ง/เทิร์น) บังคับผู้เล่น 1 คนทิ้งการ์ดทุกใบที่เขาจั่วมาในช่วงเบิกมนตราล่าสุดและยังอยู่ในมือ' },
  dark_nova: { name: 'ระเบิดทมิฬ', en: 'Dark Nova', dark: true, active: true, desc: 'ช่วงร่ายเวท (1 ครั้ง/เทิร์น) เสียเลือด 1 แล้วผู้เล่นอื่นทุกคนในระยะ 1 ได้รับความเสียหาย 1 (ไม่เลือกหน้า)' },
  hex_storm: { name: 'พายุคำสาป', en: 'Hex Storm', dark: true, active: true, desc: 'ช่วงร่ายเวท (1 ครั้ง/เทิร์น) ทิ้งการ์ด 1 ใบ แล้วผู้เล่นอื่นทุกคนสุ่มทิ้งการ์ดในมือ 1 ใบ' },
  soul_reap: { name: 'เก็บเกี่ยววิญญาณ', en: 'Soul Reaping', dark: true, desc: 'เมื่อผู้เล่นอื่นสิ้นชีพ ฟื้นฟูเลือด 1 และจั่วการ์ด 2 ใบ' },
  vampiric: { name: 'ดูดพลังชีวิต', en: 'Vampiric Hunger', dark: true, desc: 'ทุกครั้งที่ทำความเสียหายแก่ผู้เล่นอื่น จั่วการ์ด 1 ใบ' },
  bloodlust: { name: 'กระหายเลือด', en: 'Bloodlust', dark: true, desc: 'เมื่อ "ศรเวท" ของคุณทำความเสียหาย ฟื้นฟูเลือด 1' },
  fury: { name: 'โทสะคลั่ง', en: 'Fury', dark: true, desc: 'ใช้ "ศรเวท" ได้เพิ่ม 1 ครั้งต่อเทิร์น และระยะโจมตี +1' },
  tyrant_aura: { name: 'ออร่าทรราช', en: 'Tyrant Aura', dark: true, desc: 'ผู้เล่นในระยะ 1 ใช้ "ม่านบาเรีย" ป้องกัน "ศรเวท" ของคุณไม่ได้' },
  iron_hide: { name: 'หนังเหล็ก', en: 'Iron Hide', dark: true, desc: 'ความเสียหายตั้งแต่ 2 หน่วยขึ้นไปที่คุณได้รับ ลดลง 1' },

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

// ── ด้านมืดแปดเปื้อน (การ์ดฮีโร่สองหน้า) — ทักษะด้านมืดแทนที่ทักษะด้านสว่างทั้งหมดเมื่อจุติ ──
const DARK = {
  arthur: { name: 'ราชันย์ทรราช', en: 'The Tyrant King', skills: ['tyrant_aura', 'sword_stone'] },
  lancelot: { name: 'ดาบแห่งห้วงเหว', en: 'The Abyssal Blade', skills: ['abyssal_blade', 'berserk'] },
  gawain: { name: 'สุริยันแผดเผา', en: 'The Scorching Sun', skills: ['solar', 'bloodlust'] },
  bedivere: { name: 'แขนเหล็กคลั่ง', en: 'The Iron Frenzy', skills: ['fury', 'iron_hide'] },
  kay: { name: 'เสนาบดีละโมบ', en: 'The Greedy Seneschal', skills: ['vampiric', 'hex_storm'] },
  gareth: { name: 'อัศวินคำสัตย์แตกสลาย', en: 'The Broken Oath', skills: ['bloodlust', 'iron_hide'] },
  guinevere: { name: 'ราชินีหนาม', en: 'The Thorn Queen', skills: ['soul_curse', 'hex_storm'] },
  mordred: { name: 'ราชันย์กบฏ', en: 'The Usurper Crowned', skills: ['venom', 'fury'] },
  morgan: { name: 'จอมเวทแห่งราตรีนิรันดร์', en: 'The Night Eternal', skills: ['hex_storm', 'soul_reap'] },
  agravain: { name: 'มีดสั้นกระซิบพิษ', en: 'The Venom Whisper', skills: ['venom', 'vampiric'] },
  black_knight: { name: 'ป้อมปราการอมตะ', en: 'The Undying Fortress', skills: ['retribution', 'iron_hide'] },
  lot: { name: 'ขุนศึกทมิฬ', en: 'The Dark Warlord', skills: ['fury', 'dark_nova'] },
  balin: { name: 'ดาบคู่ต้องสาป', en: 'The Cursed Twinblade', skills: ['twinfang', 'dolorous', 'bloodlust'] },
  morgause: { name: 'แม่มดทอชะตา', en: 'The Fate Hag', skills: ['soul_reap', 'hex_storm'] },
  merlin: { name: 'จอมเวทล้างกาลเวลา', en: 'The Chronomancer of Ruin', skills: ['chrono_ruin', 'dark_nova'] },
  nimue: { name: 'ราชินีวังวน', en: 'The Maelstrom Queen', skills: ['watery_grave', 'dark_nova'] },
  viviane: { name: 'นักบวชหมอกมรณะ', en: 'The Death-Mist Priestess', skills: ['veil', 'soul_reap'] },
  tristan: { name: 'ศรโศกา', en: 'The Sorrow Arrow', skills: ['volley', 'vampiric'] },
  isolde: { name: 'ยาพิษรักร้าง', en: 'The Poisoned Philter', skills: ['venom', 'soul_curse'] },
  taliesin: { name: 'กวีเพลงมรณะ', en: 'The Dirge Bard', skills: ['hex_storm', 'vampiric'] },
  galahad: { name: 'ผู้พิพากษาเพลิง', en: 'The Burning Judge', skills: ['dark_nova', 'iron_hide'] },
  percival: { name: 'อัศวินคลั่งศรัทธา', en: 'The Zealot', skills: ['fury', 'bloodlust'] },
  bors: { name: 'ผู้บำเพ็ญโลหิต', en: 'The Blood Ascetic', skills: ['bloodlust', 'iron_hide'] },
  green_knight: { name: 'ยักษ์พงไพรคลั่ง', en: 'The Wild Colossus', skills: ['challenge', 'iron_hide'] },
  questing_beast: { name: 'อสูรหิวกระหาย', en: 'The Ravenous Chimera', skills: ['rend', 'vampiric'] },
};

// ── ตำนานประจำการ์ด: ความหายาก, คำคม และคำบรรยายรูปลักษณ์ (ใช้สร้าง prompt ภาพ AI ในสตูดิโอ) ──
const LORE = {
  arthur: { rarity: 'mythic', quote: 'ดาบเล่มนี้มิได้เลือกผู้แข็งแกร่งที่สุด แต่เลือกผู้ที่พร้อมแบกรับคาเมลอตทั้งแผ่นดิน', look: 'King Arthur, regal middle-aged king with short brown beard and golden crown, gleaming gold-and-royal-blue plate armor, crimson cape, holding the glowing holy sword Excalibur, Camelot castle at golden dusk behind him' },
  lancelot: { rarity: 'legendary', quote: 'คมดาบของข้าไม่เคยพลาดเป้า มีเพียงหัวใจเท่านั้นที่หลงทาง', look: 'Sir Lancelot, handsome dark-haired knight, polished silver plate armor with deep blue trim, flowing navy cape, dual swords, misty moonlit lake behind him' },
  gawain: { rarity: 'epic', quote: 'ตราบใดที่ตะวันยังส่อง ดาบของข้าไม่มีวันอ่อนแรง', look: 'Sir Gawain, blond bearded knight in radiant golden sun-engraved armor, orange cape, blazing sun halo behind his head, sword raised at sunrise' },
  bedivere: { rarity: 'rare', quote: 'มือข้างนี้อาจเป็นเงิน แต่ความภักดีของข้าแท้ยิ่งกว่าทองคำ', look: 'Sir Bedivere, grey-bearded veteran knight with a gleaming arcane silver prosthetic hand inscribed with glowing runes, steel armor with blue trim, castle battlements behind' },
  kay: { rarity: 'rare', quote: 'กองทัพเดินด้วยท้อง และราชสำนักอยู่รอดด้วยเสบียงของข้า', look: 'Sir Kay, stern seneschal with receding hair and a mustache, rich crimson tunic with gold trim, ring of brass keys at his belt, torch-lit great hall with banners' },
  gareth: { rarity: 'rare', quote: 'ข้าจะยืนขวางหน้าทุกคมดาบ เพื่อให้สหายได้กลับบ้าน', look: 'Sir Gareth, young golden-haired knight in white plate armor with blue accents, kite shield bearing a star, sunlit meadow behind' },
  guinevere: { rarity: 'legendary', quote: 'มงกุฎหนักกว่าที่ใครคิด แต่ข้าไม่เคยก้มหัว', look: 'Queen Guinevere, beautiful auburn-haired queen with a golden tiara, emerald and gold gown, holding a red rose, castle balcony at sunset' },
  mordred: { rarity: 'mythic', quote: 'บัลลังก์นี้ควรเป็นของข้าตั้งแต่ต้น และข้าจะทวงคืนด้วยเปลวเพลิง', look: 'Mordred the usurper prince, menacing knight in spiked black-and-crimson plate armor with a horned helm, wielding a jagged greatsword dripping glowing purple venom, burning castle under a stormy sky' },
  morgan: { rarity: 'mythic', quote: 'มายาภาพคือความจริงที่เจ้ายังไม่พร้อมจะมองเห็น', look: 'Morgan le Fay, pale raven-haired sorceress with a silver circlet set with a violet gem, dark purple robes, holding a glowing violet orb, eclipsed moon and starry night sky' },
  agravain: { rarity: 'rare', quote: 'ความลับทุกอย่างมีราคา และข้าคือผู้เก็บเงิน', look: 'Sir Agravain, sly hooded knight in dark green leather, thin mustache, hidden dagger, shadowy stormy courtyard' },
  black_knight: { rarity: 'epic', quote: 'ไม่มีใครเห็นใบหน้าข้า และไม่มีใครรอดไปเล่าขาน', look: 'The Black Knight, towering warrior in pitch-black full plate with a great helm whose visor glows red, massive dark greatsword, lightning storm behind' },
  lot: { rarity: 'epic', quote: 'ออร์กนีย์ไม่เคยลืม และไม่เคยให้อภัย', look: 'King Lot of Orkney, old king with long grey beard and iron crown, heavy fur cloak, snowy northern mountains' },
  balin: { rarity: 'epic', quote: 'ดาบสองเล่ม ชะตาเดียว — ความตาย', look: 'Sir Balin, wild red-haired bearded knight in chainmail with two crossed swords on his back, dark forest' },
  morgause: { rarity: 'legendary', quote: 'ข้าทอเส้นด้ายแห่งชะตา และเส้นของเจ้าใกล้ขาดแล้ว', look: 'Morgause, crimson-haired witch queen with a dark veil, blood-red gown, spinning glowing threads of fate, eclipse sky' },
  merlin: { rarity: 'mythic', quote: 'ข้าเห็นจุดจบของโลกนี้มาแล้วนับพันครั้ง และนี่คือจุดเริ่มต้นใหม่', look: 'Merlin the archmage, ancient wizard with a long silver beard, deep starlight-blue robes inscribed with gold constellations, gnarled oak staff crowned with a floating cosmic orb, mystical rune-lit ruins' },
  nimue: { rarity: 'legendary', quote: 'ทะเลสาบให้กำเนิดดาบ และทะเลสาบก็ทวงคืนได้เช่นกัน', look: 'Nimue the Lady of the Lake, ethereal woman with flowing silver-blue hair and a pearl circlet, aqua gown, holding a sphere of water, misty lake under moonlight' },
  viviane: { rarity: 'epic', quote: 'ในม่านหมอก ทุกเส้นทางคือเส้นทางกลับสู่อวาลอน', look: 'Lady Viviane, serene white-haired high priestess in a pale hooded robe, holding a glowing lotus, mist-shrouded sacred grove' },
  tristan: { rarity: 'rare', quote: 'บทเพลงของข้าแหลมคมพอๆ กับลูกธนู', look: 'Sir Tristan, brown-haired archer knight in green leather, longbow on his back, small harp, sea cliffs at sunset' },
  isolde: { rarity: 'epic', quote: 'ยาเสน่ห์หยดเดียว ผูกพันสองดวงใจไปชั่วนิรันดร์', look: 'Princess Isolde, golden-haired princess with a long braid and a jeweled circlet, white gown, holding a glowing pink love potion vial, seaside castle' },
  taliesin: { rarity: 'rare', quote: 'วีรบุรุษตายได้ แต่บทเพลงของพวกเขาไม่มีวันตาย', look: 'Taliesin the bard, curly-haired bearded bard in a green cloak, golden harp with glowing musical notes, enchanted forest' },
  galahad: { rarity: 'mythic', quote: 'ใจที่บริสุทธิ์คือเกราะที่ไม่มีวันแตก', look: 'Sir Galahad, young angelic knight with golden hair and a radiant halo, white-and-gold armor, holding the glowing Holy Grail, beams of heavenly light' },
  percival: { rarity: 'epic', quote: 'ข้าไม่รู้ทางไปจอกศักดิ์สิทธิ์ แต่ข้ารู้ว่าต้องไม่หยุดเดิน', look: 'Sir Percival, earnest young knight in a white tunic with a red cross over mail, holding a spear, dawn-lit meadow' },
  bors: { rarity: 'rare', quote: 'ความอดทนคือดาบที่คมที่สุด', look: 'Sir Bors, bald bearded ascetic knight in a brown monk robe over chainmail, prayer beads, stained-glass chapel' },
  green_knight: { rarity: 'legendary', quote: 'ฟันคอข้าได้ แต่อีกหนึ่งปี ข้าจะมาทวงคืน', look: 'The Green Knight, gigantic green-skinned warrior with a wild green beard and a holly crown, green armor, giant battle axe, primeval forest' },
  questing_beast: { rarity: 'mythic', quote: '(เสียงเห่าหอนนับร้อยดังก้องจากท้องของมัน)', look: 'The Questing Beast, monstrous chimera with a serpent head and long scaled neck, leopard-spotted body, lion haunches, glowing red eyes, roaring in a dark abyssal forest' },
};

const RARITY = {
  mythic: { name: 'MYTHIC', th: 'ตำนานเทพ' },
  legendary: { name: 'LEGENDARY', th: 'ตำนาน' },
  epic: { name: 'EPIC', th: 'มหากาพย์' },
  rare: { name: 'RARE', th: 'หายาก' },
};

module.exports = { KINGDOMS, ROLES, SKILLS, HEROES, LORD_HEROES, DARK, LORE, RARITY };
