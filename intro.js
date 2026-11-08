/** Present the opening only after the teacher starts a new game. */
export function showStartIntro({ reducedMotion = false } = {}) {
  const main = document.querySelector('main');
  const overlay = document.createElement('div');
  overlay.className = 'start-show';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'start-show-title');
  overlay.innerHTML = `<div class="start-show__sparkles" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span><span>✧</span><span>✦</span><span>✧</span><span>✦</span><span>✧</span></div>
    <div class="start-show__stage">
      <p class="start-show__eyebrow">✦ EL MOMENTO QUE ESPERABAS ✦</p>
      <div class="start-show__frame"><img src="assets/${reducedMotion ? 'a-jugar-still.png' : 'a-jugar.gif'}" alt="Joaquín Prat anuncia el comienzo de El Precio Justo"></div>
      <h1 id="start-show-title">¡A JUGAAAR!</h1>
      <p class="start-show__subtitle">¡Que comience el concurso!</p>
      <button class="start-show__skip" type="button">Ir al juego <span aria-hidden="true">→</span></button>
    </div>`;
  document.body.append(overlay);
  const wasInert = main.inert;
  main.inert = true;
  let timer;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(timer);
    document.removeEventListener('keydown', onKey);
    main.inert = wasInert;
    overlay.remove();
    document.querySelector('[data-bid]')?.focus();
  };
  const onKey = (event) => { if (event.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  overlay.querySelector('button').addEventListener('click', close);
  overlay.querySelector('button').focus();
  timer = setTimeout(close, 4800);
}
