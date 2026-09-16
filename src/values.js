// "Custom values": the mod's numeric settings (TrueWukongConfig.txt) with descriptions and a note on
// who honours them, plus keeper-only attribute overrides (keeperAttr line) for trainer-like changes.
//
// `applies` tells where a value works:
//   full   True Wukong itself, in full mode (hooks)
//   lite   TransmogKeeper, in lite mode (no hooks), v1.3+
// Regen values and wukongSpeed are honoured in both modes (in full mode both would apply, so the
// keeper only runs them when True Wukong's hooks are off - see README).

export const VALUE_GROUPS = ['Regeneration', 'Multipliers', 'Cooldowns', 'Timing', 'Misc'];

// `def` is the value with no effect (what the release ships); "reset" in the menu writes it back.
export const isDefault = (v, raw) => raw === undefined || parseFloat(raw) === parseFloat(v.def);

export const VALUES = [
  { key: 'healthRegen', def: '0', group: 'Regeneration', label: 'Health regeneration', desc: 'Health added every regenInterval seconds (0 = off).', applies: ['full', 'lite'] },
  { key: 'manaRegen', def: '0', group: 'Regeneration', label: 'Mana regeneration', desc: 'Mana (the spell resource) added every regenInterval seconds (0 = off).', applies: ['full', 'lite'] },
  { key: 'spiritRegen', def: '0', group: 'Regeneration', label: 'Qi regeneration (spirit-skill energy)', desc: 'Qi added every regenInterval seconds (0 = off). The mod calls this "spirit"; in game it is the Qi bar that Spirit Skills use.', applies: ['full', 'lite'] },
  { key: 'vesselRegen', def: '0', group: 'Regeneration', label: 'Vessel regeneration', desc: 'Vessel energy added every regenInterval seconds (0 = off).', applies: ['full', 'lite'] },
  { key: 'regenInterval', def: '2', group: 'Regeneration', label: 'Regeneration interval (s)', desc: 'Seconds between regeneration ticks. Below 1.5 the health/mana bars can glitch.', applies: ['full', 'lite'] },
  { key: 'focusRegen', def: '0', group: 'Regeneration', label: 'Passive focus gain (per second)', desc: 'Focus gained per second while idle, up to 3 focus points (4 with allowPassiveFocusOvercharge).', applies: ['full', 'lite'] },
  { key: 'focusRegenTransform', def: '0', group: 'Regeneration', label: 'Extra focus gain while transformed', desc: 'Additional focus per second during a transformation.', applies: ['full'] },
  { key: 'mightRegenTransform', def: '0', group: 'Regeneration', label: 'Might gain while transformed', desc: 'Might added every regenInterval during a transformation.', applies: ['full'] },
  { key: 'gourdRefill', def: '0', group: 'Regeneration', label: 'Gourd refill interval (s)', desc: 'Seconds per one gourd charge refill (0 = off).', applies: ['full'] },
  { key: 'wukongSpeed', def: '1', group: 'Multipliers', label: 'Move speed multiplier', desc: '1 = normal. Applied once per spawn.', applies: ['full', 'lite'] },
  { key: 'attackMultiplier', def: '1', group: 'Multipliers', label: 'Attack multiplier', desc: 'Attack is multiplied by this after spawning. Press the switchModifierKey in game to swap to the Alt value.', applies: ['full'] },
  { key: 'defenseMultiplier', def: '1', group: 'Multipliers', label: 'Defense multiplier', desc: 'Defense is multiplied by this after spawning.', applies: ['full'] },
  { key: 'attackMultiplierAlt', def: '1', group: 'Multipliers', label: 'Attack multiplier (alternate)', desc: 'Second attack multiplier, toggled with switchModifierKey.', applies: ['full'] },
  { key: 'defenseMultiplierAlt', def: '1', group: 'Multipliers', label: 'Defense multiplier (alternate)', desc: 'Second defense multiplier, toggled with switchModifierKey.', applies: ['full'] },
  { key: 'ringTimer', def: '999999', group: 'Cooldowns', label: 'Ring of Fire cooldown (s)', desc: "Cooldown of the mod's Ring of Fire shortcut (Heavy+Spell1).", applies: ['full'] },
  { key: 'cloneTimer', def: '999999', group: 'Cooldowns', label: 'Pluck of Many cooldown (s)', desc: "Cooldown of the mod's Pluck of Many shortcut (Heavy+Spell3).", applies: ['full'] },
  { key: 'perfectDodgeTiming', def: '3E-2', group: 'Timing', label: 'Perfect dodge window (s)', desc: 'Seconds a roll counts as a perfect dodge. Game default 0.03.', applies: ['full'] },
  { key: 'perfectWindow', def: '1', group: 'Timing', label: 'Perfect dodge follow-up window (s)', desc: 'Seconds after a perfect dodge that allow chain extenders.', applies: ['full'] },
  { key: 'airWindow', def: '1', group: 'Timing', label: 'Air dodge follow-up window (s)', desc: 'Seconds after an air dodge that allow chain extenders.', applies: ['full'] },
  { key: 'rockDuration', def: '1', group: 'Timing', label: 'Rock Solid duration (s)', desc: 'Keep between 0.5 and 2.5.', applies: ['full'] },
  { key: 'rockManaGain', def: '15', group: 'Misc', label: 'Rock Solid mana gain on hit', desc: 'Mana gained when Rock Solid connects.', applies: ['full'] },
  { key: 'rockFocusGain', def: '50', group: 'Misc', label: 'Rock Solid focus gain on hit', desc: 'Focus gained when Rock Solid connects.', applies: ['full'] },
  { key: 'carryMax', def: '0', group: 'Misc', label: 'Item carry limit', desc: 'Maximum carried count per item (0 = game default).', applies: ['full'] },
  { key: 'lifeDrainMin', def: '0', group: 'Misc', label: 'Vampirism minimum heal (%)', desc: 'Minimum heal per hit in percent of max health when vampirism is enabled.', applies: ['full'] },
  { key: 'specialMightCost', def: '1', group: 'Misc', label: 'Might cost of special transforms', desc: 'Fraction of the Might bar needed for Dodge+SwitchStance special transforms.', applies: ['full'] },
  { key: 'loadoutSpiritCost', def: '1', group: 'Misc', label: 'Spirit cost of custom spirit system', desc: 'Fraction of the spirit bar drained by the custom spirit system or shortcuts.', applies: ['full'] },
  { key: 'binderDrainSpeed', def: '0', group: 'Misc', label: 'Sacred Purity drain speed', desc: 'Subtracted every regenInterval while Sacred Purity is active.', applies: ['full'] },
];

// Attribute overrides (keeperAttr = Name:value,...). Names are the game's EBGUAttrFloat entries.
// The keeper re-applies a value whenever the game recomputes the attribute, so these behave like a
// trainer lock. Max/current pairs: the "Max" entries are what you want for bigger bars.
export const ATTRS = [
  { name: 'HpMax', id: 1, label: 'Max health' },
  { name: 'MpMax', id: 2, label: 'Max mana (spells)' },
  { name: 'VigorEnergyMax', id: 17, label: 'Max Qi (spirit-skill energy)' },
  { name: 'TransEnergyMax', id: 11, label: 'Max Might (transformation)' },
  { name: 'StaminaMax', id: 8, label: 'Max stamina' },
  { name: 'StaminaRecover', id: 159, label: 'Stamina recovery rate' },
  { name: 'StaminaCostMultiper', id: 200, label: 'Stamina cost multiplier (1 = normal)' },
  { name: 'Atk', id: 153, label: 'Attack' },
  { name: 'Def', id: 154, label: 'Defense' },
  { name: 'CritRate', id: 161, label: 'Critical hit chance (game units, 2000 = 20%)' },
  { name: 'CritMultiplier', id: 162, label: 'Critical hit damage (game units)' },
  { name: 'DmgAddition', id: 169, label: 'Damage bonus' },
  { name: 'DmgDef', id: 170, label: 'Damage reduction' },
  { name: 'Tenacity', id: 164, label: 'Tenacity' },
  { name: 'ThunderAtk', id: 181, label: 'Thunder attack' },
  { name: 'BurnAtk', id: 179, label: 'Burn attack' },
  { name: 'FreezeAtk', id: 178, label: 'Frost attack' },
  { name: 'PoisonAtk', id: 180, label: 'Poison attack' },
  { name: 'ThunderDef', id: 185, label: 'Thunder defense' },
  { name: 'BurnDef', id: 183, label: 'Burn defense' },
  { name: 'FreezeDef', id: 182, label: 'Frost defense' },
  { name: 'PoisonDef', id: 184, label: 'Poison defense' },
  { name: 'ExpDropAddition', id: 198, label: 'Experience (Will) gain bonus' },
  { name: 'SpiritDropAddition', id: 199, label: 'Spirit drop bonus' },
  { name: 'CommDropAddition', id: 203, label: 'Item drop bonus' },
  { name: 'HpMaxMul', id: 51, label: 'Max health multiplier' },
  { name: 'MpMaxMul', id: 52, label: 'Max mana multiplier' },
  { name: 'AtkMul', id: 53, label: 'Attack multiplier' },
  { name: 'DefMul', id: 54, label: 'Defense multiplier' },
  { name: 'StaminaRecoverMul', id: 59, label: 'Stamina recovery multiplier' },
];

export function valueByKey(key) {
  return VALUES.find((v) => v.key.toLowerCase() === String(key).toLowerCase());
}

export function attrByName(name) {
  const q = String(name).trim().toLowerCase();
  return ATTRS.find((a) => a.name.toLowerCase() === q || String(a.id) === q || a.label.toLowerCase() === q);
}

/** Parse "Name:value,Name:value" into [{name, value}]. Unknown names are kept as given. */
export function parseAttrLine(text) {
  return String(text ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.includes(':'))
    .map((p) => {
      const [n, v] = p.split(':');
      const known = attrByName(n);
      return { name: known ? known.name : n.trim(), value: parseFloat(v) };
    })
    .filter((a) => Number.isFinite(a.value));
}

export function formatAttrLine(attrs) {
  return attrs.length ? attrs.map((a) => `${a.name}:${a.value}`).join(',') : '0';
}

// ---------- live values from the running game ----------
// TransmogKeeper v1.4+ writes b1\Binaries\Win64\TransmogKeeperAttrs.txt every few seconds while a
// save is loaded: one "Name=value" line per attribute plus "time=<unix ms>". The CLI shows those next
// to the settings so you know what to set. Without a running game the file is stale or missing.

import fs from 'node:fs';
import path from 'node:path';

export const SNAPSHOT_FILE = 'TransmogKeeperAttrs.txt';
const STALE_MS = 3 * 60 * 1000;

/** Bars shown at the top of "values": [label, current attr, max attr]. */
export const LIVE_BARS = [
  ['Health', 'Hp', 'HpMax'],
  ['Mana (spells)', 'Mp', 'MpMax'],
  ['Stamina', 'Stamina', 'StaminaMax'],
  ['Qi (spirit skills)', 'VigorEnergy', 'VigorEnergyMax'],
  ['Might (transformation)', 'CurEnergy', 'TransEnergyMax'],
  ['Vessel', 'FabaoEnergy', 'FabaoEnergyMax'],
  ['Focus', 'Pevalue', 'PelevelMax'],
];

/** @returns {{ time: Date, stale: boolean, values: Record<string, number> } | null} */
export function readAttrSnapshot(configFile) {
  const file = path.join(path.dirname(configFile), '..', '..', '..', SNAPSHOT_FILE);
  if (!fs.existsSync(file)) return null;
  const values = {};
  let time = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(-?[0-9.]+)$/);
    if (!m) continue;
    if (m[1] === 'time') time = new Date(parseInt(m[2], 10));
    else values[m[1]] = parseFloat(m[2]);
  }
  if (!time) time = fs.statSync(file).mtime;
  return { time, stale: Date.now() - time.getTime() > STALE_MS, values };
}

export function fmtNum(v) {
  if (v === undefined || v === null || Number.isNaN(v)) return '?';
  return Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 100) / 100);
}
