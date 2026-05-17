// Analyse des parties Chess.com de louisssmrt
// Lit les JSON dans data/, produit un rapport dans reports/

const fs = require('fs');
const path = require('path');

const USERNAME = 'louisssmrt';
const DATA_DIR = path.join(__dirname, 'data');
const REPORTS_DIR = path.join(__dirname, 'reports');

const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json')).sort();
const allGames = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(DATA_DIR, f), 'utf8').replace(/^﻿/, '');
  const data = JSON.parse(raw);
  allGames.push(...data.games);
}

function pgnHeader(pgn, key) {
  const m = pgn.match(new RegExp(`\\[${key} "([^"]*)"\\]`));
  return m ? m[1] : null;
}

function ecoName(pgn) {
  const url = pgnHeader(pgn, 'ECOUrl');
  if (!url) return pgnHeader(pgn, 'ECO') || 'Unknown';
  const slug = url.split('/').pop();
  return slug.replace(/-/g, ' ');
}

function countMoves(pgn) {
  const moveSection = pgn.split(/\]\s*\n\s*\n/).pop();
  if (!moveSection) return 0;
  const m = moveSection.match(/(\d+)\.\s/g);
  return m ? parseInt(m[m.length - 1]) : 0;
}

function endReason(pgn) {
  const term = pgnHeader(pgn, 'Termination');
  if (!term) return null;
  if (/won by checkmate/i.test(term)) return 'checkmate';
  if (/won on time/i.test(term)) return 'time';
  if (/won by resignation/i.test(term)) return 'resignation';
  if (/drawn by repetition/i.test(term)) return 'repetition';
  if (/drawn by stalemate/i.test(term)) return 'stalemate';
  if (/drawn by agreement/i.test(term)) return 'agreement';
  if (/drawn by insufficient/i.test(term)) return 'insufficient';
  if (/drawn by 50/i.test(term)) return '50move';
  if (/drawn by timeout/i.test(term)) return 'time_vs_insufficient';
  if (/abandoned/i.test(term)) return 'abandoned';
  return 'other';
}

const enriched = allGames.map(g => {
  const isWhite = g.white.username.toLowerCase() === USERNAME.toLowerCase();
  const me = isWhite ? g.white : g.black;
  const opp = isWhite ? g.black : g.white;
  let outcome;
  if (me.result === 'win') outcome = 'W';
  else if (['agreed', 'repetition', 'stalemate', 'insufficient', '50move', 'timevsinsufficient'].includes(me.result)) outcome = 'D';
  else outcome = 'L';
  return {
    url: g.url,
    end_time: g.end_time,
    time_class: g.time_class,
    time_control: g.time_control,
    color: isWhite ? 'W' : 'B',
    my_rating: me.rating,
    opp_rating: opp.rating,
    rating_diff: me.rating - opp.rating,
    outcome,
    me_result: me.result,
    opp_result: opp.result,
    eco: pgnHeader(g.pgn, 'ECO'),
    opening: ecoName(g.pgn),
    moves: countMoves(g.pgn),
    end_reason: endReason(g.pgn),
    accuracy_me: g.accuracies ? (isWhite ? g.accuracies.white : g.accuracies.black) : null,
    accuracy_opp: g.accuracies ? (isWhite ? g.accuracies.black : g.accuracies.white) : null,
  };
});

const rapid = enriched.filter(g => g.time_class === 'rapid');
const blitz = enriched.filter(g => g.time_class === 'blitz');

function pct(n, d) { return d === 0 ? '-' : ((n / d) * 100).toFixed(1) + '%'; }
function avg(arr) { return arr.length === 0 ? null : (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1); }

function summary(games, label) {
  const n = games.length;
  if (n === 0) return `### ${label}\nAucune partie.\n`;
  const w = games.filter(g => g.outcome === 'W').length;
  const l = games.filter(g => g.outcome === 'L').length;
  const d = games.filter(g => g.outcome === 'D').length;
  const asW = games.filter(g => g.color === 'W');
  const asB = games.filter(g => g.color === 'B');
  const wW = asW.filter(g => g.outcome === 'W').length;
  const wB = asB.filter(g => g.outcome === 'W').length;
  const lW = asW.filter(g => g.outcome === 'L').length;
  const lB = asB.filter(g => g.outcome === 'L').length;
  const dW = asW.filter(g => g.outcome === 'D').length;
  const dB = asB.filter(g => g.outcome === 'D').length;
  const avgMoves = avg(games.map(g => g.moves));
  const avgRatingDiff = avg(games.map(g => g.rating_diff));
  return [
    `### ${label} (${n} parties)`,
    ``,
    `**Score global** : ${w}V / ${l}D / ${d}N -> winrate **${pct(w, n)}** (avec nulles : ${pct(w + d * 0.5, n)})`,
    `**Blancs** (${asW.length}p) : ${wW}V / ${lW}D / ${dW}N -> ${pct(wW, asW.length)}`,
    `**Noirs** (${asB.length}p) : ${wB}V / ${lB}D / ${dB}N -> ${pct(wB, asB.length)}`,
    `**Durée moyenne** : ${avgMoves} coups`,
    `**Écart Elo moyen vs adversaire** : ${avgRatingDiff > 0 ? '+' : ''}${avgRatingDiff}`,
    ``
  ].join('\n');
}

function openingTable(games, color, label, minGames = 3) {
  const subset = games.filter(g => g.color === color);
  const map = {};
  for (const g of subset) {
    const key = g.opening;
    if (!map[key]) map[key] = { n: 0, w: 0, l: 0, d: 0, eco: g.eco };
    map[key].n++;
    if (g.outcome === 'W') map[key].w++;
    else if (g.outcome === 'L') map[key].l++;
    else map[key].d++;
  }
  const rows = Object.entries(map)
    .filter(([, v]) => v.n >= minGames)
    .sort((a, b) => b[1].n - a[1].n);
  if (rows.length === 0) return `### ${label}\nPas assez d'échantillon (min ${minGames} parties).\n`;
  const lines = [`### ${label}`, ``, `| Ouverture | ECO | N | V | D | N | Winrate |`, `|---|---|---|---|---|---|---|`];
  for (const [name, v] of rows) {
    lines.push(`| ${name} | ${v.eco || '-'} | ${v.n} | ${v.w} | ${v.l} | ${v.d} | **${pct(v.w, v.n)}** |`);
  }
  lines.push('');
  return lines.join('\n');
}

function endReasonTable(games, label) {
  const losses = games.filter(g => g.outcome === 'L');
  const map = {};
  for (const g of losses) {
    const k = g.me_result || 'other';
    map[k] = (map[k] || 0) + 1;
  }
  const total = losses.length;
  const rows = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const lines = [`### ${label} - comment je perds (${total} défaites)`, '', '| Cause | N | % |', '|---|---|---|'];
  for (const [k, v] of rows) {
    lines.push(`| ${k} | ${v} | ${pct(v, total)} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function shortGamesLost(games, threshold = 20) {
  const shorts = games.filter(g => g.outcome === 'L' && g.moves > 0 && g.moves <= threshold);
  if (shorts.length === 0) return '';
  const total = games.filter(g => g.outcome === 'L').length;
  const lines = [`### Défaites courtes (<= ${threshold} coups : blunder précoce probable)`, '', `**${shorts.length} sur ${total} défaites (${pct(shorts.length, total)})**`, '', '| Date | Couleur | Adv Elo | Coups | Ouverture | Cause | Lien |', '|---|---|---|---|---|---|---|'];
  const sorted = shorts.sort((a, b) => b.end_time - a.end_time).slice(0, 15);
  for (const g of sorted) {
    const date = new Date(g.end_time * 1000).toISOString().slice(0, 10);
    lines.push(`| ${date} | ${g.color} | ${g.opp_rating} | ${g.moves} | ${g.opening} | ${g.me_result} | [voir](${g.url}) |`);
  }
  lines.push('');
  return lines.join('\n');
}

function ratingTrend(games) {
  const sorted = [...games].sort((a, b) => a.end_time - b.end_time);
  if (sorted.length === 0) return '';
  const buckets = [];
  const bucketSize = 20;
  for (let i = 0; i < sorted.length; i += bucketSize) {
    const slice = sorted.slice(i, i + bucketSize);
    const avgR = slice.reduce((a, g) => a + g.my_rating, 0) / slice.length;
    const wr = slice.filter(g => g.outcome === 'W').length / slice.length;
    buckets.push({
      start: new Date(slice[0].end_time * 1000).toISOString().slice(0, 10),
      end: new Date(slice[slice.length - 1].end_time * 1000).toISOString().slice(0, 10),
      avgR: avgR.toFixed(0),
      wr: (wr * 100).toFixed(1) + '%',
      games: slice.length,
    });
  }
  const lines = [`### Tendance Elo rapid (paquets de ${bucketSize} parties)`, '', '| Période | Parties | Elo moyen | Winrate |', '|---|---|---|---|'];
  for (const b of buckets) {
    lines.push(`| ${b.start} -> ${b.end} | ${b.games} | ${b.avgR} | ${b.wr} |`);
  }
  lines.push('');
  return lines.join('\n');
}

function vsStrongerWeaker(games, label) {
  const stronger = games.filter(g => g.rating_diff <= -25);
  const weaker = games.filter(g => g.rating_diff >= 25);
  const even = games.filter(g => Math.abs(g.rating_diff) < 25);
  function wr(arr) {
    if (arr.length === 0) return '-';
    return pct(arr.filter(g => g.outcome === 'W').length, arr.length);
  }
  return [
    `### ${label} - perf vs niveau adversaire`,
    '',
    `| Adv | Parties | Winrate |`,
    `|---|---|---|`,
    `| Plus fort (>=+25 Elo) | ${stronger.length} | ${wr(stronger)} |`,
    `| Équivalent (+/-25) | ${even.length} | ${wr(even)} |`,
    `| Plus faible (<=-25 Elo) | ${weaker.length} | ${wr(weaker)} |`,
    ``
  ].join('\n');
}

// Build report
const out = [];
out.push(`# Rapport Chess.com - louisssmrt`);
out.push(`> Généré le ${new Date().toISOString().slice(0, 10)} - ${enriched.length} parties analysées (avril + mai 2026)`);
out.push('');
out.push(summary(rapid, 'RAPID'));
out.push(summary(blitz, 'BLITZ'));
out.push(vsStrongerWeaker(rapid, 'RAPID'));
out.push(ratingTrend(rapid));
out.push(endReasonTable(rapid, 'RAPID'));
out.push(shortGamesLost(rapid, 20));
out.push(openingTable(rapid, 'W', 'RAPID - ouvertures BLANCS (>=3 parties)', 3));
out.push(openingTable(rapid, 'B', 'RAPID - ouvertures NOIRS (>=3 parties)', 3));

fs.writeFileSync(path.join(REPORTS_DIR, 'rapport-2026-05.md'), out.join('\n'));
fs.writeFileSync(path.join(REPORTS_DIR, 'games-enriched.json'), JSON.stringify(enriched, null, 2));
console.log(`Rapport généré : reports/rapport-2026-05.md`);
console.log(`Données enrichies : reports/games-enriched.json`);
console.log(`Total parties : ${enriched.length} (rapid: ${rapid.length}, blitz: ${blitz.length})`);
