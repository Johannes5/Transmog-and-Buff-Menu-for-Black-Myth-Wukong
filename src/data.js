// Catalog of True Wukong transmog IDs -> official English item names.
//
// ID layout for armor: 1 SS T P
//   SS = set family, T = quality tier (0 = base), P = slot (1 head, 2 body, 3 arms, 4 legs)
// Sources: True Wukong "ID Lists" (TrueWukong-TransmogList.txt, internal asset names),
// nitingururajk/black-myth-wukong-achievement-tracker and xyzkljl1/MyBlackMythWukongMods
// (game item IDs with names), game8 / powerpyx / fextralife / BWIKI for official names.

export const SLOTS = ['weapon', 'head', 'body', 'arms', 'legs', 'gourd'];
export const SLOT_LABEL = {
  weapon: 'Weapon',
  head: 'Head',
  body: 'Body',
  arms: 'Arms',
  legs: 'Legs',
  gourd: 'Gourd',
};
const SLOT_DIGIT = { head: 1, body: 2, arms: 3, legs: 4 };

// Armor set families.
//  family: the "1SS" prefix (e.g. 104 -> IDs 104TP)
//  tiers:  quality tiers that exist for this family (0 = base)
//  pieces: official piece names per slot (null = set has no piece in that slot)
//  altLook: tiers whose mesh differs from the base look (internal asset name in the ID list)
//  bodyTiers: override for slots that do not exist at every tier
const SETS = [
  {
    key: 'default', family: 101, name: 'Destined One (bare, no armor)', tiers: [0],
    pieces: { head: 'Bare head (no headgear)', body: 'Bare body (no armor)', arms: 'Bare arms', legs: 'Bare legs' },
    note: 'Internal "Born" look. Head/arm/leg entries may render as nothing.',
  },
  {
    key: 'starting', family: 102, name: 'Starting gear', tiers: [0],
    pieces: { head: null, body: 'Tiger Hide Loincloth', arms: 'Cotton Wristwraps', legs: 'Cotton Legwraps' },
  },
  {
    key: 'serpentscale', family: 103, name: 'Serpentscale Set', tiers: [0, 1, 2, 3, 4],
    pieces: { head: null, body: 'Serpentscale Battlerobe', arms: 'Serpentscale Bracers', legs: 'Serpentscale Gaiters' },
    altLook: { 4: 'Jinlin' },
    note: 'Chapter 1, Whiteclad Noble.',
  },
  {
    key: 'pilgrim', family: 104, name: 'Pilgrim Set', tiers: [0, 1, 2, 3, 4],
    pieces: { head: "Pilgrim's Headband", body: "Pilgrim's Garb", arms: "Pilgrim's Wristwraps", legs: "Pilgrim's Legwraps" },
    altLook: { 4: 'Xingzhe_02' },
    note: 'Chapter 1, Guanyin Temple shrine.',
  },
  {
    key: 'old-monkey-king', family: 105, name: "Great Sage armor, prologue version (Old Monkey King, weathered)", tiers: [0],
    aliases: 'monkey king sage wukong fortune favor',
    pieces: { head: 'Golden Feng-Tail Crown (Old Monkey King)', body: 'Gold Suozi Armor (Old Monkey King)', arms: 'Dian-Cui Loong-Soaring Bracers (Old Monkey King)', legs: 'Lotus Silk Cloudtreaders (Old Monkey King)' },
    note: 'The weathered Great Sage armor worn in the prologue. Given automatically in Chapter 6.',
  },
  {
    key: 'ochre', family: 106, name: 'Ochre Set', tiers: [0, 1, 2],
    pieces: { head: null, body: 'Ochre Battlerobe', arms: 'Ochre Armguard', legs: 'Ochre Greaves' },
    altLook: { 2: 'Huangfeng_02' },
    note: 'Chapter 3 first shrine.',
  },
  {
    key: 'yaksha', family: 107, name: 'Yaksha Outrage Set', tiers: [0, 1],
    pieces: { head: 'Yaksha Mask of Outrage', body: 'Embroidered Shirt of Outrage', arms: 'Yaksha Bracers of Outrage', legs: 'Yaksha Greaves of Outrage' },
    note: 'Chapter 6 first shrine.',
  },
  {
    key: 'loongscale', family: 108, name: 'Loongscale Set', tiers: [0, 1, 2],
    pieces: { head: null, body: 'Loongscale Battlerobe', arms: 'Loongscale Armguard', legs: 'Loongscale Greaves' },
    altLook: { 2: 'KangJinLong_02' },
    note: 'Chapter 3, Kang-Jin Star.',
  },
  {
    key: 'ebongold', family: 109, name: 'Ebongold Set', tiers: [0, 1, 2, 3],
    pieces: { head: null, body: 'Ebongold Silk Robe', arms: 'Ebongold Armguard', legs: 'Ebongold Gaiters' },
    altLook: { 3: 'Wujin' },
    note: 'Chapter 2 first shrine.',
  },
  {
    key: 'golden', family: 110, name: 'Golden Set (Gilded Radiance)', tiers: [0, 1],
    aliases: 'gilded radiance',
    pieces: { head: 'Golden Mask of Fury', body: 'Golden Embroidered Shirt', arms: 'Golden Armguard', legs: 'Golden Greaves' },
    note: 'Chapter 4 first shrine. Set bonus is called Gilded Radiance.',
  },
  {
    key: 'galeguard', family: 112, name: 'Galeguard Set', tiers: [0, 1, 2, 3],
    pieces: { head: 'Galeguard Beast Mask', body: 'Galeguard Beastmaw Armor', arms: 'Galeguard Bracers', legs: 'Galeguard Greaves' },
    altLook: { 3: 'Cangfeng' },
    note: 'Chapter 2, Stone Vanguard.',
  },
  {
    key: 'non-pure', family: 113, name: 'Non-Pure Set', tiers: [0, 1],
    pieces: { head: 'Non-Pure Broken Mask', body: 'Non-Pure Armor of Coiling Loong', arms: 'Non-Pure Gauntlets', legs: 'Non-Pure Greaves' },
    note: 'Chapter 4, Zhu Bajie.',
  },
  {
    key: 'centipede', family: 114, name: 'Centipede Set', tiers: [0, 1],
    pieces: { head: 'Centipede Hat of Transcendence', body: 'Centipede Qiang-Jin Armor', arms: 'Centipede Spiked Armguard', legs: 'Centipede Gaiters of Transcendence' },
    note: 'Chapter 5 first shrine. (One community table swaps this family with the Insect Set; internal asset name is WuGong = centipede.)',
  },
  {
    key: 'folk-opera', family: 115, name: 'Folk Opera Set (Deluxe Edition)', tiers: [0, 1, 2, 3, 4],
    pieces: { head: 'Folk Opera Mask', body: 'Folk Opera Almsgiving Armor', arms: 'Folk Opera Leather Bracers', legs: 'Folk Opera Buskins' },
  },
  {
    key: 'bull-king', family: 116, name: 'Bull King Set', tiers: [0],
    pieces: { head: "Bull King's Mask", body: "Bull King's Shan Wen Armor", arms: "Bull King's Bracers", legs: "Bull King's Greaves" },
    note: 'Chapter 5 secret area, Bishui Golden-Eyed Beast.',
  },
  {
    key: 'bronze', family: 117, name: 'Bronze Set', tiers: [0, 1, 2, 3],
    pieces: { head: 'Bronze Monkey Mask', body: 'Bronze Brocade Battlerobe', arms: 'Bronze Armguard', legs: 'Bronze Buskins' },
    note: 'Chapter 1 secret area, Elder Jinchi.',
  },
  {
    key: 'iron', family: 118, name: 'Iron Set (Yin Tiger)', tiers: [0, 1],
    pieces: { head: 'Iron Horned Helm', body: 'Iron-Tough Armor', arms: 'Iron-Tough Gauntlets', legs: 'Iron-Tough Greaves' },
    note: 'Zodiac Village, Yin Tiger.',
  },
  {
    key: 'insect', family: 119, name: 'Insect Set', tiers: [0, 1, 2],
    pieces: { head: 'Monastic Insect Hat', body: 'Venomous Sting Insect Armor', arms: 'Insect Spike Bracers', legs: 'Insect Spike Gaiters' },
    slotTiers: { body: [1, 2] },
    note: 'Chapter 2 secret area, Fuban (body from Scorpionlord, Chapter 4). Internal name Dujiao = rhinoceros beetle.',
  },
  {
    key: 'heavens-equal', family: 120, name: "Great Sage armor, Chapter 6 (Heaven's Equal set: Golden Feng-Tail Crown, Gold Suozi Armor...)", tiers: [0],
    aliases: 'monkey king sage wukong dashengtao',
    pieces: { head: 'Golden Feng-Tail Crown', body: 'Gold Suozi Armor', arms: 'Dian-Cui Loong-Soaring Bracers', legs: 'Lotus Silk Cloudtreaders' },
    note: 'The full Monkey King / Great Sage look. Hidden chest in Chapter 6.',
  },
  {
    key: 'three-hill', family: 121, name: 'Three Hill Crown', tiers: [0],
    pieces: { head: 'Three Hill Crown', body: null, arms: null, legs: null },
    note: 'Gauntlet of Legends reward (Dec 2024 update).',
  },
  {
    key: 'opulence', family: 122, name: 'Armor Set of Opulence (Chinese New Year lion)', tiers: [0, 1, 2, 3, 4],
    pieces: { head: 'Lion Head of Opulence', body: 'Red Silk Robe of Opulence', arms: 'Armguard of Opulence', legs: 'Buskin of Opulence' },
    note: "Trailblazer's Gift at any shrine (v1.0.13 update).",
  },
];

// Stand-alone pieces (no set).
const SINGLES = [
  { id: 17001, slot: 'head', name: 'Earth Spirit Cap', note: 'Nine-Capped Lingzhi Guai, Chapter 5' },
  { id: 17002, slot: 'head', name: 'Snout Mask', note: 'Yellow-Robed Squire, Chapter 2' },
  { id: 17003, slot: 'head', name: 'Skull of Turtle Treasure', note: 'Rare drop, Chapter 5' },
  { id: 17004, slot: 'body', name: 'Ginseng Cape', note: 'Old Ginseng Guai, Chapter 3' },
  { id: 17005, slot: 'head', name: 'Locust Antennae Mask', note: 'Rare drop, Chapter 4' },
  { id: 17006, slot: 'head', name: 'Grey Wolf Mask', note: 'Lingxuzi, Chapter 1' },
  { id: 17007, slot: 'head', name: 'See No Evil', note: 'Blind monks, Chapter 3' },
  { id: 17008, slot: 'body', name: 'Yin-Yang Daoist Robe', note: 'Keeper of Flaming Mountains, Chapter 5' },
  { id: 17009, slot: 'arms', name: 'Venomous Armguard', note: 'Venom Daoist, Chapter 4' },
  { id: 17010, slot: 'arms', name: "Guanyin's Prayer Beads", note: 'Ancient Guanyin Temple chest' },
  { id: 17011, slot: 'arms', name: 'Vajra Armguard', note: 'Clay Vajra, Chapter 3' },
];

const WEAPONS = [
  [15005, 'Willow Wood Staff', 'starter'],
  [15001, 'Bronze Cloud Staff', 'crafted, Chapter 1'],
  [15003, 'Twin Serpents Staff', 'Whiteclad Noble, Chapter 1'],
  [15004, 'Wind Bear Staff', 'crafted, Chapter 2'],
  [15008, 'Cloud-Patterned Stone Staff', 'Shigandang, Chapter 2'],
  [15009, 'Rat Sage Staff', 'Yellow Wind Sage, Chapter 2'],
  [15006, 'Chitin Staff', 'Second Sister, Chapter 4'],
  [15014, 'Kang-Jin Staff', 'Kang-Jin Star, Chapter 3'],
  [15010, 'Loongwreathe Staff', 'Red Loong'],
  [15102, 'Chu-Bai Spear', 'Pagoda Realm prisoner questline'],
  [15012, 'Spikeshaft Staff', 'after Chapter 3'],
  [15013, 'Spider Celestial Staff', 'Violet Spider, Chapter 4'],
  [15007, 'Visionary Centipede Staff', 'after Chapter 4'],
  [15011, 'Staff of Blazing Karma', 'upgrade of Cloud-Patterned Stone Staff'],
  [15019, 'Bishui Beast Staff', 'Bishui Golden-Eyed Beast, Chapter 5'],
  [15015, 'Golden Loong Staff', 'Cyan Loong'],
  [15016, 'Dark Iron Staff', 'NG+ upgrade of Staff of Blazing Karma'],
  [15018, 'Adept Spine-Shooting Fuban Staff', 'NG+ upgrade of Chitin Staff'],
  [15017, 'Stormflash Loong Staff', 'NG+ upgrade of Kang-Jin Staff'],
  [15002, 'Jingubang', 'Water Curtain Cave'],
  [15101, 'Tri-Point Double-Edged Spear', 'secret ending boss'],
  [15020, 'Qing Mallet', 'Gauntlet of Legends reward'],
  [15021, 'Leeching Centipede Staff', 'Gauntlet of Legends reward'],
  [15022, 'Fanged Cyan Staff', 'Gauntlet of Legends reward'],
].map(([id, name, note]) => ({ id, slot: 'weapon', name, note }));

// Gourd IDs are listed by the mod, but only some names are confirmed.
const GOURDS = [
  [18001, 'Old Gourd', 'starting gourd'],
  [18003, 'Gourd variant 2 (unconfirmed: Medicine Gourd?)', ''],
  [18004, 'Gourd variant 3 (unconfirmed: Healing Gourd?)', ''],
  [18005, 'Gourd variant 4 (unconfirmed: Medicine Sage Gourd?)', ''],
  [18006, 'Gourd variant 5 (unconfirmed: Medicine Master Gourd?)', ''],
  [18007, 'Xiang River Goddess Gourd', 'Chapter 4 treasure room'],
  [18008, 'Gourd variant 7 (unconfirmed)', ''],
  [18009, "Trailblazer's Scarlet Gourd", 'Deluxe Edition'],
  [18010, 'Gourd variant 8 (unconfirmed: Supreme Gourd?)', ''],
  [18011, 'Qing-Tian Gourd', 'NG+ Shen Monkey'],
  [18012, 'Plaguebane Gourd', 'Chapter 2'],
  [18013, 'Stained Jade Gourd', 'Scorpionlord, Chapter 4'],
  [18014, 'Immortal Blessing Gourd', 'Shen Monkey'],
  [18015, 'Multi-Glazed Gourd', 'Shen Monkey'],
  [18016, 'Jade Lotus Gourd', 'Shen Monkey'],
  [18017, 'Fiery Gourd', 'Chapter 3'],
].map(([id, name, note]) => ({ id, slot: 'gourd', name, note: note || 'gourd transmog is experimental' }));

const TIER_NAME = { 0: '', 1: 'tier 2', 2: 'tier 3', 3: 'tier 4', 4: 'tier 5' };

function buildArmor(allTiers) {
  const items = [];
  for (const set of SETS) {
    for (const slot of ['head', 'body', 'arms', 'legs']) {
      const pieceName = set.pieces[slot];
      if (!pieceName) continue;
      const tiers = set.slotTiers?.[slot] ?? set.tiers;
      const baseTier = tiers[0];
      for (const tier of tiers) {
        const alt = set.altLook?.[tier];
        const isBase = tier === baseTier;
        const isTop = tier === tiers[tiers.length - 1];
        if (!allTiers && !isBase && !isTop) continue;
        const id = set.family * 100 + tier * 10 + SLOT_DIGIT[slot];
        let label = pieceName;
        if (isTop && !isBase) label += ' (Mythical, highest tier)';
        else if (!isBase) label += ` (${TIER_NAME[tier]})`;
        items.push({ id, slot, name: label, set: set.name, setKey: set.key, tier, alt: !!alt, note: set.note ?? '', aliases: set.aliases ?? '' });
      }
    }
  }
  return items;
}

/** All selectable items. `allTiers` also includes same-look quality tiers. */
export function catalog({ allTiers = false } = {}) {
  return [...WEAPONS, ...buildArmor(allTiers), ...SINGLES, ...GOURDS];
}

export function sets() {
  const out = [];
  for (const set of SETS) {
    out.push(set);
    const mythTier = set.tiers.length > 1 ? set.tiers[set.tiers.length - 1] : null;
    if (mythTier !== null) {
      out.push({
        ...set,
        key: set.key + '-mythical',
        name: set.name.replace(/ Set$/, '') + ' Set (Mythical, highest tier)',
        fixedTier: mythTier,
        note: (set.note ? set.note + ' ' : '') + 'Highest quality tier; sets that change appearance when upgraded show it here.',
      });
    }
  }
  return out;
}

/** Piece names of a set as one line (for menus). */
export function setPieceNames(set) {
  return ['head', 'body', 'arms', 'legs'].map((s) => set.pieces[s]).filter(Boolean).join(', ');
}

/** Base-tier IDs of a set, per slot (only slots the set has). */
export function setPieces(setKey) {
  const set = sets().find((s) => s.key === setKey);
  if (!set) return null;
  const out = {};
  for (const slot of ['head', 'body', 'arms', 'legs']) {
    if (!set.pieces[slot]) continue;
    const tier = set.fixedTier ?? (set.slotTiers?.[slot] ?? set.tiers)[0];
    out[slot] = set.family * 100 + tier * 10 + SLOT_DIGIT[slot];
  }
  return out;
}

const byId = new Map(catalog({ allTiers: true }).map((i) => [i.id, i]));

/** Look up an item by numeric ID (any tier). Unknown IDs get a best-effort label. */
export function itemById(id) {
  const hit = byId.get(id);
  if (hit) return hit;
  let slot = 'unknown';
  if (id >= 15000 && id < 16000) slot = 'weapon';
  else if (id >= 18000 && id < 19000) slot = 'gourd';
  else if (id >= 10000 && id < 13000) slot = ['', 'head', 'body', 'arms', 'legs'][id % 10] ?? 'unknown';
  return { id, slot, name: `Unknown item ${id}`, note: '' };
}

/** Which slot an ID belongs to (used to decode config lines). */
export function slotOf(id) {
  return itemById(id).slot;
}

/** Simple multi-token fuzzy match: every token must appear in name/set/id. */
export function matches(item, term) {
  if (!term) return true;
  const hay = `${item.name} ${item.set ?? ''} ${item.id} ${item.note ?? ''} ${item.aliases ?? ''} ${SLOT_LABEL[item.slot] ?? ''}`.toLowerCase();
  return term.toLowerCase().split(/\s+/).filter(Boolean).every((t) => hay.includes(t));
}
