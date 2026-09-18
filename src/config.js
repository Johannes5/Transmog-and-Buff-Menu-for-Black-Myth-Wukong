// TrueWukongConfig.txt access: the lines the tool owns, backups and the number format the mod reads.
// Everything else in the file (the mod's own settings, comments) is preserved as is.
import fs from 'node:fs';
import path from 'node:path';
import { parseAttrLine, formatAttrLine } from './values.js';
import { parsePresets, formatPresets } from './presets.js';

export const CONFIG_REL = path.join('b1', 'Binaries', 'Win64', 'CSharpLoader', 'Mods', 'TrueWukong', 'TrueWukongConfig.txt');
export const KEYS = { staff: 'staffTransmog', spear: 'spearTransmog' };
export const TALENT_KEY = 'addTalents';
export const PRESETS_KEY = 'keeperPresets';   // named buffs "Name{talents=..;soaks=..;values=k:on:off;key=F8};..." (TransmogKeeper v1.7+ toggles by key)
export const BUFFS_KEY = 'keeperBuffs';      // TransmogKeeper v1.7+: kept buffs "id" (re-added whenever missing) or "id@heavy" (added on a 3+ point heavy attack)
/** Mode per kept buff ID; written as "id@mode" so the keeper knows when to add it. */
export const HEAVY_STING_ID = 990001;        // not a game buff: "990001@sting" tells the keeper to poison what a 3+ point heavy attack hits
export const KEPT_BUFF_MODES = { 92313: 'heavy', [HEAVY_STING_ID]: 'sting' };
export const formatBuffs = (ids) => (ids.length ? ids.map((id) => (KEPT_BUFF_MODES[id] ? `${id}@${KEPT_BUFF_MODES[id]}` : String(id))).join(',') : '0');
export const SOAKS_KEY = 'keeperSoaks';      // TransmogKeeper v1.6+: soak item IDs whose gourd effect is kept active
export const RECENT_KEY = 'recentBuffs';     // tool only: buffs removed lately, newest first (the menu offers to reactivate them)
export const RECENT_VALUES_KEY = 'recentValues';  // tool only: values reset lately "key:value;key:value", newest first
export const RECENT_KEPT = 12;

export function parseRecentValues(text) {
  return String(text ?? '').split(';').map((p) => p.trim()).filter((p) => p.includes(':')).map((p) => { const i = p.indexOf(':'); return { key: p.slice(0, i), value: p.slice(i + 1) }; }).filter((r) => r.key && r.value !== '');
}
export const formatRecentValues = (list) => (list.length ? list.map((r) => `${r.key}:${r.value}`).join(';') : '0');
export const ATTR_KEY = 'keeperAttr';
export const OUTFITS_KEY = 'keeperOutfits';   // "Name=id,id;Other name=id,id"  saved looks (TransmogKeeper v1.5+ cycles them)
export const HOTKEY_KEY = 'keeperOutfitKey';  // "F7", "Ctrl+F7", "None"        key that puts on the next saved look in game
export const DEFAULT_HOTKEY = 'F7';           // used when the line is missing (F7 is free: the patcher unbinds the mod's F4-F9 debug keys)
export const BACKUPS_KEPT = 30;

/** Config number back to a readable one: "12E-1" -> "1.2". */
export const showNumber = (raw) => (Number.isFinite(parseFloat(raw)) ? String(parseFloat(raw)) : String(raw));

/** Numbers the mod can read on every Windows locale: integers as is, decimals without a decimal point (12E-1). */
export function configNumber(n) {
  const v = parseFloat(n);
  if (Number.isInteger(v)) return String(v);
  const s = v.toString();
  if (/e/i.test(s)) return s.toUpperCase().replace('+', '');
  const decimals = s.split('.')[1].length;
  return `${Math.round(v * 10 ** decimals)}E-${decimals}`;
}

export function parseIds(text) {
  return String(text ?? '')
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** "Name=1,2;Name2=3" -> [{ name, ids }]. "0" or empty = none. Names keep their case and spaces. */
export function parseOutfits(text) {
  const out = [];
  for (const part of String(text ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    const name = part.slice(0, eq).trim();
    if (!name) continue;
    out.push({ name, ids: parseIds(part.slice(eq + 1)) });
  }
  return out;
}

export function formatOutfits(list) {
  return list.length ? list.map((o) => `${o.name}=${o.ids.length ? o.ids.join(',') : '0'}`).join(';') : '0';
}

/** A saved-outfit name may not contain the separators of the config line. */
export function validOutfitName(name) {
  return /^[^=;#]+$/.test(name) && name.trim() === name && name.length <= 40;
}

// Key names the loader understands (CSharpModBase.Input.Key), from TrueWukong-KeybindList.txt.
export const VALID_KEYS = new Set(
  `LBUTTON RBUTTON CANCEL MBUTTON XBUTTON1 XBUTTON2 BACK TAB CLEAR RETURN ENTER SHIFT CONTROL MENU PAUSE CAPITAL
   ESCAPE SPACE PRIOR NEXT END HOME LEFT UP RIGHT DOWN SELECT PRINT EXECUTE SNAPSHOT INSERT DELETE HELP
   D0 D1 D2 D3 D4 D5 D6 D7 D8 D9 A B C D E F G H I J K L M N O P Q R S T U V W X Y Z LWIN RWIN APPS SLEEP
   NUMPAD0 NUMPAD1 NUMPAD2 NUMPAD3 NUMPAD4 NUMPAD5 NUMPAD6 NUMPAD7 NUMPAD8 NUMPAD9 MULTIPLY ADD SEPARATOR SUBTRACT DECIMAL DIVIDE
   F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12 F13 F14 F15 F16 F17 F18 F19 F20 F21 F22 F23 F24 NUMLOCK SCROLL
   LSHIFT RSHIFT LCONTROL RCONTROL LMENU RMENU OEM_1 OEM_PLUS OEM_COMMA OEM_MINUS OEM_PERIOD OEM_2 OEM_3 OEM_4 OEM_5 OEM_6 OEM_7`
    .split(/\s+/)
    .filter(Boolean),
);
const MODIFIERS = { ctrl: 'Ctrl', control: 'Ctrl', alt: 'Alt', shift: 'Shift', win: 'Win', windows: 'Win' };

/**
 * Normalise a hotkey the user typed ("ctrl+f7", "F7", "none") to what the keeper reads ("Ctrl+F7").
 * Returns null when it is not a valid key.
 */
export function normalizeHotkey(text) {
  const parts = String(text ?? '').trim().split('+').map((p) => p.trim()).filter(Boolean);
  if (!parts.length || /^(none|off|-)$/i.test(parts.join(''))) return 'None';
  const key = parts.pop().toUpperCase().replace(/^(\d)$/, 'D$1');
  if (!VALID_KEYS.has(key)) return null;
  const mods = [];
  for (const p of parts) {
    const m = MODIFIERS[p.toLowerCase()];
    if (!m || mods.includes(m)) return null;
    mods.push(m);
  }
  return [...mods, key].join('+');
}

export function readConfig(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  const lines = raw.split(eol);
  const values = {};
  for (const l of lines) {
    const m = l.match(/^([A-Za-z_]+)\s*=\s*(.*)$/);
    if (m) values[m[1]] = m[2].trim();
  }
  const outfits = {};
  for (const grip of Object.keys(KEYS)) outfits[grip] = parseIds(values[KEYS[grip]]);
  return {
    file, raw, eol, lines, outfits, values,
    talents: parseIds(values[TALENT_KEY]),
    recent: parseIds(values[RECENT_KEY]),
    soaks: parseIds(values[SOAKS_KEY]),
    buffs: parseIds(String(values[BUFFS_KEY] ?? '').replace(/@[a-z]+/gi, '')),
    presets: parsePresets(values[PRESETS_KEY]),
    hasPresetsLine: values[PRESETS_KEY] !== undefined,
    recentValues: parseRecentValues(values[RECENT_VALUES_KEY]),
    attrs: parseAttrLine(values[ATTR_KEY]),
    saved: parseOutfits(values[OUTFITS_KEY]),
    hotkey: values[HOTKEY_KEY] === undefined || values[HOTKEY_KEY] === '' ? DEFAULT_HOTKEY : values[HOTKEY_KEY] === '0' ? 'None' : values[HOTKEY_KEY],
  };
}

/**
 * Write the tool's lines. `outfits` = { staff?: ids, spear?: ids }; the options replace the other
 * lines when given. A dated backup is written first (unless backup = false) and old backups pruned.
 */
export function writeConfig(cfg, outfits, { backup = true, talents, soaks, buffs, values, recentValues, attrs, saved, hotkey, presets, skipRecent = [] } = {}) {
  // Buffs that leave the active list are remembered as "recently active" (newest first, capped).
  let recent;
  if (talents || soaks || buffs) {
    const fresh0 = readConfig(cfg.file);
    const nextT = talents ?? fresh0.talents, nextS = soaks ?? fresh0.soaks, nextB = buffs ?? fresh0.buffs;
    const gone = [...fresh0.talents.filter((id) => !nextT.includes(id)), ...fresh0.soaks.filter((id) => !nextS.includes(id)), ...fresh0.buffs.filter((id) => !nextB.includes(id))]
      .filter((id) => !skipRecent.includes(id)); // parts of a named buff being switched off are not "recent"
    recent = [...gone, ...fresh0.recent.filter((id) => !gone.includes(id) && !nextT.includes(id) && !nextS.includes(id) && !nextB.includes(id))].slice(0, RECENT_KEPT);
  }
  // Always start from what is on disk right now: another CLI window, the game or a text editor may
  // have changed other lines since this session read the file (an older version re-used the lines
  // read at startup and silently reverted a transmog chosen from a second window).
  const fresh = readConfig(cfg.file);
  const lines = [...fresh.lines];
  const setLine = (key, value, comment) => {
    const idx = lines.findIndex((l) => l.startsWith(key + ' ='));
    const newLine = `${key} = ${value}`;
    if (idx >= 0) lines[idx] = newLine;
    else {
      // append, but keep the file's trailing newline (an empty last element) at the end
      const end = lines.length && lines[lines.length - 1] === '' ? lines.length - 1 : lines.length;
      lines.splice(end, 0, '', `# ${comment} #`, newLine);
    }
  };
  const setIds = (key, ids, comment) => setLine(key, ids.length ? ids.join(',') : '0', comment);
  for (const grip of Object.keys(KEYS)) {
    if (grip in outfits) setIds(KEYS[grip], outfits[grip], 'transmog IDs');
  }
  if (talents) setIds(TALENT_KEY, talents, 'talents activated on the player');
  if (presets) setLine(PRESETS_KEY, formatPresets(presets), 'named buffs: Name{talents=ids;soaks=ids;values=key:on:off;key=F8} (see wukong-transmog presets)');
  if (buffs) setLine(BUFFS_KEY, formatBuffs(buffs), 'TransmogKeeper only: kept buffs, "id" = re-added whenever missing, "id@heavy" = added on a 3+ point heavy attack, "id@sting" = such an attack poisons the enemy (see wukong-transmog buffs)');
  if (soaks) setIds(SOAKS_KEY, soaks, 'TransmogKeeper only: soaks (gourd additives) whose effect is kept active as if just drunk');
  if (recent) setIds(RECENT_KEY, recent, 'Transmog & Buff Tool only: buffs removed lately (the menu offers to reactivate them)');
  if (values) for (const [k, v] of Object.entries(values)) setLine(k, v, k);
  if (recentValues) setLine(RECENT_VALUES_KEY, formatRecentValues(recentValues.slice(0, RECENT_KEPT)), 'Transmog & Buff Tool only: values reset lately (the menu offers to reactivate them)');
  if (attrs) setLine(ATTR_KEY, formatAttrLine(attrs), 'TransmogKeeper only: attribute overrides "Name:value,Name:value" (see wukong-transmog values attr)');
  if (saved) setLine(OUTFITS_KEY, formatOutfits(saved), 'TransmogKeeper only: saved looks "Name=ids;Name=ids" (see wukong-transmog outfits)');
  if (hotkey) setLine(HOTKEY_KEY, hotkey, 'TransmogKeeper only: key that puts on the next saved look in game, e.g. F7 or Ctrl+F7 (None = off); Shift + it shows the real gear');
  if (backup) backupConfig(cfg.file);
  fs.writeFileSync(cfg.file, lines.join(fresh.eol), 'utf8');
  Object.assign(cfg, readConfig(cfg.file));
}

export function backupConfig(file) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  fs.copyFileSync(file, `${file}.bak-${stamp}`);
  pruneBackups(file);
}

export function listBackups(file) {
  const dir = path.dirname(file);
  const base = path.basename(file);
  return fs.readdirSync(dir)
    .filter((f) => f.startsWith(base + '.bak-'))
    .map((f) => {
      const full = path.join(dir, f);
      const m = f.match(/\.bak-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})(?:-(\d{3}))?/);
      const time = m ? new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5] ?? '000'}Z`) : fs.statSync(full).mtime;
      return { file: full, name: f, time };
    })
    .sort((a, b) => b.time - a.time);
}

export function pruneBackups(file, keep = BACKUPS_KEPT) {
  for (const b of listBackups(file).slice(keep)) {
    try { fs.unlinkSync(b.file); } catch { /* already gone */ }
  }
}

/** Put a backup back (the current file is backed up first). */
export function restoreBackup(cfg, backupFile) {
  backupConfig(cfg.file);
  fs.copyFileSync(backupFile, cfg.file);
  Object.assign(cfg, readConfig(cfg.file));
}
