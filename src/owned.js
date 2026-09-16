// Looks the player has unlocked: TransmogKeeper v1.7+ writes b1\Binaries\Win64\TransmogKeeperOwned.txt
// (one equipment ID per line, plus "time=<unix ms>") from the save's bag while a save is loaded.
// The Transmog menu can filter its lists to those.
import fs from 'node:fs';
import path from 'node:path';

export const OWNED_FILE = 'TransmogKeeperOwned.txt';

/** @returns {{ time: Date, ids: Set<number> } | null} */
export function readOwned(configFile) {
  const file = path.join(path.dirname(configFile), '..', '..', '..', OWNED_FILE);
  if (!fs.existsSync(file)) return null;
  const ids = new Set();
  let time = null;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^time=(\d+)$/);
    if (m) { time = new Date(parseInt(m[1], 10)); continue; }
    const n = parseInt(line, 10);
    if (Number.isInteger(n) && n > 0) ids.add(n);
  }
  return { time: time ?? fs.statSync(file).mtime, ids };
}

/**
 * Is a catalog item unlocked? Armor counts by set family and slot (any quality tier of the piece,
 * because the game's gallery keeps every tier you have held); weapons and gourds by exact ID.
 */
export function isOwned(item, owned) {
  if (!owned) return true;
  if (owned.ids.has(item.id)) return true;
  if (['head', 'body', 'arms', 'legs'].includes(item.slot) && item.id >= 10000 && item.id < 13000) {
    const family = Math.floor(item.id / 100), slot = item.id % 10;
    for (const id of owned.ids) if (Math.floor(id / 100) === family && id % 10 === slot && id >= 10000 && id < 13000) return true;
  }
  return false;
}

/** A set is unlocked when every piece it has is unlocked. */
export function isSetOwned(setPieceIds, owned) {
  if (!owned) return true;
  return Object.values(setPieceIds).every((id) => isOwned({ id, slot: ['', 'head', 'body', 'arms', 'legs'][id % 10] }, owned));
}
