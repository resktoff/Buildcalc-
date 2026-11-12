/**
 * BuildCalc — unit conversion core.
 * All calculators compute internally in SI (metres, m², m³, litres).
 * This module converts user input to SI and results back to the display system.
 * Dependency-free ES module shared by Node (tests/build) and the browser.
 */

/** Length units expressed in metres. */
export const LENGTH_TO_M = Object.freeze({
  mm: 0.001,
  cm: 0.01,
  m: 1,
  in: 0.0254,
  ft: 0.3048,
  yd: 0.9144,
});

/** Area units expressed in square metres. */
export const AREA_TO_M2 = Object.freeze({
  m2: 1,
  ft2: 0.09290304,
  yd2: 0.83612736,
});

/** Volume units expressed in cubic metres. */
export const VOLUME_TO_M3 = Object.freeze({
  m3: 1,
  L: 0.001,
  ft3: 0.028316846592,
  yd3: 0.764554857984,
  gal: 0.003785411784, // US liquid gallon
  qt: 0.000946352946, // US quart
});

/** Mass units expressed in kilograms. */
export const MASS_TO_KG = Object.freeze({
  kg: 1,
  lb: 0.45359237,
});

function convert(value, from, to, table, kind) {
  if (!(from in table)) throw new RangeError(`Unknown ${kind} unit: ${from}`);
  if (!(to in table)) throw new RangeError(`Unknown ${kind} unit: ${to}`);
  if (!Number.isFinite(value)) throw new TypeError(`Value must be a finite number, got ${value}`);
  return (value * table[from]) / table[to];
}

export const convertLength = (v, from, to) => convert(v, from, to, LENGTH_TO_M, 'length');
export const convertArea = (v, from, to) => convert(v, from, to, AREA_TO_M2, 'area');
export const convertVolume = (v, from, to) => convert(v, from, to, VOLUME_TO_M3, 'volume');
export const convertMass = (v, from, to) => convert(v, from, to, MASS_TO_KG, 'mass');

export const toMeters = (v, unit) => convertLength(v, unit, 'm');
export const fromMeters = (v, unit) => convertLength(v, 'm', unit);

/**
 * Coverage (paint spreading rate): area covered per unit of volume.
 * Metric: m² per litre. Imperial: ft² per US gallon.
 */
export function coverageToM2PerL(value, areaUnit, volumeUnit) {
  const m2 = convertArea(value, areaUnit, 'm2');
  const litres = convertVolume(1, volumeUnit, 'L');
  return m2 / litres;
}
export function coverageFromM2PerL(value, areaUnit, volumeUnit) {
  const area = convertArea(value, 'm2', areaUnit);
  const litres = convertVolume(1, volumeUnit, 'L');
  return area * litres;
}

/**
 * Unit systems: which unit each *dimension role* uses in the UI.
 *  - length: large dimensions (room length, slab width)
 *  - small:  small dimensions (slab thickness, tile size)
 *  - area:   areas typed directly by the user
 *  - volume: concrete volume (display)
 *  - liquid: paint volume (display)
 *  - coverage: paint spreading rate
 */
export const UNIT_SYSTEMS = Object.freeze({
  metric: Object.freeze({
    id: 'metric',
    length: 'm',
    small: 'cm',
    area: 'm2',
    volume: 'm3',
    volumeAlt: 'L',
    liquid: 'L',
    coverageArea: 'm2',
    coverageVolume: 'L',
  }),
  imperial: Object.freeze({
    id: 'imperial',
    length: 'ft',
    small: 'in',
    area: 'ft2',
    volume: 'yd3',
    volumeAlt: 'ft3',
    liquid: 'gal',
    coverageArea: 'ft2',
    coverageVolume: 'gal',
  }),
});

export function getSystem(id) {
  const sys = UNIT_SYSTEMS[id];
  if (!sys) throw new RangeError(`Unknown unit system: ${id}`);
  return sys;
}

/**
 * Convert a value of a given dimension role from one system to another
 * (used when the user flips the metric/imperial toggle with values typed in).
 */
export function convertRole(value, role, fromSystemId, toSystemId) {
  const from = getSystem(fromSystemId);
  const to = getSystem(toSystemId);
  switch (role) {
    case 'length':
    case 'small':
      return convertLength(value, from[role], to[role]);
    case 'area':
      return convertArea(value, from.area, to.area);
    case 'coverage': {
      const si = coverageToM2PerL(value, from.coverageArea, from.coverageVolume);
      return coverageFromM2PerL(si, to.coverageArea, to.coverageVolume);
    }
    case 'none':
      return value;
    default:
      throw new RangeError(`Unknown dimension role: ${role}`);
  }
}
