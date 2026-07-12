const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const Matchmaker = require('./src/Matchmaker');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
  transports: ['polling', 'websocket'],
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const matchmaker = new Matchmaker(io);

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id} conectou`);

  socket.on('create_room', () => {
    matchmaker.createRoom(socket);
  });

  socket.on('join_room', (code) => {
    matchmaker.joinRoom(socket, code);
  });

  socket.on('player_input', (input) => {
    matchmaker.handleInput(socket, input);
  });

  socket.on('player_ready', () => {
    matchmaker.handleReady(socket);
  });

  socket.on('play_again', () => {
    matchmaker.handlePlayAgain(socket);
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id} desconectou`);
    matchmaker.handleDisconnect(socket);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Duel Arena rodando em http://localhost:${PORT}`);
});
