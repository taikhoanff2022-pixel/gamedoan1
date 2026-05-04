const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const INPUT = {
  left: false,
  right: false,
  jumpHeld: false,
  jumpQueued: false,
  restart: false,
};

function isJumpKey(code) {
  return code === "Space" || code === "ArrowUp" || code === "KeyW";
}

function isLeftKey(code) {
  return code === "ArrowLeft" || code === "KeyA";
}

function isRightKey(code) {
  return code === "ArrowRight" || code === "KeyD";
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function rectsIntersect(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function circleRectIntersect(c, r) {
  const closestX = clamp(c.x, r.x, r.x + r.w);
  const closestY = clamp(c.y, r.y, r.y + r.h);
  const dx = c.x - closestX;
  const dy = c.y - closestY;
  return dx * dx + dy * dy <= c.r * c.r;
}

function makeLevel() {
  const level = {
    width: 3200,
    height: canvas.height,
    platforms: [],
    coins: [],
    enemies: [],
    spawn: { x: 80, y: 360 },
  };

  level.platforms.push({ x: 0, y: 480, w: level.width, h: 60, kind: "ground" });

  level.platforms.push({ x: 220, y: 400, w: 220, h: 24, kind: "brick" });
  level.platforms.push({ x: 520, y: 340, w: 180, h: 24, kind: "brick" });
  level.platforms.push({ x: 820, y: 380, w: 220, h: 24, kind: "brick" });
  level.platforms.push({ x: 1200, y: 320, w: 200, h: 24, kind: "brick" });
  level.platforms.push({ x: 1520, y: 260, w: 160, h: 24, kind: "brick" });
  level.platforms.push({ x: 1760, y: 340, w: 240, h: 24, kind: "brick" });
  level.platforms.push({ x: 2140, y: 390, w: 220, h: 24, kind: "brick" });
  level.platforms.push({ x: 2520, y: 320, w: 260, h: 24, kind: "brick" });
  level.platforms.push({ x: 2920, y: 260, w: 200, h: 24, kind: "brick" });

  const coinPoints = [
    { x: 260, y: 360 },
    { x: 320, y: 360 },
    { x: 380, y: 360 },
    { x: 560, y: 300 },
    { x: 640, y: 300 },
    { x: 860, y: 340 },
    { x: 940, y: 340 },
    { x: 1240, y: 280 },
    { x: 1320, y: 280 },
    { x: 1560, y: 220 },
    { x: 1600, y: 220 },
    { x: 1820, y: 300 },
    { x: 1900, y: 300 },
    { x: 2180, y: 350 },
    { x: 2260, y: 350 },
    { x: 2560, y: 280 },
    { x: 2640, y: 280 },
    { x: 2960, y: 220 },
    { x: 3040, y: 220 },
  ];

  for (const p of coinPoints) {
    level.coins.push({ x: p.x, y: p.y, r: 10, collected: false });
  }

  level.enemies.push({
    x: 700,
    y: 0,
    w: 38,
    h: 30,
    vx: -70,
    vy: 0,
    minX: 600,
    maxX: 1040,
    alive: true,
  });
  level.enemies.push({
    x: 1480,
    y: 0,
    w: 38,
    h: 30,
    vx: 70,
    vy: 0,
    minX: 1380,
    maxX: 1690,
    alive: true,
  });
  level.enemies.push({
    x: 2320,
    y: 0,
    w: 38,
    h: 30,
    vx: -80,
    vy: 0,
    minX: 2140,
    maxX: 2360,
    alive: true,
  });

  return level;
}

function makePlayer(spawn) {
  return {
    x: spawn.x,
    y: spawn.y,
    w: 34,
    h: 44,
    vx: 0,
    vy: 0,
    onGround: false,
    invuln: 0,
    lives: 3,
    score: 0,
    coins: 0,
    facing: 1,
  };
}

const PHYS = {
  gravity: 2200,
  accel: 2400,
  maxSpeed: 360,
  jumpSpeed: 780,
  friction: 0.82,
};

let level = makeLevel();
let player = makePlayer(level.spawn);
let camX = 0;
let gameOver = false;
let lastTime = performance.now();

function resetGame() {
  level = makeLevel();
  player = makePlayer(level.spawn);
  camX = 0;
  gameOver = false;
}

function resolvePlayerCollisionsX(prevX) {
  for (const p of level.platforms) {
    if (!rectsIntersect(player, p)) continue;
    if (player.x > prevX) {
      player.x = p.x - player.w;
    } else if (player.x < prevX) {
      player.x = p.x + p.w;
    }
    player.vx = 0;
  }
}

function resolvePlayerCollisionsY(prevY) {
  player.onGround = false;
  for (const p of level.platforms) {
    if (!rectsIntersect(player, p)) continue;
    if (player.y > prevY) {
      player.y = p.y - player.h;
      player.vy = 0;
      player.onGround = true;
    } else if (player.y < prevY) {
      player.y = p.y + p.h;
      player.vy = 0;
    }
  }
}

function resolveEnemyCollisionsX(enemy, prevX) {
  for (const p of level.platforms) {
    if (!rectsIntersect(enemy, p)) continue;
    if (enemy.x > prevX) enemy.x = p.x - enemy.w;
    else if (enemy.x < prevX) enemy.x = p.x + p.w;
    enemy.vx *= -1;
  }
}

function resolveEnemyCollisionsY(enemy, prevY) {
  for (const p of level.platforms) {
    if (!rectsIntersect(enemy, p)) continue;
    if (enemy.y > prevY) enemy.y = p.y - enemy.h;
    else if (enemy.y < prevY) enemy.y = p.y + p.h;
    enemy.vy = 0;
  }
}

function update(dt) {
  if (INPUT.restart) {
    resetGame();
    INPUT.restart = false;
  }

  if (gameOver) {
    return;
  }

  if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);

  let ax = 0;
  if (INPUT.left) ax -= PHYS.accel;
  if (INPUT.right) ax += PHYS.accel;

  if (ax !== 0) {
    player.vx += ax * dt;
    player.vx = clamp(player.vx, -PHYS.maxSpeed, PHYS.maxSpeed);
    player.facing = player.vx >= 0 ? 1 : -1;
  } else {
    player.vx *= Math.pow(PHYS.friction, dt * 60);
    if (Math.abs(player.vx) < 4) player.vx = 0;
  }

  if (INPUT.jumpQueued && player.onGround) {
    player.vy = -PHYS.jumpSpeed;
    player.onGround = false;
  }
  INPUT.jumpQueued = false;

  const prevX = player.x;
  player.x += player.vx * dt;
  resolvePlayerCollisionsX(prevX);

  const prevY = player.y;
  player.vy += PHYS.gravity * dt;
  player.y += player.vy * dt;
  resolvePlayerCollisionsY(prevY);

  player.x = clamp(player.x, 0, level.width - player.w);
  if (player.y > level.height + 200) {
    player.lives -= 1;
    if (player.lives <= 0) gameOver = true;
    else {
      player.x = level.spawn.x;
      player.y = level.spawn.y;
      player.vx = 0;
      player.vy = 0;
      player.invuln = 1.2;
    }
  }

  for (const c of level.coins) {
    if (c.collected) continue;
    if (circleRectIntersect(c, player)) {
      c.collected = true;
      player.coins += 1;
      player.score += 10;
    }
  }

  const playerWasAboveEnemy = (enemy) => prevY + player.h <= enemy.y + 10;

  for (const e of level.enemies) {
    if (!e.alive) continue;

    const ePrevX = e.x;
    e.x += e.vx * dt;
    resolveEnemyCollisionsX(e, ePrevX);

    if (e.x < e.minX) {
      e.x = e.minX;
      e.vx = Math.abs(e.vx);
    } else if (e.x + e.w > e.maxX) {
      e.x = e.maxX - e.w;
      e.vx = -Math.abs(e.vx);
    }

    const ePrevY = e.y;
    e.vy += PHYS.gravity * dt;
    e.y += e.vy * dt;
    resolveEnemyCollisionsY(e, ePrevY);

    if (e.y > level.height + 200) e.alive = false;

    if (rectsIntersect(player, e)) {
      if (player.vy > 0 && playerWasAboveEnemy(e)) {
        e.alive = false;
        player.vy = -PHYS.jumpSpeed * 0.55;
        player.score += 50;
      } else if (player.invuln <= 0) {
        player.lives -= 1;
        player.invuln = 1.2;
        player.vx = (player.x + player.w / 2 < e.x + e.w / 2 ? -1 : 1) * 280;
        player.vy = -520;
        if (player.lives <= 0) gameOver = true;
      }
    }
  }

  camX = clamp(player.x - canvas.width * 0.42, 0, level.width - canvas.width);
}

function drawBackground() {
  const skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  skyGrad.addColorStop(0, "#79b7ff");
  skyGrad.addColorStop(0.55, "#bfe3ff");
  skyGrad.addColorStop(1, "#eef7ff");
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const hills = [
    { x: 80, y: 450, r: 190, c: "#7fcf90" },
    { x: 350, y: 470, r: 230, c: "#63b975" },
    { x: 680, y: 455, r: 200, c: "#7fcf90" },
    { x: 980, y: 475, r: 250, c: "#63b975" },
  ];

  const parallaxX = camX * 0.35;
  for (let i = 0; i < 9; i++) {
    for (const h of hills) {
      const hx = h.x + i * 520 - (parallaxX % 520);
      ctx.fillStyle = h.c;
      ctx.beginPath();
      ctx.arc(hx, h.y, h.r, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
    }
  }
}

function drawWorld() {
  ctx.save();
  ctx.translate(-camX, 0);

  for (const p of level.platforms) {
    if (p.kind === "ground") {
      ctx.fillStyle = "#2f8a3a";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.fillRect(p.x, p.y, p.w, 6);
    } else {
      ctx.fillStyle = "#b56b3e";
      ctx.fillRect(p.x, p.y, p.w, p.h);
      ctx.fillStyle = "rgba(0,0,0,0.12)";
      for (let x = p.x; x < p.x + p.w; x += 24) {
        ctx.fillRect(x + 11, p.y, 2, p.h);
      }
      ctx.fillRect(p.x, p.y + 10, p.w, 2);
    }
  }

  for (const c of level.coins) {
    if (c.collected) continue;
    ctx.fillStyle = "#ffce3a";
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.25)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r - 3, 0, Math.PI * 2);
    ctx.stroke();
  }

  for (const e of level.enemies) {
    if (!e.alive) continue;
    ctx.fillStyle = "#7c3a2a";
    ctx.fillRect(e.x, e.y, e.w, e.h);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fillRect(e.x + 8, e.y + 8, 7, 7);
    ctx.fillRect(e.x + e.w - 15, e.y + 8, 7, 7);
  }

  const flashing = player.invuln > 0 && Math.floor(player.invuln * 18) % 2 === 0;
  if (!flashing) {
    ctx.fillStyle = "#2b4cff";
    ctx.fillRect(player.x, player.y, player.w, player.h);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    const ex = player.facing > 0 ? player.x + player.w - 13 : player.x + 6;
    ctx.fillRect(ex, player.y + 12, 7, 7);
  }

  ctx.restore();
}

function drawHud() {
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(12, 12, 250, 60);

  ctx.fillStyle = "#0d1b2a";
  ctx.font = "600 16px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  ctx.fillText(`Điểm: ${player.score}`, 24, 36);
  ctx.fillText(`Coin: ${player.coins}`, 24, 58);

  ctx.textAlign = "right";
  ctx.fillText(`Mạng: ${player.lives}`, 250, 36);
  ctx.restore();
}

function drawOverlay() {
  if (!gameOver) return;
  ctx.save();
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.font = "700 42px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 10);
  ctx.font = "500 16px system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif";
  ctx.fillText("Nhấn R để chơi lại", canvas.width / 2, canvas.height / 2 + 24);
  ctx.restore();
}

function render() {
  drawBackground();
  drawWorld();
  drawHud();
  drawOverlay();
}

function tick(now) {
  const dt = clamp((now - lastTime) / 1000, 0, 1 / 24);
  lastTime = now;
  update(dt);
  render();
  requestAnimationFrame(tick);
}

window.addEventListener("keydown", (e) => {
  if (isLeftKey(e.code)) {
    INPUT.left = true;
    e.preventDefault();
  }
  if (isRightKey(e.code)) {
    INPUT.right = true;
    e.preventDefault();
  }
  if (isJumpKey(e.code)) {
    INPUT.jumpHeld = true;
    INPUT.jumpQueued = true;
    e.preventDefault();
  }
  if (e.code === "KeyR") {
    INPUT.restart = true;
    e.preventDefault();
  }
});

window.addEventListener("keyup", (e) => {
  if (isLeftKey(e.code)) {
    INPUT.left = false;
    e.preventDefault();
  }
  if (isRightKey(e.code)) {
    INPUT.right = false;
    e.preventDefault();
  }
  if (isJumpKey(e.code)) {
    INPUT.jumpHeld = false;
    e.preventDefault();
  }
});

resetGame();
requestAnimationFrame(tick);
