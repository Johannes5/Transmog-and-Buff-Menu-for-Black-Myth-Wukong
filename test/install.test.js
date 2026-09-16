import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { uninstallFrom, isGameDir, isInstalled, WIN64, EXE } from '../src/install.js';

/** A fake game folder with the files the installer would have put there. */
function fakeGame({ foreignLoader = false, ownTrueWukong = false, otherMod = false } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-game-'));
  const win64 = path.join(dir, WIN64);
  const tw = path.join(win64, 'CSharpLoader', 'Mods', 'TrueWukong');
  const keeper = path.join(win64, 'CSharpLoader', 'Mods', 'TransmogKeeper');
  fs.mkdirSync(tw, { recursive: true });
  fs.mkdirSync(keeper, { recursive: true });
  fs.writeFileSync(path.join(win64, EXE), 'exe');
  fs.writeFileSync(path.join(win64, 'version.dll'), 'ours');
  fs.writeFileSync(path.join(win64, 'CSharpLoader', 'b1cs.ini'), 'EnableJit=1');
  fs.writeFileSync(path.join(tw, 'TrueWukong.dll'), 'ours');
  fs.writeFileSync(path.join(tw, 'TrueWukongConfig.txt'), 'staffTransmog = 0');
  fs.writeFileSync(path.join(tw, 'TrueWukongConfig.txt.bak-2026-01-01T00-00-00-000Z'), 'old');
  fs.writeFileSync(path.join(keeper, 'TransmogKeeper.dll'), 'ours');
  fs.writeFileSync(path.join(win64, 'TransmogKeeperLog.txt'), 'log');
  if (foreignLoader) {
    fs.writeFileSync(path.join(win64, 'version.dll.bak'), 'theirs');
    fs.writeFileSync(path.join(win64, 'CSharpLoader', 'b1cs.ini.bak'), 'EnableJit=0');
  }
  if (ownTrueWukong) fs.writeFileSync(path.join(tw, 'TrueWukong.dll.bak'), 'theirs');
  if (otherMod) {
    fs.mkdirSync(path.join(win64, 'CSharpLoader', 'Mods', 'OtherMod'));
    fs.writeFileSync(path.join(win64, 'CSharpLoader', 'Mods', 'OtherMod', 'OtherMod.dll'), 'x');
  }
  return { dir, win64, tw };
}

test('uninstall removes everything when the tool installed it all', () => {
  const { dir, win64 } = fakeGame();
  assert.ok(isGameDir(dir) && isInstalled(dir));
  uninstallFrom(dir);
  assert.ok(!fs.existsSync(path.join(win64, 'version.dll')));
  assert.ok(!fs.existsSync(path.join(win64, 'CSharpLoader')));
  assert.ok(!fs.existsSync(path.join(win64, 'TransmogKeeperLog.txt')));
  assert.ok(fs.existsSync(path.join(win64, EXE)));
  assert.ok(!isInstalled(dir));
});

test('uninstall restores a loader and a True Wukong that were there before', () => {
  const { dir, win64, tw } = fakeGame({ foreignLoader: true, ownTrueWukong: true });
  uninstallFrom(dir);
  assert.equal(fs.readFileSync(path.join(win64, 'version.dll'), 'utf8'), 'theirs');
  assert.ok(!fs.existsSync(path.join(win64, 'version.dll.bak')));
  assert.equal(fs.readFileSync(path.join(win64, 'CSharpLoader', 'b1cs.ini'), 'utf8'), 'EnableJit=0');
  assert.equal(fs.readFileSync(path.join(tw, 'TrueWukong.dll'), 'utf8'), 'theirs');
  assert.ok(fs.existsSync(path.join(tw, 'TrueWukongConfig.txt')), 'their config stays');
  assert.ok(!fs.readdirSync(tw).some((f) => f.includes('.bak-')), 'our dated backups are gone');
  assert.ok(!fs.existsSync(path.join(win64, 'CSharpLoader', 'Mods', 'TransmogKeeper')));
});

test('uninstall keeps the loader when another mod uses it', () => {
  const { dir, win64 } = fakeGame({ otherMod: true });
  const done = uninstallFrom(dir);
  assert.ok(fs.existsSync(path.join(win64, 'version.dll')), 'the other mod still needs the loader');
  assert.ok(fs.existsSync(path.join(win64, 'CSharpLoader', 'Mods', 'OtherMod', 'OtherMod.dll')));
  assert.ok(!fs.existsSync(path.join(win64, 'CSharpLoader', 'Mods', 'TrueWukong')));
  assert.ok(done.some((l) => /kept the mod loader/.test(l)));
});
