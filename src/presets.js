// Named buffs ("presets"): a bundle of talents, soaks and value changes under one name, switched on
// and off as a whole, optionally with an in-game key (TransmogKeeper v1.7+ toggles it on key press).
//
// Config line (keeperPresets), one preset per `Name{...}` block, blocks separated by ";":
//   keeperPresets = Stinger{talents=105013,901411;soaks=2313;key=F8};Movement Speed 2x{values=wukongSpeed:2:1;key=F9}
//   talents  addTalents IDs        soaks  keeperSoaks IDs        key  in-game toggle key or None
//   values   key:on:off triples   (on = the value while the preset is active, off = what "off" restores)
import { VALUES, valueByKey, isDefault } from './values.js';
import { configNumber } from './config.js';

export const PRESET_NAME_MAX = 40;
export const validPresetName = (name) => /^[^{};=#]+$/.test(name) && name.trim() === name && name.length <= PRESET_NAME_MAX;

/** Presets a fresh install starts with (written into the config when the line is missing). */
export const DEFAULT_PRESETS = [
  { name: 'Movement Speed 2x', talents: [], soaks: [], values: { wukongSpeed: ['2', '1'] }, key: 'None' },
  { name: 'Defence +40%', talents: [], soaks: [], values: { defenseMultiplier: ['14E-1', '1'] }, key: 'None' },
  { name: 'Defence +20%', talents: [], soaks: [], values: { defenseMultiplier: ['12E-1', '1'] }, key: 'None' },
  { name: 'Mana Regen', talents: [], soaks: [], values: { manaRegen: ['4', '0'] }, key: 'None' },
  { name: 'Stinger', talents: [105013, 901411], soaks: [2313], values: {}, key: 'None' },
];

const ids = (s) => String(s ?? '').split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => Number.isInteger(n) && n > 0);

export function parsePresets(text) {
  const out = [];
  for (const m of String(text ?? '').matchAll(/([^{};]+)\{([^}]*)\}/g)) {
    const name = m[1].trim();
    if (!name) continue;
    const p = { name, talents: [], soaks: [], values: {}, key: 'None' };
    for (const part of m[2].split(';')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const k = part.slice(0, eq).trim(), v = part.slice(eq + 1).trim();
      if (k === 'talents') p.talents = ids(v);
      else if (k === 'soaks') p.soaks = ids(v);
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
    const vals = Object.entries(p.values).map(([k, [on, off]]) => `${k}:${on}:${off}`);
    if (vals.length) parts.push(`values=${vals.join(',')}`);
    if (p.key && p.key !== 'None') parts.push(`key=${p.key}`);
    return `${p.name}{${parts.join(';')}}`;
  }).join(';');
}

/** A preset is "on" when every part of it is in effect. */
export function presetActive(p, cfg) {
  if (!p.talents.every((id) => cfg.talents.includes(id))) return false;
  if (!p.soaks.every((id) => cfg.soaks.includes(id))) return false;
  for (const [k, [on]] of Object.entries(p.values)) {
    if (parseFloat(cfg.values[k] ?? valueByKey(k)?.def) !== parseFloat(on)) return false;
  }
  return p.talents.length + p.soaks.length + Object.keys(p.values).length > 0;
}

/** What writeConfig needs to switch a preset on or off: { talents, soaks, values }. */
export function presetChange(p, cfg, on) {
  const talents = on ? [...new Set([...cfg.talents, ...p.talents])] : cfg.talents.filter((id) => !p.talents.includes(id));
  const soaks = on ? [...new Set([...cfg.soaks, ...p.soaks])] : cfg.soaks.filter((id) => !p.soaks.includes(id));
  const values = {};
  for (const [k, [onV, offV]] of Object.entries(p.values)) values[k] = configNumber(on ? onV : offV);
  return { talents, soaks, values };
}

/** A preset built from what is active right now (talents, soaks, values that differ from the default). */
export function presetFromCurrent(name, cfg, cat) {
  const values = {};
  for (const v of VALUES) if (!isDefault(v, cfg.values[v.key])) values[v.key] = [cfg.values[v.key], v.def];
  return { name, talents: [...cfg.talents], soaks: [...cfg.soaks], values, key: 'None' };
}

/** One line per part, for menus. */
export function describePreset(p, cat, talentName) {
  const parts = [];
  for (const id of p.talents) parts.push(talentName(id));
  for (const id of p.soaks) parts.push(talentName(id));
  for (const [k, [on]] of Object.entries(p.values)) parts.push(`${valueByKey(k)?.label ?? k} = ${String(parseFloat(on))}`);
  return parts.length ? parts.join(', ') : '(empty)';
}
