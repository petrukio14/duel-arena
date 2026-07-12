const socket = io();
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

function $(id) { return document.getElementById(id); }
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function showScreen(id) {
  document.querySelectorAll('#app > div').forEach((d) => d.classList.add('hidden'));
  show($(id));
}

let myColor = null;
let lastState = null;
let inGame = false;
let myRoomCode = null;

const keys = { up: false, down: false, left: false, right: false };
let mouseX = 400, mouseY = 300, mouseDown = false;

function showError(msg) {
  const e = $('error-msg');
  e.textContent = msg; show(e);
  setTimeout(() => hide(e), 5000);
}

$('btn-create').addEventListener('click', () => {
  hide($('error-msg'));
  socket.emit('create_room');
});

$('btn-join').addEventListener('click', () => {
  hide($('error-msg'));
  const code = $('room-code').value.toUpperCase().trim();
  if (!code) { showError('Digite o codigo da sala'); return; }
  socket.emit('join_room', code);
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

$('btn-back-menu').addEventListener('click', () => location.reload());
$('btn-back-waiting').addEventListener('click', () => showScreen('screen-menu'));
$('btn-leave').addEventListener('click', () => location.reload());

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
  const me = lastState?.players?.find((p) => p.color === myColor);
  if (!me || !inGame) return;
  const angle = Math.atan2(mouseY - me.y, mouseX - me.x);
  socket.emit('player_input', {
    move: { up: keys.up, down: keys.down, left: keys.left, right: keys.right },
    angle,
    shoot: mouseDown,
  });
}

setInterval(sendInput, 1000 / 30);

socket.on('room_created', (code) => {
  myRoomCode = code;
  $('show-code').textContent = code;
  $('waiting-title').textContent = 'Sala criada!';
  $('waiting-desc').textContent = 'Compartilhe o codigo com seu oponente:';
  $('waiting-status').textContent = 'Aguardando oponente...';
  showScreen('screen-menu');
  show($('panel-waiting'));
});

socket.on('room_joined', (code) => {
  myRoomCode = code;
  showScreen('screen-game');
  $('status').textContent = 'Conectado. Aguardando oponente ficar pronto...';
});

socket.on('error_msg', (msg) => showError(msg));

socket.on('both_connected', () => {
  showScreen('screen-game');
  $('status').textContent = 'Oponente conectado! Clique em "Estou Pronto" para começar.';
  show($('btn-ready'));
});

socket.on('player_assign', (data) => {
  myColor = data.color;
  if (!inGame) {
    $('status').textContent = 'Voce entrou na sala. Aguardando oponente...';
  }
});

socket.on('game_start', (data) => {
  inGame = true;
  hide($('btn-ready'));
  $('status').textContent = 'Duelo! 3...';
  setTimeout(() => { $('status').textContent = 'Duelo! 2...'; }, 500);
  setTimeout(() => { $('status').textContent = 'Duelo! 1...'; }, 1000);
  setTimeout(() => { $('status').textContent = 'LUTEM!'; }, 1500);
});

socket.on('state', (state) => {
  if (!inGame) return;
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
  if (inGame) $('status').textContent = 'Oponente saiu. Voltando ao menu...';
  else $('status').textContent = 'Oponente desconectou. Voltando ao menu...';
  inGame = false;
  hide($('game-over'));
  setTimeout(() => location.reload(), 2000);
});

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

  if (lastState?.players) {
    const me = lastState.players.find((p) => p.color === myColor);
    if (me) {
      const a = Math.atan2(mouseY - me.y, mouseX - me.x);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(me.x, me.y);
      ctx.lineTo(me.x + Math.cos(a) * 70, me.y + Math.sin(a) * 70);
      ctx.stroke();
    }
  }
}
