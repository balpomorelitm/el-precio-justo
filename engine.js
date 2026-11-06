const isRecord = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isId = (value) => typeof value === 'string' && value.trim().length > 0;
const isMoney = (value) => Number.isSafeInteger(value) && value >= 0;
const isDate = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value));
const clone = (value) => structuredClone(value);

/** Read a Spanish price (or a price with a decimal point) into integer cents. */
export function parseMoney(text) {
  if (typeof text !== 'string') throw new Error('Introduce un precio válido.');
  const input = text.trim();
  if (!input) return null;

  let whole;
  let fraction = '';
  if (input.includes(',')) {
    const parts = input.split(',');
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1])) {
      throw new Error('El precio admite un máximo de dos decimales.');
    }
    [whole, fraction] = parts;
    if (!/^\d+$/.test(whole) && !/^\d{1,3}(?:\.\d{3})+$/.test(whole)) {
      throw new Error('Introduce un precio válido.');
    }
    whole = whole.replaceAll('.', '');
  } else if (/^\d{1,3}(?:\.\d{3})+$/.test(input)) {
    whole = input.replaceAll('.', '');
  } else {
    const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(input);
    if (!match) throw new Error('Introduce un precio positivo con un máximo de dos decimales.');
    [, whole, fraction = ''] = match;
  }

  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('El precio es demasiado grande.');
  return Number(cents);
}

/** Winners share one point; every exact price also earns one bonus point. */
export function scoreRound(priceCents, bids) {
  if (!isMoney(priceCents) || !isRecord(bids)) throw new Error('La ronda no es válida.');
  const entries = Object.entries(bids);
  if (entries.some(([id, bid]) => !isId(id) || (bid !== null && !isMoney(bid)))) {
    throw new Error('Las propuestas deben ser precios positivos en céntimos.');
  }

  const valid = entries.filter(([, bid]) => bid !== null && bid <= priceCents);
  const highest = valid.length ? Math.max(...valid.map(([, bid]) => bid)) : null;
  const winnerIds = valid.filter(([, bid]) => bid === highest).map(([id]) => id);
  const exactIds = valid.filter(([, bid]) => bid === priceCents).map(([id]) => id);
  const overIds = entries.filter(([, bid]) => bid !== null && bid > priceCents).map(([id]) => id);
  const winners = new Set(winnerIds);
  const exacts = new Set(exactIds);
  const points = Object.fromEntries(entries.map(([id]) => [
    id,
    (winners.has(id) ? 1 / winnerIds.length : 0) + (exacts.has(id) ? 1 : 0),
  ]));
  return { winnerIds, exactIds, overIds, points };
}

export function createGame(names, catalog, fxRate = 8.8055) {
  if (!Array.isArray(names) || names.some((name) => typeof name !== 'string')) {
    throw new Error('Los grupos no son válidos.');
  }
  if (!Array.isArray(catalog)) throw new Error('El catálogo no es válido.');
  const teams = names.map((name, index) => ({ id: `team-${index + 1}`, name: name.trim() }));
  const snapshot = clone(catalog);
  const game = {
    version: 1,
    id: globalThis.crypto?.randomUUID?.() ?? `game-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'playing',
    teams,
    catalog: snapshot,
    rounds: snapshot.filter((product) => product?.required).map((product) => ({
      productId: product.id,
      bids: Object.fromEntries(teams.map((team) => [team.id, null])),
      revealed: false,
    })),
    currentRound: 0,
    fxRate,
  };
  if (!validateGame(game)) throw new Error('Revisa los grupos, los productos y el tipo de cambio.');
  return game;
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function addFraction(total, numerator, denominator) {
  const top = total.top * BigInt(denominator) + BigInt(numerator) * total.bottom;
  const bottom = total.bottom * BigInt(denominator);
  const divisor = gcd(top, bottom);
  total.top = top / divisor;
  total.bottom = bottom / divisor;
}

/** Compute totals from revealed rounds, so editing a past bid recalculates everything. */
export function getStandings(game) {
  const totals = game.teams.map((team) => ({ ...team, wins: 0, exacts: 0, top: 0n, bottom: 1n }));
  const byId = new Map(totals.map((team) => [team.id, team]));
  const products = new Map(game.catalog.map((product) => [product.id, product]));

  for (const round of game.rounds) {
    if (!round.revealed) continue;
    const result = scoreRound(products.get(round.productId).priceCents, round.bids);
    for (const id of result.winnerIds) {
      const team = byId.get(id);
      team.wins += 1;
      addFraction(team, 1, result.winnerIds.length);
    }
    for (const id of result.exactIds) {
      const team = byId.get(id);
      team.exacts += 1;
      addFraction(team, 1, 1);
    }
  }

  // Fractions remain exact until display, including ties such as six sixths = one.
  totals.sort((a, b) => {
    const difference = b.top * a.bottom - a.top * b.bottom;
    return difference > 0n ? 1 : difference < 0n ? -1 : 0;
  });
  return totals.map(({ id, name, wins, exacts, top, bottom }) => ({
    id, name, score: Number(top) / Number(bottom), wins, exacts,
  }));
}

export function appendExtra(game, random = Math.random) {
  if (!validateGame(game)) throw new Error('La partida no es válida.');
  if (game.status === 'finished') throw new Error('La partida ya ha terminado.');
  const used = new Set(game.rounds.map((round) => round.productId));
  const candidates = game.catalog.filter((product) => !product.required && !used.has(product.id));
  if (!candidates.length) throw new Error('Ya se han jugado todos los productos extra.');
  const draw = random();
  if (!Number.isFinite(draw) || draw < 0 || draw >= 1) throw new Error('La selección aleatoria no es válida.');
  const product = candidates[Math.floor(draw * candidates.length)];
  const next = clone(game);
  next.rounds.push({
    productId: product.id,
    bids: Object.fromEntries(next.teams.map((team) => [team.id, null])),
    revealed: false,
  });
  return next;
}

/** Reject corrupt or incompatible local storage before the UI uses its contents. */
export function validateGame(value) {
  try {
    if (!isRecord(value) || value.version !== 1 || !isId(value.id) || !isDate(value.startedAt)) return false;
    if (value.finishedAt !== null && !isDate(value.finishedAt)) return false;
    if (!['playing', 'finished'].includes(value.status)) return false;
    if (!Number.isFinite(value.fxRate) || value.fxRate <= 0) return false;
    if (!Array.isArray(value.teams) || !value.teams.length) return false;
    if (!value.teams.every((team) => isRecord(team) && isId(team.id) && isId(team.name))) return false;
    const teamIds = new Set(value.teams.map((team) => team.id));
    if (teamIds.size !== value.teams.length) return false;

    if (!Array.isArray(value.catalog) || !value.catalog.length) return false;
    if (!value.catalog.every((product) => isRecord(product) && isId(product.id) && isMoney(product.priceCents)
      && (product.required === undefined || typeof product.required === 'boolean'))) return false;
    const productIds = new Set(value.catalog.map((product) => product.id));
    if (productIds.size !== value.catalog.length) return false;
    const requiredIds = value.catalog.filter((product) => product.required).map((product) => product.id);
    if (!requiredIds.length || !Array.isArray(value.rounds) || value.rounds.length < requiredIds.length) return false;
    if (!requiredIds.every((id, index) => value.rounds[index]?.productId === id)) return false;
    const seen = new Set();
    for (const round of value.rounds) {
      if (!isRecord(round) || !productIds.has(round.productId) || seen.has(round.productId)) return false;
      if (typeof round.revealed !== 'boolean' || !isRecord(round.bids)) return false;
      const bids = Object.entries(round.bids);
      if (bids.length !== teamIds.size) return false;
      if (!bids.every(([id, bid]) => teamIds.has(id) && (bid === null || isMoney(bid)))) return false;
      seen.add(round.productId);
    }
    if (!Number.isInteger(value.currentRound) || value.currentRound < 0) return false;
    return value.currentRound < value.rounds.length;
  } catch {
    return false;
  }
}
