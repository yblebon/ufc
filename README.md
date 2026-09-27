# Fight Night — Match Centre

A single-page UFC fight tracker, deployed as a static site via GitHub Pages from `docs/`.

## How it works

`docs/index.html` is a self-contained page (inline CSS + JS, no build step, no dependencies).
On load it fetches match data as JSON from a hosted `DATA_URL` and renders it into
per-date event sections and per-match cards, with sidebar navigation, search, a
prediction-accuracy dashboard, and deep-linkable per-match sharing.

## Data format

The fetched JSON is an object keyed by event date, each value an array of match objects:

```json
{
  "2026-01-10": [
    {
      "match_title": "Women's Strawweight Bout | Fight 11: Fighter A vs. Fighter B",
      "date": "2026-01-10",
      "location": "Las Vegas, NV",
      "youtube": "https://www.youtube.com/watch?v=VIDEO_ID",
      "fighter1": {
        "name": "Fighter A",
        "icon": "https://example.com/a.png",
        "wiki": "https://example.com/wiki/a",
        "country": "USA",
        "score": "0.92",
        "winner": false,
        "stats": { "Age": "30", "Height": "5'10\"" }
      },
      "fighter2": { "...": "same shape as fighter1" }
    }
  ]
}
```

All fields except `match_title`, `fighter1`, and `fighter2` are optional. `youtube` shows
a "Watch Highlights" dropdown on the card when present and resolvable to a video ID.
`winner: true` on exactly one fighter marks the match decided; on both, it's a draw.

## Local development

No build step — just serve the folder and open it:

```sh
python3 -m http.server 8000 --directory docs
```

Then visit `http://localhost:8000/`.

## Social sharing / Open Graph

`docs/index.html` updates its own title and `<meta>` tags client-side when a match is
selected, but social-media crawlers fetch raw HTML without running JS, so that alone
never produces a real link preview. Instead, `scripts/generate-share-pages.mjs` fetches
the same match data and writes one small static HTML file per match to `docs/m/<cardId>.html`,
with the event, both fighters, their stats, and (once decided) the winner baked into its
`<title>`/`og:*`/`twitter:*` tags at generation time, plus a redirect into the live app at
that match's card. The Share button links to this static page rather than the SPA's `#hash`.

The `.github/workflows/generate-share-pages.yml` workflow regenerates `docs/m/` on a schedule
and on changes to the generator script, committing the result back to `main`. To regenerate
locally:

```sh
node scripts/generate-share-pages.mjs
```

Card ids are positional (`card-0`, `card-1`, …, assigned in the same date-sorted order the
client itself uses) rather than derived from match content, so they stay in sync with the
client as long as both read the same data snapshot — but a shared link can point at the wrong
match if the upstream data changes shape between when the link was generated and when it's
opened later.

## Deployment

GitHub Pages is configured to serve from the `docs/` folder on this repo's default branch.
