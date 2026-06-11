# MR5OBOT — Personal HQ

**Live at <https://mr-5obot.github.io>**

Pixel-arcade personal landing page. **Are you 1 or 0?**

Pure HTML + CSS + vanilla JS — no framework, no build step, no dependencies.
Open `index.html` in a browser and it just works.

## Pages

| File | What it is |
|---|---|
| `index.html` | Home — hero, profile cards, the vibe |
| `stuff.html` | Projects / things (placeholder cards for now) |
| `links.html` | All social links in one place |

## Features

- **1 / 0 switch** in the nav — toggles between yellow mode and blackout mode (saved in `localStorage`; you can also force it with `?m=0` in the URL)
- **Konami code** (`↑ ↑ ↓ ↓ ← → ← → B A`) — try it
- Copy-to-clipboard buttons on Discord/email, scrolling marquee, mobile menu
- Respects `prefers-reduced-motion`, keyboard-focus styles, no trackers/cookies

## Run locally

Just open `index.html`, or serve it:

```sh
python3 -m http.server 8000
# or: npx serve
```

## Deploy (pick one, all free)

**GitHub Pages**
```sh
git init && git add -A && git commit -m "hello friend"
# create a repo named MR5OBOT.github.io (or any repo) and push,
# then: repo Settings → Pages → Deploy from branch → main → / (root)
```

**Netlify** — drag the folder onto <https://app.netlify.com/drop>. Done.

**Vercel** — `npx vercel` in this folder. Done.

## TODO — fill in your real info

- [ ] `links.html` — X / Discord / Telegram handles are still guesses; replace with the real ones (GitHub + email are real)
- [ ] `stuff.html` — swap the placeholder project cards with real projects

## Design tokens

Colors live at the top of `css/style.css` (`--yellow`, `--pink`, `--blue`, `--green`, `--red`).
Fonts: [Archivo Black](https://fonts.google.com/specimen/Archivo+Black) (headlines),
[Press Start 2P](https://fonts.google.com/specimen/Press+Start+2P) (pixel labels),
[Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk) (body) — loaded from Google Fonts.
