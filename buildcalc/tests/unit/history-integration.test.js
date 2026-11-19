import test from 'node:test';
import assert from 'node:assert/strict';
import { saveHistoryEntry, loadHistory, restoreFormEntry } from '../../src/ui/history.js';
import { getSystem } from '../../src/core/units.js';
import { validateFields } from '../../src/core/validate.js';
import * as calcConcrete from '../../src/ui/calc-concrete.js';
import * as calcPaint from '../../src/ui/calc-paint.js';
import * as calcFlooring from '../../src/ui/calc-flooring.js';

function makeMemoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

function makeMockForm(controls) {
  const fieldWrappers = controls
    .filter((c) => c.name && c.name !== 'units')
    .map((c) => ({ dataset: {} }));
  return {
    controls,
    querySelectorAll(selector) {
      if (selector === 'input,select') return controls;
      if (selector === '[data-field]') return fieldWrappers;
      return [];
    },
    readInputs() {
      const out = {};
      for (const c of controls) {
        if (!c.name || c.name === 'units') continue;
        if (c.type === 'radio') {
          if (c.checked) out[c.name] = c.value;
        } else if (c.type === 'checkbox') {
          out[c.name] = Boolean(c.checked);
        } else {
          out[c.name] = c.value;
        }
      }
      return out;
    },
  };
}

test('restoreFormEntry restores inputs, radios, checkboxes, selects, and conditional fields and matches original paint result', () => {
  const store = makeMemoryStorage();
  const originalInputs = {
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
  const sys = getSystem('metric');
  const origVal = validateFields(originalInputs, calcPaint.schema(originalInputs, sys));
  assert.equal(origVal.ok, true);
  const originalResult = calcPaint.compute(origVal.values, originalInputs, sys);

  saveHistoryEntry('paint', { system: 'metric', inputs: originalInputs }, store);
  const [entry] = loadHistory('paint', store);

  const form = makeMockForm([
    { name: 'mode', type: 'radio', value: 'area', checked: true },
    { name: 'mode', type: 'radio', value: 'room', checked: false },
    { name: 'length', type: 'number', value: '' },
    { name: 'width', type: 'number', value: '' },
    { name: 'height', type: 'number', value: '' },
    { name: 'doors', type: 'number', value: '' },
    { name: 'windows', type: 'number', value: '' },
    { name: 'includeCeiling', type: 'checkbox', checked: false },
    { name: 'coats', type: 'number', value: '' },
    { name: 'coverage', type: 'number', value: '' },
    { name: 'waste', type: 'number', value: '' },
    { name: 'canSize', type: 'select-one', value: '1L' },
  ]);

  let activeSystem = 'imperial';
  let convertFlag = null;
  let condCalls = 0;
  let restoredResult = null;

  restoreFormEntry(form, entry, {
    applySystem: (s, opts) => { activeSystem = s; convertFlag = opts.convertValues; },
    storeSystem: () => {},
    updateConditionals: () => { condCalls += 1; },
    recalc: ({ touchedOnly }) => {
      assert.equal(touchedOnly, false);
      const raw = form.readInputs();
      const s = getSystem(activeSystem);
      const v = validateFields(raw, calcPaint.schema(raw, s));
      assert.equal(v.ok, true);
      restoredResult = calcPaint.compute(v.values, raw, s);
    },
  });

  assert.equal(activeSystem, 'metric');
  assert.equal(convertFlag, false);
  assert.equal(condCalls, 2);
  assert.equal(form.controls[1].checked, true);
  assert.equal(form.controls[7].checked, true);
  assert.equal(form.controls[11].value, '4L');
  assert.equal(restoredResult.litresTotal, originalResult.litresTotal);
});

test('restoreFormEntry switches imperial <-> metric in both directions without double conversion and matches original concrete result', () => {
  const store = makeMemoryStorage();
  const imperialInputs = {
    mode: 'slab',
    length: '10',
    width: '10',
    thickness: '4',
    waste: '10',
    quantity: '1',
    bagSize: '80lb',
  };
  const impSys = getSystem('imperial');
  const origImpVal = validateFields(imperialInputs, calcConcrete.schema(imperialInputs, impSys));
  assert.equal(origImpVal.ok, true);
  const originalImpResult = calcConcrete.compute(origImpVal.values, imperialInputs, impSys);

  saveHistoryEntry('concrete', { system: 'imperial', inputs: imperialInputs }, store);
  const [impEntry] = loadHistory('concrete', store);

  const form = makeMockForm([
    { name: 'mode', type: 'radio', value: 'slab', checked: true },
    { name: 'length', type: 'number', value: '5' },
    { name: 'width', type: 'number', value: '4' },
    { name: 'thickness', type: 'number', value: '10' },
    { name: 'waste', type: 'number', value: '10' },
    { name: 'quantity', type: 'number', value: '1' },
    { name: 'bagSize', type: 'select-one', value: '25kg' },
  ]);

  // Direction 1: Metric form -> restore Imperial entry
  let activeSystem = 'metric';
  let restoredImpResult = null;
  restoreFormEntry(form, impEntry, {
    applySystem: (s, opts) => {
      assert.equal(opts.convertValues, false);
      activeSystem = s;
    },
    storeSystem: () => {},
    updateConditionals: () => {},
    recalc: () => {
      const raw = form.readInputs();
      const s = getSystem(activeSystem);
      const v = validateFields(raw, calcConcrete.schema(raw, s));
      assert.equal(v.ok, true);
      assert.equal(v.values.length, 10);
      assert.equal(v.values.thickness, 4);
      restoredImpResult = calcConcrete.compute(v.values, raw, s);
    },
  });
  assert.equal(activeSystem, 'imperial');
  assert.deepEqual(restoredImpResult, originalImpResult);

  // Direction 2: Imperial form -> restore Metric entry
  const metricInputs = {
    mode: 'slab',
    length: '5',
    width: '4',
    thickness: '10',
    waste: '10',
    quantity: '1',
    bagSize: '25kg',
  };
  const metSys = getSystem('metric');
  const origMetVal = validateFields(metricInputs, calcConcrete.schema(metricInputs, metSys));
  assert.equal(origMetVal.ok, true);
  const originalMetResult = calcConcrete.compute(origMetVal.values, metricInputs, metSys);

  saveHistoryEntry('concrete', { system: 'metric', inputs: metricInputs }, store);
  const [metEntry] = loadHistory('concrete', store);

  let restoredMetResult = null;
  restoreFormEntry(form, metEntry, {
    applySystem: (s, opts) => {
      assert.equal(opts.convertValues, false);
      activeSystem = s;
    },
    storeSystem: () => {},
    updateConditionals: () => {},
    recalc: () => {
      const raw = form.readInputs();
      const s = getSystem(activeSystem);
      const v = validateFields(raw, calcConcrete.schema(raw, s));
      assert.equal(v.ok, true);
      assert.equal(v.values.length, 5);
      assert.equal(v.values.thickness, 10);
      restoredMetResult = calcConcrete.compute(v.values, raw, s);
    },
  });
  assert.equal(activeSystem, 'metric');
  assert.deepEqual(restoredMetResult, originalMetResult);
});

test('restoreFormEntry restores and recalculates flooring matching original result', () => {
  const store = makeMemoryStorage();
  const flooringInputs = {
    mode: 'room',
    length: '5',
    width: '4',
    waste: '10',
    tileLength: '60',
    tileWidth: '60',
    tilesPerBox: '4',
  };
  const sys = getSystem('metric');
  const origVal = validateFields(flooringInputs, calcFlooring.schema(flooringInputs, sys));
  assert.equal(origVal.ok, true);
  const originalResult = calcFlooring.compute(origVal.values, flooringInputs, sys);

  saveHistoryEntry('flooring', { system: 'metric', inputs: flooringInputs }, store);
  const [entry] = loadHistory('flooring', store);

  const form = makeMockForm([
    { name: 'mode', type: 'radio', value: 'room', checked: false },
    { name: 'length', type: 'number', value: '' },
    { name: 'width', type: 'number', value: '' },
    { name: 'waste', type: 'number', value: '' },
    { name: 'tileLength', type: 'number', value: '' },
    { name: 'tileWidth', type: 'number', value: '' },
    { name: 'tilesPerBox', type: 'number', value: '' },
  ]);

  let activeSystem = 'imperial';
  let restoredResult = null;

  restoreFormEntry(form, entry, {
    applySystem: (s) => { activeSystem = s; },
    storeSystem: () => {},
    updateConditionals: () => {},
    recalc: () => {
      const raw = form.readInputs();
      const s = getSystem(activeSystem);
      const v = validateFields(raw, calcFlooring.schema(raw, s));
      assert.equal(v.ok, true);
      restoredResult = calcFlooring.compute(v.values, raw, s);
    },
  });

  assert.equal(restoredResult.totalAreaM2, originalResult.totalAreaM2);
  assert.equal(restoredResult.boxes, originalResult.boxes);
});

test('submit flow does not save invalid calculation to history when validation fails', () => {
  const store = makeMemoryStorage();
  const form = makeMockForm([
    { name: 'mode', type: 'radio', value: 'slab', checked: true },
    { name: 'length', type: 'number', value: '-5' },
    { name: 'width', type: 'number', value: '4' },
    { name: 'thickness', type: 'number', value: '10' },
    { name: 'waste', type: 'number', value: '10' },
    { name: 'quantity', type: 'number', value: '1' },
    { name: 'bagSize', type: 'select-one', value: '25kg' },
  ]);

  let lastResultOk = false;
  function simulateSubmit() {
    const raw = form.readInputs();
    const sys = getSystem('metric');
    const { ok } = validateFields(raw, calcConcrete.schema(raw, sys));
    lastResultOk = ok;
    if (lastResultOk) {
      saveHistoryEntry('concrete', { system: 'metric', inputs: raw }, store);
    }
  }

  simulateSubmit();
  assert.equal(lastResultOk, false);
  assert.equal(loadHistory('concrete', store).length, 0);
});
