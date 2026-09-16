// Name -> ID resolution for the non-interactive commands ("Stormflash", "bull king", "12002", "none").
import { catalog, sets, matches } from './data.js';

/** @returns id, null for "none", or undefined when no query was given. Throws when nothing or too much matches. */
export function resolveItem(query, slot, allTiers = false) {
  if (query === undefined || query === null) return undefined;
  const q = String(query).trim();
  if (/^(none|off|0|-)$/i.test(q)) return null;
  if (/^\d+$/.test(q)) return parseInt(q, 10);
  const pool = catalog({ allTiers }).filter((i) => i.slot === slot);
  let hits = pool.filter((i) => matches(i, q));
  if (hits.length > 1) {
    const exact = hits.filter((i) => i.name.toLowerCase() === q.toLowerCase());
    if (exact.length === 1) hits = exact;
  }
  if (hits.length > 1 && !allTiers) hits = hits.filter((i) => !i.tier);
  if (hits.length === 1) return hits[0].id;
  if (!hits.length) throw new Error(`No ${slot} item matches "${q}". Try: wukong-transmog list ${q}`);
  throw new Error(`"${q}" is ambiguous for ${slot}:\n` + hits.map((i) => `  ${i.id}  ${i.name}`).join('\n'));
}

export function resolveSet(query) {
  const q = String(query).trim().toLowerCase();
  const all = sets();
  const hay = (s) => `${s.name} ${s.aliases ?? ''}`.toLowerCase();
  let hits = all.filter((s) => s.key === q);
  if (hits.length !== 1) hits = all.filter((s) => hay(s).includes(q));
  if (hits.length !== 1) {
    const words = q.split(/\s+/);
    hits = all.filter((s) => words.every((w) => hay(s).includes(w)));
  }
  if (hits.length === 1) return hits[0];
  if (!hits.length) throw new Error(`No armor set matches "${query}". Sets: ${all.map((s) => s.key).join(', ')}`);
  throw new Error(`"${query}" is ambiguous:\n` + hits.map((s) => `  ${s.key.padEnd(16)} ${s.name}`).join('\n'));
}

export function resolveTalent(cat, query) {
  const q = String(query).trim();
  if (/^\d+$/.test(q)) return parseInt(q, 10);
  let hits = cat.filter((t) => matches(t, q));
  if (hits.length > 1) {
    const exact = hits.filter((t) => t.name.toLowerCase() === q.toLowerCase());
    if (exact.length === 1) hits = exact;
  }
  if (hits.length === 1) return hits[0].id;
  if (!hits.length) throw new Error(`No buff matches "${q}". Try: wukong-transmog buffs list ${q}`);
  throw new Error(`"${q}" is ambiguous:\n` + hits.map((t) => `  ${t.id}  ${t.name}`).join('\n'));
}

/** Saved outfit by name (case-insensitive, then substring). */
export function resolveOutfit(saved, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) throw new Error('Which saved look? Run "wukong-transmog outfits" to list them.');
  let hits = saved.filter((o) => o.name.toLowerCase() === q);
  if (!hits.length) hits = saved.filter((o) => o.name.toLowerCase().includes(q));
  if (hits.length === 1) return hits[0];
  if (!hits.length) throw new Error(`No saved look matches "${query}". Saved: ${saved.map((o) => o.name).join(', ') || 'none'}`);
  throw new Error(`"${query}" is ambiguous: ${hits.map((o) => o.name).join(', ')}`);
}
