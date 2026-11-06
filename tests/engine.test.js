import test from 'node:test';
import assert from 'node:assert/strict';
import { parseMoney, scoreRound, createGame, getStandings, appendExtra, validateGame } from '../engine.js';

const makeCatalog = () => [
  { id: 'milk', name: 'Leche', priceCents: 110, required: true, source: { shop: 'Supermercado' } },
  { id: 'house', name: 'Casa', priceCents: 77900000, required: true },
  { id: 'ps5', name: 'PS5', priceCents: 54999, required: false },
  { id: 'cinema', name: 'Cine', priceCents: 900, required: false },
];

test('parseMoney preserves cents for decimal comma, decimal point and Spanish thousands', () => {
  const examples = [
    ['', null], ['  ', null], ['0', 0], ['0,01', 1], ['1,50', 150], ['1.50', 150],
    ['1,5', 150], ['1.5', 150], ['779.000', 77900000], ['779000', 77900000],
    ['779.000,50', 77900050], ['1.234.567,89', 123456789], [' 29,99 ', 2999],
    ['90071992547409,91', Number.MAX_SAFE_INTEGER],
  ];
  for (const [input, expected] of examples) assert.equal(parseMoney(input), expected, input);
});

test('parseMoney rejects negatives, invalid grouping, excess precision and unsafe amounts', () => {
  for (const input of ['-1', '-0,01', '1,234', '2.0000', '1,000.50', '77.90.00', '12..50',
    '1 000', 'NaN', 'Infinity', '+5', '€5', '1e3', '90071992547409,92', null, 1]) {
    assert.throws(() => parseMoney(input), Error, String(input));
  }
});

test('closest valid bid wins and overbids receive zero', () => {
  assert.deepEqual(scoreRound(1000, { a: 800, b: 950, c: 1001, d: null }), {
    winnerIds: ['b'], exactIds: [], overIds: ['c'], points: { a: 0, b: 1, c: 0, d: 0 },
  });
});

test('exact price gives one shared winning point plus one bonus per exact team', () => {
  assert.deepEqual(scoreRound(1000, { a: 1000, b: 1000, c: 999 }), {
    winnerIds: ['a', 'b'], exactIds: ['a', 'b'], overIds: [], points: { a: 1.5, b: 1.5, c: 0 },
  });
  assert.equal(scoreRound(1000, { a: 1000 }).points.a, 2);
  assert.deepEqual(scoreRound(1000, { a: 900, b: 900, c: 900 }).points, { a: 1 / 3, b: 1 / 3, c: 1 / 3 });
});

test('all overbids or empty bids give no winners and no points; zero is a valid bid', () => {
  assert.deepEqual(scoreRound(100, { a: 101, b: null, c: 200 }), {
    winnerIds: [], exactIds: [], overIds: ['a', 'c'], points: { a: 0, b: 0, c: 0 },
  });
  assert.deepEqual(scoreRound(100, { a: null, b: null }).points, { a: 0, b: 0 });
  assert.equal(scoreRound(100, { a: 0, b: null }).points.a, 1);
  assert.equal(scoreRound(0, { a: 0 }).points.a, 2);
});

test('scoring rejects fractional cents and invalid price or bid values', () => {
  for (const bid of [-1, 1.5, undefined, NaN, Infinity, '100']) {
    assert.throws(() => scoreRound(100, { a: bid }));
  }
  assert.throws(() => scoreRound(-1, { a: null }));
  assert.throws(() => scoreRound(100, []));
});

test('new game snapshots the catalog and creates only required rounds', () => {
  const catalog = makeCatalog();
  const game = createGame([' Grupo A ', 'Grupo B'], catalog);
  assert.equal(game.version, 1);
  assert.equal(game.status, 'playing');
  assert.equal(game.finishedAt, null);
  assert.equal(game.fxRate, 8.8055);
  assert.equal(game.currentRound, 0);
  assert.deepEqual(game.teams, [{ id: 'team-1', name: 'Grupo A' }, { id: 'team-2', name: 'Grupo B' }]);
  assert.deepEqual(game.rounds.map((round) => round.productId), ['milk', 'house']);
  assert.deepEqual(game.rounds[0].bids, { 'team-1': null, 'team-2': null });
  assert.equal(game.rounds[0].revealed, false);
  catalog[0].priceCents = 999;
  catalog[0].source.shop = 'Otra tienda';
  assert.equal(game.catalog[0].priceCents, 110);
  assert.equal(game.catalog[0].source.shop, 'Supermercado');
  assert.equal(validateGame(game), true);
  assert.throws(() => createGame([], catalog));
  assert.throws(() => createGame(['  '], catalog));
  assert.throws(() => createGame(['A'], catalog, 0));
});

test('standings ignore hidden rounds and recalculate after a corrected bid', () => {
  const game = createGame(['A', 'B'], makeCatalog());
  game.rounds[0].bids = { 'team-1': 110, 'team-2': 100 };
  game.rounds[1].bids = { 'team-1': 77900000, 'team-2': 77900000 };
  assert.deepEqual(getStandings(game).map((team) => team.score), [0, 0]);
  game.rounds[0].revealed = true;
  assert.deepEqual(getStandings(game), [
    { id: 'team-1', name: 'A', score: 2, wins: 1, exacts: 1 },
    { id: 'team-2', name: 'B', score: 0, wins: 0, exacts: 0 },
  ]);
  game.rounds[0].bids['team-1'] = 111;
  assert.deepEqual(getStandings(game), [
    { id: 'team-2', name: 'B', score: 1, wins: 1, exacts: 0 },
    { id: 'team-1', name: 'A', score: 0, wins: 0, exacts: 0 },
  ]);
  game.rounds[1].revealed = true;
  assert.deepEqual(getStandings(game).map(({ score, wins, exacts }) => ({ score, wins, exacts })), [
    { score: 2.5, wins: 2, exacts: 1 }, { score: 1.5, wins: 1, exacts: 1 },
  ]);
});

test('mathematically tied fractional totals keep original team order without rounding points', () => {
  const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
  const catalog = Array.from({ length: 7 }, (_, index) => ({ id: `p${index}`, priceCents: 100, required: true }));
  const game = createGame(names, catalog);
  for (const round of game.rounds.slice(0, 6)) {
    round.revealed = true;
    for (const team of game.teams) round.bids[team.id] = team.name === 'B' ? null : 90;
  }
  game.rounds[6].revealed = true;
  game.rounds[6].bids['team-2'] = 90;
  assert.deepEqual(getStandings(game).map((team) => team.name), names);
  assert.deepEqual(getStandings(game).map((team) => team.score), names.map(() => 1));
  game.rounds[6].revealed = false;
  assert.equal(getStandings(game)[0].score, 1);
});

test('extra rounds are selected without repeats and do not mutate the source game', () => {
  const game = createGame(['A', 'B'], makeCatalog());
  const first = appendExtra(game, () => 0.999);
  assert.equal(first.rounds.at(-1).productId, 'cinema');
  assert.equal(first.rounds.at(-1).revealed, false);
  assert.equal(first.status, 'playing');
  assert.equal(first.finishedAt, null);
  assert.equal(first.currentRound, 0);
  assert.equal(game.rounds.length, 2);
  assert.equal(game.status, 'playing');
  first.catalog[0].source.shop = 'Modificado';
  assert.equal(game.catalog[0].source.shop, 'Supermercado');
  const second = appendExtra(first, () => 0);
  assert.equal(second.rounds.at(-1).productId, 'ps5');
  assert.equal(new Set(second.rounds.map((round) => round.productId)).size, 4);
  assert.equal(validateGame(second), true);
  assert.throws(() => appendExtra(second), /extra/);
  assert.throws(() => appendExtra(game, () => 1));
  assert.throws(() => appendExtra(game, () => -1));
});

test('adding an extra from the fifth round leaves the sixth base round next in sequence', () => {
  const catalog = Array.from({ length: 6 }, (_, index) => ({ id: `base-${index}`, priceCents: 100, required: true }));
  catalog.push({ id: 'extra', priceCents: 200, required: false });
  const game = createGame(['A', 'B'], catalog);
  game.currentRound = 4;
  const next = appendExtra(game, () => 0);
  assert.equal(next.currentRound, 4);
  assert.equal(next.rounds[next.currentRound + 1].productId, 'base-5');
  assert.equal(next.rounds.at(-1).productId, 'extra');
  assert.equal(next.status, game.status);
  assert.equal(next.finishedAt, game.finishedAt);
  assert.equal(game.rounds.length, 6);
});

test('extra rounds cannot reopen a finished game', () => {
  const game = createGame(['A', 'B'], makeCatalog());
  game.status = 'finished';
  game.finishedAt = new Date().toISOString();
  const before = structuredClone(game);
  assert.throws(() => appendExtra(game), /terminado/);
  assert.deepEqual(game, before);
});

test('a JSON storage round trip hydrates safely, including a finished game at the final round', () => {
  const game = createGame(['A', 'B'], makeCatalog(), 8.9);
  game.rounds[0].bids['team-1'] = 100;
  game.rounds[0].revealed = true;
  const hydrated = JSON.parse(JSON.stringify(game));
  assert.equal(validateGame(hydrated), true);
  assert.deepEqual(getStandings(hydrated), getStandings(game));
  hydrated.status = 'finished';
  hydrated.finishedAt = new Date().toISOString();
  hydrated.currentRound = hydrated.rounds.length - 1;
  assert.equal(validateGame(hydrated), true);
  hydrated.currentRound += 1;
  assert.equal(validateGame(hydrated), false);
});

test('hydration rejects malformed identities, money, rounds, bids and incompatible versions', () => {
  const valid = createGame(['A', 'B'], makeCatalog());
  const mutations = [
    (game) => { game.version = 2; },
    (game) => { game.id = ''; },
    (game) => { game.startedAt = 'ayer'; },
    (game) => { game.finishedAt = 'mañana'; },
    (game) => { game.status = 'unknown'; },
    (game) => { game.fxRate = -1; },
    (game) => { game.teams = []; },
    (game) => { game.teams[1].id = game.teams[0].id; },
    (game) => { game.teams[0].name = ' '; },
    (game) => { game.catalog[0].priceCents = 1.1; },
    (game) => { game.catalog[1].id = game.catalog[0].id; },
    (game) => { game.rounds[0].productId = 'unknown'; },
    (game) => { game.rounds.push(structuredClone(game.rounds[0])); },
    (game) => { game.rounds.shift(); },
    (game) => { game.rounds[0].revealed = 1; },
    (game) => { game.rounds[0].bids['team-1'] = -1; },
    (game) => { game.rounds[0].bids['team-1'] = 0.5; },
    (game) => { delete game.rounds[0].bids['team-2']; },
    (game) => { game.rounds[0].bids.stranger = null; },
    (game) => { game.currentRound = 2; },
    (game) => { game.currentRound = -1; },
  ];
  for (const mutate of mutations) {
    const corrupt = structuredClone(valid);
    mutate(corrupt);
    assert.equal(validateGame(corrupt), false, mutate.toString());
  }
  for (const invalid of [null, [], 'text', {}, 0]) assert.equal(validateGame(invalid), false);
});
