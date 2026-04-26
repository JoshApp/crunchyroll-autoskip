// ==UserScript==
// @name         Crunchyroll Auto Skip + Next
// @namespace    https://github.com/JoshApp/crunchyroll-autoskip
// @version      0.2.3
// @description  Auto-clicks Crunchyroll's Skip Intro / Skip Credits / Next Episode buttons.
// @author       josh
// @match        *://*.crunchyroll.com/*
// @match        *://crunchyroll.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://joshapp.github.io/crunchyroll-autoskip/crunchyroll-autoskip.user.js
// @downloadURL  https://joshapp.github.io/crunchyroll-autoskip/crunchyroll-autoskip.user.js
// ==/UserScript==

(function () {
  'use strict';

  const VERSION = '0.2.3';
  const DEBUG = localStorage.getItem('cr-autoskip-debug') === '1';
  const FEATURES = {
    skipIntro: localStorage.getItem('cr-autoskip-intro') !== '0',
    skipOutro: localStorage.getItem('cr-autoskip-outro') !== '0',
    autoNext:  localStorage.getItem('cr-autoskip-next')  !== '0',
  };

  const log = (...args) => DEBUG && console.log('[cr-autoskip]', ...args);

  const isVisible = (el) => {
    if (!el || !el.isConnected) return false;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  };

  const matchesText = (el, patterns) => {
    const text = (el.textContent || '').trim().toLowerCase();
    if (!text) return false;
    return patterns.some((p) => text.includes(p));
  };

  const matchesAttr = (el, attr, fragments) => {
    const v = (el.getAttribute(attr) || '').toLowerCase();
    if (!v) return false;
    return fragments.some((f) => v.includes(f));
  };

  // Only iterate over genuinely interactive elements. Including [data-testid]
  // here was a bug: a container DIV with data-testid (e.g. "player-controls-
  // root") inherits its descendants' textContent, so the parent matched
  // "Skip Intro" before the actual <button> did, and clicking the DIV does
  // nothing.
  const findClickable = (predicate) => {
    const els = document.querySelectorAll('button, [role="button"], a');
    for (const el of els) {
      if (predicate(el) && isVisible(el)) return el;
    }
    return null;
  };

  // The page can have multiple <video> elements (thumbnail previews etc.).
  // The main player is the largest one on screen.
  const getMainVideo = () => {
    let main = null;
    let maxArea = 0;
    for (const v of document.querySelectorAll('video')) {
      const r = v.getBoundingClientRect();
      const area = r.width * r.height;
      if (area > maxArea) { maxArea = area; main = v; }
    }
    return main;
  };

  // Belt-and-suspenders size filter for the "Next Episode" card overlay so
  // we never click the small button in the controls bar.
  const NEXT_MIN_WIDTH  = 250;
  const NEXT_MIN_HEIGHT = 80;
  const isLargeEnough = (el) => {
    const r = el.getBoundingClientRect();
    return r.width >= NEXT_MIN_WIDTH && r.height >= NEXT_MIN_HEIGHT;
  };

  // Crunchyroll's player is React-driven; a bare el.click() doesn't always
  // trigger its handlers. Dispatch the full pointer/mouse sequence first.
  const richClick = (el) => {
    try {
      const rect = el.getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;
      const opts = {
        bubbles: true, cancelable: true, view: window,
        button: 0, clientX: x, clientY: y, screenX: x, screenY: y,
      };
      el.dispatchEvent(new PointerEvent('pointerdown', opts));
      el.dispatchEvent(new MouseEvent('mousedown', opts));
      el.dispatchEvent(new PointerEvent('pointerup', opts));
      el.dispatchEvent(new MouseEvent('mouseup', opts));
    } catch (e) {
      log('rich click dispatch failed, falling back to .click()', e);
    }
    el.click();
  };

  // Cooldown per logical action — keeps us from re-clicking the same button
  // over and over while it's still on screen, but a new episode (well past
  // 5s) still triggers a fresh click.
  const lastClickAt = {};
  const COOLDOWN_MS = 5000;
  const clickOnce = (el, label) => {
    const now = Date.now();
    if (lastClickAt[label] && now - lastClickAt[label] < COOLDOWN_MS) return false;
    lastClickAt[label] = now;
    log(`clicking ${label}`, el);
    richClick(el);
    return true;
  };

  const SKIP_INTRO_TEXTS = ['skip intro', 'skip op', 'skip opening'];
  const SKIP_INTRO_ATTRS = ['skipintro', 'skip-intro', 'skip_intro'];

  const SKIP_OUTRO_TEXTS = ['skip credits', 'skip ending', 'skip outro', 'skip ed'];
  const SKIP_OUTRO_ATTRS = ['skipcredits', 'skip-credits', 'skipoutro', 'skip-outro', 'skipending'];

  const NEXT_EP_TEXTS  = ['next episode', 'play next', 'up next'];
  const NEXT_EP_ATTRS  = ['nextepisode', 'next-episode', 'upnext', 'up-next'];

  // Auto-next is event-driven: only fires when the main video element emits
  // 'ended'. Pause/play, timeline scrubs, etc. cannot trigger this — only the
  // video actually finishing does. After it fires we scan for the wide+tall
  // end-of-episode card and click that.
  const hasEndedListener = new WeakSet();
  const onMainVideoEnded = () => {
    if (!FEATURES.autoNext) return;
    log('main video ended; looking for next-episode card');
    const tryClick = () => {
      const btn = findClickable((el) =>
        (matchesText(el, NEXT_EP_TEXTS) ||
         matchesAttr(el, 'data-testid', NEXT_EP_ATTRS) ||
         matchesAttr(el, 'aria-label', NEXT_EP_TEXTS)) &&
        isLargeEnough(el)
      );
      if (btn) { clickOnce(btn, 'auto-next'); return true; }
      return false;
    };
    if (tryClick()) return;
    setTimeout(tryClick, 500);
    setTimeout(tryClick, 2000);
  };
  const ensureEndedListener = () => {
    const v = getMainVideo();
    if (!v || hasEndedListener.has(v)) return;
    hasEndedListener.add(v);
    v.addEventListener('ended', onMainVideoEnded);
    log('attached ended listener to main video', v);
  };

  const tick = () => {
    ensureEndedListener();

    if (FEATURES.skipIntro) {
      const btn = findClickable((el) =>
        matchesText(el, SKIP_INTRO_TEXTS) ||
        matchesAttr(el, 'data-testid', SKIP_INTRO_ATTRS) ||
        matchesAttr(el, 'aria-label', SKIP_INTRO_TEXTS)
      );
      if (btn) clickOnce(btn, 'skip-intro');
    }

    if (FEATURES.skipOutro) {
      const btn = findClickable((el) =>
        matchesText(el, SKIP_OUTRO_TEXTS) ||
        matchesAttr(el, 'data-testid', SKIP_OUTRO_ATTRS) ||
        matchesAttr(el, 'aria-label', SKIP_OUTRO_TEXTS)
      );
      if (btn) clickOnce(btn, 'skip-outro');
    }
  };

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      tick();
    });
  });

  const start = () => {
    if (!document.body) {
      setTimeout(start, 50);
      return;
    }
    observer.observe(document.body, { childList: true, subtree: true });
    tick();
    console.log(
      `%c[cr-autoskip] v${VERSION} active`,
      'color:#f47521;font-weight:bold',
      FEATURES
    );
  };

  start();
})();
