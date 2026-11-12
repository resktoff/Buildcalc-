/**
 * BuildCalc — paint quantity calculator (SI internally).
 *
 *  wall area     = 2 × (L + W) × H            (room mode)   or user-entered area
 *  ceiling area  = L × W                       (optional)
 *  openings      = doors × doorArea + windows × windowArea
 *  net area      = wall + ceiling − openings   (never below 0)
 *  total area    = net area × coats
 *  litres        = total area ÷ coverage (m² per litre)
 *  with waste    = litres × (1 + waste%)
 *  cans          = ceil(with waste ÷ can size)
 */

/** Typical opening sizes used when subtracting doors/windows. */
export const DEFAULT_DOOR_AREA_M2 = 1.9; // ≈ 0.9 m × 2.1 m  (≈ 20 ft²)
export const DEFAULT_WINDOW_AREA_M2 = 1.5; // ≈ 1.2 m × 1.25 m (≈ 16 ft²)

/** Common container sizes (litres) per unit system. */
export const CAN_SIZES = Object.freeze([
  { id: '1L', litres: 1, system: 'metric', label: '1 L' },
  { id: '4L', litres: 4, system: 'metric', label: '4 L' },
  { id: '10L', litres: 10, system: 'metric', label: '10 L' },
  { id: '20L', litres: 20, system: 'metric', label: '20 L' },
  { id: '1qt', litres: 0.946352946, system: 'imperial', label: '1 qt' },
  { id: '1gal', litres: 3.785411784, system: 'imperial', label: '1 gal' },
  { id: '5gal', litres: 18.92705892, system: 'imperial', label: '5 gal' },
]);

export function getCan(id) {
  const can = CAN_SIZES.find((c) => c.id === id);
  if (!can) throw new RangeError(`Unknown can size: ${id}`);
  return can;
}

/**
 * @param {object} p
 * @param {'room'|'area'} p.mode
 * @param {number} [p.lengthM]  room length (room mode)
 * @param {number} [p.widthM]   room width (room mode)
 * @param {number} [p.heightM]  wall height (room mode)
 * @param {number} [p.areaM2]   paintable area typed directly (area mode)
 * @param {boolean} [p.includeCeiling=false] (room mode)
 * @param {number} [p.doors=0]
 * @param {number} [p.windows=0]
 * @param {number} [p.doorAreaM2]
 * @param {number} [p.windowAreaM2]
 * @param {number} [p.coats=2]
 * @param {number} p.coverageM2PerL  spreading rate
 * @param {number} [p.wastePercent=0]
 * @param {string} [p.canId]
 */
export function calculatePaint(p) {
  const mode = p.mode ?? 'room';
  const coats = p.coats ?? 2;
  const doors = p.doors ?? 0;
  const windows = p.windows ?? 0;
  const doorAreaM2 = p.doorAreaM2 ?? DEFAULT_DOOR_AREA_M2;
  const windowAreaM2 = p.windowAreaM2 ?? DEFAULT_WINDOW_AREA_M2;
  const wastePercent = p.wastePercent ?? 0;
  const coverageM2PerL = p.coverageM2PerL;
  const includeCeiling = Boolean(p.includeCeiling);

  if (!Number.isFinite(coverageM2PerL) || coverageM2PerL <= 0) throw new RangeError('coverageM2PerL must be > 0');
  if (!Number.isInteger(coats) || coats < 1) throw new RangeError('coats must be an integer >= 1');
  if (!Number.isInteger(doors) || doors < 0) throw new RangeError('doors must be an integer >= 0');
  if (!Number.isInteger(windows) || windows < 0) throw new RangeError('windows must be an integer >= 0');
  if (!Number.isFinite(wastePercent) || wastePercent < 0) throw new RangeError('wastePercent must be >= 0');

  const steps = [];
  let wallAreaM2;
  let ceilingAreaM2 = 0;

  if (mode === 'room') {
    const { lengthM, widthM, heightM } = p;
    for (const [k, v] of Object.entries({ lengthM, widthM, heightM })) {
      if (!Number.isFinite(v) || v <= 0) throw new RangeError(`${k} must be > 0`);
    }
    const perimeterM = 2 * (lengthM + widthM);
    wallAreaM2 = perimeterM * heightM;
    steps.push({ id: 'wallArea', lengthM, widthM, heightM, perimeterM, wallAreaM2 });
    if (includeCeiling) {
      ceilingAreaM2 = lengthM * widthM;
      steps.push({ id: 'ceilingArea', lengthM, widthM, ceilingAreaM2 });
    }
  } else if (mode === 'area') {
    if (!Number.isFinite(p.areaM2) || p.areaM2 <= 0) throw new RangeError('areaM2 must be > 0');
    wallAreaM2 = p.areaM2;
    steps.push({ id: 'directArea', areaM2: wallAreaM2 });
  } else {
    throw new RangeError(`Unknown mode: ${mode}`);
  }

  const openingsAreaM2 = doors * doorAreaM2 + windows * windowAreaM2;
  if (openingsAreaM2 > 0) steps.push({ id: 'openings', doors, windows, doorAreaM2, windowAreaM2, openingsAreaM2 });

  const grossAreaM2 = wallAreaM2 + ceilingAreaM2;
  const netAreaM2 = Math.max(0, grossAreaM2 - openingsAreaM2);
  const openingsExceedArea = grossAreaM2 - openingsAreaM2 < 0;
  steps.push({ id: 'netArea', grossAreaM2, openingsAreaM2, netAreaM2 });

  const totalAreaM2 = netAreaM2 * coats;
  steps.push({ id: 'coats', netAreaM2, coats, totalAreaM2 });

  const litresNet = totalAreaM2 / coverageM2PerL;
  steps.push({ id: 'litres', totalAreaM2, coverageM2PerL, litresNet });

  const litresWaste = litresNet * (wastePercent / 100);
  const litresTotal = litresNet + litresWaste;
  steps.push({ id: 'waste', wastePercent, litresNet, litresWaste, litresTotal });

  const result = {
    mode,
    coats,
    wastePercent,
    wallAreaM2,
    ceilingAreaM2,
    openingsAreaM2,
    grossAreaM2,
    netAreaM2,
    totalAreaM2,
    coverageM2PerL,
    litresNet,
    litresWaste,
    litresTotal,
    openingsExceedArea,
    cans: null,
    canId: null,
    canLitres: null,
    steps,
  };

  if (p.canId) {
    const can = getCan(p.canId);
    const cans = litresTotal > 0 ? Math.ceil(litresTotal / can.litres - 1e-9) : 0;
    result.canId = can.id;
    result.canLitres = can.litres;
    result.cans = cans;
    steps.push({ id: 'cans', litresTotal, canLitres: can.litres, cans, canLabel: can.label });
  }
  return result;
}
