// ==UserScript==
// @name         Crunchyroll Auto Skip + Next
// @namespace    https://github.com/JoshApp/crunchyroll-autoskip
// @version      0.2.5
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

  const VERSION = '0.2.5';
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

  // Plain .click() is enough now that the candidate selector targets the
  // real <button>. The richer pointer/mouse sequence we used in 0.2.2 was
  // firing Crunchyroll's React handlers twice (once on pointerdown, once
  // on click), which made Skip Intro skip too far / desync the timeline.
  const doClick = (el) => el.click();

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
    doClick(el);
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
  const scheduleTick = () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      tick();
    });
  };
  const observer = new MutationObserver(scheduleTick);

  // Crunchyroll fades the Skip Intro button in via CSS transition
  // (opacity 0 -> 1 over ~300ms). The MutationObserver fires once when
  // the node is added (opacity still 0, isVisible rejects it) and never
  // again until something else mutates the DOM. Without this periodic
  // fallback, the click only happens later when the user pauses/plays
  // and incidentally triggers a fresh mutation.
  const TICK_INTERVAL_MS = 500;

  const start = () => {
    if (!document.body) {
      setTimeout(start, 50);
      return;
    }
    observer.observe(document.body, { childList: true, subtree: true });
    setInterval(scheduleTick, TICK_INTERVAL_MS);
    tick();
    console.log(
      `%c[cr-autoskip] v${VERSION} active`,
      'color:#f47521;font-weight:bold',
      FEATURES
    );
  };

  start();
})();
