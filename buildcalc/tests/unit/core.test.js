import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertLength, convertArea, convertVolume, convertRole,
  coverageToM2PerL, coverageFromM2PerL, UNIT_SYSTEMS,
} from '../../src/core/units.js';
import { validateNumber, validateFields } from '../../src/core/validate.js';
import { calculateConcrete, bagYieldM3, BAG_SIZES } from '../../src/core/calculators/concrete.js';
import { calculatePaint, CAN_SIZES } from '../../src/core/calculators/paint.js';
import { calculateFlooring } from '../../src/core/calculators/flooring.js';

const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `expected ${a} ≈ ${b}`);

// ---------- units ----------
test('length conversions match reference values', () => {
  close(convertLength(1, 'ft', 'm'), 0.3048);
  close(convertLength(12, 'in', 'ft'), 1);
  close(convertLength(100, 'cm', 'm'), 1);
  close(convertLength(1, 'yd', 'ft'), 3);
});
test('area & volume conversions', () => {
  close(convertArea(1, 'm2', 'ft2'), 10.7639104);
  close(convertVolume(1, 'yd3', 'ft3'), 27);
  close(convertVolume(1, 'm3', 'yd3'), 1.3079506);
  close(convertVolume(1, 'gal', 'L'), 3.785411784);
});
test('coverage conversion 350 ft²/gal ≈ 8.59 m²/L and round-trips', () => {
  const si = coverageToM2PerL(350, 'ft2', 'gal');
  close(si, 8.589, 1e-3);
  close(coverageFromM2PerL(si, 'ft2', 'gal'), 350);
});
test('convertRole flips between systems', () => {
  close(convertRole(10, 'length', 'metric', 'imperial'), 32.8084, 1e-4);
  close(convertRole(2.54, 'small', 'metric', 'imperial'), 1);
  close(convertRole(1, 'area', 'imperial', 'metric'), 0.09290304);
  assert.throws(() => convertRole(1, 'bogus', 'metric', 'imperial'), RangeError);
});
test('unknown units throw', () => {
  assert.throws(() => convertLength(1, 'parsec', 'm'), RangeError);
  assert.throws(() => convertLength(NaN, 'm', 'm'), TypeError);
});
test('unit systems expose every role', () => {
  for (const sys of Object.values(UNIT_SYSTEMS)) {
    for (const role of ['length', 'small', 'area', 'volume', 'liquid', 'coverageArea', 'coverageVolume']) {
      assert.ok(sys[role], `${sys.id} missing ${role}`);
    }
  }
});

// ---------- validation ----------
test('validateNumber codes', () => {
  assert.equal(validateNumber('').code, 'required');
  assert.equal(validateNumber('', { required: false }).ok, true);
  assert.equal(validateNumber('abc').code, 'nan');
  assert.equal(validateNumber('0').code, 'min');
  assert.equal(validateNumber('-5').code, 'min');
  assert.equal(validateNumber('0', { exclusiveMin: false }).ok, true);
  assert.equal(validateNumber('1e9', { max: 1000 }).code, 'max');
  assert.equal(validateNumber('2.5', { integer: true }).code, 'integer');
  assert.equal(validateNumber('3,5').value, 3.5, 'accepts comma decimal');
  assert.equal(validateNumber(Infinity).code, 'nan');
});
test('validateFields honours conditional rules', () => {
  const schema = {
    a: { min: 0 },
    b: { min: 0, when: (v) => v.mode === 'x' },
  };
  const r1 = validateFields({ mode: 'y', a: '2' }, schema);
  assert.equal(r1.ok, true);
  const r2 = validateFields({ mode: 'x', a: '2', b: '' }, schema);
  assert.equal(r2.ok, false);
  assert.equal(r2.errors.b.code, 'required');
});

// ---------- concrete ----------
test('concrete slab 10×10 ft × 4 in = 1.235 yd³ (industry reference)', () => {
  const r = calculateConcrete({
    shape: 'slab',
    lengthM: convertLength(10, 'ft', 'm'),
    widthM: convertLength(10, 'ft', 'm'),
    thicknessM: convertLength(4, 'in', 'm'),
  });
  close(convertVolume(r.totalVolumeM3, 'm3', 'yd3'), 1.2346, 1e-3);
});
test('concrete slab metric 5 × 4 × 0.1 m = 2 m³, +10% = 2.2 m³', () => {
  const r = calculateConcrete({ shape: 'slab', lengthM: 5, widthM: 4, thicknessM: 0.1, wastePercent: 10 });
  close(r.netVolumeM3, 2);
  close(r.totalVolumeM3, 2.2);
  close(r.wasteVolumeM3, 0.2);
});
test('concrete cylinder Ø0.3 m × 3 m × 4 columns', () => {
  const r = calculateConcrete({ shape: 'cylinder', diameterM: 0.3, heightM: 3, quantity: 4 });
  close(r.unitVolumeM3, Math.PI * 0.15 * 0.15 * 3);
  close(r.netVolumeM3, r.unitVolumeM3 * 4);
});
test('concrete bags: 80 lb bag yields ≈ 0.60 ft³; 1 yd³ ≈ 45 bags', () => {
  close(convertVolume(bagYieldM3('80lb'), 'm3', 'ft3'), 0.6, 0.005);
  const r = calculateConcrete({ shape: 'slab', lengthM: 1, widthM: 1, thicknessM: 0.764554857984, bagId: '80lb' });
  assert.equal(r.bags, 45);
});
test('concrete bags: exact multiple does not round up spuriously', () => {
  const y = bagYieldM3('50kg');
  const r = calculateConcrete({ shape: 'slab', lengthM: 1, widthM: 1, thicknessM: y * 10, bagId: '50kg' });
  assert.equal(r.bags, 10);
});
test('concrete rejects invalid input', () => {
  assert.throws(() => calculateConcrete({ shape: 'slab', lengthM: 0, widthM: 1, thicknessM: 1 }), RangeError);
  assert.throws(() => calculateConcrete({ shape: 'sphere' }), RangeError);
  assert.throws(() => calculateConcrete({ shape: 'slab', lengthM: 1, widthM: 1, thicknessM: 1, wastePercent: -1 }), RangeError);
  assert.throws(() => calculateConcrete({ shape: 'slab', lengthM: 1, widthM: 1, thicknessM: 1, bagId: '99kg' }), RangeError);
});
test('bag sizes cover both systems', () => {
  assert.ok(BAG_SIZES.some((b) => b.system === 'metric'));
  assert.ok(BAG_SIZES.some((b) => b.system === 'imperial'));
});

// ---------- paint ----------
test('paint room 4×3×2.5 m, 1 door, 1 window, 2 coats, 10 m²/L', () => {
  const r = calculatePaint({ mode: 'room', lengthM: 4, widthM: 3, heightM: 2.5, doors: 1, windows: 1, coats: 2, coverageM2PerL: 10 });
  close(r.wallAreaM2, 35); // 2*(4+3)*2.5
  close(r.openingsAreaM2, 3.4);
  close(r.netAreaM2, 31.6);
  close(r.totalAreaM2, 63.2);
  close(r.litresNet, 6.32);
});
test('paint with ceiling, waste and can rounding', () => {
  const r = calculatePaint({ mode: 'room', lengthM: 4, widthM: 3, heightM: 2.5, includeCeiling: true, coats: 1, coverageM2PerL: 10, wastePercent: 10, canId: '4L' });
  close(r.ceilingAreaM2, 12);
  close(r.netAreaM2, 47);
  close(r.litresTotal, 5.17);
  assert.equal(r.cans, 2);
});
test('paint area mode imperial: 400 ft² at 350 ft²/gal ≈ 1.143 gal', () => {
  const r = calculatePaint({ mode: 'area', areaM2: convertArea(400, 'ft2', 'm2'), coats: 1, coverageM2PerL: coverageToM2PerL(350, 'ft2', 'gal') });
  close(convertVolume(r.litresTotal, 'L', 'gal'), 400 / 350, 1e-6);
});
test('paint: openings larger than area clamp to 0 and flag it', () => {
  const r = calculatePaint({ mode: 'area', areaM2: 1, doors: 5, coats: 1, coverageM2PerL: 10, canId: '1L' });
  assert.equal(r.netAreaM2, 0);
  assert.equal(r.openingsExceedArea, true);
  assert.equal(r.cans, 0);
});
test('paint rejects invalid input', () => {
  assert.throws(() => calculatePaint({ mode: 'room', lengthM: 1, widthM: 1, heightM: 1, coverageM2PerL: 0 }), RangeError);
  assert.throws(() => calculatePaint({ mode: 'room', lengthM: 1, widthM: 1, heightM: 1, coats: 0, coverageM2PerL: 10 }), RangeError);
  assert.throws(() => calculatePaint({ mode: 'room', lengthM: 1, widthM: 1, heightM: 1, doors: 1.5, coverageM2PerL: 10 }), RangeError);
  assert.throws(() => calculatePaint({ mode: 'weird', coverageM2PerL: 10 }), RangeError);
});
test('can sizes cover both systems', () => {
  assert.ok(CAN_SIZES.some((c) => c.system === 'metric'));
  assert.ok(CAN_SIZES.some((c) => c.system === 'imperial'));
});

// ---------- flooring ----------
test('flooring 5×4 m, 10% waste, 60×60 cm tiles, 4 per box', () => {
  const r = calculateFlooring({ mode: 'room', lengthM: 5, widthM: 4, wastePercent: 10, tileLengthM: 0.6, tileWidthM: 0.6, piecesPerBox: 4 });
  close(r.areaM2, 20);
  close(r.areaWithWasteM2, 22);
  assert.equal(r.pieces, Math.ceil(22 / 0.36)); // 62
  assert.equal(r.pieces, 62);
  assert.equal(r.boxes, 16);
  assert.equal(r.boxBasis, 'pieces');
});
test('flooring area mode with box coverage', () => {
  const r = calculateFlooring({ mode: 'area', areaM2: 30, wastePercent: 0, boxAreaM2: 2.2 });
  assert.equal(r.pieces, null);
  assert.equal(r.boxes, 14);
  assert.equal(r.boxBasis, 'area');
});
test('flooring imperial 12×10 ft with 12×24 in planks', () => {
  const r = calculateFlooring({
    mode: 'room',
    lengthM: convertLength(12, 'ft', 'm'), widthM: convertLength(10, 'ft', 'm'),
    wastePercent: 0,
    tileLengthM: convertLength(12, 'in', 'm'), tileWidthM: convertLength(24, 'in', 'm'),
  });
  close(convertArea(r.areaM2, 'm2', 'ft2'), 120);
  assert.equal(r.pieces, 60);
});
test('flooring rejects invalid input', () => {
  assert.throws(() => calculateFlooring({ mode: 'room', lengthM: -1, widthM: 1 }), RangeError);
  assert.throws(() => calculateFlooring({ mode: 'area', areaM2: 0 }), RangeError);
  assert.throws(() => calculateFlooring({ mode: 'area', areaM2: 10, tileLengthM: 0, tileWidthM: 1 }), RangeError);
  assert.throws(() => calculateFlooring({ mode: 'area', areaM2: 10, tileLengthM: 1, tileWidthM: 1, piecesPerBox: 2.5 }), RangeError);
});
