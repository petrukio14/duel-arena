const socket = io();

const $ = (id) => document.getElementById(id);

function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }
function setView(view) {
  ['menu', 'created', 'joining'].forEach((v) => hide($(v)));
  show($(view));
}
function showError(msg) {
  const e = $('error-msg');
  e.textContent = msg;
  show(e);
  setTimeout(() => hide(e), 4000);
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

$('btn-back-create').addEventListener('click', () => location.reload());

socket.on('room_created', (code) => {
  $('show-code').textContent = code;
  setView('created');
});

socket.on('room_joined', (code) => {
  $('joining-code').textContent = code;
  setView('joining');
});

socket.on('error_msg', (msg) => showError(msg));

socket.on('game_start', () => {
  window.location.href = '/game';
});
