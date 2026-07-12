const socket = io({ transports: ['websocket', 'polling'] });

const $ = (id) => document.getElementById(id);
const screenMenu = $('screen-menu');
const screenGame = $('screen-game');
const screenResult = $('screen-result');
const canvas = $('game-canvas');
const ctx = canvas.getContext('2d');

canvas.width = 800;
canvas.height = 600;

let cols, rows, cell, arenaW, arenaH;
let state = null;
let myColor = null;
let myIdx = null;
let gameOver = false;
let lastInput = '';

function showScreen(id) {
  [screenMenu, screenGame, screenResult].forEach((s) => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

$('btn-create').onclick = () => { socket.emit('create_room'); showScreen('screen-game'); };
$('btn-join').onclick = () => { socket.emit('join_room', $('input-code').value); showScreen('screen-game'); };
$('btn-ready').onclick = () => { socket.emit('player_ready'); };
$('btn-play-again').onclick = () => { $('game-info').textContent = 'Aguardando revanche...'; showScreen('screen-game'); socket.emit('play_again'); };
$('btn-back-menu').onclick = () => showScreen('screen-menu');
document.querySelectorAll('.btn-leave, #btn-leave').forEach((b) => b.onclick = () => location.reload());

socket.on('room_created', (code) => { $('room-code').textContent = code; $('game-info').textContent = 'Aguardando oponente...'; });
socket.on('room_joined', (code) => { $('room-code').textContent = code; $('game-info').textContent = 'Aguardando oponente...'; });
socket.on('both_connected', () => {
  $('game-info').textContent = 'Ambos conectados!';
  $('btn-ready').classList.remove('hidden');
});
socket.on('player_assign', (data) => { myColor = data.color; myIdx = data.idx; });

socket.on('game_start', (data) => {
  cols = data.cols; rows = data.rows; cell = data.cell;
  arenaW = data.w; arenaH = data.h;
  canvas.width = arenaW; canvas.height = arenaH;
  state = null; gameOver = false;
  $('game-info').textContent = 'Jogo em andamento!';
});

socket.on('state', (s) => { state = s; });

socket.on('you_died', (reason) => { gameOver = true; });

socket.on('game_over', (winner) => {
  if (winner) {
    $('result-text').textContent = winner === myColor ? 'VOCE VENCEU!' : 'Voce perdeu!';
    $('result-text').style.color = winner === myColor ? '#22c55e' : '#ef4444';
  } else {
    $('result-text').textContent = 'Empate!';
    $('result-text').style.color = '#facc15';
  }
  showScreen('screen-result');
});

socket.on('opponent_left', () => {
  $('game-info').textContent = 'Oponente saiu.';
  setTimeout(() => showScreen('screen-menu'), 2000);
});

socket.on('error_msg', (msg) => { alert(msg); showScreen('screen-menu'); });

function sendDir(dir) {
  if (dir !== lastInput) {
    lastInput = dir;
    socket.emit('player_input', { direction: dir });
  }
}

document.addEventListener('keydown', (e) => {
  const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
  const dir = map[e.key];
  if (dir) { e.preventDefault(); sendDir(dir); }
});

(function setupTouch() {
  const directions = document.querySelectorAll('.touch-dir');
  directions.forEach((btn) => {
    const dir = btn.dataset.dir;
    const handler = (e) => { e.preventDefault(); sendDir(dir); };
    btn.addEventListener('touchstart', handler, { passive: false });
    btn.addEventListener('mousedown', handler);
  });
})();

function draw() {
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (!state) { requestAnimationFrame(draw); return; }

  if (state.food) {
    ctx.fillStyle = '#facc15';
    ctx.shadowColor = '#facc15';
    ctx.shadowBlur = 8;
    ctx.fillRect(state.food.x * cell, state.food.y * cell, cell, cell);
    ctx.shadowBlur = 0;
  }

  for (const p of state.players) {
    ctx.fillStyle = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 6;
    for (let i = 0; i < p.segments.length; i++) {
      const seg = p.segments[i];
      const alpha = 1 - (i / p.segments.length) * 0.5;
      ctx.globalAlpha = i === 0 ? 1 : alpha;
      const pad = 1;
      ctx.fillRect(seg.x * cell + pad, seg.y * cell + pad, cell - pad * 2, cell - pad * 2);
    }
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  requestAnimationFrame(draw);
}

draw();

console.log('Snake Arena loaded');
