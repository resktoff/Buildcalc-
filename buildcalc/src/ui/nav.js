/**
 * BuildCalc UI — lightweight navigation & language switch behaviour.
 * Loaded standalone on content pages and shared by calculator pages.
 */

export const LANG_STORAGE_KEY = 'bc.lang';

export function initNav() {
  // Persist explicit language switches so the root redirect respects user choice.
  document.querySelectorAll('a[data-lang-switch]').forEach((link) => {
    if (link.dataset.langReady === '1') return;
    link.dataset.langReady = '1';
    link.addEventListener('click', () => {
      const target = link.getAttribute('hreflang');
      if (!target) return;
      try { localStorage.setItem(LANG_STORAGE_KEY, target); } catch { /* storage blocked */ }
    });
  });

  const btn = document.querySelector('[data-nav-toggle]');
  const nav = document.getElementById('site-nav');
  if (!btn || !nav || btn.dataset.navReady === '1') return;
  btn.dataset.navReady = '1';

  const close = ({ restoreFocus = false } = {}) => {
    if (!nav.classList.contains('is-open')) return;
    nav.classList.remove('is-open');
    btn.setAttribute('aria-expanded', 'false');
    if (restoreFocus) btn.focus();
  };

  btn.addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    btn.setAttribute('aria-expanded', String(open));
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close({ restoreFocus: true });
  });

  document.addEventListener('click', (e) => {
    if (!nav.classList.contains('is-open')) return;
    if (nav.contains(e.target) || btn.contains(e.target)) return;
    close();
  });

  nav.addEventListener('click', (e) => {
    if (e.target.closest('a')) close();
  });

  if (typeof window.matchMedia === 'function') {
    const mq = window.matchMedia('(min-width: 820px)');
    const onResize = (e) => { if (e.matches) close(); };
    if (typeof mq.addEventListener === 'function') mq.addEventListener('change', onResize);
  }
}

initNav();
