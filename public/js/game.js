const socket = io();

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

const keys = { up: false, down: false, left: false, right: false };
let mouseX = 400, mouseY = 300, mouseDown = false;
let myColor = null;
let lastState = null;
let inGame = false;

function $(id) { return document.getElementById(id); }
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.remove('hidden'); el.classList.add('hidden'); }

$('btn-leave').addEventListener('click', () => {
  socket.disconnect();
  window.location.href = '/';
});

$('btn-ready').addEventListener('click', () => {
  socket.emit('player_ready');
  hide($('btn-ready'));
  $('status').textContent = 'Pronto. Aguardando oponente...';
});

$('btn-rematch').addEventListener('click', () => {
  socket.emit('play_again');
  hide($('game-over'));
  $('status').textContent = 'Aguardando oponente ficar pronto...';
});

window.addEventListener('keydown', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') { keys.up = true; e.preventDefault(); }
  if (k === 's' || k === 'arrowdown') { keys.down = true; e.preventDefault(); }
  if (k === 'a' || k === 'arrowleft') { keys.left = true; e.preventDefault(); }
  if (k === 'd' || k === 'arrowright') { keys.right = true; e.preventDefault(); }
});

window.addEventListener('keyup', (e) => {
  const k = e.key.toLowerCase();
  if (k === 'w' || k === 'arrowup') keys.up = false;
  if (k === 's' || k === 'arrowdown') keys.down = false;
  if (k === 'a' || k === 'arrowleft') keys.left = false;
  if (k === 'd' || k === 'arrowright') keys.right = false;
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top) * scaleY;
});

canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouseDown = true; });
canvas.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

function sendInput() {
  const angle = Math.atan2(mouseY - (lastState?.me?.y || 300), mouseX - (lastState?.me?.x || 400));
  socket.emit('player_input', {
    move: { up: keys.up, down: keys.down, left: keys.left, right: keys.right },
    angle,
    shoot: mouseDown,
  });
}

setInterval(sendInput, 1000 / 30);

socket.on('player_assign', (data) => {
  myColor = data.color;
  $('status').textContent = 'Voce entrou na sala. Clique em "Estou Pronto" quando o oponente chegar.';
  show($('btn-ready'));
});

socket.on('game_start', (data) => {
  inGame = true;
  hide($('btn-ready'));
  $('status').textContent = 'Duelo!';
  if (data?.arena) { canvas.width = data.arena.w; canvas.height = data.arena.h; }
});

socket.on('state', (state) => {
  state.players.forEach((p) => { if (p.color === myColor) { state.me = p; } });
  lastState = state;
  render(state);
});

socket.on('hit', () => {
  const flash = document.createElement('div');
  flash.style.cssText = 'position:fixed;inset:0;background:rgba(239,68,68,0.25);pointer-events:none;z-index:5;animation:fade 0.2s linear forwards;';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 200);
});

socket.on('game_over', (winner) => {
  inGame = false;
  const txt = winner === myColor ? 'VITORIA!' : (winner ? 'DERROTA' : 'EMPATE');
  $('result-text').textContent = txt;
  $('result-text').style.color = winner === myColor ? '#22c55e' : (winner ? '#ef4444' : '#f59e0b');
  show($('game-over'));
});

socket.on('opponent_left', () => {
  if (!inGame) $('status').textContent = 'Oponente saiu. Voltando ao menu...';
  setTimeout(() => window.location.href = '/', 1800);
});

const styleTag = document.createElement('style');
styleTag.textContent = '@keyframes fade { from { opacity: 1; } to { opacity: 0; } }';
document.head.appendChild(styleTag);

function render(state) {
  ctx.fillStyle = '#0f1219';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#1f2533';
  ctx.lineWidth = 1;
  for (let x = 0; x <= canvas.width; x += 50) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 50) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
  }

  ctx.strokeStyle = '#2a3144';
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

  for (const proj of state.projectiles || []) {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fef3c7';
    ctx.beginPath();
    ctx.arc(proj.x, proj.y, proj.radius / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const p of state.players || []) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = p.color;
    ctx.shadowBlur = 15;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;

    const barW = 50;
    const barX = p.x - barW / 2;
    const barY = p.y - p.radius - 12;
    ctx.fillStyle = '#1f2533';
    ctx.fillRect(barX, barY, barW, 5);
    const hpPct = Math.max(0, p.hp) / 100;
    ctx.fillStyle = hpPct > 0.5 ? '#22c55e' : hpPct > 0.25 ? '#f59e0b' : '#ef4444';
    ctx.fillRect(barX, barY, barW * hpPct, 5);
  }

  if (lastState && lastState.me) {
    const me = lastState.me;
    const a = Math.atan2(mouseY - me.y, mouseX - me.x);
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(me.x, me.y);
    ctx.lineTo(me.x + Math.cos(a) * 70, me.y + Math.sin(a) * 70);
    ctx.stroke();
  }
}
