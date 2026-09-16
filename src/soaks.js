// Gourd soaks (泡酒物). In the game a soak is a consumable (item IDs 2301-2329) whose effect is a set
// of buffs the game adds when a gourd drink ends (ConsumeDesc effects). TransmogKeeper v1.6+ listens
// for the drink-end event and adds the buffs of every soak in keeperSoaks, so a soak from the tool
// behaves like a slotted one: only on a drink, for the buff's own duration (names, texts and sources
// in docs/soaks-research.md).
//
//   note: 'drink' = in game this soak only fires under an extra condition (resurrection, full health,
//         a chance, ...); from the tool it fires on every drink.
//         'instant' = a one-off effect per drink (Focus, Mana), same as in game.
export const SOAKS = [
  { id: 2301, name: "Guanyin's Willow Leaf", zh: '净瓶柳叶', text: 'Upon resurrection in battle, recovers gourd uses.', note: 'drink' },
  { id: 2302, name: 'Flower Primes', zh: '百花蕤', text: 'Using the gourd removes all Four Bane States.', note: 'drink' },
  { id: 2303, name: 'Turtle Tear', zh: '龟泪', text: 'Using the gourd at full health recovers a moderate amount of Mana.', note: 'instant' },
  { id: 2304, name: "Stranded Loong's Whisker", zh: '困龙须', text: 'Using the gourd moderately extends the duration of the next Immobilize Spell for a short duration.' },
  { id: 2305, name: 'Mount Lingtai Seedlings', zh: '灵台药苗', text: 'Using the gourd moderately extends the duration of Duplicates for the next A Pluck of Many for a short duration.' },
  { id: 2306, name: 'Breath of Fire', zh: '十二重楼胶', text: 'Using the gourd significantly increases Attack for the next Unveiling Strike in Cloud Step for a short duration.' },
  { id: 2307, name: 'Celestial Lotus Seeds', zh: '瑶池莲子', text: 'For a brief moment after using the gourd, slowly recovers a small amount of Health.' },
  { id: 2308, name: 'Undying Vine', zh: '不老藤', text: 'After using the gourd, instantly recovers a great amount of Stamina and increases Stamina recovery rate for a short duration.' },
  { id: 2309, name: 'Tiger Relic', zh: '虎舍利', text: 'Using the gourd moderately increases Critical Hit Chance for a short duration.' },
  { id: 2310, name: 'Laurel Buds', zh: '梭罗琼芽', text: 'Using the gourd moderately increases Damage Reduction for a short duration.' },
  { id: 2311, name: 'Sweet Ice', zh: '甜雪', text: 'Using the gourd moderately increases Chill Resistance for a short duration.' },
  { id: 2312, name: 'Thunderbolt Horn', zh: '霹雳角', text: 'Using the gourd moderately increases Shock Resistance for a short duration.' },
  { id: 2313, name: 'Deathstinger', zh: '倒马毒钩', text: 'After using the gourd, inflicts weak Poisoned State on the Destined One himself.' },
  { id: 2314, name: 'Purple-Veined Peach Pit', zh: '紫纹缃核', text: 'Massively increases the Health recovery from using the gourd when at Critical Health.', note: 'drink' },
  { id: 2315, name: 'Bee Mountain Stone', zh: '蜂山石髓', text: 'When using the gourd, grants a considerable chance to take a sip without consuming gourd uses.', note: 'drink' },
  { id: 2316, name: 'Iron Pellet', zh: '铁弹', text: 'Using the gourd can no longer be interrupted by incoming attacks and provides considerable Damage Reduction while drinking.', note: 'drink' },
  { id: 2317, name: 'Slumbering Beetle Husk', zh: '瞌睡虫蜕', text: 'After using the gourd, moderately reduces the Cooldown of all Spells, but impairs movement for a short duration.' },
  { id: 2318, name: 'Copper Pill', zh: '铜丸', text: 'After using the gourd, the next Rock Solid cast costs no Mana for a short duration.' },
  { id: 2319, name: 'Goji Shoots', zh: '血杞子', text: 'Using the gourd moderately extends the duration of the next Ring of Fire for a short duration.' },
  { id: 2320, name: 'Fruit of Dao', zh: '清虚道果', text: 'Using the gourd moderately extends the duration of Invincibility upon executing a Dodge for a short duration.' },
  { id: 2321, name: 'Flame Mediator', zh: '火焰丹头', text: 'Using the gourd moderately increases Burn Resistance for a short duration.' },
  { id: 2322, name: 'Double-Combed Rooster Blood', zh: '双冠血', text: 'Using the gourd while in Poisoned State removes the Poisoned State and moderately increases Movement Speed and Critical Hit Chance.' },
  { id: 2323, name: 'Gall Gem', zh: '胆中珠', text: 'Using the gourd moderately increases Poison Resistance for a short duration.' },
  { id: 2324, name: 'Graceful Orchid', zh: '蕙性兰', text: 'Using the gourd slowly recovers a small amount of Health for a short duration.' },
  { id: 2325, name: 'Tender Jade Lotus', zh: '嫩玉藕', text: 'Using the gourd slightly increases Defense for a short duration.' },
  { id: 2326, name: 'Steel Ginseng', zh: '铁骨银参', text: 'Upon using the gourd, instantly gains a moderate amount of Focus.', note: 'instant' },
  { id: 2327, name: 'Goat Skull', zh: '青山骨', text: 'Using the gourd moderately increases Maximum Health for a short duration.' },
  { id: 2328, name: 'Frost-Enduring Chrysanth', zh: '九秋菊', text: 'Using the gourd when low on Mana restores a moderate amount of Qi.', note: 'instant' },
  { id: 2329, name: 'Robust Antler', zh: '肉角', text: 'Using the gourd when Mana is depleted moderately increases Attack for a short duration.' },
];

export const soakById = (id) => SOAKS.find((s) => s.id === id);
