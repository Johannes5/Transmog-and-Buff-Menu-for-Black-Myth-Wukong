// Effect descriptions for talents, curated from the English wiki (Fextralife set, piece and Curios
// pages, Game8 armor list, Fandom pages for the Gauntlet-of-Legends staffs and the Loongscale
// Mythical passive). The game's own files only carry names, so coverage is partial: two curio
// internal names could not be matched to a wiki entry and stay null.

// Weapon effects by weapon ID (talent ID = weapon ID + 90000).
export const WEAPON_EFFECTS = {
  15005: 'No unique effect.',
  15001: 'No unique effect.',
  15003: 'Moderately increases the Damage of Light Attack Combo finishers. The effect is massively enhanced when fighting in water.',
  15004: 'Considerably increases the Critical Hit Chance of the Unveiling Strike of Cloud Step.',
  15008: 'Moderately increases the Damage executed by charged Smash Heavy Attacks.',
  15009: 'The fourth move of the Light Attack Combo and Mobile Staff Spin stir up a whirlwind of sand, increasing attack range and Damage.',
  15014: 'Punishing Downpour executes Thunder Damage to the enemy instead of area Damage. (Needs the Punishing Downpour skill.)',
  15006: 'Upon a successful hit with a charged Heavy Attack, each Focus Point spent slightly recovers Health.',
  15102: 'Integrates spear techniques into the Light Attack Combo and increases the Damage dealt by Thrust Stance moves.',
  15012: 'Continuously gains Focus for a brief moment after Seeing Through the enemy.',
  15013: 'Upon a successful hit with a charged Heavy Attack, each Focus Point spent slightly recovers Health. In Poisoned State, hits inflict Poison Bane on the enemy.',
  15007: 'Upon a successful hit with a charged Heavy Attack, each Focus Point spent slightly recovers Health. If the enemy is Poisoned, massively enhances the recovery.',
  15011: 'Charged Heavy Attacks in Smash Stance that cost over 3 Focus Points inflict a bursting lava effect on the ground.',
  15019: 'No unique effect.',
  15015: 'Moderately increases the Damage dealt by all Pillar Stance moves. A loong is summoned to strike the enemy with Thunder on Pillar Stance Heavy Attacks that cost 3 or 4 Focus Points.',
  15016: 'Considerably increases Attack based on Defense.',
  15018: 'Upon a successful hit with a charged Heavy Attack, each Focus Point spent slightly recovers Health and shoots spines from the staff at nearby enemies.',
  15017: 'Draws Thunder while charging, and inflicts Thunder Damage with every staff attack while in Shocked State.',
  15002: "The gauge of the 4th Focus Point no longer depletes over time. Heaven's Equal: for a short duration after casting a Spell, moderately increases Critical Hit Chance; upon Critical Hit, slightly reduces the Cooldown of all Spells.",
  15101: 'Integrates spear techniques into the Light Attack Combo and increases the Damage dealt by Thrust Stance moves. Performing Forceful Thrust shoots swords from the staff.',
  // Gauntlet of Legends (Fandom wiki: Qing_Mallet, Fanged_Cyan_Staff).
  15020: 'Continuously gains Focus for a brief moment after Seeing Through the enemy.',
  15022: 'Heavy attacks that consume 4 focus points inflict banes on the enemy based on stances. Smash Stance: Chill Bane. Pillar Stance: Scorch Bane. Thrust Stance: Shock Bane.',
};

// Armor sets by family (see data.js). bonus: worn pieces -> text; mythical: the extra passive of the
// Mythical-tier set; piece: slot (1 head, 2 body, 3 arms, 4 legs) -> the piece's own effect.
export const SET_EFFECTS = {
  103: {
    name: 'Wave-Rider',
    bonus: { 3: 'Massively reduces Stamina cost when in water.' },
    mythical: 'When in water, significantly increases the Damage dealt by Light Attack Combo Finishers.',
    piece: { 2: 'When Health is low, slowly recovers a small amount of Health; if in water, the effect is enhanced.' },
  },
  104: {
    name: 'Swift Pilgrim',
    bonus: { 2: 'Moderately increases Sprint speed.', 4: 'When Sprinting, each second moderately increases Attack. Stacks up to 10 times and ceases upon stopping.' },
    mythical: 'When Sprinting, gains a small amount of Focus per second.',
    piece: { 1: 'Allows using the gourd while Sprinting.' },
  },
  106: {
    name: 'Raging Sandstorm',
    bonus: { 3: 'Decoy and Duplicates are cloaked in Yellow Wind, granting them considerable Damage Reduction.' },
    mythical: 'Upon a successful hit with a charged Heavy Attack that cost 4 Focus Points, grants a Duplicate that lasts for a relatively short time.',
    piece: { 3: 'Upon consuming a Focus Point, moderately increases Critical Hit Chance for a short duration.' },
  },
  107: {
    name: 'Outrage',
    bonus: { 2: 'Pillar Stance Varied Combos, Sweeping Gale and Churning Gale, deal additional Damage.', 4: 'Unleash the rage within, significantly increasing Damage both dealt and taken.' },
    piece: { 1: 'Significantly increases Attack when Health is low.' },
  },
  108: {
    name: 'Thunder Veins',
    bonus: { 3: 'Massively reduces the duration of Shocked State; moderately increases Thunder Damage.' },
    mythical: 'Further increases Thunder Damage.', // Fandom "Loongscale Armor Set"; matches the Chinese "进一步增加所有赋雷攻击伤害"
    piece: { 2: 'Vengeful Mirage will inflict Thunder Bane.' },
  },
  109: {
    name: 'Dance of the Black Wind',
    bonus: { 3: 'In Cloud Step, a shrouding black wind continuously attacks enemies near the Destined One and the decoy.' },
    mythical: 'Moderately increases the initial Mana cost of Cloud Step, but the Decoy no longer dissipates over time and only disappears when vanquished.',
    piece: { 4: 'After a moment in Cloud Step, considerably increases Unveiling Strike Damage.' },
  },
  110: {
    name: 'Gilded Radiance',
    bonus: { 2: 'For a short duration after performing a Spirit Skill or using a Vessel, considerably increases Attack.', 4: 'Upon Critical Hits and defeats, grants a small amount of Qi.' },
    piece: { 1: 'Upon successful hits from Spirit Skills, grants massive Focus upon reverting.' },
  },
  112: {
    name: 'Gale Guardian',
    bonus: { 2: 'Upon perfect dodges, grants considerable additional Focus.', 4: 'Perfect dodges slightly reduce the Cooldown of all Spells.' },
    mythical: 'Significantly extends the duration of Invincibility of Dodges. Upon a Perfect Dodge, further reduces the Cooldown of all Spells.',
    piece: { 4: 'Performing 3 consecutive Perfect Dodges within a brief moment recovers a moderate amount of Mana.' },
  },
  113: {
    name: 'From Mud to Lotus',
    bonus: { 2: 'Mud that stains upon De-Transformation and exiting Spirit Skills grants considerable Damage Reduction for a short duration.', 4: 'When stained with mud, increases Might recovery rate; Dodges and Perfect Dodges also recover a small amount of additional Might.' },
    piece: { 4: 'For a brief moment after De-Transforming and exiting Spirit Skills, all actions cost no Stamina.' },
  },
  114: {
    name: 'Poison Ward',
    bonus: { 2: 'Massively reduces the continuous damage received from Poisoned State.', 4: 'Significantly increases Attack while suffering from Poisoned State.' },
    piece: { 2: 'For a short duration after defeating an enemy, moderately increases Attack.' },
  },
  115: {
    name: 'Every Bit Counts',
    bonus: { 4: 'Moderately increases the Will gained from defeating enemies.' },
  },
  116: {
    name: 'Unyielding Resolve',
    bonus: { 2: 'Upon taking damage, temporarily grants moderate Defense.', 4: 'Disables perfect dodges but grants Tenacity when Health is below 50%.' },
    piece: { 1: 'Grants moderate Focus upon taking damage; if the Destined One is staggered, grants more Focus.' },
  },
  117: {
    name: 'Evil Crasher',
    bonus: { 2: 'Deals additional Damage to the enemy upon crashing their Immobilization.', 4: 'Upon crashing the Immobilization on the enemy, massively reduces the Cooldown of Immobilize.' },
    piece: { 3: 'Performing a Light Attack following Evanescence directly triggers the Finisher of the Light Attack Combo.' },
  },
  118: {
    name: 'Iron Will',
    bonus: { 2: 'Upon successful Rock Solid deflections, massively increases the Focus gained by Nick of Time.', 4: 'Upon successful Rock Solid deflections, considerably reduces its Cooldown.' },
    piece: { 3: 'After a successful Deflection with Rock Solid, significantly increases the Damage of the next attack within a brief moment.' },
  },
  119: {
    name: 'Fuban Strength',
    bonus: { 2: 'Upon taking medicines, grants considerable Focus.', 4: 'Moderately increases the duration of all medicinal effects.' },
    piece: { 2: 'Considerably increases the damage dealt by all Poison-inflicting attacks.' },
  },
  120: {
    name: "Heaven's Equal",
    bonus: { 3: 'For a short duration after casting a Spell, moderately increases Critical Hit Chance.', 5: 'Upon landing a Critical Hit, reduces the Cooldown of all Spells.' },
  },
  105: {
    name: "Fortune's Favor",
    bonus: { 4: "Each new Great Sage's Talent awakened increases the Defense of this armor set." },
  },
};

// Stand-alone armor pieces (talent IDs 9070xx). Names matched to the mod's Chinese list against the
// in-game Chinese names (gamersky all-armor list): 长须面 = 长须头面 (Locust Antennae Mask, the
// Chapter 4 locust drop), 白脸羊 = 白脸子 (Grey Wolf Mask, dropped by Lingxuzi). Note: the mod's
// 907003 is 螳螂头骨 ("Mantis Skull"), which by elimination is probably Skull of Turtle Treasure
// (鳖宝头骨) rather than Locust Antennae Mask; left as-is pending confirmation.
export const UNIQUE_PIECES = {
  907001: { name: 'Earth Spirit Cap', slot: 'head', text: 'Slowly loses Health, but massively increases Health recovery when using the gourd.' },
  907002: { name: 'Snout Mask', slot: 'head', text: 'For a short duration after using the gourd, moderately increases Attack; refraining from using the gourd moderately reduces Attack.' },
  907003: { name: 'Mantis Skull (mod name; probably Skull of Turtle Treasure, unconfirmed)', slot: 'head', text: null },
  907004: { name: 'See No Evil', slot: 'head', text: 'More easily triggers Perfect Dodge.' },
  907005: { name: 'Locust Antennae Mask', slot: 'head', text: 'Considerably increases power of all Jump Attacks.' },
  907006: { name: 'Grey Wolf Mask', slot: 'head', text: 'Inflicts considerably more Damage Bonus on enemies at critical Health.' },
  907007: { name: 'Ginseng Cape', slot: 'body', text: 'For a short duration after using the gourd, moderately increases Maximum Stamina.' },
  907008: { name: 'Yin-Yang Daoist Robe', slot: 'body', text: 'When Health is above half, the Destined One is in Yang state: moderately reduces damage taken but disables Critical Hits. Below half, shifts to Yin state: massively increases Critical Hit Chance but massively increases damage taken.' },
  907009: { name: 'Venomous Armguard', slot: 'arms', text: 'Critical Hit Chance +3%.' },
  907010: { name: "Guanyin's Prayer Beads", slot: 'arms', text: 'After absorbing the lingering will, moderately increases Maximum Health and Mana for a long duration.' },
  907011: { name: 'Vajra Armguard', slot: 'arms', text: 'Moderately reduces the Cooldown of all Mysticism Spells.' },
};

// Curios by talent ID. The mod's Chinese names are internal ones; they were matched to the in-game
// Chinese names (gamersky curio list) and then to the English names/effects on the Fextralife
// "Curios" page (cross-checked with Game8). name/text are null where no match could be made.
export const CURIO_EFFECTS = {
  106002: { name: 'Tiger Tally', text: 'Upon successful hits with Light Attack Combo, moderately increases Attack for a short duration.' }, // 虎头牌
  106005: { name: null, text: null }, // 烽烟瓢: no in-game curio with a matching name or meaning found
  106007: { name: 'Glazed Reliquary', text: 'While perfect dodging, recovers a small amount of Stamina.' }, // 琉璃舍利瓶
  106008: { name: 'Wind Chime', text: 'Slightly increases movement speed.' }, // 风铃/风铎
  106012: { name: "Maitreya's Orb", text: 'Land enough successful hits on an enemy to avoid the next fatal blow.' }, // 未来珠 (Maitreya = the future Buddha)
  106014: { name: 'Jade Moon Rabbit', text: 'Slightly increases Damage Reduction; the effect is enhanced if you also equip the Gold Sun Crow.' }, // 月玉兔
  106015: { name: 'Tablet of the Three Supreme', text: 'Considerably increases Critical Hit Chance when Health is low.' }, // 三清令
  106016: { name: 'Preservation Orb', text: 'For a relatively long duration after resurrection, increases Maximum Health, Mana, and Stamina.' }, // 变颜珠 = in-game 定颜珠
  106017: { name: 'Gold Sun Crow', text: 'Slightly increases Damage Bonus; the effect is enhanced if you also equip the Jade Moon Rabbit.' }, // 日金乌
  106019: { name: 'Gold Button', text: 'Significantly increases Attack while at full Health.' }, // 金钮
  106022: { name: 'Waterward Orb', text: 'Considerably increases Defense when in water.' }, // 银水珠 = in-game 避水珠 (only water-themed orb)
  106023: { name: 'Amber Prayer Beads', text: 'Moderately increases the speed of building up Focus Points.' }, // 琥珀金珠 = in-game 琥珀念珠
  106025: { name: null, text: null }, // 魔骷房子: no in-game curio with a matching name or meaning found
  106026: { name: 'Celestial Birthstone Fragment', text: "Ignores the enemy's Four Banes Resistance." }, // 山峰石片 = in-game 仙胞石片
  106028: { name: 'Mani Bead', text: 'In Chilled State, moderately increases Critical Hit Chance.' }, // 摩尼珠
  106030: { name: 'Boshan Censer', text: 'Grants considerable Damage Reduction when Gourd Use is depleted.' }, // 槐山炉 = in-game 博山炉
  106031: { name: 'Auspicious Lantern', text: 'Inflicts chants-beguiled effect to the bearer in Cloud Step. Moderately increases Attack, but massively reduces Maximum Health.' }, // 吉祥灯
  106033: { name: 'Virtuous Bamboo Engraving', text: 'Slightly increases Might recovery rate.' }, // 君子牌
  106035: { name: null, text: null }, // second 君子牌 in the mod's list; ambiguous duplicate of 106033, left unmapped
};
