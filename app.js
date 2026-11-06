import { CATALOG, FX, REVIEW_DATE } from './catalog.js';
import { parseMoney, scoreRound, createGame, getStandings, appendExtra, validateGame } from './engine.js';

const $ = (selector, context = document) => context.querySelector(selector);
const $$ = (selector, context = document) => [...context.querySelectorAll(selector)];
const app = $('#app');
const modal = $('#modal');
const KEYS = { game: 'precio-justo:game:v1', draft: 'precio-justo:draft:v1', prefs: 'precio-justo:prefs:v1' };
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const eur = (cents) => new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', maximumFractionDigits: 2 }).format(cents / 100);
const score = (value) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 3 }).format(value);
const inputMoney = (cents) => cents === null ? '' : (cents / 100).toFixed(2).replace('.', ',');
const hkd = (cents) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 }).format(cents / 100 * game.fxRate) + ' HK$';
const safeLink = (value) => /^https:\/\//i.test(value) ? esc(value) : '#';
const imagePath = (value) => /^(assets\/|https:\/\/)/i.test(value) ? esc(value) : '';
const paths = {
  sound: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  muted: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m16 9 5 6m0-6-5 6"/>',
  motion: '<path d="m8 5 9 7-9 7V5Z"/><path d="M3 8v8m18-8v8"/>',
  fullscreen: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  back: '<path d="M20 12H4m6-6-6 6 6 6"/>',
  users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m2 4a5 5 0 0 1 3 4v2"/>',
  trophy: '<path d="M8 3h8v6a4 4 0 0 1-8 0V3Zm4 10v5m-5 3h10M8 5H4v2a5 5 0 0 0 5 5m7-7h4v2a5 5 0 0 1-5 5"/>',
  lock: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="m15 4 5 5M4 20l5-1L21 7a3.5 3.5 0 0 0-5-5L4 14v6Z"/>',
  list: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8m-8 4h5"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  shuffle: '<path d="m17 3 4 4-4 4M3 17h3c6 0 6-10 12-10h3M3 7h3c2 0 3 1 4 3m4 4c1 2 2 3 4 3h3m-4-4 4 4-4 4"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 2M5 16a8 8 0 0 0 13 2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
};
const icon = (name) => `<svg class="icon" viewBox="0 0 24 24" aria-hidden="true">${paths[name] ?? paths.check}</svg>`;
let storageAvailable = true;
function read(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } }
function write(key, value) {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(value)); }
  catch { storageAvailable = false; }
}
let game = read(KEYS.game);
const invalidSavedGame = Boolean(game && !validateGame(game));
if (!validateGame(game)) game = null;
let catalog = structuredClone(CATALOG);
let fxRate = FX.rate;
const draft = read(KEYS.draft);
if (draft && Array.isArray(draft.prices)) {
  for (const item of draft.prices) {
    if (!item || typeof item !== 'object') continue;
    const product = catalog.find((entry) => entry.id === item.id);
    if (product && Number.isSafeInteger(item.priceCents) && item.priceCents > 0) product.priceCents = item.priceCents;
  }
  if (Number.isFinite(draft.fxRate) && draft.fxRate > 0) fxRate = draft.fxRate;
}
let names = ['Equipo 1', 'Equipo 2', 'Equipo 3'];
let prefs = { sound: true, volume: 45, reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches };
const savedPrefs = read(KEYS.prefs);
if (savedPrefs && typeof savedPrefs === 'object') {
  if (typeof savedPrefs.sound === 'boolean') prefs.sound = savedPrefs.sound;
  if (typeof savedPrefs.reducedMotion === 'boolean') prefs.reducedMotion = savedPrefs.reducedMotion;
  if (Number.isFinite(savedPrefs.volume)) prefs.volume = Math.max(0, Math.min(100, savedPrefs.volume));
}
let audioContext;
let toastTimer;
function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { element.hidden = true; }, 3600);
}
function announce(message) { $('#announcer').textContent = message; }
function save() {
  if (game) write(KEYS.game, game);
  $('#save-status').textContent = storageAvailable ? 'Partida guardada en este navegador' : 'El navegador no permite guardar la partida';
}
function saveDraft() { write(KEYS.draft, { prices: catalog.map(({ id, priceCents }) => ({ id, priceCents })), fxRate }); }
function syncPrefs() {
  document.body.classList.toggle('reduced-motion', prefs.reducedMotion);
  $('#sound-toggle').innerHTML = icon(prefs.sound ? 'sound' : 'muted');
  $('#sound-toggle').setAttribute('aria-label', prefs.sound ? 'Silenciar sonido' : 'Activar sonido');
  $('#sound-toggle').title = prefs.sound ? 'Silenciar sonido' : 'Activar sonido';
  $('#sound-toggle').setAttribute('aria-pressed', String(!prefs.sound));
  $('#motion-toggle').innerHTML = icon('motion');
  $('#motion-toggle').setAttribute('aria-pressed', String(prefs.reducedMotion));
  $('#motion-toggle').setAttribute('aria-label', prefs.reducedMotion ? 'Activar animaciones' : 'Reducir animaciones');
  $('#motion-toggle').title = prefs.reducedMotion ? 'Activar animaciones' : 'Reducir animaciones';
  $('#fullscreen-toggle').innerHTML = icon('fullscreen');
  $('#volume').value = prefs.volume;
  write(KEYS.prefs, prefs);
}
function sound(kind = 'win') {
  if (!prefs.sound || !prefs.volume) return;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume().catch(() => {});
    const notes = kind === 'drum' ? [120, 130, 145, 160, 180, 210] : kind === 'lose' ? [180, 130] : kind === 'start' ? [392, 494, 587] : kind === 'exact' ? [523, 659, 784, 1047] : [440, 587, 740];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime + index * (kind === 'drum' ? .09 : .13);
      oscillator.type = kind === 'lose' || kind === 'drum' ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(prefs.volume / 100 * .13, start + .015);
      gain.gain.exponentialRampToValueAtTime(.001, start + .25);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(start); oscillator.stop(start + .27);
    });
  } catch { /* The game remains playable when audio is unavailable. */ }
}
function celebrate() {
  if (prefs.reducedMotion) return;
  const container = $('#confetti');
  container.innerHTML = Array.from({ length: 46 }, (_, index) => `<i class="piece" style="left:${Math.random() * 100}%;animation-delay:${Math.random() * .35}s;animation-duration:${2 + Math.random()}s;transform:rotate(${index * 23}deg)"></i>`).join('');
  setTimeout(() => { container.innerHTML = ''; }, 4000);
}

function renderHome() {
  app.innerHTML = `<div class="home-layout"><section class="hero-left"><div class="eyebrow"><span class="live-dot"></span>EL CONCURSO EMPIEZA EN TU CLASE</div><h1 class="hero-title">Acércate.<br><em>Sin pasarte.</em></h1><p class="hero-copy">El juego de siempre, con precios de ahora.<br>Reúne a los equipos y descubre quién tiene mejor ojo para <strong>el precio justo.</strong></p><figure class="archive-tv"><img class="archive-photo" src="assets/show-archive.jpg" alt="El concurso El Precio Justo, en una imagen de archivo de RTVE"><figcaption class="archive-caption"><span>UN CLÁSICO DE LA TELE</span><a href="https://www.rtve.es/television/el-precio-justo/" target="_blank" rel="noopener noreferrer">Archivo RTVE ↗</a></figcaption></figure><div class="feature-strip"><span class="feature">${icon('users')}Por equipos</span><span class="feature">${icon('list')}6 rondas + extras</span><span class="feature">${icon('trophy')}Acercarse sin pasarse</span></div></section><section class="setup-panel" aria-labelledby="setup-title"><div class="setup-heading"><div><h2 id="setup-title">¿Quién juega hoy?</h2><p>Pon nombre a los equipos. Nosotros llevamos la cuenta.</p></div>${icon('users')}</div><form id="setup-form"><div class="team-list">${names.map((name, index) => `<div class="team-row"><span class="team-dot" aria-hidden="true"></span><label class="sr-only" for="team-${index}">Nombre del equipo ${index + 1}</label><input class="team-input" id="team-${index}" data-team-index="${index}" value="${esc(name)}" placeholder="Nombre del equipo ${index + 1}" maxlength="40" autocomplete="off"><button type="button" class="icon-button" data-action="remove-team" data-index="${index}" aria-label="Quitar equipo ${index + 1}" ${names.length <= 2 ? 'disabled' : ''}>${icon('close')}</button></div>`).join('')}</div><div id="setup-error" class="form-error" role="alert" hidden></div><div class="setup-actions"><button type="button" class="button ghost" data-action="add-team" ${names.length >= 12 ? 'disabled' : ''}>${icon('plus')}Añadir otro equipo</button><button type="submit" class="button primary">¡Que empiece el juego! ${icon('arrow')}</button></div></form><div class="setup-foot"><button class="catalog-link" data-action="catalog">${icon('edit')}Productos y precios</button><span>Precios revisados · 6 nov 2026</span></div></section></div>`;
}
function rankRows(standings) {
  let rank = 1;
  return standings.map((team, index) => {
    if (index && Math.abs(team.score - standings[index - 1].score) > 1e-9) rank = index + 1;
    return { ...team, rank };
  });
}
function scoreboard() {
  return rankRows(getStandings(game)).map((team) => `<article class="score-card"><span class="score-rank">${team.rank}.</span><span class="score-name">${esc(team.name)}</span><span class="score-value">${score(team.score)} <small>pts</small></span></article>`).join('');
}
function getRound() { return game.rounds[game.currentRound]; }
function getProduct() { return game.catalog.find((product) => product.id === getRound().productId); }
function resultMessage(result) {
  if (!result.winnerIds.length) return 'Esta ronda queda sin ganador: las propuestas superan el precio o están vacías.';
  const winners = result.winnerIds.map((id) => game.teams.find((team) => team.id === id).name).join(' y ');
  return result.exactIds.length ? `¡Precio exacto! ${winners}. Un punto extra para cada acierto.` : `${winners} ${result.winnerIds.length === 1 ? 'gana' : 'comparten'} el punto de la ronda.`;
}
function teamStatus(teamId, result) {
  if (result.exactIds.includes(teamId)) return '<span>¡Exacto!</span><br><span class="bid-points">+' + score(result.points[teamId]) + '</span>';
  if (result.winnerIds.includes(teamId)) return '<span>Más cerca</span><br><span class="bid-points">+' + score(result.points[teamId]) + '</span>';
  if (result.overIds.includes(teamId)) return 'Se ha pasado';
  return getRound().bids[teamId] === null ? 'Sin propuesta' : 'Sin puntos';
}
function renderGame() {
  const round = getRound();
  const product = getProduct();
  const result = round.revealed ? scoreRound(product.priceCents, round.bids) : null;
  const revealedCount = game.rounds.filter((item) => item.revealed).length;
  const mayFinish = revealedCount >= 5;
  const used = new Set(game.rounds.map((item) => item.productId));
  const extrasLeft = game.catalog.filter((item) => !item.required && !used.has(item.id)).length;
  const nextExists = game.currentRound + 1 < game.rounds.length;
  const lastRevealed = game.rounds.reduce((last, item, index) => item.revealed ? index : last, -1);
  app.innerHTML = `<section class="game-top"><div><div class="round-eyebrow"><span class="live-dot"></span>${game.currentRound < 6 ? 'EL CONCURSO' : 'RONDA EXTRA'} · RONDA ${game.currentRound + 1} DE ${game.rounds.length}</div><h1 class="round-title">${round.revealed ? '¡Este es el precio justo!' : '¿Cuánto creéis que cuesta?'}</h1></div><div class="round-progress" aria-label="Progreso del juego">${game.rounds.map((item, index) => `<span class="round-dot ${item.revealed ? 'is-done' : ''} ${index === game.currentRound ? 'is-current' : ''}" title="Ronda ${index + 1}${item.revealed ? ', revelada' : ''}"></span>`).join('')}</div></section><div class="game-layout"><article class="product-panel"><div class="product-visual ${product.id === 'house' ? 'is-house' : ''}"><span class="product-category">${esc(product.category)}</span><img class="product-image" src="${imagePath(product.image)}" alt="${esc(product.imageAlt)}"></div><div class="product-info"><div class="product-brand">${esc(product.brand)}</div><h2 class="product-name">${esc(product.name)}</h2><p class="product-description">${esc(product.description)}</p><p class="image-credit">${esc(product.imageNote || 'Imagen del producto de referencia')}${round.revealed ? ` · <a href="${safeLink(product.source)}" target="_blank" rel="noopener noreferrer">${esc(product.sourceLabel)} ↗</a>` : ''}</p></div></article><section class="bids-panel" aria-labelledby="bids-heading"><div class="panel-heading"><h2 id="bids-heading">Las propuestas</h2><span>Precios en euros (€)</span></div><div class="bids-list">${game.teams.map((team) => `<div class="bid-row ${result?.winnerIds.includes(team.id) ? 'winner' : ''} ${result?.overIds.includes(team.id) ? 'over' : ''}" data-bid-row="${team.id}"><label class="bid-team" for="bid-${team.id}"><span class="team-dot" aria-hidden="true"></span>${esc(team.name)}</label><div class="bid-input-wrap"><input class="bid-input" id="bid-${team.id}" data-bid="${team.id}" inputmode="decimal" autocomplete="off" aria-label="Propuesta de ${esc(team.name)} en euros" placeholder="0,00" value="${inputMoney(round.bids[team.id])}"><span aria-hidden="true">€</span></div><div class="bid-status">${result ? teamStatus(team.id, result) : 'Por decidir'}</div></div>`).join('')}</div><p id="bid-error" class="form-error" role="alert" hidden></p>${round.revealed ? `<div class="price-reveal"><span class="price-label">EL PRECIO JUSTO</span><strong class="price-amount">${eur(product.priceCents)}</strong><span class="price-hkd">≈ ${hkd(product.priceCents)}</span></div><p class="reveal-message" id="reveal-message">${esc(resultMessage(result))}</p>` : `<div class="reveal-placeholder">${icon('lock')}El precio espera al otro lado del botón.</div>`}<div class="round-actions">${round.revealed ? `<span class="feature">${icon('edit')}Puedes corregir las propuestas</span><button class="button primary" data-action="${nextExists ? 'next' : 'finish'}">${nextExists ? 'Siguiente ronda' : 'Ver resultado final'} ${icon('arrow')}</button>` : `<button class="button primary" data-action="reveal">${icon('eye')}Revelar el precio</button>`}</div></section></div>${mayFinish ? `<div class="extra-actions"><button class="button secondary small" data-action="extra" ${!extrasLeft ? 'disabled' : ''}>${icon('shuffle')}Añadir ronda extra${extrasLeft ? ` (${extrasLeft})` : ''}</button><button class="button ghost small" data-action="confirm-finish">Terminar la partida ${icon('arrow')}</button></div>` : ''}<section class="scoreboard" aria-labelledby="score-heading"><div class="scoreboard-heading"><h2 id="score-heading">Así va el concurso</h2><span>1 punto por ronda · +1 por precio exacto</span></div><div class="score-grid" id="score-grid">${scoreboard()}</div></section><nav class="history-bar" aria-label="Revisar rondas"><span class="feature">${icon('clock')}Rondas</span>${game.rounds.map((item, index) => item.revealed || index === Math.min(lastRevealed + 1, game.rounds.length - 1) ? `<button class="history-button" data-action="round" data-index="${index}" aria-current="${index === game.currentRound}">${index + 1}. ${esc(game.catalog.find((entry) => entry.id === item.productId).name)}</button>` : '').join('')}<button class="history-button" data-action="new">Nueva partida</button></nav>`;
}
function refreshResults() {
  if (!getRound().revealed) return;
  const result = scoreRound(getProduct().priceCents, getRound().bids);
  for (const team of game.teams) {
    const row = $(`[data-bid-row="${team.id}"]`);
    row.classList.toggle('winner', result.winnerIds.includes(team.id));
    row.classList.toggle('over', result.overIds.includes(team.id));
    $('.bid-status', row).innerHTML = teamStatus(team.id, result);
  }
  $('#score-grid').innerHTML = scoreboard();
  $('#reveal-message').textContent = resultMessage(result);
}
function renderFinal() {
  const standings = rankRows(getStandings(game));
  const winners = standings.filter((team) => Math.abs(team.score - standings[0].score) < 1e-9);
  app.innerHTML = `<div class="final-layout"><section class="final-stage"><div class="final-kicker">${icon('trophy')}CONCURSO COMPLETADO</div><h1 class="final-title">${winners.length > 1 ? '¡Tenemos un empate!' : '¡El equipo ganador es…!'}</h1><div class="winner-name">${winners.map((team) => esc(team.name)).join(' <span>&amp;</span> ')}</div><div class="final-score">${score(standings[0].score)} <small>puntos${winners.length > 1 ? ' cada equipo' : ''}</small></div><div class="podium">${standings.slice(0, 3).map((team) => `<article class="score-card"><span class="score-rank">${team.rank}.</span><span class="score-name">${esc(team.name)}</span><span class="score-value">${score(team.score)}</span></article>`).join('')}</div><div class="final-actions"><button class="button primary" data-action="new">${icon('refresh')}Jugar otra vez</button><button class="button secondary" data-action="csv">${icon('download')}Descargar resultados</button><button class="button ghost" data-action="review">Revisar la partida</button></div></section><table class="summary-table"><caption class="sr-only">Clasificación final de la partida</caption><thead><tr><th>Puesto</th><th>Equipo</th><th>Rondas ganadas</th><th>Exactos</th><th>Puntos</th></tr></thead><tbody>${standings.map((team) => `<tr><td>${team.rank}</td><td>${esc(team.name)}</td><td>${team.wins}</td><td>${team.exacts}</td><td>${score(team.score)}</td></tr>`).join('')}</tbody></table><p class="catalog-note">${game.rounds.filter((round) => round.revealed).length} rondas jugadas · Los empates comparten el punto de la ronda. Precios de referencia revisados el 6 de noviembre de 2026.</p></div>`;
}
function render() { if (!game) renderHome(); else if (game.status === 'finished') renderFinal(); else renderGame(); }

function openModal(title, body) {
  $('#modal-content').innerHTML = `<div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="close-modal" data-action="close-modal" aria-label="Cerrar ventana">${icon('close')}</button></div><div class="modal-body">${body}</div>`;
  if (!modal.open) modal.showModal();
}
function showCatalog() {
  const products = game ? game.catalog : catalog;
  openModal('Los productos del concurso', `<p>Seis productos en la partida inicial y tres sorpresas extra. ${game ? 'Esta partida conserva los precios con los que empezó.' : 'Puedes ajustar cualquier precio antes de empezar.'}</p><form id="catalog-form"><div class="catalog-grid">${products.map((product) => `<article class="catalog-item"><img class="catalog-image" src="${imagePath(product.image)}" alt="${esc(product.imageAlt)}" loading="lazy"><div class="catalog-meta"><p>${product.required ? 'RONDA INICIAL' : 'RONDA EXTRA'}</p><h3>${esc(product.name)}</h3><p>${esc(product.brand)}</p>${game ? `<div class="catalog-price">${eur(product.priceCents)}</div>` : `<div class="price-editor"><label for="price-${product.id}">Precio €</label><input id="price-${product.id}" data-price="${product.id}" inputmode="decimal" required value="${inputMoney(product.priceCents)}" aria-label="Precio en euros de ${esc(product.name)}"></div>`}<a href="${safeLink(product.source)}" target="_blank" rel="noopener noreferrer">${esc(product.sourceLabel)} ↗</a>${product.note ? `<p>${esc(product.note)}</p>` : ''}</div></article>`).join('')}</div><div class="settings-row"><div><label for="fx-rate"><strong>Conversión de euros a dólares de Hong Kong</strong></label><small>Solo se muestra al revelar el precio. <a href="${FX.url}" target="_blank" rel="noopener noreferrer">Referencia BCE · ${FX.date}</a>.</small></div><input id="fx-rate" inputmode="decimal" value="${game ? game.fxRate : fxRate}" aria-label="Dólares de Hong Kong por un euro" ${game ? 'readonly' : ''}></div><p class="catalog-note">Precios consultados: 6 de noviembre de 2026. Son referencias para jugar y pueden cambiar entre establecimientos. ${game ? '' : 'Los cambios se guardan en este navegador y se fijan al iniciar la partida.'}</p><p id="catalog-error" class="form-error" role="alert" hidden></p><div class="modal-actions">${game ? '' : '<button type="button" class="button ghost" data-action="reset-prices">Restaurar precios</button>'}<button type="${game ? 'button' : 'submit'}" ${game ? 'data-action="close-modal"' : ''} class="button primary">${game ? 'Cerrar' : 'Guardar precios'}</button></div></form>`);
}
function showHelp() {
  openModal('Cómo se juega', `<ol class="rules-list"><li><strong>Forma dos equipos o más.</strong> Escribe los nombres antes de empezar.</li><li><strong>Enseña el producto y recoge los precios.</strong> Introduce cada propuesta en euros. Un campo vacío cuenta como equipo sin propuesta.</li><li><strong>Revela el precio.</strong> Gana un punto quien más se acerque <strong>sin pasarse</strong>. Si empatan, comparten ese punto. Cada precio exacto suma además un punto extra.</li><li><strong>El concurso sigue a tu ritmo.</strong> Puedes corregir propuestas en cualquier ronda revelada; el marcador se recalcula al escribir.</li><li><strong>Desde la quinta ronda revelada</strong> puedes terminar o añadir sorpresas. Los extras se colocan después de los productos pendientes, sin repetirse.</li><li><strong>La partida se guarda automáticamente</strong> en este navegador. Al volver a abrir la página podrás continuar. Al terminar, descarga el resultado en CSV.</li></ol><p class="catalog-note">El sonido, el volumen y las animaciones se controlan arriba. La conversión a HK$ es orientativa y aparece al revelar. La página está pensada para que la controle el profesor.</p><div class="modal-actions"><button class="button primary" data-action="close-modal">¡Entendido!</button></div>`);
}
function captureBids() {
  let valid = true;
  for (const input of $$('[data-bid]', app)) {
    try { getRound().bids[input.dataset.bid] = parseMoney(input.value); input.removeAttribute('aria-invalid'); }
    catch { input.setAttribute('aria-invalid', 'true'); valid = false; }
  }
  const error = $('#bid-error');
  if (!valid) { error.textContent = 'Revisa las propuestas marcadas: utiliza precios positivos y hasta dos decimales.'; error.hidden = false; $('[aria-invalid="true"]', app)?.focus(); }
  else error.hidden = true;
  if (valid) save();
  return valid;
}
function finishGame() {
  if (!captureBids()) return;
  if (game.rounds.filter((round) => round.revealed).length < 5) return;
  game.status = 'finished'; game.finishedAt = new Date().toISOString();
  modal.close(); save(); render(); sound('exact'); celebrate(); announce('Partida terminada. Consulta la clasificación final.');
}
function csvCell(value) {
  let text = String(value ?? '');
  if (/^[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
function exportCSV() {
  const rows = [['EL PRECIO JUSTO', 'Fecha', game.startedAt], ['Ronda', 'Producto', 'Precio real (EUR)', 'Equipo', 'Propuesta (EUR)', 'Puntos de la ronda']];
  game.rounds.forEach((round, index) => {
    if (!round.revealed) return;
    const product = game.catalog.find((item) => item.id === round.productId);
    const result = scoreRound(product.priceCents, round.bids);
    for (const team of game.teams) rows.push([index + 1, product.name, inputMoney(product.priceCents), team.name, inputMoney(round.bids[team.id]), String(result.points[team.id]).replace('.', ',')]);
  });
  rows.push([], ['Clasificación', 'Equipo', 'Rondas ganadas', 'Exactos', 'Puntos']);
  for (const team of rankRows(getStandings(game))) rows.push([team.rank, team.name, team.wins, team.exacts, String(team.score).replace('.', ',')]);
  const blob = new Blob(['\ufeff' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = `precio-justo-${game.startedAt.slice(0, 10)}.csv`; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000); toast('Resultados descargados.');
}

document.addEventListener('submit', (event) => {
  if (event.target.id === 'setup-form') {
    event.preventDefault();
    const values = $$('[data-team-index]', app).map((input) => input.value.trim());
    const error = $('#setup-error');
    if (values.length < 2 || values.some((name) => !name) || new Set(values.map((name) => name.toLocaleLowerCase('es'))).size !== values.length) {
      error.textContent = 'Escribe al menos dos equipos, con nombres distintos y sin campos vacíos.'; error.hidden = false; return;
    }
    names = values; game = createGame(names, catalog, fxRate); save(); render(); sound('start'); announce('Empieza el concurso. Primera ronda.');
  }
  if (event.target.id === 'catalog-form') {
    event.preventDefault();
    if (game) return;
    try {
      const updates = $$('[data-price]', modal).map((input) => {
        const priceCents = parseMoney(input.value);
        if (priceCents === null || priceCents <= 0) throw new Error('Todos los productos necesitan un precio mayor que cero.');
        return { id: input.dataset.price, priceCents };
      });
      const rate = Number($('#fx-rate').value.trim().replace(',', '.'));
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Introduce un tipo de cambio mayor que cero.');
      for (const update of updates) catalog.find((product) => product.id === update.id).priceCents = update.priceCents;
      fxRate = rate; saveDraft(); modal.close(); toast('Precios guardados para la próxima partida.');
    } catch (error) { $('#catalog-error').textContent = error.message; $('#catalog-error').hidden = false; }
  }
});
document.addEventListener('input', (event) => {
  const input = event.target;
  if (input.matches('[data-team-index]')) names[Number(input.dataset.teamIndex)] = input.value;
  if (input.matches('[data-bid]') && game?.status === 'playing') {
    try {
      getRound().bids[input.dataset.bid] = parseMoney(input.value); input.removeAttribute('aria-invalid');
      $('#bid-error').hidden = true; save(); refreshResults();
    } catch { input.setAttribute('aria-invalid', 'true'); $('#bid-error').textContent = 'Usa un precio positivo con hasta dos decimales.'; $('#bid-error').hidden = false; }
  }
  if (input.id === 'volume') { prefs.volume = Number(input.value); write(KEYS.prefs, prefs); }
});
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  try {
    if (button.id === 'sound-toggle') { prefs.sound = !prefs.sound; syncPrefs(); if (prefs.sound) sound('start'); return; }
    if (button.id === 'motion-toggle') { prefs.reducedMotion = !prefs.reducedMotion; syncPrefs(); return; }
    if (button.id === 'fullscreen-toggle') {
      if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('Utiliza el modo de pantalla completa de tu navegador.'); return;
    }
    if (button.id === 'help-toggle') { showHelp(); return; }
    switch (button.dataset.action) {
      case 'close-modal': modal.close(); break;
      case 'catalog': showCatalog(); break;
      case 'add-team': if (names.length < 12) { names.push(`Equipo ${names.length + 1}`); renderHome(); $('[data-team-index="' + (names.length - 1) + '"]').focus(); } break;
      case 'remove-team': if (names.length > 2) { names.splice(Number(button.dataset.index), 1); renderHome(); } break;
      case 'reset-prices': catalog = structuredClone(CATALOG); fxRate = FX.rate; saveDraft(); showCatalog(); break;
      case 'reveal': {
        if (!captureBids()) break;
        const gameId = game.id;
        const roundIndex = game.currentRound;
        button.disabled = true;
        sound('drum');
        await new Promise((resolve) => setTimeout(resolve, 650));
        if (!game || game.id !== gameId || game.status !== 'playing' || game.currentRound !== roundIndex) break;
        getRound().revealed = true;
        const result = scoreRound(getProduct().priceCents, getRound().bids);
        save(); renderGame(); sound(result.exactIds.length ? 'exact' : result.winnerIds.length ? 'win' : 'lose');
        if (result.exactIds.length) celebrate();
        announce(`${getProduct().name}: ${eur(getProduct().priceCents)}. ${resultMessage(result)}`); break;
      }
      case 'next': if (captureBids() && getRound().revealed && game.currentRound < game.rounds.length - 1) { game.currentRound += 1; save(); renderGame(); announce(`Ronda ${game.currentRound + 1}. ${getProduct().name}.`); } break;
      case 'round': {
        if (!captureBids()) break;
        const index = Number(button.dataset.index);
        const firstPending = game.rounds.findIndex((round) => !round.revealed);
        if (Number.isInteger(index) && index >= 0 && index < game.rounds.length && (game.rounds[index].revealed || index === firstPending)) { game.currentRound = index; save(); renderGame(); } break;
      }
      case 'extra': if (captureBids() && game.rounds.filter((round) => round.revealed).length >= 5) { game = appendExtra(game); save(); renderGame(); toast('Ronda extra añadida al final. Los productos pendientes conservan su turno.'); } break;
      case 'confirm-finish': if (captureBids()) openModal('¿Cerramos el concurso?', '<p>Se calculará la clasificación con las rondas que ya has revelado. Las pendientes no suman puntos.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Seguir jugando</button><button class="button primary" data-action="finish">Ver clasificación</button></div>'); break;
      case 'finish': finishGame(); break;
      case 'csv': exportCSV(); break;
      case 'review': game.status = 'playing'; game.finishedAt = null; game.currentRound = Math.max(0, game.rounds.findLastIndex((round) => round.revealed)); save(); renderGame(); break;
      case 'new': openModal('Una nueva partida', '<p>Se borrará el registro de la partida actual en este navegador. Puedes descargar los resultados antes de empezar otra.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Cancelar</button>' + (game ? '<button class="button secondary" data-action="csv">Descargar CSV</button>' : '') + '<button class="button primary" data-action="reset-game">Empezar de nuevo</button></div>'); break;
      case 'reset-game': if (game) names = game.teams.map((team) => team.name); game = null; write(KEYS.game, null); modal.close(); renderHome(); $('#save-status').textContent = 'Hecho para jugar juntos'; break;
    }
  } catch (error) { toast(error.message || 'No se ha podido completar la acción.'); }
});
modal.addEventListener('click', (event) => { if (event.target === modal) { const box = modal.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) modal.close(); } });
document.querySelector('.brand').addEventListener('click', (event) => { if (game) { event.preventDefault(); toast('La partida sigue guardada. Usa «Nueva partida» para empezar otra.'); } });
window.addEventListener('beforeunload', () => { if (game) save(); });
syncPrefs(); render();
if (game) { save(); toast(game.status === 'finished' ? 'Clasificación recuperada.' : 'Partida recuperada. Seguimos donde lo dejaste.'); }
if (invalidSavedGame) toast('El registro guardado no era compatible. Puedes empezar una nueva partida.');
