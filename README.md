# Crunchyroll Auto Skip + Next

A small userscript that auto-clicks Crunchyroll's **Skip Intro**, **Skip Credits**, and **Next Episode** buttons whenever they appear. No accounts, no servers, runs entirely in the browser.

## Install — easy mode

Send the recipient this single link:

> **https://joshapp.github.io/crunchyroll-autoskip/**

It's a 3-step wizard that detects their browser, walks through Tampermonkey install, then installs the script in two clicks.

## Install — manual

1. Install **Tampermonkey** for the browser:
   - Chrome / Edge / Brave / Arc: https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo
   - Firefox: https://addons.mozilla.org/firefox/addon/tampermonkey/
   - Safari: install [Userscripts](https://apps.apple.com/us/app/userscripts/id1463298887) instead, then enable it in Safari → Settings → Extensions.
2. Open https://joshapp.github.io/crunchyroll-autoskip/crunchyroll-autoskip.user.js and click **Install** in the dialog.
3. Open any episode on https://www.crunchyroll.com/ and play it.

## Auto-updates

The userscript declares an `@updateURL` pointing at GitHub Pages, so Tampermonkey checks for new versions on its default schedule (~daily) and prompts the user with a one-click update — or installs silently if they've enabled auto-install. Bumping the `@version` in the script header is all that's needed to push an update; users get it next time Tampermonkey checks.

## What it does

- **MutationObserver** on the player DOM watches for buttons matching "Skip Intro" / "Skip Credits" / "Next Episode" by visible text, `data-testid`, or `aria-label`.
- Clicks them as soon as they appear and become visible.
- 5-second cooldown per action so a single button can't get spammed; the next episode triggers fresh.

This v1 only uses the **native** skip buttons. Shows that don't have them won't auto-skip. AniSkip-style crowdsourced fallback is planned for v2.

## Verify it's working

1. Open Crunchyroll, start an episode.
2. Open the browser DevTools console (Cmd+Opt+J on Chrome, Cmd+Opt+C on Safari).
3. You should see `[cr-autoskip] active` in orange.
4. When the intro/credits/next-episode button appears, the script clicks it.

## Toggles

The three features can be turned off independently from the browser console:

```js
localStorage.setItem('cr-autoskip-intro', '0'); // skip intro
localStorage.setItem('cr-autoskip-outro', '0'); // skip credits
localStorage.setItem('cr-autoskip-next',  '0'); // auto next episode
localStorage.setItem('cr-autoskip-debug', '1'); // verbose logging

// Re-enable
localStorage.removeItem('cr-autoskip-intro');
```

Reload the Crunchyroll tab after changing.

## When it breaks

Crunchyroll redesigns their player every so often.

1. Turn on debug mode (`localStorage.setItem('cr-autoskip-debug', '1')`, reload).
2. While the intro is playing, right-click the visible "Skip Intro" button → Inspect.
3. Note the new `data-testid`, `aria-label`, or visible text.
4. Add the fragment to the appropriate `SKIP_*_TEXTS` or `SKIP_*_ATTRS` array near the top of the userscript and bump `@version`. Push to main — users get the update automatically.

## Hosting

This repo is set up to be served by **GitHub Pages from the `main` branch root**. After cloning and pushing:

1. GitHub → Settings → Pages → Source: `Deploy from a branch`, Branch: `main`, Folder: `/ (root)`.
2. Wait ~1 minute for Pages to build.
3. The wizard lives at `https://joshapp.github.io/crunchyroll-autoskip/`.
4. The script lives at `https://joshapp.github.io/crunchyroll-autoskip/crunchyroll-autoskip.user.js` (this is the URL referenced in `@updateURL` / `@downloadURL`).

If you fork this to a different GitHub user, find/replace `JoshApp` (and lowercase `joshapp` for Pages URLs) in `index.html`, the userscript header (`@namespace` / `@updateURL` / `@downloadURL`), and this README.

## Roadmap

- **v2:** AniSkip API fallback for shows without native skip buttons (uses MAL ID via the `arm` mapping; seeks past OP/ED timestamps).
- **v3:** Settings UI instead of localStorage flags; per-show overrides.
