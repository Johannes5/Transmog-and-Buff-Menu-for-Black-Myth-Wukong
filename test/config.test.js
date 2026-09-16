import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readConfig, writeConfig, configNumber, showNumber, parseIds, parseOutfits, formatOutfits, normalizeHotkey, validOutfitName, listBackups, pruneBackups, restoreBackup,
} from '../src/config.js';

const SAMPLE = [
  '# True Wukong config #',
  'healthRegen = 0',
  'wukongSpeed = 12E-1',
  '',
  '# transmog #',
  'staffTransmog = 15004,12001,11922,11923,11924,18008',
  'spearTransmog = 15004,12001,11922,11923,11924,18008',
  'addTalents = 901012,106031',
  'keeperAttr = MpMax:600,HpMax:1000',
  '',
].join('\r\n');

function tmpConfig(text = SAMPLE) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-'));
  const file = path.join(dir, 'TrueWukongConfig.txt');
  fs.writeFileSync(file, text);
  return file;
}

test('configNumber writes locale-proof numbers', () => {
  assert.equal(configNumber('5'), '5');
  assert.equal(configNumber(1.2), '12E-1');
  assert.equal(configNumber('0.03'), '3E-2');
  assert.equal(configNumber(2), '2');
  assert.equal(showNumber('12E-1'), '1.2');
  assert.equal(showNumber('3E-2'), '0.03');
  assert.equal(showNumber('abc'), 'abc');
});

test('parseIds ignores junk and zero', () => {
  assert.deepEqual(parseIds('15004, 12001,0,x,'), [15004, 12001]);
  assert.deepEqual(parseIds('0'), []);
  assert.deepEqual(parseIds(undefined), []);
});

test('readConfig decodes every line the tool owns', () => {
  const cfg = readConfig(tmpConfig());
  assert.equal(cfg.eol, '\r\n');
  assert.deepEqual(cfg.outfits.staff, [15004, 12001, 11922, 11923, 11924, 18008]);
  assert.deepEqual(cfg.outfits.spear, cfg.outfits.staff);
  assert.deepEqual(cfg.talents, [901012, 106031]);
  assert.deepEqual(cfg.attrs, [{ name: 'MpMax', value: 600 }, { name: 'HpMax', value: 1000 }]);
  assert.equal(cfg.values.wukongSpeed, '12E-1');
  assert.deepEqual(cfg.saved, []);
  assert.equal(cfg.hotkey, 'None');
});

test('writeConfig replaces only the given lines, keeps the rest and the line endings', () => {
  const file = tmpConfig();
  const cfg = readConfig(file);
  writeConfig(cfg, { staff: [15001], spear: [15001] }, { backup: false, talents: [], values: { wukongSpeed: configNumber(1.5) } });
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^staffTransmog = 15001\r\n/m);
  assert.match(text, /^spearTransmog = 15001\r\n/m);
  assert.match(text, /^addTalents = 0\r\n/m);
  assert.match(text, /^wukongSpeed = 15E-1\r\n/m);
  assert.match(text, /^healthRegen = 0\r\n/m);           // untouched
  assert.match(text, /^# True Wukong config #\r\n/m);   // comments survive
  assert.match(text, /^keeperAttr = MpMax:600,HpMax:1000\r\n/m);
  assert.deepEqual(cfg.outfits.staff, [15001]);         // the object was refreshed
  assert.deepEqual(cfg.talents, []);
});

test('writeConfig starts from the file on disk, not from stale memory', () => {
  const file = tmpConfig();
  const a = readConfig(file);
  const b = readConfig(file);
  writeConfig(a, {}, { backup: false, talents: [901012] });
  writeConfig(b, { staff: [15001], spear: [15001] }, { backup: false });
  const now = readConfig(file);
  assert.deepEqual(now.talents, [901012]);   // a's change survived b's write
  assert.deepEqual(now.outfits.staff, [15001]);
});

test('new keys are appended with a comment; saved looks and the key round-trip', () => {
  const file = tmpConfig();
  const cfg = readConfig(file);
  writeConfig(cfg, {}, { backup: false, saved: [{ name: 'Boss fits', ids: [15004, 12001] }, { name: 'Plain', ids: [] }], hotkey: 'Ctrl+F7' });
  const text = fs.readFileSync(file, 'utf8');
  assert.match(text, /^# TransmogKeeper only: saved looks/m);
  assert.match(text, /^keeperOutfits = Boss fits=15004,12001;Plain=0\r\n/m);
  assert.match(text, /^keeperOutfitKey = Ctrl\+F7\r\n/m);
  const again = readConfig(file);
  assert.deepEqual(again.saved, [{ name: 'Boss fits', ids: [15004, 12001] }, { name: 'Plain', ids: [] }]);
  assert.equal(again.hotkey, 'Ctrl+F7');
});

test('parseOutfits / formatOutfits', () => {
  assert.deepEqual(parseOutfits('A=1,2;B=0;=5;C'), [{ name: 'A', ids: [1, 2] }, { name: 'B', ids: [] }]);
  assert.equal(formatOutfits([]), '0');
  assert.equal(formatOutfits([{ name: 'A', ids: [1] }]), 'A=1');
  assert.ok(validOutfitName('Boss fits'));
  assert.ok(!validOutfitName('a=b'));
  assert.ok(!validOutfitName(' padded'));
  assert.ok(!validOutfitName('x'.repeat(41)));
});

test('normalizeHotkey', () => {
  assert.equal(normalizeHotkey('f7'), 'F7');
  assert.equal(normalizeHotkey('ctrl + f7'), 'Ctrl+F7');
  assert.equal(normalizeHotkey('Shift+Alt+o'), 'Shift+Alt+O');
  assert.equal(normalizeHotkey('7'), 'D7');
  assert.equal(normalizeHotkey('none'), 'None');
  assert.equal(normalizeHotkey(''), 'None');
  assert.equal(normalizeHotkey('F99'), null);
  assert.equal(normalizeHotkey('Ctrl+Ctrl+F7'), null);
  assert.equal(normalizeHotkey('Super+F7'), null);
});

test('every write makes a backup, backups are pruned and can be restored', async () => {
  const file = tmpConfig();
  const cfg = readConfig(file);
  for (let i = 1; i <= 35; i++) {
    writeConfig(cfg, { staff: [15000 + i], spear: [15000 + i] }, { backup: true });
    await new Promise((r) => setTimeout(r, 2)); // distinct timestamps
  }
  assert.equal(listBackups(file).length, 30);
  const newest = listBackups(file)[0];
  const before = readConfig(newest.file);
  assert.deepEqual(before.outfits.staff, [15034]); // the state before the last write
  restoreBackup(cfg, newest.file);
  assert.deepEqual(cfg.outfits.staff, [15034]);
  assert.deepEqual(readConfig(file).outfits.staff, [15034]);
  pruneBackups(file, 5);
  assert.equal(listBackups(file).length, 5);
});
