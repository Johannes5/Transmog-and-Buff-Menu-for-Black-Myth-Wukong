#!/usr/bin/env node
// wukong-transmog: pick True Wukong transmog looks by name instead of raw IDs.
//
//   wukong-transmog                  interactive menu
//   wukong-transmog show             decode the current staffTransmog / spearTransmog lines
//   wukong-transmog list [words...]  search the catalog ("list loong", "list head golden")
//   wukong-transmog set [options]    non-interactive edit, e.g.
//       set --grip both --weapon "Stormflash" --set "Heaven's Equal"
//       set --grip staff --head "Bull King" --body 12002 --arms none
//       set --clear
//   wukong-transmog outfits ...      saved looks (and the in-game key that cycles them)
//   wukong-transmog buffs ...        set bonuses and weapon effects without the gear
//   wukong-transmog values ...       regen, speed, multipliers, attribute locks
//   wukong-transmog doctor           check the install and the logs
//   wukong-transmog mod full|lite|off switch mod mode (lite = trainer-friendly)
//   options: --config <path>  --all-tiers  --grip staff|spear|both  --no-backup

import fs from 'node:fs';
import path from 'node:path';
import { catalog, sets, setPieces, setPieceNames, itemById, slotOf, matches, SLOTS, SLOT_LABEL } from './data.js';
import { loadTalentCatalog, talentById, formatTalent, fullName, groupsOf, CATEGORIES } from './talents.js';
import { VALUES, VALUE_GROUPS, ATTRS, valueByKey, attrByName, formatAttrLine, readAttrSnapshot, LIVE_BARS, fmtNum } from './values.js';
import { hasPayload, installInto, uninstallFrom, findGameDirs, isGameDir, isInstalled, needsUpdate, payloadVersion, gameRunning, gameExeStamp } from './install.js';
import { readSettings, writeSettings } from './settings.js';
import {
  CONFIG_REL, KEYS, TALENT_KEY, readConfig, writeConfig, configNumber, showNumber, listBackups, restoreBackup, normalizeHotkey, validOutfitName,
} from './config.js';
import { resolveItem, resolveSet, resolveTalent, resolveOutfit } from './resolve.js';
import { modPaths, modState, setMode, keeperInstalled, trainerMode, tailLines } from './mod.js';
import { runDoctor } from './doctor.js';

// ---------- config file ----------

// Which config to use, in this order: --config, the WUKONG_TRANSMOG_CONFIG variable, the folder
// chosen earlier (settings.json next to the tool), or a single detected Steam install. With several
// or no detected installs the menu asks; without a menu (a command) the error says what to do.
class NeedsGameFolder extends Error {
  constructor(gameDirs) { super('game folder needs to be chosen'); this.gameDirs = gameDirs; }
}

function findConfig(explicit) {
  const direct = explicit ?? process.env.WUKONG_TRANSMOG_CONFIG;
  if (direct) {
    if (!fs.existsSync(direct)) throw new Error(`Config file not found: ${direct}`);
    return direct;
  }
  const saved = readSettings().configPath;
  if (saved && fs.existsSync(saved)) return saved;
  const installed = findGameDirs().filter((g) => fs.existsSync(path.join(g, CONFIG_REL)));
  if (installed.length === 1) return path.join(installed[0], CONFIG_REL);
  throw new NeedsGameFolder(findGameDirs());
}

const gameDirOf = (configFile) => path.resolve(path.dirname(configFile), '..', '..', '..', '..', '..', '..');

// ---------- outfit model ----------
// An outfit is { weapon, head, body, arms, legs, gourd } -> id or null.

function idsToOutfit(ids) {
  const outfit = Object.fromEntries(SLOTS.map((s) => [s, null]));
  const extras = [];
  for (const id of ids) {
    const slot = slotOf(id);
    if (slot in outfit && outfit[slot] === null) outfit[slot] = id;
    else extras.push(id);
  }
  return { outfit, extras };
}

function outfitToIds(outfit) {
  return SLOTS.map((s) => outfit[s]).filter((id) => id);
}

function describeOutfit(ids) {
  if (!ids.length) return '  (none - shows your real gear)';
  const { outfit, extras } = idsToOutfit(ids);
  const rows = SLOTS.filter((s) => outfit[s]).map((s) => {
    const it = itemById(outfit[s]);
    const set = it.set ? `  [${it.set}]` : '';
    return `  ${SLOT_LABEL[s].padEnd(7)} ${String(it.id).padEnd(6)} ${it.name}${set}`;
  });
  if (extras.length) rows.push(`  extra IDs: ${extras.join(', ')}`);
  return rows.join('\n');
}

const shortName = (name) => name.replace(/\s*\(.*\)$/, '').replace(/^Great Sage armor, Chapter 6.*/, "Heaven's Equal Set").replace(/^Great Sage armor, prologue version.*/, 'Old Monkey King Set');

/** "Stormflash, Bull King Set" for a list of IDs. */
function idsSummary(ids) {
  const { outfit } = idsToOutfit(ids);
  const armor = ['head', 'body', 'arms', 'legs'].map((s) => outfit[s]).filter(Boolean);
  const setNames = [...new Set(armor.map((id) => itemById(id).set).filter(Boolean))];
  const parts = [];
  if (outfit.weapon) parts.push(itemById(outfit.weapon).name);
  if (armor.length) parts.push(setNames.length === 1 && armor.length === 4 ? shortName(setNames[0]) : `${armor.length} armor piece${armor.length > 1 ? 's' : ''}`);
  if (outfit.gourd) parts.push('gourd');
  return parts.length ? parts.join(', ') : 'none (real gear)';
}
const outfitSummary = (cfg) => idsSummary(cfg.outfits.staff);

// ---------- arg parsing ----------

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const flagOnly = ['all-tiers', 'clear', 'no-backup', 'help', 'json', 'yes'];
      if (flagOnly.includes(key) || i + 1 >= argv.length || argv[i + 1].startsWith('--')) opts[key] = true;
      else opts[key] = argv[++i];
    } else opts._.push(a);
  }
  return opts;
}

// ---------- helpers ----------

const VERSION = (() => {
  try { return JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version; } catch { return '?'; }
})();

/** One consistent line after every save. */
function savedLine(cfg) {
  return keeperInstalled(cfg.file) ? 'Saved. Applies in game within a second.' : 'Saved. Press Ctrl+Enter in game (or reload the save).';
}

function describeTalents(cfg) {
  if (!cfg.talents.length) return '  (none)';
  const cat = loadTalentCatalog(cfg.file);
  return cfg.talents.map((id) => formatTalent(talentById(cat, id))).join('\n');
}

function describeSaved(cfg) {
  if (!cfg.saved.length) return '  (no saved looks yet)';
  const cur = cfg.outfits.staff.join(',');
  return cfg.saved.map((o) => `  ${o.name.padEnd(24)} ${idsSummary(o.ids)}${o.ids.join(',') === cur ? '   [wearing]' : ''}`).join('\n');
}

// ---------- commands ----------

function cmdShow(cfg) {
  console.log(`Config: ${cfg.file}\n`);
  for (const grip of Object.keys(KEYS)) {
    console.log(`${grip === 'staff' ? 'Staff grip' : 'Spear grip'} outfit (${KEYS[grip]}):`);
    console.log(describeOutfit(cfg.outfits[grip]));
    console.log();
  }
  console.log('Buffs (' + TALENT_KEY + '):');
  console.log(describeTalents(cfg));
  console.log(`\nSaved looks (in-game key: ${cfg.hotkey}):`);
  console.log(describeSaved(cfg));
  console.log();
}

function cmdTalents(cfg, opts) {
  const sub = (opts._[1] ?? '').toLowerCase();
  const cat = loadTalentCatalog(cfg.file);
  if (!cat.length) console.log('Warning: the buff list file (TrueWukong-TalentList.txt) is missing next to the config; only raw IDs work.\n');
  if (!sub) {
    console.log(`Buffs (${TALENT_KEY}):`);
    console.log(describeTalents(cfg));
    console.log('\nCommands: buffs list [words] | buffs info <name|id> | buffs add <name|id>... | buffs remove <name|id>... | buffs clear');
    return;
  }
  if (sub === 'list') {
    const term = opts._.slice(2).join(' ');
    const hits = cat.filter((t) => matches(t, term));
    let lastHeader = '';
    for (const t of hits) {
      const header = t.group ? `${t.category}: ${t.group}` : t.category;
      if (header !== lastHeader) {
        console.log(`\n${header}`);
        lastHeader = header;
      }
      console.log(formatTalent(t, { active: cfg.talents.includes(t.id), withGroup: false }));
    }
    if (!hits.length) console.log('No matches.');
    else console.log(`
Categories: ${CATEGORIES.join(' | ')}   (filter with: buffs list <category, set or words>)`);
    return;
  }
  if (sub === 'info') {
    const queries = opts._.slice(2);
    if (!queries.length) throw new Error('usage: wukong-transmog buffs info <name or id> [...]');
    for (const q of queries) {
      const id = resolveTalent(cat, q);
      console.log(formatTalent(talentById(cat, id), { active: cfg.talents.includes(id) }));
    }
    return;
  }
  let talents = [...cfg.talents];
  if (sub === 'clear') talents = [];
  else if (sub === 'add' || sub === 'remove') {
    const queries = opts._.slice(2);
    if (!queries.length) throw new Error(`usage: wukong-transmog buffs ${sub} <name or id> [...]`);
    for (const q of queries) {
      const id = resolveTalent(cat, q);
      if (sub === 'add' && !talents.includes(id)) talents.push(id);
      if (sub === 'remove') talents = talents.filter((t) => t !== id);
    }
  } else throw new Error('usage: wukong-transmog buffs [list [words] | info <name|id> | add <name|id>... | remove <name|id>... | clear]');
  writeConfig(cfg, {}, { backup: !opts['no-backup'], talents });
  console.log('Written to ' + cfg.file + `

Buffs (${TALENT_KEY}):`);
  console.log(describeTalents(cfg));
  console.log('\n' + savedLine(cfg));
}

function cmdList(opts) {
  const term = opts._.slice(1).join(' ');
  const items = catalog({ allTiers: !!opts['all-tiers'] }).filter((i) => matches(i, term));
  if (opts.json) {
    console.log(JSON.stringify(items, null, 2));
    return;
  }
  let lastSlot = '';
  for (const it of [...items].sort((a, b) => SLOTS.indexOf(a.slot) - SLOTS.indexOf(b.slot) || a.id - b.id)) {
    if (it.slot !== lastSlot) {
      console.log(`\n${SLOT_LABEL[it.slot] ?? it.slot}`);
      lastSlot = it.slot;
    }
    const set = it.set ? `  [${it.set}]` : it.note ? `  (${it.note})` : '';
    console.log(`  ${String(it.id).padEnd(6)} ${it.name}${set}`);
  }
  if (!items.length) console.log('No matches.');
  console.log();
}

function cmdSet(cfg, opts) {
  const grip = (opts.grip ?? 'both').toLowerCase();
  const grips = grip === 'both' ? ['staff', 'spear'] : [grip];
  if (grips.some((g) => !KEYS[g])) throw new Error('--grip must be staff, spear or both');
  const allTiers = !!opts['all-tiers'];
  const result = {};
  for (const g of grips) {
    let outfit;
    if (opts.clear) outfit = Object.fromEntries(SLOTS.map((s) => [s, null]));
    else {
      outfit = idsToOutfit(cfg.outfits[g]).outfit;
      if (opts.set) {
        const set = resolveSet(opts.set);
        for (const slot of ['head', 'body', 'arms', 'legs']) outfit[slot] = null;
        Object.assign(outfit, setPieces(set.key));
      }
      for (const slot of SLOTS) {
        if (slot in opts) {
          const v = resolveItem(opts[slot], slot, allTiers);
          if (v !== undefined) outfit[slot] = v;
        }
      }
    }
    result[g] = outfitToIds(outfit);
  }
  writeConfig(cfg, result, { backup: !opts['no-backup'] });
  console.log('Written to ' + cfg.file);
  for (const g of grips) {
    console.log(`\n${g === 'staff' ? 'Staff grip' : 'Spear grip'} outfit (${KEYS[g]} = ${result[g].join(',') || 0}):`);
    console.log(describeOutfit(result[g]));
  }
  console.log('\n' + savedLine(cfg));
}

// ---------- saved looks ----------
// keeperOutfits keeps named ID lists in the config; keeperOutfitKey is the in-game key that puts on
// the next one (TransmogKeeper v1.5+). The keeper writes the chosen look into staffTransmog /
// spearTransmog itself, so the tool and the game always agree.

function cmdOutfits(cfg, opts) {
  const sub = (opts._[1] ?? '').toLowerCase();
  const name = opts._.slice(2).join(' ');
  if (!sub) {
    console.log(`Saved looks (in-game key to cycle them: ${cfg.hotkey}):`);
    console.log(describeSaved(cfg));
    console.log('\nCommands: outfits save <name> | outfits wear <name> | outfits delete <name> | outfits key <F7|Ctrl+F7|none>');
    return;
  }
  let saved = [...cfg.saved];
  if (sub === 'save') {
    if (!validOutfitName(name)) throw new Error('usage: wukong-transmog outfits save <name>   (no "=", ";" or "#", up to 40 characters)');
    saved = saved.filter((o) => o.name.toLowerCase() !== name.toLowerCase());
    saved.push({ name, ids: [...cfg.outfits.staff] });
    writeConfig(cfg, {}, { backup: !opts['no-backup'], saved });
    console.log(`Saved the current look as "${name}" (${idsSummary(cfg.outfits.staff)}).`);
  } else if (sub === 'wear') {
    const o = resolveOutfit(saved, name);
    writeConfig(cfg, { staff: o.ids, spear: o.ids }, { backup: !opts['no-backup'] });
    console.log(`Wearing "${o.name}":\n${describeOutfit(o.ids)}\n\n${savedLine(cfg)}`);
  } else if (sub === 'delete' || sub === 'remove') {
    const o = resolveOutfit(saved, name);
    writeConfig(cfg, {}, { backup: !opts['no-backup'], saved: saved.filter((x) => x !== o) });
    console.log(`Deleted the saved look "${o.name}".`);
  } else if (sub === 'key') {
    const key = normalizeHotkey(name);
    if (!key) throw new Error(`"${name}" is not a key the game understands. Examples: F7, Ctrl+F7, Shift+Alt+O, NUMPAD1, none. Full list: TrueWukong-KeybindList.txt next to the config.`);
    writeConfig(cfg, {}, { backup: !opts['no-backup'], hotkey: key });
    console.log(key === 'None' ? 'In-game key removed.' : `${key} now puts on the next saved look in game${keeperInstalled(cfg.file) ? '' : ' (needs the keeper)'}.`);
  } else throw new Error('usage: wukong-transmog outfits [save <name> | wear <name> | delete <name> | key <key|none>]');
}

// ---------- custom values ----------
// The mod's numeric settings (regen, multipliers, cooldowns, ...) plus keeper-only attribute
// overrides (keeperAttr). See values.js for what applies in which mode.

function liveHeader(snap) {
  if (!snap) return 'Live values: none yet (start the game with TransmogKeeper v1.4+ installed and load a save).';
  const when = snap.time.toLocaleTimeString();
  return `Live values from the game as of ${when}${snap.stale ? ' (STALE: game not running or keeper not writing)' : ''}:`;
}

function describeLive(cfg) {
  const snap = readAttrSnapshot(cfg.file);
  const rows = [liveHeader(snap)];
  if (!snap) return rows.join('\n');
  for (const [label, cur, max] of LIVE_BARS) {
    if (snap.values[cur] === undefined && snap.values[max] === undefined) continue;
    rows.push(`  ${label.padEnd(24)} ${fmtNum(snap.values[cur])} / ${fmtNum(snap.values[max])}`);
  }
  for (const a of ATTRS) {
    if (LIVE_BARS.some(([, , max]) => max === a.name)) continue;
    if (snap.values[a.name] !== undefined) rows.push(`  ${a.label.padEnd(24)} ${fmtNum(snap.values[a.name])}   (${a.name})`);
  }
  return rows.join('\n');
}

function describeValues(cfg, { group } = {}) {
  const snap = readAttrSnapshot(cfg.file);
  const live = (name) => (snap && snap.values[name] !== undefined ? `   game now: ${fmtNum(snap.values[name])}${snap.stale ? ' (stale)' : ''}` : '');
  const rows = [];
  for (const g of VALUE_GROUPS) {
    if (group && g.toLowerCase() !== group.toLowerCase()) continue;
    rows.push(`\n${g}`);
    for (const v of VALUES.filter((x) => x.group === g)) {
      const cur = cfg.values[v.key] !== undefined ? showNumber(cfg.values[v.key]) : '(not in config)';
      rows.push(`  ${v.key.padEnd(22)} = ${String(cur).padEnd(8)} ${v.label}   [${v.applies.join(', ')}]`);
      rows.push(`          ${v.desc}`);
    }
  }
  if (!group || /attr/i.test(group)) {
    rows.push('\nAttribute locks (keeperAttr, TransmogKeeper only, both modes)');
    if (!cfg.attrs.length) rows.push('  (none locked)');
    for (const a of cfg.attrs) {
      const known = attrByName(a.name);
      rows.push(`  ${a.name.padEnd(22)} = ${String(a.value).padEnd(8)} ${known ? known.label : '(unknown attribute name)'}${live(a.name)}`);
    }
  }
  return rows.join('\n');
}

function cmdValues(cfg, opts) {
  const sub = (opts._[1] ?? '').toLowerCase();
  if (!sub) {
    console.log(`Config: ${cfg.file}\n`);
    console.log(describeLive(cfg));
    console.log(describeValues(cfg));
    console.log('\n[full] = needs Trainer compatibility off, [lite] = works with it on. Attack/defense multipliers take effect at the next respawn.');
    console.log('Commands: values set <key> <number> | values attr | values attr set <Name> <number> | values attr remove <Name> | values attr clear');
    return;
  }
  if (sub === 'set') {
    const [key, value] = opts._.slice(2);
    const v = valueByKey(key);
    if (!v) throw new Error(`Unknown value "${key}". Keys: ${VALUES.map((x) => x.key).join(', ')}`);
    if (value === undefined || !Number.isFinite(parseFloat(value))) throw new Error(`usage: wukong-transmog values set ${v.key} <number>`);
    writeConfig(cfg, {}, { backup: !opts['no-backup'], values: { [v.key]: configNumber(value) } });
    console.log(`Written to ${cfg.file}\n  ${v.key} = ${configNumber(value)}   ${v.label}   [${v.applies.join(', ')}]`);
    if (!v.applies.includes('lite') && trainerMode(cfg.file)) console.log('  Note: this value is off while Trainer compatibility is on.');
    else console.log('  ' + savedLine(cfg));
    return;
  }
  if (sub === 'attr') {
    const action = (opts._[2] ?? 'list').toLowerCase();
    if (action === 'list') {
      const snap = readAttrSnapshot(cfg.file);
      console.log(liveHeader(snap) + '\n');
      console.log('Attributes the keeper can lock to a value (game names; numeric IDs work too):\n');
      for (const a of ATTRS) {
        const lock = cfg.attrs.find((x) => x.name === a.name);
        const now = snap && snap.values[a.name] !== undefined ? `game now: ${fmtNum(snap.values[a.name])}` : 'game now: ?';
        console.log(`  ${a.name.padEnd(22)} ${a.label.padEnd(36)} ${now.padEnd(18)} ${lock ? 'locked at ' + lock.value : 'not locked'}`);
      }
      console.log('\nCommands: values attr set <Name> <number> | values attr remove <Name> | values attr clear');
      return;
    }
    let attrs = [...cfg.attrs];
    if (action === 'clear') attrs = [];
    else if (action === 'set' || action === 'remove') {
      const [name, value] = opts._.slice(3);
      const known = attrByName(name ?? '');
      if (!known && !/^\d+$/.test(name ?? '')) throw new Error(`Unknown attribute "${name}". See: wukong-transmog values attr`);
      const n = known ? known.name : name;
      attrs = attrs.filter((a) => a.name !== n);
      if (action === 'set') {
        if (!Number.isFinite(parseFloat(value))) throw new Error(`usage: wukong-transmog values attr set ${n} <number>`);
        attrs.push({ name: n, value: parseFloat(value) });
      }
    } else throw new Error('usage: wukong-transmog values attr [list | set <Name> <number> | remove <Name> | clear]');
    writeConfig(cfg, {}, { backup: !opts['no-backup'], attrs });
    console.log(`Written to ${cfg.file}\n` + describeValues(cfg, { group: 'attr' }));
    console.log('\n' + savedLine(cfg));
    return;
  }
  throw new Error('usage: wukong-transmog values [set <key> <number> | attr ...]');
}

// ---------- mod on/off/lite ----------

function describeMod(cfg, st, p) {
  console.log(`Mode: ${st.mode}`);
  console.log(`  loader (version.dll): ${st.loaderOn ? 'active' : st.loaderOff ? 'disabled (renamed to version.dll.off)' : 'MISSING'}`);
  console.log(`  EnableJit: ${st.jit === null ? 'unknown' : st.jit ? '1 (hooks on, trainers may break)' : '0 (no hooks, trainer-friendly)'}`);
  console.log(`  TrueWukong.dll prepared (patched): ${st.patched ? 'yes' : 'no (reinstall the in-game part: Options > Game folder)'}`);
  console.log(`  TransmogKeeper (auto re-apply): ${st.keeper ? 'installed' : 'not installed (reinstall the in-game part: Options > Game folder)'}`);
  console.log(`  game running: ${gameRunning() ? 'yes' : 'no'}`);
  console.log(`  logs: ${p.modLog}\n        ${p.keeperLog}`);
}

function cmdMod(cfg, opts) {
  const p = modPaths(cfg.file);
  const want = (opts._[1] ?? 'status').toLowerCase();
  if (want === 'status') return describeMod(cfg, modState(p), p);
  if (!['full', 'lite', 'off'].includes(want)) throw new Error('usage: wukong-transmog mod status|full|lite|off');
  if (gameRunning()) throw new Error('Close the game first; the loader files are in use while it runs.');
  const warning = setMode(p, want);
  if (warning) console.log('Warning: ' + warning);
  describeMod(cfg, modState(p), p);
  if (want === 'lite') console.log(keeperInstalled(cfg.file)
    ? '\nTrainer compatibility on: looks and buffs apply on their own; attack/defense multipliers and the cooldown timers are off.'
    : '\nLite mode without the keeper: after loading a save press Ctrl+Enter once to apply the look (also after every respawn).');
}

// ---------- doctor ----------

function cmdDoctor(cfg) {
  const gameDir = gameDirOf(cfg.file);
  const { checks, verdict, paths } = runDoctor(cfg.file, gameDir);
  console.log(`Transmog & Buff Tool ${VERSION} doctor\n`);
  const mark = { ok: '   ', warn: ' ! ', fail: '!! ' };
  for (const c of checks) console.log(mark[c.level] + c.text);
  console.log('\n' + verdict);
  const showTail = (file, title) => {
    const lines = tailLines(file, 6);
    if (!lines.length) return;
    console.log(`\n${title} (last lines):`);
    for (const l of lines) console.log('  ' + l.slice(0, 180));
  };
  if (checks.some((c) => c.level !== 'ok')) {
    showTail(paths.modLog, 'TrueWukongLog.txt');
    showTail(paths.keeperLog, 'TransmogKeeperLog.txt');
  }
  console.log();
}

// ---------- undo (config backups) ----------

/** What differs between a backup and the current config, in tool terms. */
function describeBackupDiff(cfg, backupFile) {
  const old = readConfig(backupFile);
  const out = [];
  if (old.outfits.staff.join(',') !== cfg.outfits.staff.join(',')) out.push(`transmog: ${outfitSummary(old)}`);
  if (old.talents.join(',') !== cfg.talents.join(',')) out.push(`buffs: ${old.talents.length} active`);
  for (const v of VALUES) if ((old.values[v.key] ?? '') !== (cfg.values[v.key] ?? '')) out.push(`${v.key} = ${old.values[v.key] ?? '?'}`);
  if (formatAttrLine(old.attrs) !== formatAttrLine(cfg.attrs)) out.push(`locks: ${old.attrs.length}`);
  if (old.saved.length !== cfg.saved.length) out.push(`saved looks: ${old.saved.length}`);
  if (old.hotkey !== cfg.hotkey) out.push(`key: ${old.hotkey}`);
  return out.length ? out.join('; ') : 'same as now';
}

function cmdUndo(cfg, opts) {
  const backups = listBackups(cfg.file);
  const sub = opts._[1];
  if (!sub) {
    if (!backups.length) return console.log('No backups yet. One is written before every change.');
    console.log('Backups (newest first). Restore with: wukong-transmog undo <number>\n');
    backups.slice(0, 15).forEach((b, i) => console.log(`  ${String(i + 1).padStart(2)}  ${b.time.toLocaleString()}   ${describeBackupDiff(cfg, b.file)}`));
    return;
  }
  const n = parseInt(sub, 10);
  if (!backups[n - 1]) throw new Error(`No backup number ${sub}. Run "wukong-transmog undo" to list them.`);
  restoreBackup(cfg, backups[n - 1].file);
  console.log(`Restored the config from ${backups[n - 1].time.toLocaleString()}.\n${savedLine(cfg)}`);
}

// ---------- buff impact preview ----------
// The keeper writes the player's attributes every few seconds. After a buff is added or removed
// while a save is loaded, wait for the next snapshot and show which attributes moved.

const VOLATILE = new Set(LIVE_BARS.map(([, cur]) => cur));

async function showBuffImpact(cfg, before) {
  if (!before || before.stale) return;
  process.stdout.write('  Watching the game for attribute changes');
  const deadline = Date.now() + 12000;
  let rows = [];
  let latest = before;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 500));
    const snap = readAttrSnapshot(cfg.file);
    if (!snap || snap.time <= latest.time) { process.stdout.write('.'); continue; }
    latest = snap;
    rows = [];
    for (const [k, v] of Object.entries(snap.values)) {
      const b = before.values[k];
      if (b === undefined || VOLATILE.has(k) || Math.abs(v - b) < 0.0005) continue;
      rows.push(`    ${(ATTRS.find((a) => a.name === k)?.label ?? k).padEnd(38)} ${fmtNum(b)} -> ${fmtNum(v)}`);
    }
    if (rows.length) break;
  }
  console.log();
  if (rows.length) console.log('  The game now reports:\n' + rows.join('\n') + '\n');
  else console.log('  No attribute changed within 12 s. Many buffs act only on a trigger (a hit, a dodge, a spell) and do not show here.\n');
}

// ---------- interactive ----------

async function interactive(cfg, opts) {
  const { select, search, confirm, input } = await import('@inquirer/prompts');
  const allTiers = !!opts['all-tiers'];
  const pool = catalog({ allTiers });
  const backup = !opts['no-backup'];
  const saved = () => console.log('  ' + savedLine(cfg) + '\n');
  // Text question with a way back: an empty answer returns null.
  const ask = async (message, def) => {
    const a = (await input({ message: `${message} (empty = back)`, default: def })).trim();
    return a === '' ? null : a;
  };

  // Arrow-key list. Typing filters it; leaving it empty shows everything.
  const pickFrom = async (message, items, extra = []) =>
    search({
      message,
      pageSize: 18,
      source: (term) => {
        const hits = items.filter((i) => matches(i, term));
        const choices = hits.map((i) => ({
          name: `${i.name}${i.set ? `   [${shortName(i.set)}]` : ''}`,
          value: i.id,
          description: i.note ? i.note : undefined,
        }));
        return term ? choices : [...extra, ...choices];
      },
    });

  console.log(`Transmog & Buff Tool ${VERSION}`);
  console.log('Arrow keys to move, Enter to choose, Ctrl+C to quit. Typing narrows a list; every screen has "- back".\n');

  for (;;) {
    const action = await select({
      message: 'What do you want to do?',
      pageSize: 8,
      choices: [
        { name: `Transmog   change how my gear looks          (now: ${outfitSummary(cfg)})`, value: 'transmog' },
        { name: `Buffs      set bonuses and weapon effects I don't own   (${cfg.talents.length} active)`, value: 'buffs' },
        { name: 'Values     regeneration, speed, attack, defense', value: 'values' },
        { name: 'Undo       restore an earlier change', value: 'undo' },
        { name: 'Doctor     check the install and the logs when something does not work', value: 'doctor' },
        { name: 'Options    trainer compatibility, attribute locks, game folder, uninstall', value: 'options' },
        { name: 'Quit', value: 'quit' },
      ],
    });
    if (action === 'quit') return;
    if (action === 'transmog') await menuTransmog();
    else if (action === 'buffs') await menuBuffs();
    else if (action === 'values') await menuValues();
    else if (action === 'undo') await menuUndo();
    else if (action === 'doctor') { cmdDoctor(cfg); await input({ message: 'Enter to go back' }); }
    else if (action === 'options') await menuOptions();
  }

  // ----- Transmog -----
  async function menuTransmog() {
    // Work on one outfit and always write it to both grips, so Tab never changes the look.
    const outfit = idsToOutfit(cfg.outfits.staff).outfit;
    const save = () => {
      const ids = outfitToIds(outfit);
      writeConfig(cfg, { staff: ids, spear: ids }, { backup });
      saved();
    };
    const current = (slot) => (outfit[slot] ? itemById(outfit[slot]).name : 'real gear');
    for (;;) {
      const action = await select({
        message: 'Transmog: only the look changes, your real gear and stats stay as they are.',
        pageSize: 11,
        choices: [
          { name: '- back', value: '__back__' },
          { name: `Armor set   pick a whole set`, value: 'set' },
          { name: `Weapon      ${current('weapon')}`, value: 'weapon' },
          { name: `Head        ${current('head')}`, value: 'head' },
          { name: `Body        ${current('body')}`, value: 'body' },
          { name: `Arms        ${current('arms')}`, value: 'arms' },
          { name: `Legs        ${current('legs')}`, value: 'legs' },
          { name: `Gourd       ${current('gourd')}`, value: 'gourd' },
          { name: `Saved looks ${cfg.saved.length ? `${cfg.saved.length} saved, in-game key ${cfg.hotkey}` : 'save this look, switch between looks, in-game key'}`, value: 'saved' },
          { name: 'Remove all transmog (show real gear)', value: 'clear' },
        ],
      });
      if (action === '__back__') return;
      if (action === 'saved') {
        await menuSaved();
        Object.assign(outfit, idsToOutfit(cfg.outfits.staff).outfit); // a saved look may have been put on
        continue;
      }
      if (action === 'clear') {
        if (await confirm({ message: 'Show real gear everywhere?', default: true })) {
          for (const s of SLOTS) outfit[s] = null;
          save();
        }
        continue;
      }
      if (action === 'set') {
        const setKey = await pickFrom(
          'Turn my armor into which set?',
          sets().map((s) => ({ id: s.key, name: shortName(s.name) + (s.fixedTier !== undefined ? ' (Mythical look)' : ''), note: setPieceNames(s) + (s.note ? '. ' + s.note : ''), aliases: (s.aliases ?? '') + ' ' + s.name + ' ' + setPieceNames(s) })),
          [{ name: '- back', value: '__back__' }],
        );
        if (setKey === '__back__') continue;
        for (const slot of ['head', 'body', 'arms', 'legs']) outfit[slot] = null;
        Object.assign(outfit, setPieces(setKey));
        save();
        continue;
      }
      const slot = action;
      const chosen = await pickFrom(
        `Turn my ${SLOT_LABEL[slot].toLowerCase()} into:`,
        pool.filter((i) => i.slot === slot),
        [{ name: '- back (keep as is)', value: '__back__' }, { name: '- real gear (no transmog in this slot)', value: null }],
      );
      if (chosen === '__back__') continue;
      outfit[slot] = chosen;
      save();
    }
  }

  // ----- Saved looks -----
  async function menuSaved() {
    for (;;) {
      const cur = cfg.outfits.staff.join(',');
      const pick = await select({
        message: `Saved looks. ${cfg.hotkey === 'None' ? 'Set an in-game key to cycle through them while playing.' : `${cfg.hotkey} in game puts on the next one.`}`,
        pageSize: 14,
        choices: [
          { name: '- back', value: '__back__' },
          { name: `+ save the current look (${outfitSummary(cfg)}) under a name`, value: '__save__' },
          { name: `In-game key   ${cfg.hotkey}${keeperInstalled(cfg.file) ? '' : '   (needs the keeper, see Doctor)'}`, value: '__key__', description: 'Pressing it in game puts on the next saved look, in the order shown here. Examples: F7, Ctrl+F7, NUMPAD1. Slots a look leaves empty keep the previous look until the next respawn.' },
          ...cfg.saved.map((o) => ({ name: `${o.name.padEnd(24)} ${idsSummary(o.ids)}${o.ids.join(',') === cur ? '   [wearing]' : ''}`, value: o.name, description: describeOutfit(o.ids) })),
        ],
      });
      if (pick === '__back__') return;
      if (pick === '__save__') {
        const name = await ask('Name for this look');
        if (name === null) continue;
        if (!validOutfitName(name)) { console.log('  Names cannot contain "=", ";" or "#" and are at most 40 characters.\n'); continue; }
        const list = cfg.saved.filter((o) => o.name.toLowerCase() !== name.toLowerCase());
        list.push({ name, ids: [...cfg.outfits.staff] });
        writeConfig(cfg, {}, { backup, saved: list });
        console.log(`  Saved as "${name}".\n`);
        continue;
      }
      if (pick === '__key__') {
        const answer = await ask('Key that puts on the next saved look in game (e.g. F7, Ctrl+F7; "none" = off)', cfg.hotkey);
        if (answer === null) continue;
        const key = normalizeHotkey(answer);
        if (!key) { console.log('  Not a key the game understands. Examples: F7, Ctrl+F7, Shift+O, NUMPAD1. Full list in TrueWukong-KeybindList.txt next to the config.\n'); continue; }
        writeConfig(cfg, {}, { backup, hotkey: key });
        console.log(key === 'None' ? '  In-game key removed.\n' : `  ${key} cycles the saved looks in game. Takes effect within a second (a new key while the game runs is picked up too).\n`);
        continue;
      }
      const o = cfg.saved.find((x) => x.name === pick);
      const what = await select({
        message: `"${o.name}": ${idsSummary(o.ids)}`,
        choices: [
          { name: '- back', value: '__back__' },
          { name: 'Wear it now', value: 'wear' },
          { name: 'Overwrite it with the current look', value: 'overwrite' },
          { name: 'Rename', value: 'rename' },
          { name: 'Delete', value: 'delete' },
        ],
      });
      if (what === 'wear') { writeConfig(cfg, { staff: o.ids, spear: o.ids }, { backup }); saved(); }
      else if (what === 'overwrite') { o.ids = [...cfg.outfits.staff]; writeConfig(cfg, {}, { backup, saved: cfg.saved }); console.log('  Updated.\n'); }
      else if (what === 'rename') {
        const name = await ask('New name', o.name);
        if (name === null) continue;
        if (!validOutfitName(name)) { console.log('  Names cannot contain "=", ";" or "#" and are at most 40 characters. Unchanged.\n'); continue; }
        o.name = name;
        writeConfig(cfg, {}, { backup, saved: cfg.saved });
      } else if (what === 'delete') {
        writeConfig(cfg, {}, { backup, saved: cfg.saved.filter((x) => x !== o) });
        console.log(`  Deleted "${o.name}".\n`);
      }
    }
  }

  // ----- Buffs -----
  async function menuBuffs() {
    const cat = loadTalentCatalog(cfg.file);
    for (;;) {
      const pick = await select({
        message: 'Buffs: effects of gear you do not own, active on any outfit.',
        pageSize: 12,
        choices: [
          { name: '- back', value: '__back__' },
          { name: '+ add a buff', value: '__add__' },
          ...cfg.talents.map((id) => {
            const t = talentById(cat, id);
            return { name: `x remove: ${fullName(t)}`, value: id, description: t.description ?? undefined };
          }),
        ],
      });
      if (pick === '__back__') return;
      let talents = [...cfg.talents];
      if (pick === '__add__') {
        const category = await select({
          message: 'Which kind of buff?',
          choices: [{ name: '- back', value: '__back__' }, ...CATEGORIES.map((c) => ({ name: c, value: c }))],
        });
        if (category === '__back__') continue;
        let items = cat.filter((t) => t.category === category && !cfg.talents.includes(t.id));
        if (category === 'Armor') {
          const group = await select({
            message: 'Which armor set?',
            pageSize: 18,
            choices: [{ name: '- back', value: '__back__' }, ...groupsOf(cat, 'Armor').map((g) => ({ name: g, value: g }))],
          });
          if (group === '__back__') continue;
          items = items.filter((t) => t.group === group);
        }
        const id = await select({
          message: `${category === 'Armor' ? items[0]?.group ?? 'Armor' : category}: which buff? (description below)`,
          pageSize: 14,
          choices: [
            { name: '- back', value: '__back__' },
            ...items.map((t) => ({ name: `${t.name}${t.description ? '' : '   (no description)'}`, value: t.id, description: t.description ?? `(no description available; ${t.kind})` })),
          ],
        });
        if (id === '__back__') continue;
        talents.push(id);
      } else talents = talents.filter((t) => t !== pick);
      const before = keeperInstalled(cfg.file) ? readAttrSnapshot(cfg.file) : null;
      writeConfig(cfg, {}, { backup, talents });
      saved();
      await showBuffImpact(cfg, before);
    }
  }

  // ----- Values -----
  async function menuValues() {
    const lite = trainerMode(cfg.file);
    for (;;) {
      const pick = await select({
        message: 'Values: the two multipliers take effect at the next respawn (shrine, transformation or reload); the rest right away.',
        pageSize: 16,
        choices: [
          { name: '- back', value: '__back__' },
          ...VALUES.map((v) => {
            const blocked = lite && !v.applies.includes('lite');
            return { name: `${v.label.padEnd(40)} ${cfg.values[v.key] !== undefined ? showNumber(cfg.values[v.key]) : '?'}${blocked ? '   (off while Trainer compatibility is on)' : ''}`, value: v.key, description: v.desc };
          }),
        ],
      });
      if (pick === '__back__') return;
      const v = valueByKey(pick);
      const answer = await ask(`${v.label} - new value (${v.desc})`, cfg.values[v.key] !== undefined ? showNumber(cfg.values[v.key]) : '');
      if (answer === null) continue;
      if (!Number.isFinite(parseFloat(answer))) { console.log('  Not a number, unchanged.\n'); continue; }
      writeConfig(cfg, {}, { backup, values: { [v.key]: configNumber(answer) } });
      saved();
    }
  }

  // ----- Undo -----
  async function menuUndo() {
    const backups = listBackups(cfg.file);
    if (!backups.length) { console.log('  No backups yet. One is written before every change.\n'); return; }
    const pick = await select({
      message: 'Restore the config as it was before a change:',
      pageSize: 14,
      choices: [
        { name: '- back', value: '__back__' },
        ...backups.slice(0, 20).map((b) => ({ name: `${b.time.toLocaleString()}   ${describeBackupDiff(cfg, b.file)}`, value: b.file })),
      ],
    });
    if (pick === '__back__') return;
    restoreBackup(cfg, pick);
    saved();
  }

  // ----- Options -----
  async function menuOptions() {
    for (;;) {
      const p = modPaths(cfg.file);
      const st = modState(p);
      const trainer = st.mode === 'lite';
      const pick = await select({
        message: 'Options',
        pageSize: 10,
        choices: [
          { name: '- back', value: '__back__' },
          { name: `Trainer compatibility   ${trainer ? 'ON' : 'off'}   (turn on if WeMod/FLiNG/Cheat Engine cannot attach)`, value: 'trainer', description: 'Runs the in-game mod without hooks. Looks and buffs still apply within a second; attack/defense multipliers and the cooldown timers are unavailable. Needs the game closed to switch.' },
          { name: `Attribute locks         ${cfg.attrs.length ? cfg.attrs.length + ' set' : 'none'}   (advanced)`, value: 'locks', description: 'Hold a stat such as max health or crit chance at a value you choose. Shows what the game currently uses.' },
          { name: `Game folder             ${gameDirOf(cfg.file)}`, value: 'folder', description: 'Change which game installation the tool works on, or reinstall the in-game part there. The choice is remembered in settings.json next to the tool.' },
          { name: `Status                  mod ${st.mode}, keeper ${st.keeper ? 'installed' : 'not installed'}, last log lines`, value: 'status' },
          { name: 'Uninstall               remove the in-game part (restores what it replaced)', value: 'uninstall' },
        ],
      });
      if (pick === '__back__') return;
      if (pick === 'trainer') {
        if (gameRunning()) { console.log('  Close the game first, then switch this.\n'); continue; }
        const want = trainer ? 'full' : 'lite';
        if (want === 'lite' && !st.patched) { console.log('  The in-game mod on this install is not the prepared version. Reinstall it via Options > Game folder.\n'); continue; }
        if (!(await confirm({ message: `Turn Trainer compatibility ${want === 'lite' ? 'ON' : 'off'}?`, default: true }))) continue;
        cmdMod(cfg, { _: ['mod', want] });
        console.log();
        continue;
      }
      if (pick === 'locks') { await menuLocks(); continue; }
      if (pick === 'folder') {
        const file = await chooseGameDir(findGameDirs(), { current: gameDirOf(cfg.file), offerReinstall: true });
        Object.assign(cfg, readConfig(file));
        console.log(`  Using ${file}\n`);
        continue;
      }
      if (pick === 'uninstall') {
        await menuUninstall();
        if (!fs.existsSync(cfg.file)) throw new Error('The in-game part was removed. Delete the tool folder whenever you like.');
        continue;
      }
      if (pick === 'status') {
        describeMod(cfg, st, p);
        for (const [title, file] of [['TrueWukongLog.txt', p.modLog], ['TransmogKeeperLog.txt', p.keeperLog]]) {
          const lines = tailLines(file, 6);
          console.log(`\n  ${title}${lines.length ? ` (last lines, ${new Date(fs.statSync(file).mtimeMs).toLocaleString()}):` : ': not written yet'}`);
          for (const l of lines) console.log('    ' + l.slice(0, 160));
        }
        console.log();
        continue;
      }
    }
  }

  async function menuUninstall() {
    const gameDir = gameDirOf(cfg.file);
    console.log(`  This removes the mod loader, the mod and the keeper from\n    ${gameDir}\n  and puts back any file they replaced. Buffs disappear at the next game start. Save games are not touched.\n`);
    if (gameRunning()) { console.log('  Close the game first.\n'); return; }
    if (!(await confirm({ message: 'Remove the in-game part now?', default: false }))) return;
    for (const line of uninstallFrom(gameDir)) console.log('  ' + line);
    writeSettings({ configPath: undefined });
    console.log('\n  Done. The tool folder itself can be deleted by hand.\n');
  }

  async function menuLocks() {
    if (!keeperInstalled(cfg.file)) { console.log('  Attribute locks need the keeper (see Doctor). Not installed on this game.\n'); return; }
    for (;;) {
      const snap = readAttrSnapshot(cfg.file);
      const now = (name) => (snap && snap.values[name] !== undefined ? `game now ${fmtNum(snap.values[name])}${snap.stale ? ' (stale)' : ''}` : 'game now ?');
      console.log('  ' + liveHeader(snap));
      const pick = await select({
        message: 'Attribute locks: the value is held there while you play.',
        pageSize: 16,
        choices: [
          { name: '- back', value: '__back__' },
          ...ATTRS.map((a) => {
            const cur = cfg.attrs.find((x) => x.name === a.name);
            return { name: `${a.label.padEnd(36)} ${cur ? 'locked at ' + cur.value : 'not locked'}, ${now(a.name)}`, value: a.name, description: `${a.name}: the game computes this from level, gear, talents and buffs. A lock re-applies your value whenever the game changes it. Type "none" to remove the lock.` };
          }),
        ],
      });
      if (pick === '__back__') return;
      const cur = cfg.attrs.find((x) => x.name === pick);
      const gameNow = snap && snap.values[pick] !== undefined ? fmtNum(snap.values[pick]) : '';
      const answer = await ask(`Lock ${pick} at (${now(pick)}; "none" = remove the lock)`, cur ? String(cur.value) : gameNow);
      if (answer === null) continue;
      let attrs = cfg.attrs.filter((x) => x.name !== pick);
      if (!/^(none|off|-)$/i.test(answer)) {
        if (!Number.isFinite(parseFloat(answer))) { console.log('  Not a number, unchanged.\n'); continue; }
        attrs.push({ name: pick, value: parseFloat(answer) });
      }
      writeConfig(cfg, {}, { backup, attrs });
      saved();
    }
  }
}

// ---------- main ----------

const HELP = `Transmog & Buff Tool ${VERSION}  (wukong-transmog)

  wukong-transmog                      menu (Transmog, Buffs, Values, Undo, Doctor, Options)
  wukong-transmog show                 what is configured right now
  wukong-transmog list [words...]      search looks (add --all-tiers, --json)
  wukong-transmog set [options]        change looks without the menu
      --set "<armor set>"              whole set (head/body/arms/legs)
      --weapon/--head/--body/--arms/--legs/--gourd "<name or id or none>"
      --clear                          remove all transmog
  wukong-transmog outfits              saved looks
      outfits save|wear|delete <name>
      outfits key <F7|Ctrl+F7|none>    in-game key that puts on the next saved look
  wukong-transmog buffs                active buffs (set bonuses, weapon and piece effects, curios)
      buffs list [words]               browse, grouped by category and armor set
      buffs info <name|id>             what a buff does
      buffs add|remove <name|id>...    e.g. buffs add "gilded radiance 4-piece"
      buffs clear
  wukong-transmog values               regen, speed, attack/defense multipliers
      values set <key> <number>        e.g. values set manaRegen 5
      values attr ...                  attribute locks (advanced)
  wukong-transmog undo [number]        list backups / restore one
  wukong-transmog doctor               check the install and the logs
  wukong-transmog install [game dir]   copy the bundled in-game part into the game folder
  wukong-transmog uninstall [--yes]    remove it again (restores replaced files)
  wukong-transmog mod status|full|lite|off   trainer compatibility = lite; off = vanilla
  global: --config <TrueWukongConfig.txt>  --all-tiers  --no-backup`;

// ---------- first-run install of the in-game part ----------

function rememberInstall(gameDir) {
  const file = path.join(gameDir, CONFIG_REL);
  writeSettings({ configPath: file, gameExe: gameExeStamp(gameDir) });
  return file;
}

async function cmdInstall(opts, { interactive: ask = false } = {}) {
  const gameDirs = findGameDirs();
  let gameDir = opts._[1] ?? opts.game ?? gameDirs[0];
  if (ask) {
    const { select, confirm } = await import('@inquirer/prompts');
    if (!hasPayload()) throw new Error('This copy of the tool has no bundled game files, so it cannot install the in-game part.\nUse the release zip from the mod page, or point it at an existing install with --config <TrueWukongConfig.txt>.');
    if (gameDirs.length > 1) gameDir = await select({ message: 'Several game folders found. Install into which one?', choices: gameDirs.map((g) => ({ name: g, value: g })) });
    if (!gameDir) throw new Error('The game folder was not found in any Steam library.\nRun: "Transmog & Buff Tool.bat" install "<path to BlackMythWukong>"');
    console.log(`Game folder: ${gameDir}`);
    if (gameRunning()) throw new Error('Close the game first, then start the tool again.');
    const ok = await confirm({ message: 'Install the in-game part there? (mod loader, mod and keeper; existing files are backed up)', default: true });
    if (!ok) throw new Error('Nothing installed.');
  }
  if (!gameDir) throw new Error('Game folder not found. Usage: wukong-transmog install "<path to BlackMythWukong>"');
  if (gameRunning()) throw new Error('Close the game first.');
  for (const line of installInto(gameDir)) console.log('  ' + line);
  console.log('  Done. Start the game whenever you like; looks apply on their own once a save is loaded.\n');
  return rememberInstall(gameDir);
}

function cmdUninstall(opts) {
  const dir = opts._[1] ?? (readSettings().configPath ? gameDirOf(readSettings().configPath) : findGameDirs()[0]);
  if (!dir || !isGameDir(dir)) throw new Error('Game folder not found. Usage: wukong-transmog uninstall "<path to BlackMythWukong>" --yes');
  if (!opts.yes) throw new Error(`This would remove the mod loader, the mod and the keeper from\n  ${dir}\nand restore any file they replaced. Add --yes to do it.`);
  if (gameRunning()) throw new Error('Close the game first.');
  for (const line of uninstallFrom(dir)) console.log('  ' + line);
  writeSettings({ configPath: undefined });
  console.log('  Done.');
}

/**
 * Menu: let the user pick the game folder from what was detected, or type one. Installs the
 * bundled in-game part there if it is missing (or offers to reinstall it). Remembers the choice.
 * @returns config path
 */
async function chooseGameDir(detected, { current, offerReinstall = false } = {}) {
  const { select, input, confirm } = await import('@inquirer/prompts');
  const known = [...new Set([current, ...detected].filter(Boolean))];
  let gameDir;
  for (;;) {
    const choice = await select({
      message: known.length ? 'Which game installation should the tool use?' : 'No Black Myth: Wukong installation was found in your Steam libraries.',
      choices: [
        ...known.map((g) => ({ name: `${g}${isInstalled(g) ? '' : '   (in-game part not installed yet)'}`, value: g })),
        { name: '- type the game folder myself', value: '__type__' },
      ],
    });
    gameDir = choice === '__type__'
      ? (await input({ message: 'Game folder (the one that contains "b1" and the game exe):' })).trim().replace(/^"|"$/g, '')
      : choice;
    if (isGameDir(gameDir)) break;
    console.log(`  That folder does not contain b1\\Binaries\\Win64\\b1-Win64-Shipping.exe: ${gameDir}\n`);
  }
  const installed = isInstalled(gameDir);
  if (!installed || (offerReinstall && hasPayload())) {
    if (!installed && !hasPayload()) throw new Error(`The in-game part is not installed in ${gameDir}, and this copy of the tool has no bundled game files to install it.\nUse the release zip from the mod page.`);
    const question = installed ? `Reinstall the in-game part into ${gameDir}? (fixes a broken or outdated install; your config is kept)` : `Install the in-game part into ${gameDir}? (mod loader, mod and keeper; existing files are backed up)`;
    if (await confirm({ message: question, default: !installed })) {
      if (gameRunning()) throw new Error('Close the game first, then start the tool again.');
      for (const line of installInto(gameDir)) console.log('  ' + line);
      console.log();
    } else if (!installed) throw new Error('Nothing installed.');
  }
  return rememberInstall(gameDir);
}

/** A newer bundled in-game part than the one in the game folder: offer to update it (menu only). */
async function maybeUpdate(gameDir) {
  if (!needsUpdate(gameDir)) return;
  const bundled = payloadVersion().split(' ')[0];
  if (gameRunning()) { console.log(`This tool version brings a newer in-game part (${bundled}). Close the game and start the tool again to install it.\n`); return; }
  const { confirm } = await import('@inquirer/prompts');
  if (!(await confirm({ message: `This tool version brings a newer in-game part (${bundled}). Install it now? (your config is kept)`, default: true }))) return;
  for (const line of installInto(gameDir)) console.log('  ' + line);
  writeSettings({ gameExe: gameExeStamp(gameDir) });
  console.log();
}

/** Steam updated the game since the in-game part was installed: say so once. */
function noteGameUpdate(gameDir) {
  const now = gameExeStamp(gameDir);
  if (!now) return;
  const s = readSettings();
  if (s.gameExe && s.gameExe !== now) console.log('Note: the game was updated since the in-game part was installed. If looks or buffs stop applying, run Doctor and check the mod page for a tool update.\n');
  if (s.gameExe !== now) writeSettings({ gameExe: now });
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cmd = opts._[0] ?? '';
  if (opts.help || cmd === 'help') return console.log(HELP);
  if (cmd === 'list') return cmdList(opts);
  if (cmd === 'install') return cmdInstall(opts);
  if (cmd === 'uninstall') return cmdUninstall(opts);
  let file;
  try {
    file = findConfig(opts.config);
  } catch (e) {
    if (!(e instanceof NeedsGameFolder)) throw e;
    if (cmd) {
      throw new Error(
        (e.gameDirs.length ? `Several game installations found:\n  ${e.gameDirs.join('\n  ')}\n` : 'No game installation found in your Steam libraries.\n') +
          'Start the tool without a command once and pick the game folder in the menu, or use --config <TrueWukongConfig.txt>.',
      );
    }
    console.log(`Transmog & Buff Tool ${VERSION}\n`);
    file = await chooseGameDir(e.gameDirs);
  }
  if (!cmd) {
    await maybeUpdate(gameDirOf(file));
    noteGameUpdate(gameDirOf(file));
  }
  const cfg = readConfig(file);
  if (cmd === 'show') return cmdShow(cfg);
  if (cmd === 'set') return cmdSet(cfg, opts);
  if (cmd === 'mod') return cmdMod(cfg, opts);
  if (cmd === 'buffs' || cmd === 'talents') return cmdTalents(cfg, opts);
  if (cmd === 'values') return cmdValues(cfg, opts);
  if (cmd === 'undo') return cmdUndo(cfg, opts);
  if (cmd === 'outfits' || cmd === 'looks') return cmdOutfits(cfg, opts);
  if (cmd === 'doctor') return cmdDoctor(cfg);
  if (cmd) throw new Error(`Unknown command "${cmd}".\n\n${HELP}`);
  return interactive(cfg, opts);
}

main().catch((err) => {
  if (err?.name === 'ExitPromptError') process.exit(0);
  console.error(err.message ?? err);
  process.exit(1);
});
