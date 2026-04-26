// ==UserScript==
// @name         Crunchyroll Auto Skip + Next
// @namespace    https://github.com/JoshApp/crunchyroll-autoskip
// @version      0.1.0
// @description  Auto-clicks Crunchyroll's Skip Intro / Skip Credits / Next Episode buttons.
// @author       josh
// @match        https://www.crunchyroll.com/*
// @match        https://beta.crunchyroll.com/*
// @match        https://static.crunchyroll.com/*
// @run-at       document-idle
// @grant        none
// @updateURL    https://joshapp.github.io/crunchyroll-autoskip/crunchyroll-autoskip.user.js
// @downloadURL  https://joshapp.github.io/crunchyroll-autoskip/crunchyroll-autoskip.user.js
// ==/UserScript==

(function () {
  'use strict';

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

  const findClickable = (predicate) => {
    const els = document.querySelectorAll('button, [role="button"], a, [data-testid]');
    for (const el of els) {
      if (predicate(el) && isVisible(el)) return el;
    }
    return null;
  };

  // Cooldown per logical action so a sticky/persistent button doesn't get spammed,
  // but the next episode (>5s later) still triggers a fresh click.
  const lastClickAt = {};
  const COOLDOWN_MS = 5000;
  const clickOnce = (el, label) => {
    const now = Date.now();
    if (lastClickAt[label] && now - lastClickAt[label] < COOLDOWN_MS) return false;
    lastClickAt[label] = now;
    log(`clicking ${label}`, el);
    el.click();
    return true;
  };

  const SKIP_INTRO_TEXTS = ['skip intro', 'skip op', 'skip opening'];
  const SKIP_INTRO_ATTRS = ['skipintro', 'skip-intro', 'skip_intro'];

  const SKIP_OUTRO_TEXTS = ['skip credits', 'skip ending', 'skip outro', 'skip ed'];
  const SKIP_OUTRO_ATTRS = ['skipcredits', 'skip-credits', 'skipoutro', 'skip-outro', 'skipending'];

  const NEXT_EP_TEXTS  = ['next episode', 'play next', 'up next'];
  const NEXT_EP_ATTRS  = ['nextepisode', 'next-episode', 'upnext', 'up-next'];

  const tick = () => {
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

    if (FEATURES.autoNext) {
      const btn = findClickable((el) =>
        matchesText(el, NEXT_EP_TEXTS) ||
        matchesAttr(el, 'data-testid', NEXT_EP_ATTRS) ||
        matchesAttr(el, 'aria-label', NEXT_EP_TEXTS)
      );
      if (btn) clickOnce(btn, 'auto-next');
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
      '%c[cr-autoskip] active',
      'color:#f47521;font-weight:bold',
      FEATURES
    );
  };

  start();
})();
