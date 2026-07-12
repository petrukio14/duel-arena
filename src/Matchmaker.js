/**
 * Gera codigo de sala de 4 letras maiusculas.
 * Mantem mapa de salas ativas.
 * Lida com create/join/disconnect.
 */
const GameRoom = require('./GameRoom');

class Matchmaker {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.socketToRoom = new Map();
  }

  generateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ24679';
    let code;
    do {
      code = '';
      for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(socket) {
    if (this.socketToRoom.has(socket.id)) {
      socket.emit('error_msg', 'Voce ja esta numa sala');
      return;
    }
    const code = this.generateCode();
    const room = new GameRoom(this.io, code);
    room.addPlayer(socket);
    this.rooms.set(code, room);
    this.socketToRoom.set(socket.id, code);
    socket.emit('room_created', code);
    console.log(`[ROOM] Sala ${code} criada por ${socket.id}`);
  }

  joinRoom(socket, code) {
    if (this.socketToRoom.has(socket.id)) {
      socket.emit('error_msg', 'Voce ja esta numa sala');
      return;
    }
    const upperCode = (code || '').toUpperCase().trim();
    const room = this.rooms.get(upperCode);
    if (!room) {
      socket.emit('error_msg', `Sala ${upperCode} nao encontrada`);
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('error_msg', 'Sala cheia');
      return;
    }
    room.addPlayer(socket);
    this.socketToRoom.set(socket.id, upperCode);
    socket.emit('room_joined', upperCode);
    if (room.players.length === 2) {
      room.bothConnected();
    }
    console.log(`[ROOM] ${socket.id} entrou na sala ${upperCode}`);
  }

  handleInput(socket, input) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;
    const room = this.rooms.get(code);
    if (room) room.handleInput(socket.id, input);
  }

  handleReady(socket) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;
    const room = this.rooms.get(code);
    if (room) room.handleReady(socket.id);
  }

  handlePlayAgain(socket) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;
    const room = this.rooms.get(code);
    if (room) room.handlePlayAgain(socket.id);
  }

  handleDisconnect(socket) {
    const code = this.socketToRoom.get(socket.id);
    if (!code) return;
    const room = this.rooms.get(code);
    if (room) {
      room.removePlayer(socket);
      socket.to(code).emit('opponent_left');
      if (room.players.length === 0) {
        this.rooms.delete(code);
        console.log(`[ROOM] Sala ${code} vazia, removida`);
      }
    }
    this.socketToRoom.delete(socket.id);
  }
}

module.exports = Matchmaker;
