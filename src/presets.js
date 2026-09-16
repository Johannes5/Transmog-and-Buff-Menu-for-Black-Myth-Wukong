// Named buffs ("presets"): a bundle of talents, soaks, kept buffs and value changes under one name,
// switched on and off as a whole, optionally with an in-game key (TransmogKeeper v1.7+ toggles it).
//
// Config line (keeperPresets), one preset per `Name{...}` block, blocks separated by ";":
//   keeperPresets = Stinger{talents=105013,901411;buffs=92313;key=F8};Movement Speed 2x{values=wukongSpeed:2:1;key=F9}
//   talents  addTalents IDs        soaks  keeperSoaks IDs        buffs  keeperBuffs IDs
//   values   key:on:off triples   (on = the value while the preset is active, off = what "off" restores)
//   key      in-game toggle key or None
import { VALUES, valueByKey, isDefault } from './values.js';
import { configNumber } from './config.js';

export const PRESET_NAME_MAX = 40;
export const validPresetName = (name) => /^[^{};=#]+$/.test(name) && name.trim() === name && name.length <= PRESET_NAME_MAX;

/** Presets a fresh install starts with (written into the config when the line is missing). */
export const DEFAULT_PRESETS = [
  { name: 'Movement Speed 2x', talents: [], soaks: [], buffs: [], values: { wukongSpeed: ['2', '1'] }, key: 'None' },
  { name: 'Defence +40%', talents: [], soaks: [], buffs: [], values: { defenseMultiplier: ['14E-1', '1'] }, key: 'None' },
  { name: 'Defence +20%', talents: [], soaks: [], buffs: [], values: { defenseMultiplier: ['12E-1', '1'] }, key: 'None' },
  { name: 'Mana Regen', talents: [], soaks: [], buffs: [], values: { manaRegen: ['4', '0'] }, key: 'None' },
  // Spider Celestial Staff + Centipede 2-piece + Deathstinger venom (poisons you on your next hit, no gourd needed)
  { name: 'Stinger', talents: [105013, 901411], soaks: [], buffs: [92313], values: {}, key: 'None' },
];

const ids = (s) => String(s ?? '').split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);
const empty = (name) => ({ name, talents: [], soaks: [], buffs: [], values: {}, key: 'None' });

export function parsePresets(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(/([^{};]+)\{([^}]*)\}/g)) {
    const name = m[1].trim();
    if (!name) continue;
    const p = empty(name);
    for (const part of m[2].split(';')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const k = part.slice(0, eq).trim(), v = part.slice(eq + 1).trim();
      if (k === 'talents') p.talents = ids(v);
      else if (k === 'soaks') p.soaks = ids(v);
      else if (k === 'buffs') p.buffs = ids(v);
      else if (k === 'key') p.key = v || 'None';
      else if (k === 'values') {
        for (const triple of v.split(',')) {
          const [key, on, off] = triple.split(':').map((x) => x.trim());
          const def = valueByKey(key);
          if (def && on !== undefined && on !== '') p.values[def.key] = [on, off ?? def.def];
        }
      }
    }
    out.push(p);
  }
  return out;
}

export function formatPresets(list) {
  if (!list.length) return '0';
  return list.map((p) => {
    const parts = [];
    if (p.talents.length) parts.push(`talents=${p.talents.join(',')}`);
    if (p.soaks.length) parts.push(`soaks=${p.soaks.join(',')}`);
    if (p.buffs?.length) parts.push(`buffs=${p.buffs.join(',')}`);
    const vals = Object.entries(p.values).map(([k, [on, off]]) => `${k}:${on}:${off}`);
    if (vals.length) parts.push(`values=${vals.join(',')}`);
    if (p.key && p.key !== 'None') parts.push(`key=${p.key}`);
    return `${p.name}{${parts.join(';')}}`;
  }).join(';');
}

/** Every ID a preset controls (talents, soaks, kept buffs). */
export const presetIds = (p) => [...p.talents, ...p.soaks, ...(p.buffs ?? [])];

/** A preset is "on" when every part of it is in effect. */
export function presetActive(p, cfg) {
  if (!p.talents.every((id) => cfg.talents.includes(id))) return false;
  if (!p.soaks.every((id) => cfg.soaks.includes(id))) return false;
  if (!(p.buffs ?? []).every((id) => cfg.buffs.includes(id))) return false;
  for (const [k, [on]] of Object.entries(p.values)) {
    if (parseFloat(cfg.values[k] ?? valueByKey(k)?.def) !== parseFloat(on)) return false;
  }
  return presetIds(p).length + Object.keys(p.values).length > 0;
}

/** What writeConfig needs to switch a preset on or off: { talents, soaks, buffs, values, skipRecent }. */
export function presetChange(p, cfg, on) {
  const merge = (cur, add) => (on ? [...new Set([...cur, ...add])] : cur.filter((id) => !add.includes(id)));
  const values = {};
  for (const [k, [onV, offV]] of Object.entries(p.values)) values[k] = configNumber(on ? onV : offV);
  return { talents: merge(cfg.talents, p.talents), soaks: merge(cfg.soaks, p.soaks), buffs: merge(cfg.buffs, p.buffs ?? []), values, skipRecent: presetIds(p) };
}

/** A preset built from what is active right now (talents, soaks, kept buffs, values that differ from the default). */
export function presetFromCurrent(name, cfg) {
  const values = {};
  for (const v of VALUES) if (!isDefault(v, cfg.values[v.key])) values[v.key] = [cfg.values[v.key], v.def];
  return { name, talents: [...cfg.talents], soaks: [...cfg.soaks], buffs: [...cfg.buffs], values, key: 'None' };
}

/** IDs and value keys that belong to some preset that is currently on (hidden from the "Active" list). */
export function coveredByActivePresets(cfg) {
  const idSet = new Set(), keys = new Set();
  for (const p of cfg.presets) {
    if (!presetActive(p, cfg)) continue;
    for (const id of presetIds(p)) idSet.add(id);
    for (const k of Object.keys(p.values)) keys.add(k);
  }
  return { ids: idSet, keys };
}

/** One line per part, for menus. */
export function describePreset(p, cat, talentName) {
  const parts = [];
  for (const id of presetIds(p)) parts.push(talentName(id));
  for (const [k, [on]] of Object.entries(p.values)) parts.push(`${valueByKey(k)?.label ?? k} = ${String(parseFloat(on))}`);
  return parts.length ? parts.join(', ') : '(empty)';
}
