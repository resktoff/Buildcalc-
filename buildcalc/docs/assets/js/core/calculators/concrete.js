/**
 * BuildCalc — concrete volume calculator (SI internally).
 *
 * Shapes:
 *  - slab     : rectangular prism  V = L × W × T
 *  - cylinder : round column       V = π × (D/2)² × H
 *
 * Bag yield: pre-mixed concrete bags yield ≈ 0.60 ft³ per 80 lb bag,
 * i.e. a placed density of ≈ 2136 kg/m³ of dry mix. We use that constant for
 * every bag size so results are consistent across units.
 */

export const CONCRETE_SHAPES = Object.freeze(['slab', 'cylinder']);

/**
 * Yield of bagged pre-mix per kg of dry mix, anchored to the industry rule
 * "one 80 lb bag ≈ 0.60 ft³" (so 45 bags ≈ 1 yd³, 60 lb ≈ 0.45 ft³, 40 lb ≈ 0.30 ft³).
 * 0.60 ft³ / 80 lb = 0.0075 ft³/lb → m³/kg.
 */
export const BAG_YIELD_M3_PER_KG = (0.6 * 0.028316846592) / (80 * 0.45359237);
/** Equivalent placed density (≈ 2135.8 kg/m³), exported for documentation/UI. */
export const BAG_YIELD_KG_PER_M3 = 1 / BAG_YIELD_M3_PER_KG;

export const BAG_SIZES = Object.freeze([
  { id: '25kg', massKg: 25, system: 'metric', label: '25 kg' },
  { id: '40kg', massKg: 40, system: 'metric', label: '40 kg' },
  { id: '50kg', massKg: 50, system: 'metric', label: '50 kg' },
  { id: '60lb', massKg: 60 * 0.45359237, system: 'imperial', label: '60 lb' },
  { id: '80lb', massKg: 80 * 0.45359237, system: 'imperial', label: '80 lb' },
]);

export function getBag(id) {
  const bag = BAG_SIZES.find((b) => b.id === id);
  if (!bag) throw new RangeError(`Unknown bag size: ${id}`);
  return bag;
}

export function bagYieldM3(bagId) {
  return getBag(bagId).massKg * BAG_YIELD_M3_PER_KG;
}

/**
 * @param {object} p
 * @param {'slab'|'cylinder'} p.shape
 * @param {number} [p.lengthM]     slab length (m)
 * @param {number} [p.widthM]      slab width (m)
 * @param {number} [p.thicknessM]  slab thickness (m)
 * @param {number} [p.diameterM]   cylinder diameter (m)
 * @param {number} [p.heightM]     cylinder height (m)
 * @param {number} [p.quantity=1]  number of identical elements
 * @param {number} [p.wastePercent=0]
 * @param {string} [p.bagId]       optional bag size for bag count
 */
export function calculateConcrete(p) {
  const shape = p.shape;
  if (!CONCRETE_SHAPES.includes(shape)) throw new RangeError(`Unknown shape: ${shape}`);
  const quantity = p.quantity ?? 1;
  const wastePercent = p.wastePercent ?? 0;
  assertPositive({ quantity });
  assertNonNegative({ wastePercent });

  let unitVolumeM3;
  const steps = [];
  if (shape === 'slab') {
    const { lengthM, widthM, thicknessM } = p;
    assertPositive({ lengthM, widthM, thicknessM });
    unitVolumeM3 = lengthM * widthM * thicknessM;
    steps.push({ id: 'slabVolume', lengthM, widthM, thicknessM, unitVolumeM3 });
  } else {
    const { diameterM, heightM } = p;
    assertPositive({ diameterM, heightM });
    const radiusM = diameterM / 2;
    unitVolumeM3 = Math.PI * radiusM * radiusM * heightM;
    steps.push({ id: 'cylinderVolume', diameterM, radiusM, heightM, unitVolumeM3 });
  }

  const netVolumeM3 = unitVolumeM3 * quantity;
  if (quantity !== 1) steps.push({ id: 'quantity', quantity, unitVolumeM3, netVolumeM3 });

  const wasteVolumeM3 = netVolumeM3 * (wastePercent / 100);
  const totalVolumeM3 = netVolumeM3 + wasteVolumeM3;
  steps.push({ id: 'waste', wastePercent, netVolumeM3, wasteVolumeM3, totalVolumeM3 });

  const result = {
    shape,
    quantity,
    wastePercent,
    unitVolumeM3,
    netVolumeM3,
    wasteVolumeM3,
    totalVolumeM3,
    bags: null,
    bagId: null,
    bagYieldM3: null,
    steps,
  };

  if (p.bagId) {
    const yieldM3 = bagYieldM3(p.bagId);
    const bags = Math.ceil(totalVolumeM3 / yieldM3 - 1e-9);
    result.bagId = p.bagId;
    result.bagYieldM3 = yieldM3;
    result.bags = bags;
    steps.push({ id: 'bags', totalVolumeM3, bagYieldM3: yieldM3, bags, bagLabel: getBag(p.bagId).label });
  }
  return result;
}

function assertPositive(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (!Number.isFinite(v) || v <= 0) throw new RangeError(`${k} must be a positive finite number, got ${v}`);
  }
}
function assertNonNegative(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (!Number.isFinite(v) || v < 0) throw new RangeError(`${k} must be a non-negative finite number, got ${v}`);
  }
}
