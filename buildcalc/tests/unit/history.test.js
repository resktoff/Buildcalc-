import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HISTORY_LIMIT,
  loadHistory,
  saveHistoryEntry,
  removeHistoryEntry,
  clearHistory,
} from '../../src/ui/history.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('history keeps at most 10 entries per calculator and separates calculators', () => {
  const store = makeMemoryStorage();
  for (let i = 1; i <= 12; i += 1) {
    saveHistoryEntry('concrete', { system: 'metric', inputs: { length: String(i), width: '4' } }, store);
  }
  saveHistoryEntry('paint', { system: 'imperial', inputs: { area: '400' } }, store);

  const concrete = loadHistory('concrete', store);
  const paint = loadHistory('paint', store);

  assert.equal(concrete.length, HISTORY_LIMIT);
  assert.equal(concrete[0].inputs.length, '12');
  assert.equal(concrete[9].inputs.length, '3');
  assert.equal(paint.length, 1);
  assert.equal(paint[0].system, 'imperial');
  assert.equal('summary' in concrete[0], false);
});

test('history avoids consecutive duplicates for identical system and inputs', () => {
  const store = makeMemoryStorage();
  saveHistoryEntry('flooring', { system: 'metric', inputs: { length: '5', width: '4' } }, store);
  saveHistoryEntry('flooring', { system: 'metric', inputs: { length: '5', width: '4' } }, store);

  const list = loadHistory('flooring', store);
  assert.equal(list.length, 1);
});

test('history supports removing a single entry and clearing all', () => {
  const store = makeMemoryStorage();
  saveHistoryEntry('paint', { system: 'metric', inputs: { area: '20' } }, store);
  saveHistoryEntry('paint', { system: 'metric', inputs: { area: '30' } }, store);

  let list = loadHistory('paint', store);
  assert.equal(list.length, 2);

  list = removeHistoryEntry('paint', list[0].id, store);
  assert.equal(list.length, 1);
  assert.equal(list[0].inputs.area, '20');

  list = clearHistory('paint', store);
  assert.equal(list.length, 0);
  assert.equal(loadHistory('paint', store).length, 0);
});

test('history tolerates blocked localStorage and corrupt JSON', () => {
  const throwingStore = {
    getItem: () => { throw new Error('blocked'); },
    setItem: () => { throw new Error('blocked'); },
    removeItem: () => { throw new Error('blocked'); },
  };
  assert.deepEqual(loadHistory('concrete', null), []);
  assert.deepEqual(loadHistory('concrete', throwingStore), []);
  assert.doesNotThrow(() => saveHistoryEntry('concrete', { system: 'metric', inputs: { a: '1' } }, throwingStore));
  assert.deepEqual(loadHistory('concrete', throwingStore), []);
  assert.deepEqual(clearHistory('concrete', throwingStore), []);

  const corruptStore = makeMemoryStorage();
  corruptStore.setItem('bc.history.concrete', '{not-valid-json');
  assert.deepEqual(loadHistory('concrete', corruptStore), []);
});
