# Davide Di Matteo — Security & Research

Personal cybersecurity portfolio, served directly by GitHub Pages at https://dingo97.github.io/.

## Structure

- `index.html`: homepage and native HTML project disclosures.
- `assets/site.css`, `assets/sections.css`: shared design and homepage sections.
- `assets/site.js`: optional navigation and stored accent preference (`ddm-theme`).
- `assets/htb.js`: Hack The Box rendering and request fallback.
- `research/CVE-2026-20516/index.html`: original research article; `assets/research.css` styles it.
- `assets/og.png`: generated social-sharing cover.

The public site needs **no build step and no runtime packages**. From this directory, `python -m http.server 4173 --bind 127.0.0.1` starts a local preview.

## Hack The Box contract

`.github/workflows/update-htb.yml` is the existing scheduled job. It uses the repository's `HTB_TOKEN` secret and updates the root `htb-data.json`. The redesign does not change that workflow or JSON schema.

The homepage fetches `htb-data.json?v=<timestamp>` from the same directory. Profile statistics, up to eight machines, and the latest eight combined challenges/Sherlocks are rendered from that response. `recentSherlocks` remains optional for compatibility with older snapshots. Difficulty aliases are normalized, external strings are inserted as text, and zero counts are preserved.

If the response is unavailable, malformed, or takes longer than eight seconds, an embedded snapshot is displayed with its original update date and an explicit fallback label. The snapshot is a fallback only; every page load requests the current JSON. To refresh it, replace `HTB_FALLBACK` in `assets/htb.js` with a verified copy of `htb-data.json`.

Keep `assets/htb.js` and `htb-data.json` at their current paths. Deploying only `index.html` is insufficient: publish the complete repository.

## Checks

Node.js 20+ is needed only for development checks:

```sh
npm ci
npm run check
```

Tests exercise the real JSON, legacy data, merged challenge/Sherlock ordering, empty or malformed data, HTML injection, failed requests and timeouts, plus local links, article metadata, menu behaviour and theme persistence. These are DOM and unit checks, not browser rendering tests.

## Social cover

`assets/og.png` was generated with the built-in ImageGen tool. Brief: a landscape editorial cover with the exact text “Davide Di Matteo”, “Security & Research”, “dingo97.github.io” and “ddm/”; moss black, warm white and pale lime; geometric typography and fine intersecting orbital lines, without photography or invented claims.
