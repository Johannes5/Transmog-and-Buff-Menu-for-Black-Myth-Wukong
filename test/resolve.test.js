import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveItem, resolveSet, resolveTalent, resolveOutfit } from '../src/resolve.js';
import { catalog, itemById, slotOf, setPieces, sets } from '../src/data.js';
import { CURIO_EFFECTS, UNIQUE_PIECES, WEAPON_EFFECTS } from '../src/effects.js';

test('catalog IDs are unique and decode to their slot', () => {
  const all = catalog({ allTiers: true });
  const ids = all.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate IDs in the catalog');
  for (const it of all) assert.equal(slotOf(it.id), it.slot, `slot of ${it.id} ${it.name}`);
  assert.equal(itemById(99999).name, 'Unknown item 99999');
});

test('resolveItem by name, exact name, id and none', () => {
  assert.equal(resolveItem('none', 'head'), null);
  assert.equal(resolveItem('0', 'head'), null);
  assert.equal(resolveItem('12002', 'body'), 12002);
  assert.equal(resolveItem(undefined, 'body'), undefined);
  const weapon = catalog().find((i) => i.slot === 'weapon' && !/unconfirmed/i.test(i.name));
  assert.equal(resolveItem(weapon.name, 'weapon'), weapon.id);
  assert.throws(() => resolveItem('no such thing at all', 'legs'), /No legs item matches/);
});

test('resolveSet by key, name and words; every set has base pieces', () => {
  assert.equal(resolveSet('bull-king').key, 'bull-king');
  assert.equal(resolveSet("heaven's equal").key, 'heavens-equal');
  assert.throws(() => resolveSet('zzz'), /No armor set matches/);
  for (const s of sets()) {
    const pieces = setPieces(s.key);
    assert.ok(Object.keys(pieces).length > 0, `${s.key} has no pieces`);
    for (const id of Object.values(pieces)) assert.ok(itemById(id).set, `${s.key}: ${id} is not in the catalog`);
  }
});

test('resolveTalent and resolveOutfit', () => {
  const cat = [
    { id: 901012, name: '4-piece set bonus', aliases: 'Golden Set armor', category: 'Armor' },
    { id: 901014, name: '2-piece set bonus', aliases: 'Golden Set armor', category: 'Armor' },
  ];
  assert.equal(resolveTalent(cat, '901012'), 901012);
  assert.equal(resolveTalent(cat, '4-piece'), 901012);
  assert.throws(() => resolveTalent(cat, 'golden'), /ambiguous/);
  const saved = [{ name: 'Boss fits', ids: [1] }, { name: 'Casual', ids: [] }];
  assert.equal(resolveOutfit(saved, 'boss fits').ids[0], 1);
  assert.equal(resolveOutfit(saved, 'cas').name, 'Casual');
  assert.throws(() => resolveOutfit(saved, 'nope'), /No saved look/);
});

test('effect tables have the shape the catalog expects', () => {
  for (const [id, c] of Object.entries(CURIO_EFFECTS)) {
    assert.ok(id >= 106000 && id < 107000, id);
    assert.ok('name' in c && 'text' in c, id);
  }
  for (const [id, u] of Object.entries(UNIQUE_PIECES)) {
    assert.ok(id >= 907000 && id < 908000, id);
    assert.ok(['head', 'body', 'arms', 'legs'].includes(u.slot), id);
  }
  for (const id of Object.keys(WEAPON_EFFECTS)) assert.ok(id >= 15000 && id < 16000, id);
});
