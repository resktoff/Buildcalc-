/**
 * BuildCalc UI — local calculation history (browser-only, localStorage).
 * Purely client-side, no network calls, tolerant of blocked/corrupt storage.
 */

export const HISTORY_LIMIT = 10;

export function historyKey(calcId) {
  return `bc.history.${calcId}`;
}

function getStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function sameInputs(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);
  if (keysA.length !== keysB.length) return false;
  for (const k of keysA) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

function isValidEntry(entry) {
  return Boolean(
    entry &&
    typeof entry === 'object' &&
    typeof entry.id === 'string' &&
    typeof entry.ts === 'number' &&
    Number.isFinite(entry.ts) &&
    (entry.system === 'metric' || entry.system === 'imperial') &&
    entry.inputs &&
    typeof entry.inputs === 'object' &&
    !Array.isArray(entry.inputs)
  );
}

export function loadHistory(calcId, storage) {
  const store = getStorage(storage);
  if (!store) return [];
  try {
    const raw = store.getItem(historyKey(calcId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isValidEntry).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function persistHistory(calcId, list, storage) {
  const store = getStorage(storage);
  if (!store) return list;
  try {
    store.setItem(historyKey(calcId), JSON.stringify(list));
  } catch {
    /* quota exceeded or storage blocked */
  }
  return list;
}

export function saveHistoryEntry(calcId, { system, inputs }, storage) {
  if ((system !== 'metric' && system !== 'imperial') || !inputs || typeof inputs !== 'object') {
    return loadHistory(calcId, storage);
  }
  const list = loadHistory(calcId, storage);
  const cleanInputs = { ...inputs };
  const now = Date.now();

  if (list.length > 0 && list[0].system === system && sameInputs(list[0].inputs, cleanInputs)) {
    const updated = [{ ...list[0], ts: now }, ...list.slice(1)];
    return persistHistory(calcId, updated, storage);
  }

  const entry = {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    ts: now,
    system,
    inputs: cleanInputs,
  };
  const next = [entry, ...list].slice(0, HISTORY_LIMIT);
  return persistHistory(calcId, next, storage);
}

export function removeHistoryEntry(calcId, id, storage) {
  const list = loadHistory(calcId, storage).filter((e) => e.id !== id);
  return persistHistory(calcId, list, storage);
}

export function clearHistory(calcId, storage) {
  const store = getStorage(storage);
  if (!store) return [];
  try {
    store.removeItem(historyKey(calcId));
  } catch {
    /* storage blocked */
  }
  return [];
}

/**
 * Restore a saved history entry onto a calculator <form> and trigger recalculation.
 * Extracted for direct integration testing without altering app behaviour.
 */
export function restoreFormEntry(form, entry, { applySystem, storeSystem, updateConditionals, recalc }) {
  applySystem(entry.system, { convertValues: false });
  storeSystem(entry.system);
  updateConditionals(entry.inputs);
  form.querySelectorAll('input,select').forEach((el) => {
    if (!el.name || el.name === 'units') return;
    if (!(el.name in entry.inputs)) return;
    const val = entry.inputs[el.name];
    if (el.type === 'radio') el.checked = (el.value === String(val));
    else if (el.type === 'checkbox') el.checked = Boolean(val);
    else el.value = String(val);
  });
  updateConditionals(entry.inputs);
  form.querySelectorAll('[data-field]').forEach((w) => { w.dataset.touched = '1'; });
  recalc({ touchedOnly: false });
}
