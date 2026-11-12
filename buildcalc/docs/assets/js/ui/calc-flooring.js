import { convertLength, convertArea } from '../core/units.js';
import { LIMITS } from '../core/validate.js';
import { calculateFlooring } from '../core/calculators/flooring.js';
import { formatStep, renderResults } from './common.js';

export const id = 'flooring';
export const selects = {};

export function schema(raw, sys) {
  const L = convertLength(LIMITS.lengthM, 'm', sys.length);
  const S = convertLength(LIMITS.smallM, 'm', sys.small);
  const A = convertArea(LIMITS.areaM2, 'm2', sys.area);
  const isRoom = (r) => r.mode !== 'area';
  const isArea = (r) => r.mode === 'area';
  // Tile size: optional, but if one dimension is given the other is required.
  const tileGiven = (r) => String(r.tileLength ?? '').trim() !== '' || String(r.tileWidth ?? '').trim() !== '';
  return {
    length: { max: L, when: isRoom },
    width: { max: L, when: isRoom },
    area: { max: A, when: isArea },
    waste: { min: 0, exclusiveMin: false, max: LIMITS.wastePercent },
    tileLength: { max: S, required: true, when: tileGiven },
    tileWidth: { max: S, required: true, when: tileGiven },
    piecesPerBox: { min: 1, exclusiveMin: false, max: LIMITS.piecesPerBox, integer: true, when: (r) => r.boxMode === 'pieces' },
    boxArea: { max: A, when: (r) => r.boxMode === 'area' },
  };
}

export function compute(values, raw, sys) {
  const mode = raw.mode === 'area' ? 'area' : 'room';
  const params = { mode, wastePercent: values.waste };
  if (mode === 'room') {
    params.lengthM = convertLength(values.length, sys.length, 'm');
    params.widthM = convertLength(values.width, sys.length, 'm');
  } else {
    params.areaM2 = convertArea(values.area, sys.area, 'm2');
  }
  if (values.tileLength != null && values.tileWidth != null) {
    params.tileLengthM = convertLength(values.tileLength, sys.small, 'm');
    params.tileWidthM = convertLength(values.tileWidth, sys.small, 'm');
  }
  if (raw.boxMode === 'pieces' && values.piecesPerBox != null) params.piecesPerBox = values.piecesPerBox;
  if (raw.boxMode === 'area' && values.boxArea != null) params.boxAreaM2 = convertArea(values.boxArea, sys.area, 'm2');
  return calculateFlooring(params);
}

export function render(result, ctx) {
  const c = ctx.i18n.calc;
  const rows = [
    { label: c.results.net, value: ctx.area(result.areaM2) },
    { label: c.results.waste, value: `${ctx.area(result.wasteAreaM2)} (${ctx.percent(result.wastePercent)} %)` },
  ];
  if (result.pieces !== null) {
    rows.push({ label: c.results.pieces, value: ctx.int(result.pieces), help: `${c.results.pieceArea}: ${ctx.area(result.pieceAreaM2, 4)}` });
  }
  if (result.boxes !== null) rows.push({ label: c.results.boxes, value: ctx.int(result.boxes) });
  return renderResults({
    primaryLabel: c.results.total,
    primaryValue: ctx.area(result.areaWithWasteM2),
    rows,
    steps: result.steps.map((s) => formatStep(ctx, c.steps, s)),
    howLabel: ctx.i18n.common.howCalculated,
    disclaimer: ctx.i18n.common.disclaimer,
  });
}
