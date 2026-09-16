// Talent catalog for the "extra effects" feature: set bonuses, armor piece effects, weapon effects,
// curios and other talents the game can activate on the player without the matching gear.
// IDs come from the mod's TrueWukong-TalentList.txt (next to the config); names and descriptions
// come from data.js (sets, weapons) and effects.js (curated texts).
//
// Catalog entry: { id, category, group, tier, name, description, kind, aliases, slot: 'talent', note }
//   category  'Armor' | 'Weapons' | 'Curios' | 'Other'
//   group     set name for armor (used for the second-level menu), null otherwise
//   tier      'Mythical' or null
import fs from 'node:fs';
import path from 'node:path';
import { sets } from './data.js';
import { WEAPON_EFFECTS, SET_EFFECTS, UNIQUE_PIECES, CURIO_EFFECTS } from './effects.js';

const LIST_FILE = 'TrueWukong-TalentList.txt';
export const CATEGORIES = ['Armor', 'Weapons', 'Curios', 'Other'];
const UNIQUE_GROUP = 'Stand-alone pieces';
const SLOT_NAMES = { 1: 'head', 2: 'body', 3: 'arms', 4: 'legs' };

const NO_TEXT = null;

/** Parse "ID - chinese - English" lines of the mod's talent list into the catalog. */
export function loadTalentCatalog(configFile) {
  const file = path.join(path.dirname(configFile), LIST_FILE);
  if (!fs.existsSync(file)) return [];
  const setList = sets().filter((s) => !s.fixedTier);
  const families = new Map(setList.map((s) => [s.family, s]));
  const setOrder = setList.map((s) => s.family);
  const out = new Map();
  let section = '';
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (/^[A-Z ]+:$/.test(line)) { section = line.slice(0, -1).toLowerCase(); continue; }
    const m = line.match(/^(\d+)\s*-\s*(.+)$/);
    if (!m || out.has(parseInt(m[1], 10))) continue;
    const id = parseInt(m[1], 10);
    const parts = m[2].split(/\s+-\s+/).map((s) => s.trim()).filter(Boolean);
    const modName = parts[parts.length - 1];
    const chinese = parts.slice(0, -1).join(' ');
    const mythical = /EX|MYTHIC/i.test(m[2]);

    let entry;
    if (section === 'weapons' || (id >= 105000 && id < 106000)) {
      const text = WEAPON_EFFECTS[id - 90000];
      entry = { category: 'Weapons', group: null, tier: null, name: modName, kind: 'weapon effect', description: text ?? NO_TEXT };
    } else if (/^90\d\d\d\d$/.test(String(id)) && families.get(100 + parseInt(String(id).slice(2, 4), 10))) {
      const set = families.get(100 + parseInt(String(id).slice(2, 4), 10));
      const setName = set.name.replace(/\s*\(.*\)$/, '');
      const fx = SET_EFFECTS[set.family] ?? {};
      const pieces = m[2].match(/套装?(\d)/)?.[1];
      if (pieces) {
        const n = parseInt(pieces, 10);
        const text = mythical ? fx.mythical : fx.bonus?.[n];
        entry = {
          category: 'Armor', group: setName, tier: mythical ? 'Mythical' : null,
          name: `${n}-piece set bonus${mythical ? ' (Mythical tier)' : ''}`,
          kind: 'set bonus, no need to wear the set',
          description: text ? `${fx.name ? fx.name + ': ' : ''}${text}` : (mythical ? 'Mythical-tier extra set bonus; exact text not found yet.' : NO_TEXT),
        };
      } else {
        const slot = id % 10;
        const pieceName = set.pieces?.[SLOT_NAMES[slot]] ?? modName;
        const text = fx.piece?.[slot];
        entry = {
          category: 'Armor', group: setName, tier: mythical ? 'Mythical' : null,
          name: `${pieceName}${mythical ? ' (Mythical tier)' : ''}: piece effect`,
          kind: 'effect of a single armor piece, no need to wear it',
          description: text ? `${text}${mythical ? ' (Mythical-tier piece; same effect text as the base piece.)' : ''}` : NO_TEXT,
        };
      }
      entry.setFamily = set.family;
    } else if (UNIQUE_PIECES[id] || (id >= 907000 && id < 908000)) {
      const u = UNIQUE_PIECES[id];
      entry = {
        category: 'Armor', group: UNIQUE_GROUP, tier: null,
        name: u ? `${u.name} (${u.slot}): piece effect` : `${modName}: piece effect`,
        kind: 'effect of a single armor piece, no need to wear it',
        description: u?.text ?? NO_TEXT,
      };
    } else if (id >= 106000 && id < 107000) {
      const c = CURIO_EFFECTS[id];
      entry = { category: 'Curios', group: null, tier: null, name: c?.name ?? modName, kind: 'curio effect', description: c?.text ?? NO_TEXT };
    } else {
      entry = { category: 'Other', group: null, tier: null, name: modName, kind: 'talent', description: NO_TEXT };
    }
    const aliases = [chinese, modName, entry.category, entry.group ?? '', entry.tier ?? '', entry.kind].join(' ');
    out.set(id, { id, slot: 'talent', aliases, note: entry.description ?? entry.kind, ...entry });
  }

  const groupRank = (e) => (e.group === UNIQUE_GROUP ? 999 : e.setFamily ? setOrder.indexOf(e.setFamily) : 0);
  const kindRank = (e) => (e.tier ? 2 : 0) + (/piece effect/.test(e.name) ? 1 : 0);
  return [...out.values()].sort(
    (a, b) => CATEGORIES.indexOf(a.category) - CATEGORIES.indexOf(b.category) || groupRank(a) - groupRank(b) || kindRank(a) - kindRank(b) || a.id - b.id,
  );
}

export function talentById(catalog, id) {
  return catalog.find((t) => t.id === id) ?? { id, slot: 'talent', category: 'Other', group: null, tier: null, name: `Unknown talent ${id}`, kind: 'unknown', description: null, note: '', aliases: '' };
}

/** Distinct groups (armor sets) of a category, in catalog order. */
export function groupsOf(catalog, category) {
  return [...new Set(catalog.filter((t) => t.category === category && t.group).map((t) => t.group))];
}

/** Full name for flat listings: "Golden Set: 4-piece set bonus". */
export function fullName(t) {
  return t.group ? `${t.group}: ${t.name}` : t.name;
}

/** Two lines for a talent: "ID  name  [active]" and an indented description. */
export function formatTalent(t, { active = false, withGroup = true } = {}) {
  const head = `  ${String(t.id).padEnd(7)} ${withGroup ? fullName(t) : t.name}${active ? '   [active]' : ''}`;
  const body = t.description ? `\n          ${t.description}` : `\n          (no description available; ${t.kind})`;
  return head + body;
}
