import { CATALOG, FX, REVIEW_DATE } from './catalog.js';
import { showStartIntro } from './intro.js';
import { parseMoney, scoreRound, createGame, getStandings, appendExtra, validateGame, turnOrder } from './engine.js';

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
const productImage = (product) => product.id === 'house' ? 'assets/house.png' : product.image;
const priceQuestions = {
  coffee: '¿Cuánto cuesta este café con leche?',
  mug: '¿Cuánto cuesta esta taza?',
  dress: '¿Cuánto cuesta este vestido?',
  boots: '¿Cuánto cuestan estas botas?',
  ps5: '¿Cuánto cuesta esta consola?',
  house: '¿Cuánto cuesta esta casa?',
  salmon: '¿Cuánto cuesta un kilo de salmón fresco?',
  bag: '¿Cuánto cuesta este bolso?',
  ball: '¿Cuánto cuesta este balón de fútbol?',
};
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
let audioMaster;
let audioArmed = false;
let audioCue = 0;
let revealRequest = 0;
let resolveRevealDelay;
let pendingReveal;
let finalAnimationFrame;
const activeAudio = new Set();
const activeSynths = new Set();
const AUDIO_FILES = {
  start: ['01_entrada_concurso_80s.wav', .7],
  next: ['02_siguiente_pregunta.wav', .85],
  drum: ['03_revelar_precio.wav', .85],
  exact: ['04_acierto_campanillas.wav', .85],
  win: ['driken5482-crowd-clapping-3-236779.mp3', 2],
  finish: ['06_puntuacion_espectacular.wav', .7],
};
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
  syncAudioVolume();
  if (prefs.reducedMotion) settleFinalCounter();
  write(KEYS.prefs, prefs);
}
function armAudio() {
  // Called from the teacher's click, submit or volume input, never on restoration.
  audioArmed = true;
  try {
    audioContext ??= new (window.AudioContext || window.webkitAudioContext)();
    if (!audioMaster) {
      audioMaster = audioContext.createGain();
      audioMaster.connect(audioContext.destination);
    }
    syncAudioVolume();
    Promise.resolve(audioContext.resume()).catch(() => {});
  } catch { /* HTML audio can still work if Web Audio is unavailable. */ }
}
function syncAudioVolume() {
  for (const record of activeAudio) {
    record.audio.muted = !prefs.sound;
    record.audio.volume = Math.min(1, prefs.volume / 100 * record.level);
  }
  if (audioMaster) audioMaster.gain.value = prefs.sound ? prefs.volume / 100 : 0;
  if (!prefs.sound || !prefs.volume) resolveRevealDelay?.();
}
function stopAllSounds() {
  audioCue += 1;
  for (const record of activeAudio) {
    record.audio.onended = null;
    record.audio.onerror = null;
    try { record.audio.pause(); record.audio.currentTime = 0; } catch { /* Already stopped. */ }
  }
  activeAudio.clear();
  for (const oscillator of activeSynths) { try { oscillator.stop(); } catch { /* Already ended. */ } }
  activeSynths.clear();
}
function fallbackSound(kind = 'win') {
  if (!audioArmed || !prefs.sound || !prefs.volume || !audioContext || !audioMaster) return;
  try {
    const notes = kind === 'drum' ? [120, 130, 145, 160, 180, 210] : kind === 'lose' ? [180, 130] : kind === 'start' ? [392, 494, 587] : kind === 'exact' ? [523, 659, 784, 1047] : [440, 587, 740];
    notes.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const start = audioContext.currentTime + index * (kind === 'drum' ? .09 : .13);
      oscillator.type = kind === 'lose' || kind === 'drum' ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(.13, start + .015);
      gain.gain.exponentialRampToValueAtTime(.001, start + .25);
      oscillator.connect(gain); gain.connect(audioMaster);
      activeSynths.add(oscillator);
      oscillator.onended = () => activeSynths.delete(oscillator);
      oscillator.start(start); oscillator.stop(start + .27);
    });
  } catch { /* The game remains playable when audio is unavailable. */ }
}
function playClip(filename, level, fallbackKind, cue) {
  if (cue !== audioCue || !audioArmed || !prefs.sound || !prefs.volume) return;
  let record;
  const recover = () => {
    if (cue !== audioCue || !prefs.sound || !prefs.volume) return;
    // Only the entry/final crowd clip has a media fallback; that fallback ends here.
    if (filename === 'freesound_community-claps-44774.mp3') playClip('driken5482-crowd-clapping-3-236779.mp3', 2, null, cue);
    else if (fallbackKind) fallbackSound(fallbackKind);
  };
  const failed = () => {
    if (!record || !activeAudio.has(record)) return;
    activeAudio.delete(record);
    record.audio.onended = null;
    record.audio.onerror = null;
    try { record.audio.pause(); } catch { /* No media was started. */ }
    recover();
  };
  try {
    const audio = new window.Audio(`assets/${filename}`);
    record = { audio, level };
    audio.preload = 'auto';
    audio.muted = !prefs.sound;
    audio.volume = Math.min(1, prefs.volume / 100 * level);
    activeAudio.add(record);
    audio.onended = () => { activeAudio.delete(record); audio.onended = null; audio.onerror = null; };
    audio.onerror = failed;
    Promise.resolve(audio.play()).then(() => {
      if (!activeAudio.has(record)) { try { audio.pause(); } catch { /* Cancelled while loading. */ } }
    }).catch(failed);
  } catch {
    if (record) failed();
    else recover();
  }
}
function sound(kind = 'win') {
  stopAllSounds();
  const cue = audioCue;
  if (!audioArmed || !prefs.sound || !prefs.volume) return () => {};
  const clip = AUDIO_FILES[kind];
  if (clip) playClip(clip[0], clip[1], kind, cue);
  else fallbackSound(kind);
  if (kind === 'start' || kind === 'finish') playClip('freesound_community-claps-44774.mp3', .5, null, cue);
  return () => { if (audioCue === cue) stopAllSounds(); };
}
function waitForReveal(milliseconds) {
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      if (resolveRevealDelay === finish) resolveRevealDelay = null;
      resolve();
    };
    const timer = setTimeout(finish, milliseconds);
    resolveRevealDelay = finish;
  });
}
function animateFinalScore() {
  if (prefs.reducedMotion || typeof window.requestAnimationFrame !== 'function') return;
  const element = $('.final-score');
  const total = getStandings(game)[0].score;
  const finalText = element.textContent;
  const label = $('small', element).textContent;
  element.innerHTML = `<span class="final-counter" aria-hidden="true">0</span><span class="sr-only">${esc(finalText)}</span> <small aria-hidden="true">${esc(label)}</small>`;
  const counter = $('.final-counter', element);
  const started = window.performance.now();
  const tick = (now) => {
    if (!element.isConnected) return;
    const progress = Math.max(0, Math.min(1, (now - started) / 2600));
    counter.textContent = score(total * (1 - (1 - progress) ** 3));
    if (progress < 1) finalAnimationFrame = window.requestAnimationFrame(tick);
    else { counter.textContent = score(total); finalAnimationFrame = null; }
  };
  finalAnimationFrame = window.requestAnimationFrame(tick);
}
function settleFinalCounter() {
  if (finalAnimationFrame && window.cancelAnimationFrame) window.cancelAnimationFrame(finalAnimationFrame);
  finalAnimationFrame = null;
  const counter = $('.final-counter');
  if (counter && game?.status === 'finished') counter.textContent = score(getStandings(game)[0].score);
}
function cancelPlayback() {
  revealRequest += 1;
  resolveRevealDelay?.();
  if (pendingReveal?.button.isConnected) {
    pendingReveal.button.disabled = false;
    pendingReveal.button.innerHTML = pendingReveal.markup;
    pendingReveal.button.removeAttribute('aria-busy');
  }
  pendingReveal = null;
  stopAllSounds();
  settleFinalCounter();
}
function celebrate() {
  if (prefs.reducedMotion) return;
  const container = $('#confetti');
  container.innerHTML = Array.from({ length: 46 }, (_, index) => `<i class="piece" style="left:${Math.random() * 100}%;animation-delay:${Math.random() * .35}s;animation-duration:${2 + Math.random()}s;transform:rotate(${index * 23}deg)"></i>`).join('');
  setTimeout(() => { container.innerHTML = ''; }, 4000);
}

function renderHome() {
  app.innerHTML = `<div class="home-layout"><section class="hero-left"><div class="eyebrow"><span class="live-dot"></span>EL CONCURSO EMPIEZA EN TU CLASE</div><h1 class="hero-title">Acércate.<br><em>Sin pasarte.</em></h1><p class="hero-copy">The classic game, with today’s prices.<br>Bring your teams together and find out who has the best eye for <strong>the right price.</strong></p><figure class="archive-tv"><img class="archive-photo" src="assets/cover.png" alt="El concurso El Precio Justo, en una imagen de archivo de RTVE"><figcaption class="archive-caption"><span>UN CLÁSICO DE LA TELE</span><a href="https://www.rtve.es/television/el-precio-justo/" target="_blank" rel="noopener noreferrer">Archivo RTVE ↗</a></figcaption></figure><div class="feature-strip"><span class="feature">${icon('users')}Team play</span><span class="feature">${icon('list')}6 rounds + extras</span><span class="feature">${icon('trophy')}Closest without going over</span></div></section><section class="setup-panel" aria-labelledby="setup-title"><div class="setup-heading"><div><h2 id="setup-title">¿Quién juega hoy?</h2><p>Name your teams. We’ll keep track of the scores.</p></div>${icon('users')}</div><form id="setup-form"><div class="team-list">${names.map((name, index) => `<div class="team-row"><span class="team-dot" aria-hidden="true"></span><label class="sr-only" for="team-${index}">Team ${index + 1} name</label><input class="team-input" id="team-${index}" data-team-index="${index}" value="${esc(name)}" placeholder="Team ${index + 1} name" maxlength="40" autocomplete="off"><button type="button" class="icon-button" data-action="remove-team" data-index="${index}" aria-label="Quitar equipo ${index + 1}" ${names.length <= 2 ? 'disabled' : ''}>${icon('close')}</button></div>`).join('')}</div><div id="setup-error" class="form-error" role="alert" hidden></div><div class="setup-actions"><button type="button" class="button ghost" data-action="add-team" ${names.length >= 12 ? 'disabled' : ''}>${icon('plus')}Añadir otro equipo</button><button type="submit" class="button primary">¡Que empiece el juego! ${icon('arrow')}</button></div></form><div class="setup-foot"><button class="catalog-link" data-action="catalog">${icon('edit')}Productos y precios</button><span>Prices checked · 6 Nov 2026</span></div></section></div>`;
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
  if (!result.winnerIds.length) return 'No winner this round: all guesses were over the price or left blank.';
  const winners = result.winnerIds.map((id) => game.teams.find((team) => team.id === id).name).join(' y ');
  return result.exactIds.length ? `Exact price! ${winners}. One bonus point for each exact guess.` : `${winners} ${result.winnerIds.length === 1 ? 'wins' : 'share'} the point for this round.`;
}
function teamStatus(teamId, result) {
  if (result.exactIds.includes(teamId)) return '<span>¡Exacto!</span><br><span class="bid-points">+' + score(result.points[teamId]) + '</span>';
  if (result.winnerIds.includes(teamId)) return '<span>Más cerca</span><br><span class="bid-points">+' + score(result.points[teamId]) + '</span>';
  if (result.overIds.includes(teamId)) return 'Se ha pasado';
  return getRound().bids[teamId] === null ? 'Sin propuesta' : 'Sin puntos';
}
function renderGame() {
  const orderedTeams = turnOrder(game.teams, game.currentRound);
  const round = getRound();
  const product = getProduct();
  const result = round.revealed ? scoreRound(product.priceCents, round.bids) : null;
  const revealedCount = game.rounds.filter((item) => item.revealed).length;
  const mayFinish = revealedCount >= 3;
  const mayAddExtra = revealedCount >= 5;
  const used = new Set(game.rounds.map((item) => item.productId));
  const extrasLeft = game.catalog.filter((item) => !item.required && !used.has(item.id)).length;
  const nextExists = game.currentRound + 1 < game.rounds.length;
  const lastRevealed = game.rounds.reduce((last, item, index) => item.revealed ? index : last, -1);
  app.innerHTML = `<section class="game-top"><div><div class="round-eyebrow"><span class="live-dot"></span>${game.currentRound < 6 ? 'EL CONCURSO' : 'RONDA EXTRA'} · RONDA ${game.currentRound + 1} DE ${game.rounds.length}</div><h1 class="round-title">${round.revealed ? '¡Este es el precio justo!' : esc(priceQuestions[product.id] ?? '¿Cuánto cuesta este producto?')}</h1></div><div class="round-progress" aria-label="Progreso del juego">${game.rounds.map((item, index) => `<span class="round-dot ${item.revealed ? 'is-done' : ''} ${index === game.currentRound ? 'is-current' : ''}" title="Ronda ${index + 1}${item.revealed ? ', revelada' : ''}"></span>`).join('')}</div></section><div class="game-layout"><article class="product-panel"><div class="product-visual ${product.id === 'house' ? 'is-house' : ''}"><span class="product-category">${esc(product.category)}</span><img class="product-image" src="${imagePath(productImage(product))}" alt="${esc(product.id === 'house' ? 'Fotografía del chalet con piscina en Valdemorillo' : product.imageAlt)}"></div>${product.id === 'house' ? `<figure class="house-map"><img src="assets/house-map.png" alt="Mapa de Valdemorillo y Madrid, con Valdemorillo señalado"><figcaption><span>Valdemorillo y Madrid</span><button type="button" data-action="show-house-map">Ver mapa grande ↗</button></figcaption></figure>` : ''}<div class="product-info"><div class="product-brand">${esc(product.brand)}</div><h2 class="product-name">${esc(product.name)}</h2><p class="product-description">${esc(product.description)}</p><p class="image-credit">${esc(product.id === 'house' ? 'Fotografía del chalet' : product.imageNote || 'Imagen del producto de referencia')}${round.revealed ? ` · <a href="${safeLink(product.source)}" target="_blank" rel="noopener noreferrer">${esc(product.sourceLabel)} ↗</a>` : ''}</p></div></article><section class="bids-panel" aria-labelledby="bids-heading"><div class="panel-heading"><h2 id="bids-heading">Team guesses</h2><span>Guesses in euros (€)</span></div><p class="turn-order">First up: <strong>${esc(orderedTeams[0].name)}</strong></p><div class="bids-list">${orderedTeams.map((team) => `<div class="bid-row ${result?.winnerIds.includes(team.id) ? 'winner' : ''} ${result?.overIds.includes(team.id) ? 'over' : ''}" data-bid-row="${team.id}"><label class="bid-team" for="bid-${team.id}"><span class="team-dot" aria-hidden="true"></span>${esc(team.name)}</label><div class="bid-input-wrap"><input class="bid-input" id="bid-${team.id}" data-bid="${team.id}" inputmode="decimal" autocomplete="off" aria-label="Guess from ${esc(team.name)} in euros" placeholder="0,00" value="${inputMoney(round.bids[team.id])}"><span aria-hidden="true">€</span></div><div class="bid-status">${result ? teamStatus(team.id, result) : 'Por decidir'}</div></div>`).join('')}</div><p id="bid-error" class="form-error" role="alert" hidden></p>${round.revealed ? `<div class="price-reveal"><span class="price-label">EL PRECIO JUSTO</span><strong class="price-amount">${eur(product.priceCents)}</strong><span class="price-hkd">≈ ${hkd(product.priceCents)}</span></div><p class="reveal-message" id="reveal-message">${esc(resultMessage(result))}</p>` : `<div class="reveal-placeholder">${icon('lock')}The price stays hidden until you reveal it.</div>`}<div class="round-actions">${round.revealed ? `<span class="feature">${icon('edit')}You can edit these guesses</span><button class="button primary" data-action="${nextExists ? 'next' : 'finish'}">${nextExists ? 'Siguiente ronda' : 'Ver resultado final'} ${icon('arrow')}</button>` : `<button class="button primary" data-action="reveal">${icon('eye')}Revelar el precio</button>`}</div></section></div>${mayFinish ? `<div class="extra-actions"><button class="button secondary small" data-action="extra" ${!mayAddExtra ? 'hidden' : ''} ${!extrasLeft ? 'disabled' : ''}>${icon('shuffle')}Añadir ronda extra${extrasLeft ? ` (${extrasLeft})` : ''}</button><button class="button ghost small" data-action="confirm-finish">Terminar la partida ${icon('arrow')}</button></div>` : ''}<section class="scoreboard" aria-labelledby="score-heading"><div class="scoreboard-heading"><h2 id="score-heading">Así va el concurso</h2><span>1 point per round · +1 for an exact price</span></div><div class="score-grid" id="score-grid">${scoreboard()}</div></section><nav class="history-bar" aria-label="Revisar rondas"><span class="feature">${icon('clock')}Rondas</span>${game.rounds.map((item, index) => item.revealed || index === Math.min(lastRevealed + 1, game.rounds.length - 1) ? `<button class="history-button" data-action="round" data-index="${index}" aria-current="${index === game.currentRound}">${index + 1}. ${esc(game.catalog.find((entry) => entry.id === item.productId).name)}</button>` : '').join('')}<button class="history-button" data-action="new">Nueva partida</button></nav>`;
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
  app.innerHTML = `<div class="final-layout"><section class="final-stage"><div class="final-kicker">${icon('trophy')}CONCURSO COMPLETADO</div><h1 class="final-title">${winners.length > 1 ? '¡Tenemos un empate!' : '¡El equipo ganador es…!'}</h1><div class="winner-name">${winners.map((team) => esc(team.name)).join(' <span>&amp;</span> ')}</div><div class="final-score">${score(standings[0].score)} <small>puntos${winners.length > 1 ? ' cada equipo' : ''}</small></div><div class="podium">${standings.slice(0, 3).map((team) => `<article class="score-card"><span class="score-rank">${team.rank}.</span><span class="score-name">${esc(team.name)}</span><span class="score-value">${score(team.score)}</span></article>`).join('')}</div><div class="final-actions"><button class="button primary" data-action="new">${icon('refresh')}Jugar otra vez</button><button class="button ghost" data-action="review">Revisar la partida</button></div></section><table class="summary-table"><caption class="sr-only">Clasificación final de la partida</caption><thead><tr><th>Puesto</th><th>Equipo</th><th>Rondas ganadas</th><th>Exactos</th><th>Puntos</th></tr></thead><tbody>${standings.map((team) => `<tr><td>${team.rank}</td><td>${esc(team.name)}</td><td>${team.wins}</td><td>${team.exacts}</td><td>${score(team.score)}</td></tr>`).join('')}</tbody></table><p class="catalog-note">${game.rounds.filter((round) => round.revealed).length} rounds played · Tied winners share the point for the round. Reference prices checked on 6 November 2026.</p></div>`;
}
function render() { if (!game) renderHome(); else if (game.status === 'finished') renderFinal(); else renderGame(); }

function openModal(title, body) {
  $('#modal-content').innerHTML = `<div class="modal-header"><h2 id="modal-title">${esc(title)}</h2><button class="close-modal" data-action="close-modal" aria-label="Cerrar ventana">${icon('close')}</button></div><div class="modal-body">${body}</div>`;
  if (!modal.open) modal.showModal();
}
function showCatalog() {
  const products = game ? game.catalog : catalog;
  openModal('Los productos del concurso', `<p>Six products in the main game and three extra surprises. ${game ? 'This game keeps the prices that were set when it started.' : 'You can adjust any price before you start.'}</p><form id="catalog-form"><div class="catalog-grid">${products.map((product) => `<article class="catalog-item"><img class="catalog-image" src="${imagePath(productImage(product))}" alt="${esc(product.id === 'house' ? 'Fotografía del chalet con piscina en Valdemorillo' : product.imageAlt)}" loading="lazy"><div class="catalog-meta"><p>${product.required ? 'RONDA INICIAL' : 'RONDA EXTRA'}</p><h3>${esc(product.name)}</h3><p>${esc(product.brand)}</p>${game ? `<div class="catalog-price">${eur(product.priceCents)}</div>` : `<div class="price-editor"><label for="price-${product.id}">Precio €</label><input id="price-${product.id}" data-price="${product.id}" inputmode="decimal" required value="${inputMoney(product.priceCents)}" aria-label="Price in euros for ${esc(product.name)}"></div>`}<a href="${safeLink(product.source)}" target="_blank" rel="noopener noreferrer">${esc(product.sourceLabel)} ↗</a>${product.note ? `<p>${esc(product.note)}</p>` : ''}</div></article>`).join('')}</div><div class="settings-row"><div><label for="fx-rate"><strong>Euros to Hong Kong dollars</strong></label><small>Shown only after the price is revealed. <a href="${FX.url}" target="_blank" rel="noopener noreferrer">ECB reference · ${FX.date}</a>.</small></div><input id="fx-rate" inputmode="decimal" value="${game ? game.fxRate : fxRate}" aria-label="Hong Kong dollars per euro" ${game ? 'readonly' : ''}></div><p class="catalog-note">Prices checked on 6 November 2026. These are reference prices for the game and may vary between shops. ${game ? '' : 'Changes are saved in this browser. Prices are fixed when the game starts.'}</p><p id="catalog-error" class="form-error" role="alert" hidden></p><div class="modal-actions">${game ? '' : '<button type="button" class="button ghost" data-action="reset-prices">Restaurar precios</button>'}<button type="${game ? 'button' : 'submit'}" ${game ? 'data-action="close-modal"' : ''} class="button primary">${game ? 'Cerrar' : 'Guardar precios'}</button></div></form>`);
}
function showHelp() {
  openModal('How to play', `<ol class="rules-list"><li><strong>Make at least two teams.</strong> Enter the team names before starting.</li><li><strong>Show the product and collect each team’s guess.</strong> Enter prices in euros. A blank field means that the team is not taking part in that round.</li><li><strong>Reveal the price.</strong> The closest guess <strong>without going over</strong> wins one point. Tied winners share that point. Each exact guess earns one additional bonus point.</li><li><strong>Take turns and play at your own pace.</strong> A different team goes first each round: the previous first team moves to the end. You can edit guesses in any revealed round; scores update automatically.</li><li><strong>You can finish after the third revealed round.</strong> From the fifth revealed round, you can add extra rounds. Extras come after the remaining products and do not repeat.</li><li><strong>The game saves automatically</strong> in this browser. Reopen the page to continue.</li></ol><p class="catalog-note">Use the controls at the top for sound, volume and animations. The approximate HK$ conversion appears only after the price is revealed. This page is designed to be controlled by the teacher.</p><div class="modal-actions"><button class="button primary" data-action="close-modal">Got it!</button></div>`);
}
function captureBids() {
  let valid = true;
  for (const input of $$('[data-bid]', app)) {
    try { getRound().bids[input.dataset.bid] = parseMoney(input.value); input.removeAttribute('aria-invalid'); }
    catch { input.setAttribute('aria-invalid', 'true'); valid = false; }
  }
  const error = $('#bid-error');
  if (!valid) { error.textContent = 'Check the highlighted guesses: use positive prices with up to two decimal places.'; error.hidden = false; $('[aria-invalid="true"]', app)?.focus(); }
  else error.hidden = true;
  if (valid) save();
  return valid;
}
function finishGame() {
  if (!captureBids()) return;
  if (game.rounds.filter((round) => round.revealed).length < 3) return;
  game.status = 'finished'; game.finishedAt = new Date().toISOString();
  modal.close(); save(); render(); sound('finish'); animateFinalScore(); celebrate(); announce('Partida terminada. Consulta la clasificación final.');
}

document.addEventListener('submit', (event) => {
  if (event.target.id === 'setup-form') {
    event.preventDefault();
    armAudio();
    const values = $$('[data-team-index]', app).map((input) => input.value.trim());
    const error = $('#setup-error');
    if (values.length < 2 || values.some((name) => !name) || new Set(values.map((name) => name.toLocaleLowerCase('es'))).size !== values.length) {
      error.textContent = 'Enter at least two teams with different names. Do not leave a team name blank.'; error.hidden = false; return;
    }
    names = values; game = createGame(names, catalog, fxRate); save(); render();
    const stopIntroSound = sound('start');
    showStartIntro({ reducedMotion: prefs.reducedMotion, onClose: stopIntroSound });
    announce('Empieza el concurso. Primera ronda.');
  }
  if (event.target.id === 'catalog-form') {
    event.preventDefault();
    if (game) return;
    try {
      const updates = $$('[data-price]', modal).map((input) => {
        const priceCents = parseMoney(input.value);
        if (priceCents === null || priceCents <= 0) throw new Error('Every product needs a price greater than zero.');
        return { id: input.dataset.price, priceCents };
      });
      const rate = Number($('#fx-rate').value.trim().replace(',', '.'));
      if (!Number.isFinite(rate) || rate <= 0) throw new Error('Enter an exchange rate greater than zero.');
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
    } catch { input.setAttribute('aria-invalid', 'true'); $('#bid-error').textContent = 'Use a positive price with up to two decimal places.'; $('#bid-error').hidden = false; }
  }
  if (input.id === 'volume') { prefs.volume = Number(input.value); armAudio(); syncAudioVolume(); write(KEYS.prefs, prefs); }
});
document.addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button || button.disabled) return;
  armAudio();
  try {
    if (button.id === 'sound-toggle') { prefs.sound = !prefs.sound; syncPrefs(); return; }
    if (button.id === 'motion-toggle') { prefs.reducedMotion = !prefs.reducedMotion; syncPrefs(); return; }
    if (button.id === 'fullscreen-toggle') {
      if (document.fullscreenElement) await document.exitFullscreen(); else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen(); else toast('Use your browser’s full-screen mode.'); return;
    }
    if (button.id === 'help-toggle') { showHelp(); return; }
    switch (button.dataset.action) {
      case 'close-modal': modal.close(); break;
      case 'catalog': showCatalog(); break;
      case 'show-house-map': openModal('Valdemorillo y Madrid', '<p>Situación de Valdemorillo respecto a Madrid.</p><img class="house-map-large" src="assets/house-map.png" alt="Mapa de Valdemorillo y Madrid, con Valdemorillo señalado"><div class="modal-actions"><button class="button primary" data-action="close-modal">Cerrar mapa</button></div>'); break;
      case 'add-team': if (names.length < 12) { names.push(`Equipo ${names.length + 1}`); renderHome(); $('[data-team-index="' + (names.length - 1) + '"]').focus(); } break;
      case 'remove-team': if (names.length > 2) { names.splice(Number(button.dataset.index), 1); renderHome(); } break;
      case 'reset-prices': catalog = structuredClone(CATALOG); fxRate = FX.rate; saveDraft(); showCatalog(); break;
      case 'reveal': {
        if (!captureBids()) break;
        const gameId = game.id;
        const roundIndex = game.currentRound;
        const request = ++revealRequest;
        pendingReveal = { button, markup: button.innerHTML };
        button.disabled = true;
        button.textContent = 'Revealing…';
        button.setAttribute('aria-busy', 'true');
        sound('drum');
        await waitForReveal(prefs.sound && prefs.volume ? 2600 : 0);
        if (!game || game.id !== gameId || game.status !== 'playing' || game.currentRound !== roundIndex || request !== revealRequest) break;
        pendingReveal = null;
        getRound().revealed = true;
        const result = scoreRound(getProduct().priceCents, getRound().bids);
        save(); renderGame(); sound(result.exactIds.length ? 'exact' : result.winnerIds.length ? 'win' : 'lose');
        if (result.exactIds.length) celebrate();
        announce(`${getProduct().name}: ${eur(getProduct().priceCents)}. ${resultMessage(result)}`); break;
      }
      case 'next': if (captureBids() && getRound().revealed && game.currentRound < game.rounds.length - 1) { game.currentRound += 1; save(); renderGame(); sound('next'); announce(`Ronda ${game.currentRound + 1}. ${getProduct().name}.`); } break;
      case 'round': {
        if (!captureBids()) break;
        const index = Number(button.dataset.index);
        const firstPending = game.rounds.findIndex((round) => !round.revealed);
        if (Number.isInteger(index) && index >= 0 && index < game.rounds.length && (game.rounds[index].revealed || index === firstPending)) { cancelPlayback(); game.currentRound = index; save(); renderGame(); } break;
      }
      case 'extra': if (captureBids() && game.rounds.filter((round) => round.revealed).length >= 5) { game = appendExtra(game); save(); renderGame(); toast('Extra round added at the end. The remaining products keep their turn.'); } break;
      case 'confirm-finish': if (captureBids()) openModal('¿Cerramos el concurso?', '<p>The final scores will include only the rounds you have revealed. Unplayed rounds do not earn points.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Seguir jugando</button><button class="button primary" data-action="finish">Ver clasificación</button></div>'); break;
      case 'finish': finishGame(); break;
      case 'review': cancelPlayback(); game.status = 'playing'; game.finishedAt = null; game.currentRound = Math.max(0, game.rounds.findLastIndex((round) => round.revealed)); save(); renderGame(); break;
      case 'new': openModal('Una nueva partida', '<p>The current game will be removed from this browser when you start a new one.</p><div class="modal-actions"><button class="button secondary" data-action="close-modal">Cancelar</button><button class="button primary" data-action="reset-game">Empezar de nuevo</button></div>'); break;
      case 'reset-game': cancelPlayback(); if (game) names = game.teams.map((team) => team.name); game = null; write(KEYS.game, null); modal.close(); renderHome(); $('#save-status').textContent = 'Hecho para jugar juntos'; break;
    }
  } catch (error) { toast(error.message || 'No se ha podido completar la acción.'); }
});
modal.addEventListener('click', (event) => { if (event.target === modal) { const box = modal.getBoundingClientRect(); if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) modal.close(); } });
document.querySelector('.brand').addEventListener('click', (event) => { if (game) { event.preventDefault(); toast('Your game is still saved. Use «Nueva partida» to start a new one.'); } });
window.addEventListener('beforeunload', () => { cancelPlayback(); if (game) save(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) cancelPlayback(); });
syncPrefs(); render();
if (game) { save(); toast(game.status === 'finished' ? 'Clasificación recuperada.' : 'Partida recuperada. Seguimos donde lo dejaste.'); }
if (invalidSavedGame) toast('El registro guardado no era compatible. Puedes empezar una nueva partida.');
