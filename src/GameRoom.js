/**
 * GameRoom: logica autoritativa de uma sala de duel 1v1.
 * - Arena 800x600
 * - Atualiza 60 vezes/seg
 * - Dispara estado pros 2 clientes via socket.io
 */
const TICK_RATE = 60;
const ARENA_W = 800;
const ARENA_H = 600;
const PLAYER_RADIUS = 18;
const PLAYER_SPEED = 3.5;
const PROJECTILE_SPEED = 7;
const PROJECTILE_RADIUS = 6;
const PROJECTILE_DAMAGE = 10;
const SHOOT_COOLDOWN = 350;
const MAX_HP = 100;

class GameRoom {
  constructor(io, code) {
    this.io = io;
    this.code = code;
    this.players = [];
    this.projectiles = [];
    this.lastUpdate = 0;
    this.tickInterval = null;
    this.running = false;
    this.winners = {};
  }

  addPlayer(socket) {
    const color = this.players.length === 0 ? '#3b82f6' : '#ef4444';
    const spawnX = this.players.length === 0 ? 150 : ARENA_W - 150;
    const player = {
      id: socket.id,
      socket,
      color,
      x: spawnX,
      y: ARENA_H / 2,
      hp: MAX_HP,
      radius: PLAYER_RADIUS,
      wantsShoot: false,
      shootAngle: 0,
      lastShotAt: 0,
      move: { up: false, down: false, left: false, right: false },
      ready: false,
    };
    player.socket.join(this.code);
    this.players.push(player);
    socket.emit('player_assign', { color, index: this.players.length - 1, code: this.code });
  }

  removePlayer(socket) {
    this.players = this.players.filter((p) => p.id !== socket.id);
  }

  handleInput(id, input) {
    const p = this.players.find((p) => p.id === id);
    if (!p) return;
    p.move = input.move;
    p.shootAngle = input.angle;
    p.wantsShoot = input.shoot;
  }

  handleShoot(id, angle) {
    const p = this.players.find((p) => p.id === id);
    if (!p) return;
    const now = Date.now();
    if (now - p.lastShotAt < SHOOT_COOLDOWN) return;
    p.lastShotAt = now;
    this.projectiles.push({
      id: `${id}_${now}_${Math.random().toString(36).slice(2, 7)}`,
      ownerId: id,
      x: p.x,
      y: p.y,
      vx: Math.cos(angle) * PROJECTILE_SPEED,
      vy: Math.sin(angle) * PROJECTILE_SPEED,
      radius: PROJECTILE_RADIUS,
      life: 120,
    });
  }

  handleReady(id) {
    const p = this.players.find((p) => p.id === id);
    if (!p) return;
    p.ready = true;
    const bothReady = this.players.length === 2 && this.players.every((p) => p.ready);
    if (bothReady) this.start();
  }

  handlePlayAgain(id) {
    const p = this.players.find((p) => p.id === id);
    if (!p) return;
    p.ready = false;
    p.hp = MAX_HP;
    p.x = p.color === '#3b82f6' ? 150 : ARENA_W - 150;
    p.y = ARENA_H / 2;
    p.lastShotAt = 0;
    p.wantsShoot = false;
    const bothReady = this.players.length === 2 && this.players.every((p) => p.ready);
    if (bothReady) this.start();
  }

  start() {
    this.projectiles = [];
    this.players.forEach((p, i) => {
      p.hp = MAX_HP;
      p.x = i === 0 ? 150 : ARENA_W - 150;
      p.y = ARENA_H / 2;
    });
    this.io.to(this.code).emit('game_start', { arena: { w: ARENA_W, h: ARENA_H } });
    if (this.running) return;
    this.running = true;
    this.lastUpdate = Date.now();
    this.tickInterval = setInterval(() => this.tick(), 1000 / TICK_RATE);
    console.log(`[ROOM ${this.code}] Jogo iniciado`);
  }

  stop(winner = null) {
    this.running = false;
    if (this.tickInterval) clearInterval(this.tickInterval);
    this.tickInterval = null;
    this.io.to(this.code).emit('game_over', winner);
    this.players.forEach((p) => (p.ready = false));
    console.log(`[ROOM ${this.code}] Jogo acabou. Winner: ${winner || 'draw'}`);
  }

  tick() {
    for (const p of this.players) {
      let dx = 0, dy = 0;
      if (p.move.up) dy -= 1;
      if (p.move.down) dy += 1;
      if (p.move.left) dx -= 1;
      if (p.move.right) dx += 1;
      if (dx !== 0 || dy !== 0) {
        const len = Math.hypot(dx, dy);
        p.x += (dx / len) * PLAYER_SPEED;
        p.y += (dy / len) * PLAYER_SPEED;
      }
      p.x = Math.max(p.radius, Math.min(ARENA_W - p.radius, p.x));
      p.y = Math.max(p.radius, Math.min(ARENA_H - p.radius, p.y));

      if (p.wantsShoot) this.handleShoot(p.id, p.shootAngle);
    }

    for (const proj of this.projectiles) {
      proj.x += proj.vx;
      proj.y += proj.vy;
      proj.life -= 1;
      for (const p of this.players) {
        if (p.id === proj.ownerId) continue;
        const d = Math.hypot(proj.x - p.x, proj.y - p.y);
        if (d < proj.radius + p.radius) {
          p.hp = Math.max(0, p.hp - PROJECTILE_DAMAGE);
          proj.life = 0;
          this.io.to(p.id).emit('hit', {});
        }
      }
      if (proj.x < 0 || proj.x > ARENA_W || proj.y < 0 || proj.y > ARENA_H) proj.life = 0;
    }

    this.projectiles = this.projectiles.filter((p) => p.life > 0);

    const dead = this.players.find((p) => p.hp <= 0);
    if (dead) {
      const winner = this.players.find((p) => p.hp > 0);
      this.stop(winner ? winner.color : null);
      return;
    }

    const state = {
      players: this.players.map((p) => ({
        id: p.id,
        x: p.x,
        y: p.y,
        hp: p.hp,
        color: p.color,
        radius: p.radius,
      })),
      projectiles: this.projectiles.map((p) => ({ id: p.id, x: p.x, y: p.y, radius: p.radius })),
    };
    this.io.to(this.code).emit('state', state);
  }
}

module.exports = GameRoom;
