// Generates one small static HTML file per match under docs/m/, with the
// event name, both fighters, their stats, and (once decided) the winner
// baked into <title>/og:*/twitter:* meta tags at build time. Social-media
// crawlers fetch this static page directly (no JS execution needed), then
// a redirect sends real visitors into the live app at the matching card.
//
// This logic intentionally mirrors buildShareCopy() / isValidMatch() /
// getOutcome() / parseMatchDate() in docs/index.html so the generated
// card-N ids and copy match what the client itself would produce from the
// same data snapshot. Keep the two in sync if either changes.

import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_URL = process.env.DATA_URL || 'https://static-conf.vercel.app/go/ufc';
const OUT_DIR = path.join(__dirname, '..', 'docs', 'm');
const SITE_URL = process.env.SITE_URL || ''; // optional absolute base URL, e.g. https://yblebon.github.io/ufc/

function isValidData(d) {
    return d !== null && typeof d === 'object' && !Array.isArray(d);
}

function isValidMatch(m) {
    return m && typeof m === 'object'
        && typeof m.match_title === 'string'
        && m.fighter1 && typeof m.fighter1 === 'object'
        && m.fighter2 && typeof m.fighter2 === 'object';
}

function isWinnerFlag(v) { return v === true || v === 'true'; }

function getOutcome(match) {
    const w1 = isWinnerFlag(match.fighter1.winner);
    const w2 = isWinnerFlag(match.fighter2.winner);
    if (w1 && w2) return 'draw';
    if (w1) return 'fighter1';
    if (w2) return 'fighter2';
    return null;
}

function parseMatchDate(dateStr) {
    if (!dateStr) return NaN;
    const ts = Date.parse(String(dateStr));
    return Number.isNaN(ts) ? NaN : ts;
}

function safeUrl(raw) {
    try {
        const u = new URL(String(raw));
        if (u.protocol === 'https:' || u.protocol === 'http:') return u.href;
    } catch (_) { /* not a valid absolute URL */ }
    return null;
}

function formatStats(stats) {
    if (!stats || typeof stats !== 'object') return '';
    return Object.entries(stats)
        .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
        .map(([k, v]) => `${k} ${v}`)
        .join(', ');
}

function buildShareCopy(m) {
    const eventName  = m.match_title || `${m.fighter1Name} vs ${m.fighter2Name}`;
    const winnerName = m.outcome === 'fighter1' ? m.fighter1Name : m.outcome === 'fighter2' ? m.fighter2Name : null;
    const loserName  = m.outcome === 'fighter1' ? m.fighter2Name : m.outcome === 'fighter2' ? m.fighter1Name : null;

    const title = winnerName ? `🏆 ${eventName}` : eventName;

    let description = winnerName
        ? `${eventName} — 🏆 Winner: ${winnerName} (def. ${loserName})`
        : `${eventName} — ${m.fighter1Name} vs ${m.fighter2Name}`;

    const metaBits = [m.dateKey, m.location].filter(Boolean);
    if (metaBits.length) description += ` · ${metaBits.join(' · ')}`;

    const statsBits = [
        formatStats(m.stats1) ? `${m.fighter1Name}: ${formatStats(m.stats1)}` : '',
        formatStats(m.stats2) ? `${m.fighter2Name}: ${formatStats(m.stats2)}` : ''
    ].filter(Boolean);
    if (statsBits.length) description += `. ${statsBits.join(' | ')}`;

    return { title, description };
}

function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function pageHtml({ cardId, title, description, image }) {
    const safeTitle = escapeHtml(`${title} — Fight Night`);
    const safeDesc  = escapeHtml(description);
    const safeImage = image ? escapeHtml(image) : '';
    const target    = `../index.html#${encodeURIComponent(cardId)}`;
    const absUrl    = SITE_URL ? escapeHtml(new URL(`m/${cardId}.html`, SITE_URL).href) : '';

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${safeTitle}</title>
<meta name="description" content="${safeDesc}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Fight Night">
<meta property="og:title" content="${safeTitle}">
<meta property="og:description" content="${safeDesc}">
${absUrl ? `<meta property="og:url" content="${absUrl}">\n` : ''}${safeImage ? `<meta property="og:image" content="${safeImage}">\n` : ''}<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${safeTitle}">
<meta name="twitter:description" content="${safeDesc}">
${safeImage ? `<meta name="twitter:image" content="${safeImage}">\n` : ''}<link rel="canonical" href="${target}">
<meta http-equiv="refresh" content="0; url=${target}">
<script>location.replace(${JSON.stringify(target)});</script>
</head>
<body>
<p>Redirecting to <a href="${target}">Fight Night — ${safeTitle}</a>…</p>
</body>
</html>
`;
}

async function main() {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${DATA_URL}`);
    const data = await res.json();
    if (!isValidData(data)) throw new Error('Unexpected data format from ' + DATA_URL);

    const dates = Object.keys(data).sort((a, b) => {
        const ta = parseMatchDate(a);
        const tb = parseMatchDate(b);
        if (!Number.isNaN(ta) && !Number.isNaN(tb)) return tb - ta;
        if (!Number.isNaN(ta)) return -1;
        if (!Number.isNaN(tb)) return 1;
        return String(b).localeCompare(String(a));
    });

    // Regenerate from scratch each run — card ids are positional, so a stale
    // leftover file from a previous data snapshot could point at the wrong match.
    await rm(OUT_DIR, { recursive: true, force: true });
    await mkdir(OUT_DIR, { recursive: true });

    let cardIndex = 0;
    let written = 0;

    for (const dateKey of dates) {
        const fights = data[dateKey];
        if (!Array.isArray(fights)) continue;

        for (const match of fights) {
            if (!isValidMatch(match)) continue;
            const cardId = `card-${cardIndex++}`;

            const m = {
                dateKey,
                match_title: String(match.match_title || ''),
                outcome: getOutcome(match),
                fighter1Name: String(match.fighter1.name || ''),
                fighter2Name: String(match.fighter2.name || ''),
                stats1: (match.fighter1.stats && typeof match.fighter1.stats === 'object') ? match.fighter1.stats : null,
                stats2: (match.fighter2.stats && typeof match.fighter2.stats === 'object') ? match.fighter2.stats : null,
                location: match.location ? String(match.location) : ''
            };

            const { title, description } = buildShareCopy(m);
            const icon1 = safeUrl(match.fighter1.icon);
            const icon2 = safeUrl(match.fighter2.icon);
            const winnerIcon = m.outcome === 'fighter2' ? icon2 : m.outcome === 'fighter1' ? icon1 : null;
            const image = winnerIcon || icon1 || icon2 || '';

            await writeFile(
                path.join(OUT_DIR, `${cardId}.html`),
                pageHtml({ cardId, title, description, image }),
                'utf8'
            );
            written++;
        }
    }

    console.log(`Generated ${written} share page(s) in ${OUT_DIR}`);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
