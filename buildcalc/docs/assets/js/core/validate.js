/**
 * BuildCalc — input validation core.
 * Returns machine-readable error codes; the UI maps codes to translated messages.
 *
 * Error codes:
 *  - required : empty / missing value
 *  - nan      : not a finite number
 *  - min      : below minimum (strict when exclusiveMin)
 *  - max      : above maximum
 *  - integer  : must be a whole number
 */

export function validateNumber(raw, rule = {}) {
  const {
    required = true,
    min = 0,
    exclusiveMin = true,
    max = Infinity,
    integer = false,
  } = rule;

  const trimmed = typeof raw === 'string' ? raw.trim() : raw;
  const isEmpty = trimmed === '' || trimmed === null || trimmed === undefined ||
    (typeof trimmed === 'number' && Number.isNaN(trimmed));

  if (isEmpty) {
    return required ? { ok: false, code: 'required' } : { ok: true, value: null };
  }
  const value = typeof trimmed === 'number' ? trimmed : Number(String(trimmed).replace(',', '.'));
  if (!Number.isFinite(value)) return { ok: false, code: 'nan' };
  if (exclusiveMin ? value <= min : value < min) return { ok: false, code: 'min', min, exclusive: exclusiveMin };
  if (value > max) return { ok: false, code: 'max', max };
  if (integer && !Number.isInteger(value)) return { ok: false, code: 'integer' };
  return { ok: true, value };
}

/**
 * Validate a map of raw values against a schema { field: rule }.
 * Rules may contain `when(values)` to make a field conditional.
 * Returns { ok, values, errors } where errors is { field: {code,...} }.
 */
export function validateFields(raw, schema) {
  const values = {};
  const errors = {};
  for (const [field, rule] of Object.entries(schema)) {
    if (typeof rule.when === 'function' && !rule.when(raw)) continue;
    const res = validateNumber(raw[field], rule);
    if (res.ok) values[field] = res.value;
    else errors[field] = res;
  }
  return { ok: Object.keys(errors).length === 0, values, errors };
}

/** Shared sanity limits (in SI) to prevent absurd results from typos. */
export const LIMITS = Object.freeze({
  lengthM: 1000, // 1 km
  smallM: 5, // 5 m for thickness / tile size
  areaM2: 1_000_000, // 100 ha
  wastePercent: 100,
  quantity: 10_000,
  coats: 10,
  openings: 500,
  coverageM2PerL: 100,
  piecesPerBox: 10_000,
});
