const TICK_RATE = 12;
const ARENA_W = 800;
const ARENA_H = 600;
const CELL = 20;
const COLS = ARENA_W / CELL;
const ROWS = ARENA_H / CELL;
const INITIAL_SIZE = 3;
const SCORE_PER_FOOD = 1;

class GameRoom {
  constructor(io, code) {
    this.io = io;
    this.code = code;
    this.players = [];
    this.food = null;
    this.tickInterval = null;
    this.running = false;
    this.seq = 0;
  }

  spawnFood() {
    const occupied = new Set();
    for (const p of this.players) {
      for (const s of p.segments) occupied.add(`${s.x},${s.y}`);
    }
    let pos;
    do {
      pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
    } while (occupied.has(`${pos.x},${pos.y}`));
    this.food = pos;
  }

  addPlayer(socket) {
    const idx = this.players.length;
    const color = idx === 0 ? '#3b82f6' : '#ef4444';
    const startX = idx === 0 ? 5 : COLS - 6;
    const startY = Math.floor(ROWS / 2);
    const dir = idx === 0 ? 'right' : 'left';
    const segments = [];
    for (let i = 0; i < INITIAL_SIZE; i++) {
      segments.push({ x: startX + (idx === 0 ? -i : i), y: startY });
    }
    const player = {
      id: socket.id, socket, color,
      segments, direction: dir, nextDirection: dir,
      alive: true, ready: false, score: 0,
    };
    socket.join(this.code);
    this.players.push(player);
    socket.emit('player_assign', { color, idx, code: this.code });
  }

  removePlayer(socket) {
    this.players = this.players.filter((p) => p.id !== socket.id);
  }

  bothConnected() {
    this.io.to(this.code).emit('both_connected');
  }

  handleReady(id) {
    const p = this.players.find((p) => p.id === id);
    if (!p) return;
    p.ready = true;
    if (this.players.length === 2 && this.players.every((p) => p.ready)) this.start();
  }

  handlePlayAgain(id) {
    const p = this.players.find((p) => p.id === id);
    if (!p) return;
    p.ready = true;
    p.score = 0;
    const idx = this.players.indexOf(p);
    const startX = idx === 0 ? 5 : COLS - 6;
    const startY = Math.floor(ROWS / 2);
    const dir = idx === 0 ? 'right' : 'left';
    p.segments = [];
    for (let i = 0; i < INITIAL_SIZE; i++) {
      p.segments.push({ x: startX + (idx === 0 ? -i : i), y: startY });
    }
    p.direction = dir;
    p.nextDirection = dir;
    p.alive = true;
    if (this.players.length === 2 && this.players.every((p) => p.ready)) this.start();
  }

  handleInput(id, input) {
    const p = this.players.find((p) => p.id === id);
    if (!p) return;
    const dir = input.direction;
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
    if (dir && opposite[dir] !== p.direction) {
      p.nextDirection = dir;
    }
  }

  start() {
    this.food = null;
    this.spawnFood();
    this.io.to(this.code).emit('game_start', { cols: COLS, rows: ROWS, cell: CELL, w: ARENA_W, h: ARENA_H });
    if (this.running) return;
    this.running = true;
    this.tickInterval = setInterval(() => this.tick(), 1000 / TICK_RATE);
  }

  stop(winner = null) {
    this.running = false;
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = null;
    this.io.to(this.code).emit('game_over', winner);
    this.players.forEach((p) => (p.ready = false));
  }

  tick() {
    for (const p of this.players) {
      if (!p.alive) continue;
      p.direction = p.nextDirection;

      const head = p.segments[0];
      let nx = head.x, ny = head.y;
      if (p.direction === 'up') ny--;
      if (p.direction === 'down') ny++;
      if (p.direction === 'left') nx--;
      if (p.direction === 'right') nx++;

      if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) {
        p.alive = false;
        this.io.to(p.id).emit('you_died', 'wall');
        continue;
      }

      for (const s of p.segments) {
        if (s.x === nx && s.y === ny) {
          p.alive = false;
          this.io.to(p.id).emit('you_died', 'self');
          break;
        }
      }
      if (!p.alive) continue;

      p.segments.unshift({ x: nx, y: ny });

      if (this.food && nx === this.food.x && ny === this.food.y) {
        p.score += SCORE_PER_FOOD;
        this.spawnFood();
      } else {
        p.segments.pop();
      }
    }

    for (const p of this.players) {
      if (!p.alive) continue;
      for (const op of this.players) {
        if (op === p || !op.alive) continue;
        for (const s of op.segments) {
          if (s.x === p.segments[0].x && s.y === p.segments[0].y) {
            p.alive = false;
            this.io.to(p.id).emit('you_died', 'other');
            break;
          }
        }
        if (!p.alive) break;
      }
    }

    const alive = this.players.filter((p) => p.alive);
    if (alive.length <= 1) {
      const winner = alive.length === 1 ? alive[0].color : null;
      this.stop(winner);
      return;
    }

    this.seq++;
    this.io.to(this.code).emit('state', {
      seq: this.seq,
      players: this.players.map((p) => ({
        color: p.color,
        segments: p.segments,
        direction: p.direction,
        alive: p.alive,
        score: p.score,
      })),
      food: this.food,
    });
  }
}

module.exports = GameRoom;
