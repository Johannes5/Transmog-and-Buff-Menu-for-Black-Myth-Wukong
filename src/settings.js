// Tool settings, stored next to the tool (not in the game folder): settings.json
//   { "configPath": "<game>\\b1\\Binaries\\Win64\\CSharpLoader\\Mods\\TrueWukong\\TrueWukongConfig.txt" }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SETTINGS_FILE = path.join(root, 'settings.json');

export function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch { return {}; }
}

export function writeSettings(patch) {
  const next = { ...readSettings(), ...patch };
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(next, null, 2) + '\n');
  return next;
}
