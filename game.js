// ===== スペースシューター =====

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const W = canvas.width;   // 480
const H = canvas.height;  // 640

const scoreUI = document.getElementById('score-ui');
const levelUI = document.getElementById('level-ui');
const livesUI = document.getElementById('lives-ui');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('start-btn');

// ===== 画面スケーリング（スマホ対応） =====
function applyScale() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  document.getElementById('game-container').style.transform = `scale(${scale})`;
}
window.addEventListener('resize', applyScale);
window.addEventListener('orientationchange', applyScale);
applyScale();

// ===== ゲーム状態 =====
let state = 'title'; // 'title' | 'playing' | 'gameover'
let score = 0;
let lives = 3;
let level = 1;
let frame = 0;
let animId = null;

// ===== キーボード入力 =====
const keys = {};
document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (state === 'playing' && (e.code === 'Space' || e.code === 'KeyZ')) {
    e.preventDefault();
    playerShoot();
  }
});
document.addEventListener('keyup', e => { keys[e.code] = false; });

// ===== タッチ入力（スマホ対応） =====
const isTouchDevice = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

// タッチデバイスならタイトルの操作説明を更新
if (isTouchDevice) {
  document.getElementById('controls-hint').innerHTML =
    '左側ドラッグ : 移動<br>右側タップ&ホールド : 射撃';
}

// スクリーン座標 → キャンバス論理座標（CSSスケールを考慮）
function toCanvas(touch) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (touch.clientX - rect.left) * (W / rect.width),
    y: (touch.clientY - rect.top)  * (H / rect.height),
  };
}

// 仮想ジョイスティック（フローティング型：タッチした場所が基点）
const joystick = {
  active: false,
  id: null,
  baseX: 0, baseY: 0,  // タッチした基点
  curX: 0,  curY: 0,   // 現在のノブ位置
  maxR: 65,            // 最大移動半径（canvas px）
  dx: 0, dy: 0,        // アナログ入力値 (-1.0 〜 1.0)
};

// 射撃ボタン（右下固定）
const fireBtn = {
  active: false,
  id: null,
  x: W - 88,
  y: H - 108,
  r: 58,
};

function handleTouchStart(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    const p = toCanvas(t);
    // 左60%: ジョイスティックゾーン
    if (!joystick.active && p.x < W * 0.6) {
      joystick.active = true;
      joystick.id     = t.identifier;
      joystick.baseX  = p.x;
      joystick.baseY  = p.y;
      joystick.curX   = p.x;
      joystick.curY   = p.y;
      joystick.dx     = 0;
      joystick.dy     = 0;
    }
    // 右40%: 射撃ゾーン
    else if (!fireBtn.active && p.x >= W * 0.6) {
      fireBtn.active = true;
      fireBtn.id     = t.identifier;
    }
  }
}

function handleTouchMove(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joystick.id) {
      const p  = toCanvas(t);
      const dx = p.x - joystick.baseX;
      const dy = p.y - joystick.baseY;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        const clamped = Math.min(dist, joystick.maxR);
        // アナログ値: 指の移動量に比例（小さく動かすとゆっくり移動）
        joystick.dx   = (dx / dist) * (clamped / joystick.maxR);
        joystick.dy   = (dy / dist) * (clamped / joystick.maxR);
        joystick.curX = joystick.baseX + (dx / dist) * clamped;
        joystick.curY = joystick.baseY + (dy / dist) * clamped;
      } else {
        joystick.dx   = 0;
        joystick.dy   = 0;
        joystick.curX = joystick.baseX;
        joystick.curY = joystick.baseY;
      }
    }
  }
}

function handleTouchEnd(e) {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier === joystick.id) {
      joystick.active = false;
      joystick.id     = null;
      joystick.dx     = 0;
      joystick.dy     = 0;
    }
    if (t.identifier === fireBtn.id) {
      fireBtn.active = false;
      fireBtn.id     = null;
    }
  }
}

canvas.addEventListener('touchstart',  handleTouchStart, { passive: false });
canvas.addEventListener('touchmove',   handleTouchMove,  { passive: false });
canvas.addEventListener('touchend',    handleTouchEnd,   { passive: false });
canvas.addEventListener('touchcancel', handleTouchEnd,   { passive: false });

// ===== 仮想コントローラー描画 =====
function drawVirtualControls() {
  if (!isTouchDevice) return;
  ctx.save();

  // ── ジョイスティック ──
  if (joystick.active) {
    // ベースリング
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = '#adf';
    ctx.lineWidth   = 3;
    ctx.beginPath();
    ctx.arc(joystick.baseX, joystick.baseY, joystick.maxR, 0, Math.PI * 2);
    ctx.stroke();
    // ノブ
    ctx.globalAlpha = 0.55;
    ctx.fillStyle   = '#adf';
    ctx.beginPath();
    ctx.arc(joystick.curX, joystick.curY, 26, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // 非アクティブ時: 薄い点線でヒント表示
    ctx.globalAlpha = 0.15;
    ctx.strokeStyle = '#adf';
    ctx.lineWidth   = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(110, H - 120, joystick.maxR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.1;
    ctx.fillStyle   = '#adf';
    ctx.beginPath();
    ctx.arc(110, H - 120, 26, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 射撃ボタン ──
  ctx.globalAlpha = fireBtn.active ? 0.7 : 0.3;
  ctx.fillStyle   = fireBtn.active ? '#f60' : '#f44';
  ctx.beginPath();
  ctx.arc(fireBtn.x, fireBtn.y, fireBtn.r, 0, Math.PI * 2);
  ctx.fill();

  ctx.globalAlpha  = fireBtn.active ? 1.0 : 0.6;
  ctx.fillStyle    = '#fff';
  ctx.font         = 'bold 16px "Courier New"';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('FIRE', fireBtn.x, fireBtn.y);

  ctx.restore();
}

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
  invincible: 0,
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

  // キーボード入力（デジタル）
  let kdx = 0, kdy = 0;
  if (keys['ArrowLeft'] || keys['KeyA'])  kdx -= 1;
  if (keys['ArrowRight'] || keys['KeyD']) kdx += 1;
  if (keys['ArrowUp'] || keys['KeyW'])    kdy -= 1;
  if (keys['ArrowDown'] || keys['KeyS'])  kdy += 1;

  const klen = Math.hypot(kdx, kdy);
  if (klen > 0) {
    player.x += (kdx / klen) * spd;
    player.y += (kdy / klen) * spd;
  }

  // ジョイスティック入力（アナログ: 傾け量に比例した速度）
  if (joystick.active) {
    player.x += joystick.dx * spd;
    player.y += joystick.dy * spd;
  }

  player.x = Math.max(player.w / 2, Math.min(W - player.w / 2, player.x));
  player.y = Math.max(player.h / 2, Math.min(H - player.h / 2, player.y));

  if (player.invincible > 0) player.invincible--;
  if (player.shootCooldown > 0) player.shootCooldown--;

  // 射撃ボタン長押しで連射
  if (state === 'playing' && fireBtn.active) playerShoot();
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
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (enemies[i].y > H + 50) enemies.splice(i, 1);
  }
}

function drawEnemies() {
  for (const e of enemies) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.rotate(e.angle);

    ctx.shadowBlur = 10;
    ctx.shadowColor = e.color;
    ctx.fillStyle = e.color;

    if (e.size >= 32) {
      ctx.beginPath();
      ctx.moveTo(0, -e.size);
      ctx.lineTo(e.size * 0.8, -e.size * 0.2);
      ctx.lineTo(e.size * 0.5, e.size * 0.8);
      ctx.lineTo(-e.size * 0.5, e.size * 0.8);
      ctx.lineTo(-e.size * 0.8, -e.size * 0.2);
      ctx.closePath();
    } else if (e.size >= 24) {
      ctx.beginPath();
      ctx.moveTo(0, e.size);
      ctx.lineTo(e.size, -e.size * 0.5);
      ctx.lineTo(0, -e.size * 0.3);
      ctx.lineTo(-e.size, -e.size * 0.5);
      ctx.closePath();
    } else {
      ctx.beginPath();
      ctx.moveTo(0, e.size);
      ctx.lineTo(e.size * 0.7, -e.size * 0.5);
      ctx.lineTo(-e.size * 0.7, -e.size * 0.5);
      ctx.closePath();
    }
    ctx.fill();

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
  joystick.active = false;
  fireBtn.active  = false;
  resetPlayer();
  updateHUD();
  overlay.style.display = 'none';
  state = 'playing';
  if (animId) cancelAnimationFrame(animId);
  loop();
}

function gameOver() {
  state = 'gameover';
  const hint = isTouchDevice
    ? '左ドラッグ: 移動 / 右タップ: 射撃'
    : 'WASD/矢印: 移動 / スペース/Z: 射撃';
  overlay.style.display = 'flex';
  overlay.innerHTML = `
    <h1>GAME OVER</h1>
    <div class="score-display">スコア: ${score}</div>
    <p>レベル ${level} まで到達！</p>
    <button id="start-btn" style="margin-top:24px;padding:14px 40px;font-size:20px;font-family:'Courier New',monospace;background:transparent;border:2px solid #0ff;color:#0ff;cursor:pointer;touch-action:manipulation;">もう一度</button>
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
  drawVirtualControls();

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
