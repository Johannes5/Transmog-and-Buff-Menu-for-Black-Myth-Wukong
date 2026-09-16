# Black Myth: Wukong - Gourd Soaks and Drinks (research)

Compiled 2026-09-16 from the English wikis (Fextralife, Game8, Fandom via search snippets), Chinese sources (gamersky, biligame BWIKI) and two community GitHub repos. No code was changed.

Notes on the request:

- "Loong Aura" and "Tiger Subduing Pellet" are **not** soaks. They are medicines: 伏虎丸 / Tiger Subduing Pellets (item ID 2227), 聚珍伏虎丸 / Enhanced Tiger Subduing Pellets (2253), 龙光倍力丸 / Loong Aura Amplification Pellets (2245). "Goji Shoots" (血杞子) and "Breath of Fire" (十二重楼胶) are real soaks.
- Base game: 27 soaks, 17 drinks. The Dec-2024 "Gauntlet of Legends" (连战) update added 2 soaks and 1 drink, so the current totals are **29 soaks / 18 drinks**.
- English effect text is quoted from the Fextralife per-item pages (Game8's list page shows flavour text, not effects). Chinese effect text is quoted from gamersky (drinks) and biligame BWIKI (soaks); BWIKI entries that contain concrete numbers (e.g. "+2秒", "20%") appear to be editor-annotated versions of the in-game text and are marked with `*`.
- `id` = game-internal item ID from `ItemDesc.data` (see section 3). `slots` = number of soak slots for drinks.

## 1. Soaks (泡酒物)

```jsonc
[
  { "id": 2301, "en": "Guanyin's Willow Leaf", "zh": "净瓶柳叶", "rarity": "神珍",
    "effect_en": "Upon resurrection in battle, recovers gourd uses.",
    "effect_zh": "打斗中还魂后，恢复葫芦相应饮过的盛酒量",
    "source": "Purchased from Shen Monkey in New Game Plus. / 二周目申猴处购买" },
  { "id": 2302, "en": "Flower Primes", "zh": "百花蕤", "rarity": "神珍",
    "effect_en": "Using the gourd removes all Four Bane States.",
    "effect_zh": "饮酒后，消除身处的所有异常状态",
    "source": "Purchased from Shen Monkey in Chapter 6. / 申猴处购买（第六回）" },
  { "id": 2303, "en": "Turtle Tear", "zh": "龟泪", "rarity": "特品",
    "effect_en": "Use the gourd at full health recovers a moderate amount of Mana.",
    "effect_zh": "生命饱满时饮酒，可恢复少许法力",
    "source": "Ch.3 Bitter Lake, North Shore: follow the shoreline, defeat Apramana Bat, interact with the skeleton, return to the giant turtle. / 小西天，击败无量蝠后获得" },
  { "id": 2304, "en": "Stranded Loong's Whisker", "zh": "困龙须", "rarity": "特品",
    "effect_en": "Using the gourd moderately extends the duration of the next Immobilize Spell for a short duration.",
    "effect_zh": "饮酒后一定时间内，下次定身法的维持时间+2秒 *",
    "source": "Ch.3 Snowhill Path, Mirrormere: after Kang-Jin Loong, small island with a gnarled tree on the frozen lake (turtle chest). / 小西天照鉴湖边桌上盒子" },
  { "id": 2305, "en": "Mount Lingtai Seedlings", "zh": "灵台药苗", "rarity": "特品",
    "effect_en": "Using the gourd moderately extends the duration of Duplicates for the next A Pluck of Many for a short duration.",
    "effect_zh": "饮酒后一定时间内，少许延长下次使出身外身法时，毛猴的维持时间",
    "source": "Ch.5 Woods of Ember, Camp of Seasons: cross two bridges, golden turtle container on the right. / 火焰山春秋寨到灰烬台路旁凉亭盒子" },
  { "id": 2306, "en": "Breath of Fire", "zh": "十二重楼胶", "rarity": "特品",
    "effect_en": "Using the gourd significantly increases Attack for the next Unveiling Strike in Cloud Step for a short duration.",
    "effect_zh": "饮酒后10秒内，增加20%攻击至下次聚形散气破隐一击 *",
    "source": "Ch.3 Bitter Lake, Turtle Island: chest after defeating Cyan Loong (secret boss, Four Loongs quest). / 四渎神龙支线，击败青背龙后宝箱" },
  { "id": 2307, "en": "Celestial Lotus Seeds", "zh": "瑶池莲子", "rarity": "上品",
    "effect_en": "For a brief moment after using the gourd, slowly recovers a small amount of health.",
    "effect_zh": "饮酒后短时间内，缓缓恢复些微生命",
    "source": "Bought from Shen Monkey from Chapter 3. / 申猴处购买" },
  { "id": 2308, "en": "Undying Vine", "zh": "不老藤", "rarity": "上品",
    "effect_en": "After using the gourd, instantly recovers a great amount of Stamina and increases Stamina recovery rate for a short duration.",
    "effect_zh": "饮酒后，立刻恢复大量气力；并在一定时间内，增加气力恢复速度",
    "source": "Ch.4 Purple Cloud Mountain, Valley of Blooms: random drop from Lushleaf (tree) enemies. / 盘丝岭紫云山击败树人青冉冉后概率获得" },
  { "id": 2309, "en": "Tiger Relic", "zh": "虎舍利", "rarity": "上品",
    "effect_en": "Using the gourd moderately increases Critical Hit Chance for a short duration.",
    "effect_zh": "饮酒后一定时间内，少许增加暴击率",
    "source": "Ch.2 Crouching Tiger Temple, Temple Entrance: hidden cellar (needs Sterness of Stone / after Tiger Vanguard and Stone Vanguard). / 黄风岭卧虎寺滑沙处大跳抵达桌子盒子" },
  { "id": 2310, "en": "Laurel Buds", "zh": "梭罗琼芽", "rarity": "上品",
    "effect_en": "Using the gourd moderately increases Damage Reduction for a short duration.",
    "effect_zh": "饮酒后一定时间内，增加10%伤害减免，持续15秒 *",
    "source": "Ch.2 Sandgate Village, Village Entrance: container by the statue past Lang-Li-Guhh-Baw, guarded by a shaman rat. / 黄风岭沙门村佛像前盒子" },
  { "id": 2311, "en": "Sweet Ice", "zh": "甜雪", "rarity": "良品",
    "effect_en": "Using the gourd moderately increases Chill Resistance for a short duration.",
    "effect_zh": "饮酒后一定时间内，少许增加寒冻耐性",
    "source": "Ch.3 New Thunderclap Temple: small golden turtle container, drop down from the Monk From the Sea courtyard. / 小西天小雷音寺泥塑菩萨附近六角凉亭盒子" },
  { "id": 2312, "en": "Thunderbolt Horn", "zh": "霹雳角", "rarity": "良品",
    "effect_en": "Using the gourd moderately increases Shock resistance for a short duration.",
    "effect_zh": "饮酒后一定时间内，少许增加雷蛰耐性",
    "source": "Bought from Shen Monkey from Chapter 3. / 申猴处购买" },
  { "id": 2313, "en": "Deathstinger", "zh": "倒马毒钩", "rarity": "上品",
    "effect_en": "After using the gourd, inflicts weak Poisoned State to the Destined One himself.",
    "effect_zh": "饮酒后一定时间内，使自身处于毒伤状态",
    "source": "Ch.4 Webbed Hollow, Verdure Bridge village: defeat the Scorpion Prince spirit. / 盘丝洞花间桥村落，击败蝎太子后获得" },
  { "id": 2314, "en": "Purple-Veined Peach Pit", "zh": "紫纹缃核", "rarity": "上品",
    "effect_en": "Massively increases the Health recovery from using the gourd when at Critical Health.",
    "effect_zh": "生命危急时饮酒，大大增加生命恢复量",
    "source": "Ch.4 The Verdure Bridge: turn left from the shrine, room with 5 golden chests after the knife-throwing cutscene. / 盘丝洞花间桥"大喜"门后棺材" },
  { "id": 2315, "en": "Bee Mountain Stone", "zh": "蜂山石髓", "rarity": "上品",
    "effect_en": "When using the gourd, grants a considerable chance to take a sip without consuming gourd uses.",
    "effect_zh": "饮酒时，有一定概率不消耗葫芦中的酒量",
    "source": "Ch.4 Temple of the Yellow Flowers, Mountain Trail: upstairs, turn left, golden container guarded by monks. / 盘丝岭黄花观山道，石栅栏前盒子" },
  { "id": 2316, "en": "Iron Pellet", "zh": "铁弹", "rarity": "上品",
    "effect_en": "Using the gourd can no longer be interrupted by incoming attacks and now provides considerable Damage Reduction.",
    "effect_zh": "饮酒时，不会被对手打断，且获得一定伤害减免",
    "source": "Ch.2: bought from Man-in-Stone (6480 Will) after his side quest. / 黄风岭石中人处购买" },
  { "id": 2317, "en": "Slumbering Beetle Husk", "zh": "瞌睡虫蜕", "rarity": "特品",
    "effect_en": "After using the gourd, moderately reduces Cooldown for all Spells, but impairs movement for a short duration.",
    "effect_zh": "饮酒后少许减少所有法术的回转时间，但一定时间内会艰难行走",
    "source": "Ch.5 Furnace Valley, The Emerald Hall: golden turtle container after Yin-Yang Fish. / 火焰山翠云殿盒子" },
  { "id": 2318, "en": "Copper Pill", "zh": "铜丸", "rarity": "特品",
    "effect_en": "After using the gourd, the next Rock Solid cast costs no mana for a short duration",
    "effect_zh": "饮酒后一定时间内，下次铜头铁臂不消耗法力",
    "source": "Ch.2 Crouching Tiger Temple: small gold chest on the path after Tiger Vanguard (shield enemy + archer). / 黄风岭定风桥土地庙附近盒子" },
  { "id": 2319, "en": "Goji Shoots", "zh": "血杞子", "rarity": "特品",
    "effect_en": "Using the gourd moderately extends the duration of the next Ring of Fire for a short duration.",
    "effect_zh": "饮酒后一定时间内，少许延长下次安身法的持续时间",
    "source": "Ch.4 Webbed Hollow, Upper Hollow: left path from the shrine, last building in the corner, upstairs golden container. / 盘丝岭，盘丝洞上层往上走两层进入房间" },
  { "id": 2320, "en": "Fruit of Dao", "zh": "清虚道果", "rarity": "上品",
    "effect_en": "Using the gourd moderately extends the duration of Invincibility upon executing a Dodge for a short duration.",
    "effect_zh": "饮酒后一定时间内，少许延长闪避的无敌时间",
    "source": "Ch.4 Court of Illumination / Purple Cloud Mountain: random drop from the blue/yellow-robed Daoist monks. / 盘丝岭紫云山击败黄袍拂尘道士或御剑道士后概率获得" },
  { "id": 2321, "en": "Flame Mediator", "zh": "火焰丹头", "rarity": "良品",
    "effect_en": "Using the gourd moderately increases Burn Resistance for a short duration.",
    "effect_zh": "饮酒后一定时间内，少许增加火焚耐性",
    "source": "Ch.5: random drop from the fire rock enemies near Flint Vanguard / Furnace Valley entrance. / 火焰山丹灶谷谷口刷红石头怪掉落" },
  { "id": 2322, "en": "Double-Combed Rooster Blood", "zh": "双冠血", "rarity": "上品",
    "effect_en": "Using the gourd while in Poisoned State removes the Poisoned State and moderately increase Movement Speed and Critical Hit Chance.",
    "effect_zh": "饮酒时若处于毒伤状态，消解毒伤状态且少许增加移动速度和暴击率",
    "source": "Ch.4 Purple Cloud Mountain (secret area): dropped by Duskveil. / 盘丝岭紫云山击败晦月魔君后获得" },
  { "id": 2323, "en": "Gall Gem", "zh": "胆中珠", "rarity": "良品",
    "effect_en": "Using the Gourd moderately increases Poison Resistance for a short duration.",
    "effect_zh": "饮酒后一定时间内，少许增加毒伤耐性",
    "source": "Ch.1 Bamboo Grove, Marsh of White Mist: defeat the snake enemy next to Shen Monkey. / 黑云山救申猴时击败蛇巡司后获得" },
  { "id": 2324, "en": "Graceful Orchid", "zh": "蕙性兰", "rarity": "特品",
    "effect_en": "Using the gourd slowly recovers a small amount of Health for a short duration.",
    "effect_zh": "饮酒后一定时间内，缓缓恢复些微生命",
    "source": "Reward from Chen Loong (Zodiac Village) after handing in all 15 seed types. / 集齐全部种子交给六六村辰龙" },
  { "id": 2325, "en": "Tender Jade Lotus", "zh": "嫩玉藕", "rarity": "上品",
    "effect_en": "Using the gourd slightly increases a small amount of Defense for a short duration.",
    "effect_zh": "饮酒后一定时间内，少许增加防御",
    "source": "Random harvest when picking Jade Lotus plants (e.g. Ch.1 Black Wind Cave). / 采集碧藕概率获得" },
  { "id": 2326, "en": "Steel Ginseng", "zh": "铁骨银参", "rarity": "上品",
    "effect_en": "Upon using the gourd, instantly gains a moderate amount of Focus.",
    "effect_zh": "饮酒时，立刻获得30棍势 *",
    "source": "Random harvest when picking Aged Ginseng (e.g. Ch.2 near Man-in-Stone). / 采集人参概率获得" },
  { "id": 2327, "en": "Goat Skull", "zh": "青山骨", "rarity": "上品",
    "effect_en": "Using the gourd moderately increases Maximum Health for a short duration.",
    "effect_zh": "饮酒后一定时间内，少许增加生命上限",
    "source": "Random harvest when picking Licorice (Ch.2 Yellow Wind Ridge / Kingdom of Sahali). / 采集甘草概率获得" },

  // Added in the Gauntlet of Legends (连战) update, v1.0.12 (Dec 2024)
  { "id": 2328, "en": "Frost-Enduring Chrysanth", "zh": "九秋菊", "rarity": "仙品",
    "effect_en": "Using gourd in low Mana restores a moderate amount of Qi.",
    "effect_zh": "饮酒时若法力不足，恢复少许元气。",
    "source": "Gauntlet of Legends: clear the \"Four Monks\" challenge. / 连战·四僧（不净、不空、不能、不白）通关奖励" },
  { "id": 2329, "en": "Robust Antler", "zh": "肉角", "rarity": "仙品",
    "effect_en": "Using gourd when Mana is depleted moderately increases Attack for a short duration.",
    "effect_zh": "饮酒时若法力耗尽，一定时间内少许增加攻击。",
    "source": "Gauntlet of Legends: clear the \"Collective Strength\" challenge. / 连战·万样骁凶通关奖励" }
]
```

## 2. Drinks (酒)

```jsonc
[
  { "id": 2001, "en": "Coconut Wine", "zh": "椰子酒", "rarity": "凡品", "slots": 1,
    "effect_en": "Each sip restores 33% of maximum health.",
    "effect_zh": "每饮一口，恢复当前上限三成三分的生命；酒越陈，恢复越多。",
    "source": "Starting drink." },
  { "id": 2002, "en": "3-Year-Old Coconut Wine", "zh": "椰子酒·三年陈", "rarity": "良品", "slots": 1,
    "effect_en": "Each sip recovers 36% of Maximum Health; the older the wine, the greater the recovery.",
    "effect_zh": "每饮一口，恢复当前上限三成六分的生命；酒越陈，恢复越多。",
    "source": "Upgrade Coconut Wine at Shen Monkey (Awaken Wine Worm x1)." },
  { "id": 2003, "en": "5-Year-Old Coconut Wine", "zh": "椰子酒·五年陈", "rarity": "上品", "slots": 1,
    "effect_en": "Each sip recovers 40% of Maximum Health; the older the wine, the greater the recovery.",
    "effect_zh": "每饮一口，恢复当前上限四成的生命；酒越陈，恢复越多。",
    "source": "Upgrade 3-Year-Old (Awaken Wine Worm x1)." },
  { "id": 2004, "en": "10-Year-Old Coconut Wine", "zh": "椰子酒·十年陈", "rarity": "特品", "slots": 2,
    "effect_en": "Each sip recovers 43% of Maximum Health; the older the wine, the greater the recovery.",
    "effect_zh": "每饮一口，恢复当前上限四成三分的生命；酒越陈，恢复越多。",
    "source": "Upgrade 5-Year-Old (Awaken Wine Worm x1)." },
  { "id": 2005, "en": "18-Year-Old Coconut Wine", "zh": "椰子酒·十八年陈", "rarity": "特品", "slots": 2,
    "effect_en": "Each sip recovers 46% of Maximum Health; the older the wine, the greater the recovery.",
    "effect_zh": "每饮一口，恢复当前上限四成六分的生命；酒越陈，恢复越多。",
    "source": "Upgrade 10-Year-Old (Awaken Wine Worm x2)." },
  { "id": 2006, "en": "30-Year-Old Coconut Wine", "zh": "椰子酒·三十年陈", "rarity": "仙品", "slots": 2,
    "effect_en": "Each sip recovers 49% of Maximum Health; the older the wine, the greater the recovery.",
    "effect_zh": "每饮一口，恢复当前上限四成九分的生命；酒越陈，恢复越多。",
    "source": "Upgrade 18-Year-Old (Awaken Wine Worm x2)." },
  { "id": 2007, "en": "Monkey Brew", "zh": "猴儿酿", "rarity": "神珍", "slots": 3,
    "effect_en": "Each sip recovers 50% of Maximum Health; the older the wine, the greater the recovery.",
    "effect_zh": "每饮一口，恢复当前上限五成的生命。",
    "source": "Upgrade 30-Year-Old (Awaken Wine Worm x3)." },
  { "id": 2021, "en": "Jade Dew", "zh": "玉液", "rarity": "神珍", "slots": 3,
    "effect_en": "Each sip recovers 55% of Maximum Health.",
    "effect_zh": "每饮一口，恢复当前上限五成半的生命",
    "source": "Upgrade Monkey Brew (Awaken Wine Worm x5; needs NG+ worm count)." },
  { "id": 2010, "en": "Lambbrew", "zh": "羔儿酿", "rarity": "上品", "slots": 1,
    "effect_en": "Each sip instantly recovers 20% of maximum health. For a brief moment after, slowly recovers 25% of maximum health",
    "effect_zh": "每饮一口，立刻恢复当前上限两成的生命；其后片时内，持续缓慢恢复两成半的生命。",
    "source": "Ch.2 Sandgate Village: before the Village Entrance shrine, climb the rat-archer hill to the altar. / 黄风岭起始点河右侧山上" },
  { "id": null, "en": "Dry Spirit", "zh": "干和烧", "rarity": "仙品", "slots": 2,
    "effect_en": "Each sip instantly recovers 18% of Maximum Health, and for a brief moment, slowly recovers 48% of Maximum Health",
    "effect_zh": "每饮一口，立刻恢复当前上限一成八分的生命；其后片时内，持续缓慢恢复四成八分的生命",
    "source": "Upgrade Lambbrew at Shen Monkey (Awaken Wine Worm x5). ID not present in any source; by elimination it is one of 2008 / 2013-2018." },
  { "id": 2009, "en": "Bluebridge Romance", "zh": "蓝桥风月", "rarity": "仙品", "slots": 3,
    "effect_en": "Each sip recovers 36% of maximum health. Moderately increases Movement Speed.",
    "effect_zh": "每饮一口，恢复当前上限三成六分的生命；少许增加移动速度",
    "source": "Ch.3 Bitter Lake, North Shore: golden vase in the lake by the coastal temple (heart-shaped rock). / 小西天苦海北岸，庙旁湖中石上" },
  { "id": 2019, "en": "Jade Essence", "zh": "琼浆", "rarity": "仙品", "slots": 2,
    "effect_en": "Each sip recovers 36% of maximum health and a moderate of Mana.",
    "effect_zh": "每饮一口，恢复当前上限三成六分的生命，并恢复少许法力。",
    "source": "Ch.3 Valley of Ecstasy, Towers of Karma: behind the stone pillar / tower near the Old Ginseng Guai. / 罪业塔林土地庙，老人参精身后塔后桌上" },
  { "id": 2022, "en": "Pinebrew", "zh": "松醪", "rarity": "特品", "slots": 2,
    "effect_en": "Each sip recovers 35% of maximum health. When Health is below half, using the gourd grants a considerable amount of Focus.",
    "effect_zh": "每饮一口，恢复当前上限三成半的生命；生命过半时饮酒，还会获得棍势。",
    "source": "Bought from Shen Monkey after Chapter 3 (Yellowbrow). / 击败黄眉后申猴处购买" },
  { "id": 2011, "en": "Worryfree Brew", "zh": "无忧醑", "rarity": "仙品", "slots": 2,
    "effect_en": "Each sip recovers 24% of maximum health; when at Critical health, massively increases the recovery.",
    "effect_zh": "每饮一口，恢复当前上限两成四分的生命；当生命危急时，大大增加恢复量。",
    "source": "Ch.4 Webbed Hollow, Verdure Bridge village: break the cocoons in the house left of the purple altar, interact with the tea kettle. / 盘丝洞花间桥，门前挂两只利爪茧的房子内" },
  { "id": 2023, "en": "Sunset of the Nine Skies", "zh": "九霞清醑", "rarity": "仙品", "slots": 3,
    "effect_en": "Each sip recovers 35% of maximum health, grants a considerable amount of Qi.",
    "effect_zh": "每饮一口，恢复当前上限三成半的生命；获得一定量元气",
    "source": "Ch.4 Temple of Yellow Flowers, Court of Illumination: up the stairs, right at the split, hut table near the mushroom girl. / 黄花观金光苑，蘑女后桌上" },
  { "id": 2012, "en": "Loong Balm", "zh": "龙膏", "rarity": "神珍", "slots": 4,
    "effect_en": "Each sip recovers 30% of maximum health, considerably increases Damage executed by the next attack.",
    "effect_zh": "每饮一口，恢复当前上限三成的生命；一定程度增加下次攻击造成的伤害",
    "source": "Ch.5 Furnace Valley, Emerald Hall: on the dais next to the throne after Yin-Yang Fish. / 翠云殿，击败火焰山土地后大殿台子上" },
  { "id": 2020, "en": "A Thousand Days Inebriation", "zh": "千日醉", "rarity": "神珍", "slots": 3,
    "effect_en": "Each sip recovers 60% of maximum health, but for a brief moment, inebriation impairs movement.",
    "effect_zh": "每饮一口，恢复当前上限六成的生命，但会因醉酒踉跄片时。",
    "source": "Bought from Shen Monkey once Chapter 6 is unlocked. / 解锁第六回后申猴处购买" },

  // Added in the Gauntlet of Legends (连战) update
  { "id": 2024, "en": "Sour Wine", "zh": "苦酒", "rarity": "仙品", "slots": 3,
    "effect_en": "Each sip restores 24% of Maximum Health; for a short duration, increases the Stamina cost of all actions, but enhances the Damage dealt by all charged Heavy Attacks and Varied Combos.",
    "effect_zh": "每饮一口，恢复当前上限两成四分的生命，一定时间内增加所有动作的气力消耗，但也增加所有蓄力重棍和切手技造成的伤害。",
    "source": "Gauntlet of Legends: clear the \"Shadowy Assembly\" challenge (1 per cycle, max 3). / 连战·蛰虫始振通关奖励" }
]
```

Upgrade chain: 椰子酒 2001 -> 2002 -> 2003 -> 2004 -> 2005 -> 2006 -> 猴儿酿 2007 -> 玉液 2021; 羔儿酿 2010 -> 干和烧 (id unknown). Awaken Wine Worm = 三冬虫.

## 3. Item IDs

**Found.** Two independent community sources agree.

1. `nitingururajk/black-myth-wukong-achievement-tracker` - `SOAK_ID_MAPPING_METHODOLOGY.md` documents extracting `b1/Content/00Main/PBTable/Runtime/AchievementDesc.data` and `ItemDesc.data` (pakchunk16, 952 item rows) with CUE4Parse (`EGame.GAME_BlackMythWukong`, AES key `0xA896068444F496956900542A215367688B49B19C2537FCD2743D8585BA1EB128`) and parsing them with the game's own `Protobuf.RunTime.dll` (`ResB1.TBItemDesc`, `ResB1.TBWineDesc`, `ResB1.TBAchievementDesc`). Achievement 81078 "Brewer's Bounty" (`RequirementType == ProgressGainItem`) lists exactly the 27 base soaks as the consecutive IDs **2301-2327**; the Chinese names attached to each ID are the ones in section 1. `AchievementPlanner.cs` also holds the 8 non-default drink IDs for achievement 81064 "Brews and Barrels" (2009, 2010, 2011, 2012, 2019, 2020, 2022, 2023) and the 9 gourd IDs for 81076 "Gourds Gathered" (18007, 18009, 18011-18017).
2. `xyzkljl1/MyBlackMythWukongMods` - `CSharpMods/EffectDetailDescription/Data.cs`, dictionary `ItemEffectDesc`, keyed by item ID with a `//中文/English` comment per entry. It confirms every soak ID above plus the two Gauntlet soaks (2328 九秋菊, 2329 肉角), the coconut chain 2001-2007, 2021 玉液, and 2024 苦酒. Comments also mention related buff/passive IDs (e.g. soak 2304 -> Buff 92304 / Passive 192, 2319 -> 92319 / Passive 198, 2320 -> 92320 / Passive 199, Sour Wine -> buffs 92027+92028), i.e. a soak's buff entry is `90000 + itemId`.

ID layout observed:

| Range | Category | Notes |
| --- | --- | --- |
| 2001-2024 | Drinks (WineDesc / ItemDesc) | 2001-2007 coconut line + Monkey Brew; 2009-2012, 2019-2023 other drinks; 2024 Sour Wine. 2008, 2013-2018 unaccounted for (Dry Spirit must be one of them; the rest are probably unused/cut). |
| 2204-2254 | Medicines (powders 2204-2213, pills/decoctions 2215-2254) | e.g. 2227 Tiger Subduing Pellets, 2245 Loong Aura Amplification Pellets. Recipes (formulas) use 1xxx (`1118` etc.). |
| 2301-2327 | Base-game soaks | Consecutive, order in section 1. |
| 2328-2329 | Gauntlet update soaks | Frost-Enduring Chrysanth, Robust Antler. |
| 18007-18017 | Gourds | 18007 Xiang River Goddess, 18009 Trailblazer's Scarlet, 18011 Qing-Tian, 18012 Plaguebane, 18013 Stained Jade, 18014 Immortal Blessing, 18015 Multi-Glazed, 18016 Jade Lotus, 18017 Fiery. |
| 810xx | Achievements | 81064 Brews and Barrels, 81076 Gourds Gathered, 81078 Brewer's Bounty. |

**Not found:** a public Cheat Engine table with a soak/drink ID list. The FearLess Revolution thread "Black Myth Wukong Item Count Pointer" (t=30894) has an item-ID header and posts in the 104xx range (skills/transformations) but no consumable IDs on the pages checked (1, 2, 3 of 11); the biligame and gamersky pages carry no IDs.

## Sources

- Fextralife Soaks list: https://blackmythwukong.wiki.fextralife.com/Soaks (and per-item pages, e.g. https://blackmythwukong.wiki.fextralife.com/Bee+Mountain+Stone, .../Goji+Shoots, .../Breath+Of+Fire, .../Turtle+Tear)
- Fextralife Drinks list: https://blackmythwukong.wiki.fextralife.com/Drinks (and https://blackmythwukong.wiki.fextralife.com/Coconut+Wine)
- Fextralife medicines (not soaks): https://blackmythwukong.wiki.fextralife.com/Tiger+Subduing+Pellets , https://blackmythwukong.wiki.fextralife.com/Enhanced+Tiger+Subduing+Pellets
- Game8 List of All Drinks and Soaks: https://game8.co/games/Black-Myth-Wukong/archives/468469
- Fandom (blocked for direct fetch; used via search snippets): https://blackmythwukong.fandom.com/wiki/Soaks , https://blackmythwukong.fandom.com/wiki/Drinks , https://blackmythwukong.fandom.com/wiki/Sour_Wine , https://blackmythwukong.fandom.com/wiki/Frost-Enduring_Chrysanth , https://blackmythwukong.fandom.com/wiki/Robust_Antler , https://blackmythwukong.fandom.com/wiki/Gauntlet_of_Legends
- gamerant all soaks: https://gamerant.com/black-myth-wukong-all-soaks-how-to-get-them/ ; PowerPyx: https://www.powerpyx.com/black-myth-wukong-all-soaks-locations/
- gamersky 泡酒物 summary (葫芦与行囊道具全收集攻略): https://www.gamersky.com/handbook/202409/1817792_3.shtml ; 全泡酒物图鉴: https://www.gamersky.com/handbook/202409/1815086.shtml
- gamersky 酒品 summary: https://www.gamersky.com/handbook/202409/1817792_2.shtml ; 全酒品图鉴 (per drink pages _2 .. _17): https://www.gamersky.com/handbook/202409/1815032.shtml
- gamersky Gauntlet update items (苦酒 _5, 肉角 _6, 九秋菊 _7): https://www.gamersky.com/handbook/202412/1857649_5.shtml
- biligame BWIKI 泡酒物: https://wiki.biligame.com/wukong/%E6%B3%A1%E9%85%92%E7%89%A9 ; 酒: https://wiki.biligame.com/wukong/%E9%85%92
- GitHub nitingururajk/black-myth-wukong-achievement-tracker: https://github.com/nitingururajk/black-myth-wukong-achievement-tracker (files `SOAK_ID_MAPPING_METHODOLOGY.md`, `bmw_web/Services/AchievementPlanner.cs`, branch master)
- GitHub xyzkljl1/MyBlackMythWukongMods: https://github.com/xyzkljl1/MyBlackMythWukongMods (file `CSharpMods/EffectDetailDescription/Data.cs`)
- FearLess Revolution CE thread: https://fearlessrevolution.com/viewtopic.php?t=30894 ; GuidedHacking table: https://guidedhacking.com/resources/black-myth-wukong-cheat-engine-table.1321/
- Gauntlet of Legends update coverage (Sour Wine / Frost-Enduring Chrysanth / Robust Antler): https://techraptor.net/gaming/news/black-myth-wukong-update-boss-rush
