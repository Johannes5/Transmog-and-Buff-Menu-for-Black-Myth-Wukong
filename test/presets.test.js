import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DEFAULT_PRESETS, migratePresets, parsePresets, formatPresets, presetActive, presetChange, presetFromCurrent, validPresetName } from '../src/presets.js';
import { readConfig, writeConfig } from '../src/config.js';

const SAMPLE = ['wukongSpeed = 1', 'manaRegen = 0', 'defenseMultiplier = 1', 'addTalents = 901012', 'keeperSoaks = 0', ''].join('\r\n');
function tmpConfig() {
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'wt-')), 'TrueWukongConfig.txt');
  fs.writeFileSync(file, SAMPLE);
  return file;
}

test('presets round-trip through the config line', () => {
  const text = formatPresets(DEFAULT_PRESETS);
  assert.deepEqual(parsePresets(text), DEFAULT_PRESETS);
  assert.equal(formatPresets([]), '0');
  assert.deepEqual(parsePresets('0'), []);
  assert.deepEqual(parsePresets('Broken{values=nosuchkey:1:0};Ok{talents=1,x,2;key=Ctrl+F8}'), [
    { name: 'Broken', talents: [], soaks: [], buffs: [], values: {}, key: 'None' },
    { name: 'Ok', talents: [1, 2], soaks: [], buffs: [], values: {}, key: 'Ctrl+F8' },
  ]);
  assert.ok(validPresetName('Defence +40%'));
  assert.ok(!validPresetName('a{b'));
  assert.ok(!validPresetName('a;b'));
});

test('a preset is on when all of its parts are in effect; toggling writes the right lines', () => {
  const file = tmpConfig();
  const cfg = readConfig(file);
  const stinger = DEFAULT_PRESETS.find((p) => p.name === 'Self Stinger');
  const speed = DEFAULT_PRESETS.find((p) => p.name === 'Movement Speed 2x');
  assert.equal(presetActive(stinger, cfg), false);
  assert.equal(presetActive(speed, cfg), false);
  writeConfig(cfg, {}, { backup: false, ...presetChange(stinger, cfg, true) });
  assert.deepEqual(cfg.talents, [901012, 105013, 901411]);
  assert.deepEqual(cfg.buffs, [92313]);
  assert.deepEqual(cfg.soaks, []);
  assert.equal(presetActive(stinger, cfg), true);
  writeConfig(cfg, {}, { backup: false, ...presetChange(speed, cfg, true) });
  assert.equal(cfg.values.wukongSpeed, '2');
  assert.equal(presetActive(speed, cfg), true);
  writeConfig(cfg, {}, { backup: false, ...presetChange(speed, cfg, false) });
  assert.equal(cfg.values.wukongSpeed, '1');
  writeConfig(cfg, {}, { backup: false, ...presetChange(stinger, cfg, false) });
  assert.deepEqual(cfg.talents, [901012]);
  assert.deepEqual(cfg.soaks, []);
});

test('presets line round-trips through writeConfig and a preset can be built from the current state', () => {
  const file = tmpConfig();
  const cfg = readConfig(file);
  assert.equal(cfg.hasPresetsLine, false);
  writeConfig(cfg, {}, { backup: false, presets: DEFAULT_PRESETS, values: { wukongSpeed: '2' } });
  assert.equal(cfg.hasPresetsLine, true);
  assert.deepEqual(cfg.presets, DEFAULT_PRESETS);
  const mine = presetFromCurrent('Mine', cfg);
  assert.deepEqual(mine, { name: 'Mine', talents: [901012], soaks: [], buffs: [], values: { wukongSpeed: ['2', '1'] }, key: 'None' });
});

test('Heavy Sting is written as "990001@sting"; an old default "Stinger" is renamed and Heavy Sting added', () => {
  const sting = DEFAULT_PRESETS.find((p) => p.name === 'Heavy Sting');
  assert.match(formatPresets([sting]), /^Heavy Sting\{buffs=990001@sting;desc=/);
  assert.deepEqual(parsePresets(formatPresets([sting]))[0].buffs, [990001]);
  const old = parsePresets('Mana Regen{values=manaRegen:4:0};Stinger{talents=105013,901411;buffs=92313@heavy;key=F8}');
  const moved = migratePresets(old);
  assert.deepEqual(moved.map((p) => p.name), ['Mana Regen', 'Self Stinger', 'Heavy Sting']);
  assert.equal(moved[1].key, 'F8');
  assert.equal(migratePresets(moved), null);
  assert.equal(migratePresets(parsePresets('Stinger{talents=105013}')), null); // the user's own "Stinger" is left alone
});
