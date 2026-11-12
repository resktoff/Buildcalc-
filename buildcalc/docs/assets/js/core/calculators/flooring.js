/**
 * BuildCalc — flooring calculator (tiles, planks, laminate) — SI internally.
 *
 *  floor area        = L × W                   (room mode) or user-entered area
 *  area with waste   = area × (1 + waste%)
 *  piece area        = tileL × tileW
 *  pieces            = ceil(area with waste ÷ piece area)
 *  boxes             = ceil(pieces ÷ pieces per box)     (if pieces per box given)
 *                    | ceil(area with waste ÷ box area)  (if box coverage given)
 */

/**
 * @param {object} p
 * @param {'room'|'area'} p.mode
 * @param {number} [p.lengthM]
 * @param {number} [p.widthM]
 * @param {number} [p.areaM2]
 * @param {number} [p.wastePercent=10]
 * @param {number} [p.tileLengthM]   piece length (optional → no piece count)
 * @param {number} [p.tileWidthM]    piece width
 * @param {number} [p.piecesPerBox]  optional
 * @param {number} [p.boxAreaM2]     optional alternative to piecesPerBox
 */
export function calculateFlooring(p) {
  const mode = p.mode ?? 'room';
  const wastePercent = p.wastePercent ?? 10;
  if (!Number.isFinite(wastePercent) || wastePercent < 0) throw new RangeError('wastePercent must be >= 0');

  const steps = [];
  let areaM2;
  if (mode === 'room') {
    const { lengthM, widthM } = p;
    for (const [k, v] of Object.entries({ lengthM, widthM })) {
      if (!Number.isFinite(v) || v <= 0) throw new RangeError(`${k} must be > 0`);
    }
    areaM2 = lengthM * widthM;
    steps.push({ id: 'floorArea', lengthM, widthM, areaM2 });
  } else if (mode === 'area') {
    if (!Number.isFinite(p.areaM2) || p.areaM2 <= 0) throw new RangeError('areaM2 must be > 0');
    areaM2 = p.areaM2;
    steps.push({ id: 'directArea', areaM2 });
  } else {
    throw new RangeError(`Unknown mode: ${mode}`);
  }

  const wasteAreaM2 = areaM2 * (wastePercent / 100);
  const areaWithWasteM2 = areaM2 + wasteAreaM2;
  steps.push({ id: 'waste', wastePercent, areaM2, wasteAreaM2, areaWithWasteM2 });

  const result = {
    mode,
    wastePercent,
    areaM2,
    wasteAreaM2,
    areaWithWasteM2,
    pieceAreaM2: null,
    pieces: null,
    boxes: null,
    boxBasis: null,
    steps,
  };

  const hasTile = Number.isFinite(p.tileLengthM) && Number.isFinite(p.tileWidthM);
  if (hasTile) {
    if (p.tileLengthM <= 0 || p.tileWidthM <= 0) throw new RangeError('tile dimensions must be > 0');
    const pieceAreaM2 = p.tileLengthM * p.tileWidthM;
    const pieces = Math.ceil(areaWithWasteM2 / pieceAreaM2 - 1e-9);
    result.pieceAreaM2 = pieceAreaM2;
    result.pieces = pieces;
    steps.push({ id: 'pieces', tileLengthM: p.tileLengthM, tileWidthM: p.tileWidthM, pieceAreaM2, areaWithWasteM2, pieces });

    if (Number.isFinite(p.piecesPerBox) && p.piecesPerBox > 0) {
      if (!Number.isInteger(p.piecesPerBox)) throw new RangeError('piecesPerBox must be an integer');
      result.boxes = Math.ceil(pieces / p.piecesPerBox - 1e-9);
      result.boxBasis = 'pieces';
      steps.push({ id: 'boxesByPieces', pieces, piecesPerBox: p.piecesPerBox, boxes: result.boxes });
    }
  }
  if (result.boxes === null && Number.isFinite(p.boxAreaM2) && p.boxAreaM2 > 0) {
    result.boxes = Math.ceil(areaWithWasteM2 / p.boxAreaM2 - 1e-9);
    result.boxBasis = 'area';
    steps.push({ id: 'boxesByArea', areaWithWasteM2, boxAreaM2: p.boxAreaM2, boxes: result.boxes });
  }
  return result;
}
