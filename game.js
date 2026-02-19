// ===== スペースシューター =====

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;
const H = canvas.height;

const scoreUI = document.getElementById('score-ui');
const levelUI = document.getElementById('level-ui');
const livesUI = document.getElementById('lives-ui');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');

// ===== ゲーム状態 =====
let state = 'title'; // 'title' | 'playing' | 'gameover'
let score = 0;
let lives = 3;
let level = 1;
let frame = 0;
let animId = null;

// ===== 入力 =====
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (state === 'playing' && (e.code === 'Space' || e.code === 'KeyZ')) {
    e.preventDefault();
    playerShoot();
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ===== 星背景 =====
const stars = Array.from({ length: 80 }, () => ({
  x: Math.random() * W,
  y: Math.random() * H,
  r: Math.random() * 1.5 + 0.3,
  speed: Math.random() * 1.5 + 0.3,
  brightness: Math.random(),
}));

function updateStars() {
  for (const s of stars) {
    s.y += s.speed;
    if (s.y > H) { s.y = 0; s.x = Math.random() * W; }
  }
}

function drawStars() {
  for (const s of stars) {
    ctx.globalAlpha = 0.4 + s.brightness * 0.6;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ===== プレイヤー =====
const player = {
  x: W / 2,
  y: H - 80,
  w: 36,
  h: 36,
  speed: 4.5,
  invincible: 0,   // 無敵フレーム数
  shootCooldown: 0,
};

function resetPlayer() {
  player.x = W / 2;
  player.y = H - 80;
  player.invincible = 90;
  player.shootCooldown = 0;
}

function updatePlayer() {
  const spd = player.speed;
  if (keys['ArrowLeft'] || keys['KeyA'])  player.x -= spd;
  if (keys['ArrowRight'] || keys['KeyD']) player.x += spd;
  if (keys['ArrowUp'] || keys['KeyW'])    player.y -= spd;
  if (keys['ArrowDown'] || keys['KeyS'])  player.y += spd;

  player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));
  player.y = Math.max(player.h / 2, Math.min(H - player.h / 2, player.y));

  if (player.invincible > 0) player.invincible--;
  if (player.shootCooldown > 0) player.shootCooldown--;
}

function drawPlayer() {
  if (player.invincible > 0 && Math.floor(player.invincible / 5) % 2 === 0) return;

  const x = player.x, y = player.y;
  ctx.save();
  ctx.translate(x, y);

  // エンジン炎
  const flameH = 10 + Math.sin(frame * 0.3) * 4;
  const grad = ctx.createLinearGradient(0, 14, 0, 14 + flameH);
  grad.addColorStop(0, '#ff8800');
  grad.addColorStop(1, 'rgba(255,0,0,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-8, 14);
  ctx.lineTo(8, 14);
  ctx.lineTo(0, 14 + flameH);
  ctx.closePath();
  ctx.fill();

  // 機体
  ctx.fillStyle = '#4af';
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(14, 14);
  ctx.lineTo(6, 8);
  ctx.lineTo(-6, 8);
  ctx.lineTo(-14, 14);
  ctx.closePath();
  ctx.fill();

  // コックピット
  ctx.fillStyle = '#aef';
  ctx.beginPath();
  ctx.ellipse(0, -4, 5, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ===== プレイヤー弾 =====
const bullets = [];
let lastShootFrame = -20;

function playerShoot() {
  if (player.shootCooldown > 0) return;
  const shootDelay = Math.max(8, 15 - level);
  player.shootCooldown = shootDelay;

  bullets.push({ x: player.x, y: player.y - 18, w: 4, h: 12, vy: -12, owner: 'player' });

  // レベル3以降は3way
  if (level >= 3) {
    bullets.push({ x: player.x - 12, y: player.y - 8, w: 3, h: 10, vy: -11, vx: -1.5, owner: 'player' });
    bullets.push({ x: player.x + 12, y: player.y - 8, w: 3, h: 10, vy: -11, vx: 1.5,  owner: 'player' });
  }
}

function updateBullets() {
  for (const b of bullets) {
    b.y += b.vy || 0;
    b.x += b.vx || 0;
  }
  // 画面外削除
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    if (b.y < -20 || b.y > H + 20 || b.x < -20 || b.x > W + 20) bullets.splice(i, 1);
  }
}

function drawBullets() {
  for (const b of bullets) {
    if (b.owner === 'player') {
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#0ff';
      ctx.fillStyle = '#0ff';
      ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
      ctx.shadowBlur = 0;
    } else {
      ctx.shadowBlur = 8;
      ctx.shadowColor = '#f40';
      ctx.fillStyle = '#f80';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r || 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }
}

// ===== 敵 =====
const enemies = [];

const ENEMY_TYPES = [
  { color: '#f55', hp: 1, score: 10, size: 20, speed: 1.5, shoot: false },
  { color: '#f0a', hp: 2, score: 25, size: 24, speed: 1.2, shoot: true,  shootRate: 120 },
  { color: '#fa0', hp: 4, score: 60, size: 32, speed: 0.8, shoot: true,  shootRate: 80  },
];

function spawnEnemy() {
  const typeIdx = Math.min(Math.floor(Math.random() * (1 + Math.floor(level / 2))), ENEMY_TYPES.length - 1);
  const t = ENEMY_TYPES[typeIdx];
  enemies.push({
    x: t.size + Math.random() * (W - t.size * 2),
    y: -t.size,
    ...t,
    maxHp: t.hp,
    shootTimer: Math.floor(Math.random() * (t.shootRate || 120)),
    angle: 0,
    wobble: (Math.random() - 0.5) * 0.5,
  });
}

function updateEnemies() {
  for (const e of enemies) {
    e.y += e.speed;
    e.x += Math.sin(frame * 0.03 + e.wobble * 10) * e.wobble * 3;
    e.angle = Math.sin(frame * 0.05) * 0.2;

    if (e.shoot) {
      e.shootTimer--;
      if (e.shootTimer <= 0) {
        e.shootTimer = Math.max(40, e.shootRate - level * 5);
        const dx = player.x - e.x;
        const dy = player.y - e.y;
        const dist = Math.hypot(dx, dy);
        const speed = 3 + level * 0.3;
        bullets.push({ x: e.x, y: e.y + e.size, vx: (dx / dist) * speed, vy: (dy / dist) * speed, r: 5, owner: 'enemy' });
      }
    }
  }
  // 画面外削除
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].y > H + 50) enemies.splice(i, 1);
  }
}

function drawEnemies() {
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);

    // 本体
    ctx.shadowBlur = 10;
    ctx.shadowColor = e.color;
    ctx.fillStyle = e.color;

    if (e.size >= 32) {
      // 大型敵
      ctx.beginPath();
      ctx.moveTo(0, -e.size);
      ctx.lineTo(e.size * 0.8, -e.size * 0.2);
      ctx.lineTo(e.size * 0.5, e.size * 0.8);
      ctx.lineTo(-e.size * 0.5, e.size * 0.8);
      ctx.lineTo(-e.size * 0.8, -e.size * 0.2);
      ctx.closePath();
    } else if (e.size >= 24) {
      // 中型敵
      ctx.beginPath();
      ctx.moveTo(0, e.size);
      ctx.lineTo(e.size, -e.size * 0.5);
      ctx.lineTo(0, -e.size * 0.3);
      ctx.lineTo(-e.size, -e.size * 0.5);
      ctx.closePath();
    } else {
      // 小型敵
      ctx.beginPath();
      ctx.moveTo(0, e.size);
      ctx.lineTo(e.size * 0.7, -e.size * 0.5);
      ctx.lineTo(-e.size * 0.7, -e.size * 0.5);
      ctx.closePath();
    }
    ctx.fill();

    // HPバー（2HP以上）
    if (e.maxHp > 1) {
      const bw = e.size * 2;
      const bx = -e.size;
      const by = e.size + 4;
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#333';
      ctx.fillRect(bx, by, bw, 4);
      ctx.fillStyle = '#0f0';
      ctx.fillRect(bx, by, bw * (e.hp / e.maxHp), 4);
    }

    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ===== パーティクル =====
const particles = [];

function spawnExplosion(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      r: Math.random() * 4 + 1,
      color,
      life: 40 + Math.random() * 20,
      maxLife: 60,
    });
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx;
    p.y += p.vy;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.life--;
    if (p.life <= 0) particles.splice(i, 1);
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = p.life / p.maxLife;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ===== 当たり判定 =====
function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
}

function checkCollisions() {
  // プレイヤー弾 vs 敵
  for (let bi = bullets.length - 1; bi >= 0; bi--) {
    const b = bullets[bi];
    if (b.owner !== 'player') continue;
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (rectsOverlap(b.x, b.y, b.w, b.h, e.x, e.y, e.size * 1.4, e.size * 1.4)) {
        bullets.splice(bi, 1);
        e.hp--;
        if (e.hp <= 0) {
          spawnExplosion(e.x, e.y, e.color, 12 + e.size);
          score += e.score;
          enemies.splice(ei, 1);
        }
        break;
      }
    }
  }

  // 敵弾 vs プレイヤー
  if (player.invincible === 0) {
    for (let bi = bullets.length - 1; bi >= 0; bi--) {
      const b = bullets[bi];
      if (b.owner !== 'enemy') continue;
      if (rectsOverlap(b.x, b.y, (b.r || 4) * 2, (b.r || 4) * 2, player.x, player.y, player.w * 0.7, player.h * 0.7)) {
        bullets.splice(bi, 1);
        hitPlayer();
        break;
      }
    }
  }

  // 敵体当たり vs プレイヤー
  if (player.invincible === 0) {
    for (let ei = enemies.length - 1; ei >= 0; ei--) {
      const e = enemies[ei];
      if (rectsOverlap(e.x, e.y, e.size * 1.2, e.size * 1.2, player.x, player.y, player.w * 0.7, player.h * 0.7)) {
        spawnExplosion(e.x, e.y, e.color, 10);
        enemies.splice(ei, 1);
        hitPlayer();
        break;
      }
    }
  }
}

function hitPlayer() {
  lives--;
  spawnExplosion(player.x, player.y, '#4af', 20);
  if (lives <= 0) {
    gameOver();
  } else {
    resetPlayer();
  }
  updateHUD();
}

// ===== レベルアップ =====
let spawnInterval = 80;
let spawnTimer = 0;

function checkLevel() {
  const newLevel = Math.floor(score / 200) + 1;
  if (newLevel !== level) {
    level = newLevel;
    spawnInterval = Math.max(20, 80 - level * 8);
    updateHUD();
  }
}

// ===== HUD =====
function updateHUD() {
  scoreUI.textContent = `スコア: ${score}`;
  levelUI.textContent = `レベル: ${level}`;
  livesUI.textContent = '残機: ' + '❤️'.repeat(Math.max(0, lives));
}

// ===== ゲームフロー =====
function startGame() {
  score = 0;
  lives = 3;
  level = 1;
  frame = 0;
  spawnInterval = 80;
  spawnTimer = 0;
  bullets.length = 0;
  enemies.length = 0;
  particles.length = 0;
  resetPlayer();
  updateHUD();
  overlay.style.display = 'none';
  state = 'playing';
  if (animId) cancelAnimationFrame(animId);
  loop();
}

function gameOver() {
  state = 'gameover';
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <h1>GAME OVER</h1>
    <div class="score-display">スコア: ${score}</div>
    <p>レベル ${level} まで到達！</p>
    <button id="start-btn" style="margin-top:20px;padding:12px 32px;font-size:18px;font-family:'Courier New',monospace;background:transparent;border:2px solid #0ff;color:#0ff;cursor:pointer;">もう一度</button>
  `;
  document.getElementById('start-btn').addEventListener('click', startGame);
}

// ===== メインループ =====
function loop() {
  animId = requestAnimationFrame(loop);
  frame++;

  // 背景
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, W, H);

  updateStars();
  drawStars();

  if (state !== 'playing') return;

  // スポーン
  spawnTimer++;
  if (spawnTimer >= spawnInterval) {
    spawnTimer = 0;
    spawnEnemy();
  }

  updatePlayer();
  updateEnemies();
  updateBullets();
  updateParticles();
  checkCollisions();
  checkLevel();

  drawParticles();
  drawBullets();
  drawEnemies();
  drawPlayer();

  updateHUD();
}

// ===== タイトル =====
startBtn.addEventListener('click', startGame);

// 最初の描画（星だけ流す）
function titleLoop() {
  if (state !== 'title') return;
  animId = requestAnimationFrame(titleLoop);
  frame++;
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, W, H);
  updateStars();
  drawStars();
}
titleLoop();
