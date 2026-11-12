/**
 * BuildCalc — calculator form markup (build time).
 * Field attributes consumed by src/ui/app.js:
 *   data-role            dimension role for unit conversion (length|small|area|coverage|none)
 *   data-unit-role       span whose text becomes the unit label
 *   data-default-*       default value per unit system (applied when empty)
 *   data-placeholder-*   placeholder per unit system
 *   data-show-when       "field=value|value" conditional visibility
 *   data-select          select rebuilt per unit system from calc.selects
 */
import { esc } from './layout.js';

function numberField({ id, name, label, role = 'none', help, required = true, integer = false, min, defaults, placeholders, optionalLabel, helpAttr }) {
  const unit = role !== 'none' ? ` <span class="unit" data-unit-role="${role}"></span>` : '';
  const helpId = help ? `${id}-help` : null;
  const errId = `${id}-err`;
  const describedBy = [helpId, errId].filter(Boolean).join(' ');
  const attrs = [
    `id="${id}"`, `name="${name}"`, 'type="number"',
    integer ? 'inputmode="numeric" step="1"' : 'inputmode="decimal" step="any"',
    min !== undefined ? `min="${min}"` : 'min="0"',
    `data-role="${role}"`,
    required ? 'required' : '',
    `aria-describedby="${describedBy}"`,
    defaults ? `data-default-metric="${defaults[0]}" data-default-imperial="${defaults[1]}"` : '',
    placeholders ? `data-placeholder-metric="${placeholders[0]}" data-placeholder-imperial="${placeholders[1]}"` : '',
    'autocomplete="off"',
  ].filter(Boolean).join(' ');
  return `<div class="field" data-field="${name}">
          <label for="${id}">${esc(label)}${unit}${!required && optionalLabel ? ` <small>(${esc(optionalLabel)})</small>` : ''}</label>
          <input ${attrs}>
          ${help ? `<p class="field-help" id="${helpId}"${helpAttr ? ` data-help-for="${helpAttr}"` : ''}>${esc(help)}</p>` : ''}
          <p class="field-error" id="${errId}" hidden></p>
        </div>`;
}

function unitToggle(t) {
  return `<fieldset class="unit-fieldset">
        <legend>${esc(t.units.legend)}</legend>
        <div class="segmented" role="radiogroup" aria-label="${esc(t.units.legend)}">
          <label><input type="radio" name="units" value="metric" checked><span>${esc(t.units.metric)}</span></label>
          <label><input type="radio" name="units" value="imperial"><span>${esc(t.units.imperial)}</span></label>
        </div>
      </fieldset>`;
}

function modeToggle(t, prefix) {
  return `<fieldset>
        <legend>${esc(t.common.mode)}</legend>
        <div class="radio-list">
          <label class="radio-card"><input type="radio" name="mode" value="room" checked> ${esc(t.common.modeRoom)}</label>
          <label class="radio-card"><input type="radio" name="mode" value="area"> ${esc(t.common.modeArea)}</label>
        </div>
      </fieldset>`;
}

function wasteField(t, id, def) {
  return numberField({ id, name: 'waste', label: t.common.waste, role: 'none', help: t.common.wasteHelp, defaults: [def, def] });
}

function actions(t) {
  return `<div class="form-actions">
        <button type="submit" class="btn btn-primary">${esc(t.common.results)}</button>
        <button type="reset" class="btn btn-ghost">${esc(t.common.reset)}</button>
      </div>`;
}

function errorSummary() {
  return `<p class="error-summary" data-error-summary role="alert" hidden></p>`;
}

function selectField({ id, name, label, noneLabel, selectKey }) {
  return `<div class="field" data-field="${name}">
          <label for="${id}">${esc(label)}</label>
          <select id="${id}" name="${name}" data-select="${selectKey}">
            <option value="none">${esc(noneLabel)}</option>
          </select>
          <p class="field-error" id="${id}-err" hidden></p>
        </div>`;
}

export function concreteForm(t) {
  const c = t.concrete;
  return `<form class="calc-form card" data-calc="concrete" novalidate aria-labelledby="calc-title">
      ${unitToggle(t)}
      <fieldset>
        <legend>${esc(c.shape)}</legend>
        <div class="radio-list">
          <label class="radio-card"><input type="radio" name="shape" value="slab" checked> ${esc(c.shapes.slab)}</label>
          <label class="radio-card"><input type="radio" name="shape" value="cylinder"> ${esc(c.shapes.cylinder)}</label>
        </div>
      </fieldset>
      <div class="field-grid cols-3" data-show-when="shape=slab">
        ${numberField({ id: 'c-length', name: 'length', label: c.fields.length, role: 'length', placeholders: ['5', '16'] })}
        ${numberField({ id: 'c-width', name: 'width', label: c.fields.width, role: 'length', placeholders: ['4', '12'] })}
        ${numberField({ id: 'c-thickness', name: 'thickness', label: c.fields.thickness, role: 'small', placeholders: ['10', '4'] })}
      </div>
      <div class="field-grid" data-show-when="shape=cylinder" hidden>
        ${numberField({ id: 'c-diameter', name: 'diameter', label: c.fields.diameter, role: 'small', placeholders: ['30', '12'] })}
        ${numberField({ id: 'c-height', name: 'height', label: c.fields.height, role: 'length', placeholders: ['3', '10'] })}
      </div>
      <div class="field-grid">
        ${numberField({ id: 'c-quantity', name: 'quantity', label: t.common.quantity, role: 'none', help: t.common.quantityHelp, integer: true, min: 1, defaults: ['1', '1'] })}
        ${wasteField(t, 'c-waste', '5')}
      </div>
      ${selectField({ id: 'c-bag', name: 'bag', label: c.fields.bag, noneLabel: c.fields.bagNone, selectKey: 'bag' })}
      ${errorSummary()}
      ${actions(t)}
    </form>`;
}

export function paintForm(t) {
  const p = t.paint;
  return `<form class="calc-form card" data-calc="paint" novalidate aria-labelledby="calc-title">
      ${unitToggle(t)}
      ${modeToggle(t, 'p')}
      <div data-show-when="mode=room">
        <div class="field-grid cols-3">
          ${numberField({ id: 'p-length', name: 'length', label: p.fields.length, role: 'length', placeholders: ['4', '12'] })}
          ${numberField({ id: 'p-width', name: 'width', label: p.fields.width, role: 'length', placeholders: ['3', '10'] })}
          ${numberField({ id: 'p-height', name: 'height', label: p.fields.height, role: 'length', placeholders: ['2.5', '8'] })}
        </div>
        <div class="field" data-field="ceiling">
          <label class="check"><input type="checkbox" name="ceiling"> ${esc(p.fields.ceiling)}</label>
        </div>
      </div>
      <div data-show-when="mode=area" hidden>
        ${numberField({ id: 'p-area', name: 'area', label: p.fields.area, role: 'area', placeholders: ['30', '320'] })}
      </div>
      <div class="field-grid">
        ${numberField({ id: 'p-doors', name: 'doors', label: p.fields.doors, role: 'none', integer: true, min: 0, required: false, help: p.fields.doorsHelp.replace('{area}', '…'), helpAttr: 'doors', defaults: ['1', '1'] })}
        ${numberField({ id: 'p-windows', name: 'windows', label: p.fields.windows, role: 'none', integer: true, min: 0, required: false, help: p.fields.windowsHelp.replace('{area}', '…'), helpAttr: 'windows', defaults: ['1', '1'] })}
      </div>
      <div class="field-grid">
        ${numberField({ id: 'p-coats', name: 'coats', label: p.fields.coats, role: 'none', integer: true, min: 1, defaults: ['2', '2'] })}
        ${numberField({ id: 'p-coverage', name: 'coverage', label: p.fields.coverage, role: 'coverage', help: p.fields.coverageHelp, defaults: ['10', '350'] })}
      </div>
      <div class="field-grid">
        ${wasteField(t, 'p-waste', '5')}
        ${selectField({ id: 'p-can', name: 'can', label: p.fields.can, noneLabel: p.fields.canNone, selectKey: 'can' })}
      </div>
      ${errorSummary()}
      ${actions(t)}
    </form>`;
}

export function flooringForm(t) {
  const f = t.flooring;
  return `<form class="calc-form card" data-calc="flooring" novalidate aria-labelledby="calc-title">
      ${unitToggle(t)}
      ${modeToggle(t, 'f')}
      <div class="field-grid" data-show-when="mode=room">
        ${numberField({ id: 'f-length', name: 'length', label: f.fields.length, role: 'length', placeholders: ['5', '12'] })}
        ${numberField({ id: 'f-width', name: 'width', label: f.fields.width, role: 'length', placeholders: ['4', '10'] })}
      </div>
      <div data-show-when="mode=area" hidden>
        ${numberField({ id: 'f-area', name: 'area', label: f.fields.area, role: 'area', placeholders: ['20', '120'] })}
      </div>
      ${wasteField(t, 'f-waste', '10')}
      <fieldset>
        <legend>${esc(f.fields.tileLength)} × ${esc(f.fields.tileWidth)} <small>(${esc(t.common.optional)})</small></legend>
        <div class="field-grid">
          ${numberField({ id: 'f-tile-length', name: 'tileLength', label: f.fields.tileLength, role: 'small', required: false, placeholders: ['60', '12'] })}
          ${numberField({ id: 'f-tile-width', name: 'tileWidth', label: f.fields.tileWidth, role: 'small', required: false, placeholders: ['60', '24'], help: f.fields.tileHelp })}
        </div>
      </fieldset>
      <fieldset>
        <legend>${esc(f.fields.boxMode)}</legend>
        <div class="radio-list">
          <label class="radio-card"><input type="radio" name="boxMode" value="none" checked> ${esc(f.fields.boxNone)}</label>
          <label class="radio-card"><input type="radio" name="boxMode" value="pieces"> ${esc(f.fields.boxPieces)}</label>
          <label class="radio-card"><input type="radio" name="boxMode" value="area"> ${esc(f.fields.boxArea)}</label>
        </div>
      </fieldset>
      <div data-show-when="boxMode=pieces" hidden>
        ${numberField({ id: 'f-ppb', name: 'piecesPerBox', label: f.fields.piecesPerBox, role: 'none', integer: true, min: 1, placeholders: ['4', '8'] })}
      </div>
      <div data-show-when="boxMode=area" hidden>
        ${numberField({ id: 'f-box-area', name: 'boxArea', label: f.fields.boxAreaField, role: 'area', placeholders: ['1.44', '16'] })}
      </div>
      ${errorSummary()}
      ${actions(t)}
    </form>`;
}

export const FORMS = { concrete: concreteForm, paint: paintForm, flooring: flooringForm };
