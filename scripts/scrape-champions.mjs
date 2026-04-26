#!/usr/bin/env node
/**
 * Serebii Pokémon Champions Attackdex Scraper
 *
 * Fetches every move page from serebii.net/attackdex-champions/ and generates:
 *   src/data/moves.js     — complete Champions move database
 *   src/data/learnsets.js — per-Pokémon learnsets
 *
 * Run:  node scripts/scrape-champions.mjs
 * Requires Node.js 18+ (built-in fetch)
 */

import { writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = 'https://www.serebii.net';
const DELAY_MS = 600; // be polite to Serebii

// ─── Load our Pokémon roster for base-stat matching ───────────────────────────
// We identify which Pokémon (including regional/Mega forms) learned a move by
// matching the 6 pipe-separated base stats on each learnset row against our data.

const { POKEMON } = await import('../src/data/pokemon.js');

// "hp|atk|def|spa|spd|spe" → pokémon id (or array if collision)
const STAT_LOOKUP = new Map();
for (const p of POKEMON) {
  const { hp, atk, def, spa, spd, spe } = p.baseStats;
  const key = `${hp}|${atk}|${def}|${spa}|${spd}|${spe}`;
  const existing = STAT_LOOKUP.get(key);
  if (!existing) {
    STAT_LOOKUP.set(key, p.id);
  } else if (Array.isArray(existing)) {
    existing.push(p.id);
  } else {
    STAT_LOOKUP.set(key, [existing, p.id]);
  }
}

// Also build a slug → id map for disambiguation when stats collide
const SLUG_LOOKUP = new Map();
for (const p of POKEMON) {
  // e.g. "raichu-alola" → try "raichu" and "raichua" as partial slugs
  SLUG_LOOKUP.set(p.id, p.id);
  SLUG_LOOKUP.set(p.id.replace(/-/g, ''), p.id);
  SLUG_LOOKUP.set(p.id.split('-')[0], p.id); // base name prefix
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert display name → move id.  "King's Shield" → "kings-shield" */
function moveNameToId(name) {
  return name
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Capitalize first letter of each word */
function titleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Move-page parsers ────────────────────────────────────────────────────────

function parseType(html) {
  // Serebii shows type as an image: /pokedex-bw/type/fire.gif
  const m = html.match(/\/type\/(\w+)\.gif/i);
  if (!m) return 'Normal';
  return titleCase(m[1].toLowerCase());
}

function parseCategory(html) {
  // Category image paths contain "physical", "special", or "other"
  if (/attackdex[^"]*\/physical\.shtml|["\/]physical\.gif/i.test(html)) return 'physical';
  if (/attackdex[^"]*\/special\.shtml|["\/]special\.gif/i.test(html))   return 'special';
  return 'status';
}

/**
 * Parse the move stats table where labels and values are in adjacent <tr> rows.
 * Serebii structure:
 *   <tr><td><b>Power Points</b></td><td><b>Base Power</b></td><td><b>Accuracy</b></td></tr>
 *   <tr><td class="cen">16</td><td class="cen">90</td><td class="cen">100</td></tr>
 * Returns { pp, power, accuracy }
 */
function parseMoveStats(html) {
  // Find the header row containing "Base Power"
  const headerIdx = html.search(/Base\s+Power/i);
  if (headerIdx === -1) return { pp: 10, power: 0, accuracy: null };

  // Find the next <tr> after the header row
  const afterHeader = html.slice(headerIdx);
  const nextRowMatch = afterHeader.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
  if (!nextRowMatch) return { pp: 10, power: 0, accuracy: null };

  // Skip the header row itself; find the following <tr>
  const headerRowEnd = afterHeader.indexOf('</tr>');
  const afterHeaderRow = afterHeader.slice(headerRowEnd + 5);
  const valueRowMatch = afterHeaderRow.match(/<tr[^>]*>([\s\S]*?)<\/tr>/i);
  if (!valueRowMatch) return { pp: 10, power: 0, accuracy: null };

  // Extract all numeric <td> values from the value row
  const nums = [...valueRowMatch[1].matchAll(/<td[^>]*>\s*(\d+)\s*<\/td>/gi)]
    .map(m => parseInt(m[1]));

  // Order: PP, Base Power, Accuracy (3 cells)
  const pp       = nums[0] ?? 10;
  const power    = nums[1] ?? 0;
  const accuracy = nums[2] ?? null;

  return { pp, power, accuracy };
}

/** True if the move targets all adjacent Pokémon (spread in doubles) */
function parseSpread(html) {
  return /All\s+Adjacent|allAdjacent|Entire\s+Field/i.test(html);
}

/** Parse the learnset table, returning our Pokémon IDs */
function parseLearners(html) {
  const learners = [];

  // Each learner row contains a link to /pokedex-champions/[slug]
  // and 6 <td> cells with integer base stats (HP, Atk, Def, SpA, SpD, Spe).
  // Stats appear in individual <td> tags, NOT pipe-separated in raw HTML.
  for (const row of html.split(/<tr[\s>]/i)) {
    const slugMatch = row.match(/href="\/pokedex-champions\/([a-z0-9-]+)"/i);
    if (!slugMatch) continue;
    const serebiiSlug = slugMatch[1];

    // Extract all <td> cells that contain only an integer
    const tdNums = [...row.matchAll(/<td[^>]*>\s*(\d{1,4})\s*<\/td>/gi)]
      .map(m => parseInt(m[1]));

    // The base stats block is 6 consecutive integers; take the last 6
    // (earlier cells may contain dex number or other data)
    if (tdNums.length < 6) continue;
    const stats = tdNums.slice(-6);
    const key = stats.join('|');
    const match = STAT_LOOKUP.get(key);

    if (!match) continue; // Pokémon not in our roster

    if (Array.isArray(match)) {
      // Stat collision — disambiguate using the Serebii slug
      const best = match.find(id =>
        id === serebiiSlug ||
        id.replace(/-/g, '') === serebiiSlug ||
        id.startsWith(serebiiSlug)
      );
      learners.push(best ?? match[0]);
    } else {
      learners.push(match);
    }
  }

  return [...new Set(learners)];
}

// ─── Network ──────────────────────────────────────────────────────────────────

async function get(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'pokemon-champions-calc/1.0 (educational project)' },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return res.text();
}

/** Fetch move list from the Champions moves page, returning [{slug, name}] */
async function fetchMoveList() {
  console.log('Fetching move list from /pokemonchampions/moves.shtml …');
  const html = await get(`${BASE}/pokemonchampions/moves.shtml`);
  if (!html) throw new Error('Could not fetch move list');

  const moves = [];
  const seen = new Set();

  // Links look like: href="/attackdex-champions/heatwave.shtml">Heat Wave</a>
  for (const [, slug, rawName] of html.matchAll(
    /href="\/attackdex-champions\/([a-z0-9-]+)\.shtml"[^>]*>([^<]{2,40})</gi
  )) {
    const name = rawName.trim().replace(/&amp;/g, '&').replace(/&#\d+;/g, '');
    if (!seen.has(slug) && /^[A-Z]/.test(name)) {
      seen.add(slug);
      moves.push({ slug, name });
    }
  }

  console.log(`  → ${moves.length} moves found`);
  return moves;
}

/** Fetch and parse one move page. Returns {move, learners} or null. */
async function fetchMovePage(slug, name) {
  const html = await get(`${BASE}/attackdex-champions/${slug}.shtml`);
  if (!html) return null;

  const id       = moveNameToId(name);
  const type     = parseType(html);
  const category = parseCategory(html);
  const { pp, power: rawPower, accuracy } = parseMoveStats(html);
  const power    = category !== 'status' ? rawPower : 0;
  const spread   = parseSpread(html);
  const learners = parseLearners(html);

  return {
    move: { id, name, type, category, power, accuracy, pp, spread },
    learners,
  };
}

// ─── Output generators ────────────────────────────────────────────────────────

function generateMovesJs(moves) {
  const rows = moves.map(m => {
    const parts = [
      `id: ${JSON.stringify(m.id)}`,
      `name: ${JSON.stringify(m.name)}`,
      `type: ${JSON.stringify(m.type)}`,
      `category: ${JSON.stringify(m.category)}`,
      `power: ${m.power}`,
      `accuracy: ${m.accuracy ?? 'null'}`,
      `pp: ${m.pp}`,
      `spread: ${m.spread}`,
    ];
    return `  { ${parts.join(', ')} },`;
  });

  return [
    '// Auto-generated by scripts/scrape-champions.mjs — do not edit by hand',
    `// Generated: ${new Date().toISOString()}`,
    'export const MOVES = [',
    ...rows,
    '];',
    '',
    'export const DAMAGING_MOVES = MOVES.filter(m => m.power > 0);',
    '',
    'export function getMoveById(id) {',
    '  return MOVES.find(m => m.id === id) ?? MOVES[0];',
    '}',
    '',
  ].join('\n');
}

function generateLearnsetJs(learnsets) {
  const entries = Object.entries(learnsets)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, moves]) => {
      const list = [...new Set(moves)].map(m => JSON.stringify(m)).join(', ');
      return `  ${JSON.stringify(id)}: [${list}],`;
    });

  return [
    '// Auto-generated by scripts/scrape-champions.mjs — do not edit by hand',
    `// Generated: ${new Date().toISOString()}`,
    'export const LEARNSETS = {',
    ...entries,
    '};',
    '',
  ].join('\n');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const moveList = await fetchMoveList();
  await sleep(DELAY_MS);

  const moves   = [];
  const learnsets = {};
  const failed  = [];

  for (let i = 0; i < moveList.length; i++) {
    const { slug, name } = moveList[i];
    process.stdout.write(`[${String(i + 1).padStart(3)}/${moveList.length}] ${name.padEnd(24)}`);

    let result;
    try {
      result = await fetchMovePage(slug, name);
    } catch (e) {
      process.stdout.write(`ERROR: ${e.message}\n`);
      failed.push(name);
      await sleep(DELAY_MS);
      continue;
    }

    if (!result) {
      process.stdout.write('404 — skipped\n');
      failed.push(name);
    } else {
      moves.push(result.move);
      for (const pkmnId of result.learners) {
        (learnsets[pkmnId] ??= []).push(result.move.id);
      }
      process.stdout.write(`${result.move.type.padEnd(10)} ${result.move.category.padEnd(9)} pwr:${String(result.move.power).padStart(3)}  learners:${result.learners.length}\n`);
    }

    await sleep(DELAY_MS);
  }

  // Write output
  const movesPath    = resolve(__dirname, '../src/data/moves.js');
  const learnsetPath = resolve(__dirname, '../src/data/learnsets.js');

  writeFileSync(movesPath,    generateMovesJs(moves));
  writeFileSync(learnsetPath, generateLearnsetJs(learnsets));

  console.log('\n─── Done ───────────────────────────────────────');
  console.log(`  ${moves.length} moves → src/data/moves.js`);
  console.log(`  ${Object.keys(learnsets).length} Pokémon with learnsets → src/data/learnsets.js`);
  if (failed.length) {
    console.log(`  ${failed.length} failed/skipped: ${failed.join(', ')}`);
  }
}

main().catch(err => {
  console.error('\nFatal:', err);
  process.exit(1);
});
