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

let touchMove = { x: 0, y: 0, active: false };
let touchShoot = { x: 400, y: 300, active: false, justFired: false };
let touchShootBtn = false;
let isMobile = window.matchMedia('(max-width: 820px), (pointer: coarse)').matches;

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
  if (touchMove.active) return;
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  mouseX = (e.clientX - rect.left) * sx;
  mouseY = (e.clientY - rect.top) * sy;
});
canvas.addEventListener('mousedown', (e) => { if (e.button === 0) mouseDown = true; });
canvas.addEventListener('mouseup', (e) => { if (e.button === 0) mouseDown = false; });
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

const joystick = { cx: 100, cy: 480, r: 60, kx: 0, ky: 0 };
const shootBtn = { cx: 700, cy: 480, r: 50 };

canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  for (const t of e.changedTouches) {
    const tx = (t.clientX - rect.left) * sx;
    const ty = (t.clientY - rect.top) * sy;
    const scale = canvas.width / 800;
    const jx = 100 * scale, jy = 480 * scale, jr = 60 * scale;
    const sbx = 700 * scale, sby = 480 * scale, sbr = 50 * scale;
    if (Math.hypot(tx - jx, ty - jy) < jr * 1.4) {
      touchMove.active = true;
      touchMove.id = t.identifier;
    } else if (Math.hypot(tx - sbx, ty - sby) < sbr * 1.4) {
      touchShootBtn = true;
    } else {
      touchShoot.active = true;
      touchShoot.x = tx;
      touchShoot.y = ty;
      touchShoot.justFired = true;
    }
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  for (const t of e.changedTouches) {
    const tx = (t.clientX - rect.left) * sx;
    const ty = (t.clientY - rect.top) * sy;
    if (touchMove.active && t.identifier === touchMove.id) {
      const scale = canvas.width / 800;
      const jx = 100 * scale, jy = 480 * scale, jr = 60 * scale;
      const dx = tx - jx;
      const dy = ty - jy;
      const d = Math.hypot(dx, dy);
      if (d > 0) {
        const maxR = jr;
        touchMove.x = d > maxR ? (dx / d) * maxR : dx;
        touchMove.y = d > maxR ? (dy / d) * maxR : dy;
      } else {
        touchMove.x = 0; touchMove.y = 0;
      }
    }
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (touchMove.active && t.identifier === touchMove.id) {
      touchMove.active = false;
      touchMove.x = 0;
      touchMove.y = 0;
    }
    touchShootBtn = false;
    touchShoot.active = false;
  }
}, { passive: false });
canvas.addEventListener('touchcancel', (e) => {
  touchMove.active = false; touchMove.x = 0; touchMove.y = 0;
  touchShoot.active = false; touchShootBtn = false;
});

function sendInput() {
  const me = lastState?.players?.find((p) => p.color === myColor);
  if (!me || !inGame) return;

  let mx = mouseX, my = mouseY, shooting = mouseDown, tu = false, td = false, tl = false, tr = false;

  if (touchMove.active) {
    const deadzone = 10;
    tu = touchMove.y < -deadzone;
    td = touchMove.y > deadzone;
    tl = touchMove.x < -deadzone;
    tr = touchMove.x > deadzone;
  }
  if (touchShoot.active) {
    mx = touchShoot.x;
    my = touchShoot.y;
    if (touchShoot.justFired) {
      shooting = true;
      touchShoot.justFired = false;
    }
  }
  if (touchShootBtn) {
    shooting = true;
  }

  const move = {
    up: keys.up || tu,
    down: keys.down || td,
    left: keys.left || tl,
    right: keys.right || tr,
  };

  const angle = Math.atan2(my - me.y, mx - me.x);
  socket.emit('player_input', { move, angle, shoot: shooting });
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
      let ax = mouseX, ay = mouseY;
      if (touchShoot.active) { ax = touchShoot.x; ay = touchShoot.y; }
      const a = Math.atan2(ay - me.y, ax - me.x);
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(me.x, me.y);
      ctx.lineTo(me.x + Math.cos(a) * 70, me.y + Math.sin(a) * 70);
      ctx.stroke();
    }
  }

  if (isMobile && inGame) {
    const s = canvas.width / 800;
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(100 * s, 480 * s, 60 * s, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(100 * s, 480 * s, 40 * s, 0, Math.PI * 2);
    ctx.stroke();
    if (touchMove.active) {
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.arc(100 * s + touchMove.x, 480 * s + touchMove.y, 18 * s, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(239,68,68,0.2)';
    ctx.beginPath();
    ctx.arc(700 * s, 480 * s, 50 * s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(239,68,68,0.6)';
    ctx.font = `${Math.round(28 * s)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ATIRAR', 700 * s, 480 * s);
  }
}
