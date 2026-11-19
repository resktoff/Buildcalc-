import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { saveHistoryEntry, loadHistory } from '../../src/ui/history.js';
import { getSystem } from '../../src/core/units.js';
import { validateFields } from '../../src/core/validate.js';
import * as calcConcrete from '../../src/ui/calc-concrete.js';
import * as calcPaint from '../../src/ui/calc-paint.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

test('integration: restoring a concrete record restores mode, selects, unit system without double conversion, and recalculates', () => {
  const store = makeMemoryStorage();
  const savedInputs = {
    mode: 'slab',
    length: '5',
    width: '4',
    thickness: '10',
    waste: '10',
    quantity: '1',
    bagSize: '25kg',
  };
  saveHistoryEntry('concrete', { system: 'metric', inputs: savedInputs }, store);

  const [entry] = loadHistory('concrete', store);
  assert.equal(entry.system, 'metric');
  assert.deepEqual(entry.inputs, savedInputs);

  // Simulate user currently in imperial, then restoring a metric entry:
  // app.js calls applySystem(entry.system, { convertValues: false }) before setting inputs.
  const sys = getSystem(entry.system);
  const { ok, values } = validateFields(entry.inputs, calcConcrete.schema(entry.inputs, sys));
  assert.equal(ok, true);
  // Values must remain in metric (no double conversion): length = 5 m, width = 4 m, thickness = 10 cm
  assert.equal(values.length, 5);
  assert.equal(values.width, 4);
  assert.equal(values.thickness, 10);

  const result = calcConcrete.compute(values, entry.inputs, sys);
  assert.ok(Object.values(result).some((v) => typeof v === 'number' && Math.abs(v - 2.2) < 0.01));
});

test('integration: restoring a paint record restores checkboxes, selects, and conditional room mode', () => {
  const store = makeMemoryStorage();
  const savedInputs = {
    mode: 'room',
    length: '4',
    width: '3',
    height: '2.5',
    doors: '1',
    windows: '1',
    includeCeiling: true,
    coats: '2',
    coverage: '10',
    waste: '10',
    canSize: '4L',
  };
  saveHistoryEntry('paint', { system: 'metric', inputs: savedInputs }, store);

  const [entry] = loadHistory('paint', store);
  assert.equal(entry.inputs.includeCeiling, true);
  assert.equal(entry.inputs.mode, 'room');
  assert.equal(entry.inputs.canSize, '4L');

  const sys = getSystem(entry.system);
  const { ok, values } = validateFields(entry.inputs, calcPaint.schema(entry.inputs, sys));
  assert.equal(ok, true);

  const result = calcPaint.compute(values, entry.inputs, sys);
  assert.ok(result.litresTotal > 0);
});

test('integration: invalid calculation is never saved to history', () => {
  const store = makeMemoryStorage();
  const invalidInputs = {
    shape: 'slab',
    length: '-5',
    width: '4',
    thickness: '10',
    waste: '10',
    bagSize: '25kg',
  };
  const sys = getSystem('metric');
  const { ok } = validateFields(invalidInputs, calcConcrete.schema(invalidInputs, sys));
  assert.equal(ok, false);

  // Mirror app.js submit guard: only saveHistoryEntry when lastResultOk is true
  if (ok) {
    saveHistoryEntry('concrete', { system: 'metric', inputs: invalidInputs }, store);
  }
  assert.equal(loadHistory('concrete', store).length, 0);
});

test('integration: app.js wires restoreEntry with applySystem(..., convertValues: false), updateConditionals, and recalc', () => {
  const appSrc = readFileSync(new URL('../../src/ui/app.js', import.meta.url), 'utf8');
  assert.match(appSrc, /applySystem\(entry\.system,\s*\{\s*convertValues:\s*false\s*\}\)/);
  assert.match(appSrc, /updateConditionals\(entry\.inputs\)/);
  assert.match(appSrc, /recalc\(\{\s*touchedOnly:\s*false\s*\}\)/);
  assert.match(appSrc, /if\s*\(lastResultOk\)\s*\{\s*saveHistoryEntry\(/);
});
