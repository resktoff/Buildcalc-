import { convertLength, convertArea, coverageToM2PerL, coverageFromM2PerL } from '../core/units.js';
import { LIMITS } from '../core/validate.js';
import { calculatePaint, CAN_SIZES, DEFAULT_DOOR_AREA_M2, DEFAULT_WINDOW_AREA_M2 } from '../core/calculators/paint.js';
import { formatStep, renderResults } from './common.js';

export const id = 'paint';

export const selects = {
  can: { options: CAN_SIZES, defaults: { metric: '4L', imperial: '1gal' } },
};

export function schema(raw, sys) {
  const L = convertLength(LIMITS.lengthM, 'm', sys.length);
  const A = convertArea(LIMITS.areaM2, 'm2', sys.area);
  const C = coverageFromM2PerL(LIMITS.coverageM2PerL, sys.coverageArea, sys.coverageVolume);
  const isRoom = (r) => r.mode !== 'area';
  const isArea = (r) => r.mode === 'area';
  return {
    length: { max: L, when: isRoom },
    width: { max: L, when: isRoom },
    height: { max: L, when: isRoom },
    area: { max: A, when: isArea },
    doors: { min: 0, exclusiveMin: false, max: LIMITS.openings, integer: true, required: false },
    windows: { min: 0, exclusiveMin: false, max: LIMITS.openings, integer: true, required: false },
    coats: { min: 1, exclusiveMin: false, max: LIMITS.coats, integer: true },
    coverage: { max: C },
    waste: { min: 0, exclusiveMin: false, max: LIMITS.wastePercent },
  };
}

export function compute(values, raw, sys) {
  const toM = (v) => convertLength(v, sys.length, 'm');
  const mode = raw.mode === 'area' ? 'area' : 'room';
  const params = {
    mode,
    doors: values.doors ?? 0,
    windows: values.windows ?? 0,
    coats: values.coats,
    coverageM2PerL: coverageToM2PerL(values.coverage, sys.coverageArea, sys.coverageVolume),
    wastePercent: values.waste,
    includeCeiling: raw.ceiling === 'on' || raw.ceiling === true,
    canId: raw.can && raw.can !== 'none' ? raw.can : undefined,
  };
  if (mode === 'room') {
    params.lengthM = toM(values.length);
    params.widthM = toM(values.width);
    params.heightM = toM(values.height);
  } else {
    params.areaM2 = convertArea(values.area, sys.area, 'm2');
  }
  return calculatePaint(params);
}

/** Help text for openings in display units (used by app.js on unit toggle). */
export function dynamicHelp(ctx) {
  return {
    doors: ctx.t('calc.fields.doorsHelp', { area: ctx.area(DEFAULT_DOOR_AREA_M2, 1) }),
    windows: ctx.t('calc.fields.windowsHelp', { area: ctx.area(DEFAULT_WINDOW_AREA_M2, 1) }),
  };
}

export function render(result, ctx) {
  const c = ctx.i18n.calc;
  const rows = [
    { label: c.results.net, value: ctx.liquid(result.litresNet) },
    { label: c.results.area, value: ctx.area(result.netAreaM2) },
    { label: ctx.t('calc.results.areaCoats', { coats: ctx.int(result.coats) }), value: ctx.area(result.totalAreaM2) },
  ];
  if (result.openingsAreaM2 > 0) rows.push({ label: c.results.openings, value: ctx.area(result.openingsAreaM2) });
  if (result.cans !== null) {
    const can = CAN_SIZES.find((k) => k.id === result.canId);
    rows.push({ label: ctx.t('calc.results.cans', { can: can.label }), value: ctx.int(result.cans) });
  }
  return renderResults({
    primaryLabel: c.results.total,
    primaryValue: ctx.liquid(result.litresTotal),
    rows,
    warning: result.openingsExceedArea ? c.results.openingsWarning : null,
    steps: result.steps.map((s) => formatStep(ctx, c.steps, s)),
    howLabel: ctx.i18n.common.howCalculated,
    disclaimer: ctx.i18n.common.disclaimer,
  });
}
