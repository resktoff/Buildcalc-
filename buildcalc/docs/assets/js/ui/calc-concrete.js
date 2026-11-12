import { convertLength, convertVolume } from '../core/units.js';
import { LIMITS } from '../core/validate.js';
import { calculateConcrete, BAG_SIZES } from '../core/calculators/concrete.js';
import { formatStep, renderResults } from './common.js';

export const id = 'concrete';

export const selects = {
  bag: { options: BAG_SIZES, defaults: { metric: '50kg', imperial: '80lb' } },
};

export function schema(raw, sys) {
  const L = convertLength(LIMITS.lengthM, 'm', sys.length);
  const S = convertLength(LIMITS.smallM, 'm', sys.small);
  const isSlab = (r) => r.shape !== 'cylinder';
  const isCyl = (r) => r.shape === 'cylinder';
  return {
    length: { max: L, when: isSlab },
    width: { max: L, when: isSlab },
    thickness: { max: S, when: isSlab },
    diameter: { max: S, when: isCyl },
    height: { max: L, when: isCyl },
    quantity: { min: 1, exclusiveMin: false, max: LIMITS.quantity, integer: true },
    waste: { min: 0, exclusiveMin: false, max: LIMITS.wastePercent },
  };
}

export function compute(values, raw, sys) {
  const toM = (v, unit) => convertLength(v, unit, 'm');
  const shape = raw.shape === 'cylinder' ? 'cylinder' : 'slab';
  const params = {
    shape,
    quantity: values.quantity,
    wastePercent: values.waste,
    bagId: raw.bag && raw.bag !== 'none' ? raw.bag : undefined,
  };
  if (shape === 'slab') {
    params.lengthM = toM(values.length, sys.length);
    params.widthM = toM(values.width, sys.length);
    params.thicknessM = toM(values.thickness, sys.small);
  } else {
    params.diameterM = toM(values.diameter, sys.small);
    params.heightM = toM(values.height, sys.length);
  }
  return calculateConcrete(params);
}

export function render(result, ctx) {
  const c = ctx.i18n.calc;
  const rows = [
    { label: c.results.net, value: ctx.volume(result.netVolumeM3) },
    { label: c.results.waste, value: `${ctx.volume(result.wasteVolumeM3)} (${ctx.percent(result.wastePercent)} %)` },
  ];
  if (result.quantity > 1) rows.push({ label: c.results.unit, value: ctx.volume(result.unitVolumeM3) });
  if (result.bags !== null) {
    const bag = BAG_SIZES.find((b) => b.id === result.bagId);
    const yieldTxt = ctx.sys.id === 'imperial'
      ? `${ctx.n(convertVolume(result.bagYieldM3, 'm3', 'ft3'), 2)} ${ctx.unitLabel('ft3')}`
      : `${ctx.n(convertVolume(result.bagYieldM3, 'm3', 'L'), 1)} ${ctx.unitLabel('L')}`;
    rows.push({
      label: ctx.t('calc.results.bags', { bag: bag.label }),
      value: ctx.int(result.bags),
      help: ctx.t('calc.results.bagsHelp', { yield: yieldTxt }),
    });
  }
  return renderResults({
    primaryLabel: c.results.total,
    primaryValue: ctx.volume(result.totalVolumeM3),
    rows,
    steps: result.steps.map((s) => formatStep(ctx, c.steps, s)),
    howLabel: ctx.i18n.common.howCalculated,
    disclaimer: ctx.i18n.common.disclaimer,
  });
}
