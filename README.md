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

## Deployment

GitHub Pages is configured to serve from the `docs/` folder on this repo's default branch.
