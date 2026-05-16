/**
 * Keepie-Uppie — A soccer ball juggling mini-game
 * Fixed-position overlay keepie-uppie game
 */
(function () {
  'use strict';

  // --- Constants ---
  const BALL_RADIUS = 22; // human-requested: bigger ball
  const GRAVITY = 0.18; // human-requested: much floatier
  const AIR_FRICTION = 0.998;
  const FLOOR_RESTITUTION = 0.65;
  const WALL_RESTITUTION = 0.85;
  const GRASS_HEIGHT = 36; // human-requested: thinner grass
  const GRAB_DISTANCE = 60; // bigger grab zone for bigger ball
  const KICK_DISTANCE = 50; // bigger kick zone
  const KICK_STRENGTH = 9.5; // human-requested: kick a bit higher
  const KICK_COOLDOWN = 8;
  const THROW_THRESHOLD_OFFSET = 150; // easier throw
  const LOW_ZONE_HEIGHT = BALL_RADIUS * 6; // 3 ball heights above grass
  const LOW_ZONE_TIMEOUT = 120; // ~2 seconds at 60fps
  const PARTICLE_COUNT = 3;
  const SQUASH_FRAMES = 4;

  // --- State ---
  const State = { GROUND: 0, HELD: 1, FREE: 2 };

  let canvas, ctx;
  let scoreEl;
  let width, height;
  let ball, cursor, particles;
  let juggles = 0;
  let bestScore = parseInt(localStorage.getItem('kickups_best') || '0', 10);
  let groundTimer = 0;
  let lowZoneTimer = 0;
  let kickCooldown = 0;
  let squashTimer = 0;
  let prevCursorX = 0;
  let prevCursorY = 0;
  let cursorVX = 0;
  let cursorVY = 0;
  let animFrameId;
  let gameActive = true;
  let containerEl, hintEl;

  // Floor Y = top of grass strip
  function floorY() {
    return height - GRASS_HEIGHT;
  }

  function init() {
    canvas = document.getElementById('kickupsCanvas');
    scoreEl = document.getElementById('kickupsScore');
    if (!canvas || !scoreEl) return;

    ctx = canvas.getContext('2d');
    resize();

    ball = {
      x: width / 2,
      y: floorY() - BALL_RADIUS,
      vx: 0,
      vy: 0,
      state: State.GROUND,
      rotation: 0,
    };

    cursor = { x: -100, y: -100 };
    particles = [];

    containerEl = document.getElementById('kickups');
    hintEl = document.getElementById('kickupsHint');

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchstart', onTouchStart, { passive: false });
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', resize);

    // Restore saved preference
    if (localStorage.getItem('kickups_off') === '1') {
      gameActive = false;
      containerEl.classList.add('kickups--hidden');
      canvas.classList.add('kickups__canvas--hidden');
    }
    updateHint();
    updateScoreDisplay();
    loop();
  }

  function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
  }

  function onMouseMove(e) {
    cursor.x = e.clientX;
    cursor.y = e.clientY;
  }

  function onTouchMove(e) {
    if (e.touches.length > 0) {
      cursor.x = e.touches[0].clientX;
      cursor.y = e.touches[0].clientY;
    }
  }

  function onTouchStart(e) {
    if (e.touches.length > 0) {
      cursor.x = e.touches[0].clientX;
      cursor.y = e.touches[0].clientY;
      // Reset cursor velocity on new touch to avoid stale deltas
      prevCursorX = cursor.x;
      prevCursorY = cursor.y;
    }
  }

  function onKeyDown(e) {
    if (e.key === 'b' || e.key === 'B') {
      gameActive = !gameActive;
      if (gameActive) {
        containerEl.classList.remove('kickups--hidden');
        canvas.classList.remove('kickups__canvas--hidden');
        localStorage.removeItem('kickups_off');
        // Reset ball to ground
        ball.x = width / 2;
        ball.y = floorY() - BALL_RADIUS;
        ball.vx = 0;
        ball.vy = 0;
        ball.state = State.GROUND;
        juggles = 0;
        updateScoreDisplay();
      } else {
        containerEl.classList.add('kickups--hidden');
        canvas.classList.add('kickups__canvas--hidden');
        localStorage.setItem('kickups_off', '1');
        setCursor('default');
      }
      updateHint();
    }
  }

  function updateHint() {
    if (!hintEl) return;
    hintEl.textContent = gameActive ? 'B to end game' : 'B to play ball';
    hintEl.classList.toggle('kickups__hint--inactive', !gameActive);
  }

  // --- Game Loop ---
  function loop() {
    if (gameActive) {
      update();
      draw();
    }
    animFrameId = requestAnimationFrame(loop);
  }

  function update() {
    // Cursor velocity (smoothed)
    cursorVX = cursor.x - prevCursorX;
    cursorVY = cursor.y - prevCursorY;
    prevCursorX = cursor.x;
    prevCursorY = cursor.y;

    if (kickCooldown > 0) kickCooldown--;
    if (squashTimer > 0) squashTimer--;

    const dist = distance(cursor.x, cursor.y, ball.x, ball.y);

    switch (ball.state) {
      case State.GROUND:
        // Ball rests on floor
        ball.y = floorY() - BALL_RADIUS;
        ball.vx *= 0.9; // ground friction
        if (Math.abs(ball.vx) < 0.1) ball.vx = 0;
        ball.x += ball.vx;
        bounceWalls();

        groundTimer++;

        // Pick up if cursor is near — streak resets on pickup
        if (dist < GRAB_DISTANCE) {
          ball.state = State.HELD;
          groundTimer = 0;
          lowZoneTimer = 0;
          if (juggles > 0) {
            juggles = 0;
            updateScoreDisplay();
          }
          setCursor('grab');
        }
        break;

      case State.HELD:
        // Ball follows cursor
        ball.x = cursor.x;
        ball.y = cursor.y;
        setCursor('grabbing');

        // Throw upward when cursor crosses threshold
        const throwLine = height - GRASS_HEIGHT - THROW_THRESHOLD_OFFSET;
        if (cursor.y < throwLine) {
          ball.state = State.FREE;
          ball.vx = cursorVX * 0.6;
          ball.vy = Math.min(cursorVY * 1.2, -2); // ensure upward
          ball.vy = Math.max(ball.vy, -10); // cap speed (floaty)
          setCursor('default');
        }
        break;

      case State.FREE:
        // Physics
        ball.vy += GRAVITY;
        ball.vx *= AIR_FRICTION;
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Rotation from horizontal velocity
        ball.rotation += ball.vx * 0.05;

        // Wall bounce
        bounceWalls();

        // Floor bounce
        if (ball.y + BALL_RADIUS >= floorY()) {
          ball.y = floorY() - BALL_RADIUS;
          ball.vy *= -FLOOR_RESTITUTION;
          squashTimer = SQUASH_FRAMES;

          // If barely bouncing, settle to ground
          if (Math.abs(ball.vy) < 0.8) {
            ball.vy = 0;
            ball.state = State.GROUND;
            groundTimer = 0;
          }
        }

        // Low zone timer: ball near grass too long forces pickup + streak reset
        if (ball.y + BALL_RADIUS > floorY() - LOW_ZONE_HEIGHT) {
          lowZoneTimer++;
          if (lowZoneTimer >= LOW_ZONE_TIMEOUT) {
            ball.vy = 0;
            ball.vx = 0;
            ball.state = State.GROUND;
            ball.y = floorY() - BALL_RADIUS;
            groundTimer = 0;
            lowZoneTimer = 0;
          }
        } else {
          lowZoneTimer = 0;
        }

        // Ceiling bounce
        if (ball.y - BALL_RADIUS < 0) {
          ball.y = BALL_RADIUS;
          ball.vy = Math.abs(ball.vy) * 0.5;
        }

        // Cursor kick
        if (dist < KICK_DISTANCE && kickCooldown === 0 && ball.vy >= 0) {
          // Kick direction: ball center - cursor position
          let dx = ball.x - cursor.x;
          let dy = ball.y - cursor.y;
          const len = Math.sqrt(dx * dx + dy * dy) || 1;
          dx /= len;
          dy /= len;

          // Add some upward bias
          dy = Math.min(dy, -0.3);

          ball.vx = dx * KICK_STRENGTH + cursorVX * 0.2;
          ball.vy = dy * KICK_STRENGTH;
          ball.vy = Math.max(ball.vy, -12); // cap upward speed (floaty)

          kickCooldown = KICK_COOLDOWN;
          juggles++;
          groundTimer = 0;
          updateScoreDisplay();
          spawnParticles(ball.x, ball.y);
        }
        break;
    }

    // Update particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.15;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }

  function bounceWalls() {
    if (ball.x - BALL_RADIUS < 0) {
      ball.x = BALL_RADIUS;
      ball.vx *= -WALL_RESTITUTION;
    }
    if (ball.x + BALL_RADIUS > width) {
      ball.x = width - BALL_RADIUS;
      ball.vx *= -WALL_RESTITUTION;
    }
  }

  function setCursor(type) {
    document.body.style.cursor = type;
  }

  function updateScoreDisplay() {
    if (juggles > bestScore) {
      bestScore = juggles;
      localStorage.setItem('kickups_best', String(bestScore));
    }
    scoreEl.textContent = juggles;
    if (juggles > 0) {
      scoreEl.classList.add('kickups__score--pulse');
      setTimeout(() => scoreEl.classList.remove('kickups__score--pulse'), 200);
    }
    // Show best score
    const bestEl = document.getElementById('kickupsBest');
    if (bestEl) bestEl.textContent = bestScore;
  }

  function spawnParticles(x, y) {
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 6,
        vy: -Math.random() * 5 - 2,
        life: 15 + Math.random() * 10,
        maxLife: 25,
        size: 3 + Math.random() * 3,
      });
    }
  }

  // --- Drawing ---
  function draw() {
    ctx.clearRect(0, 0, width, height);

    // Draw particles
    for (const p of particles) {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = `rgba(255, 209, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw ball
    ctx.save();
    ctx.translate(ball.x, ball.y);

    // Squash effect on ground bounce
    if (squashTimer > 0) {
      const t = squashTimer / SQUASH_FRAMES;
      ctx.scale(1 + t * 0.2, 1 - t * 0.15);
    }

    ctx.rotate(ball.rotation);

    // Ball body
    ctx.beginPath();
    ctx.arc(0, 0, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Pentagon pattern
    drawPentagons();

    ctx.restore();
  }

  function drawPentagons() {
    const r = BALL_RADIUS * 0.42;
    ctx.fillStyle = '#333333';

    // Center pentagon
    drawPentagon(0, 0, r);

    // Surrounding pentagons (offset)
    const outerR = BALL_RADIUS * 0.75;
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      drawPentagon(
        Math.cos(angle) * outerR,
        Math.sin(angle) * outerR,
        r * 0.7
      );
    }
  }

  function drawPentagon(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
      const x = cx + Math.cos(angle) * r;
      const y = cy + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // --- Helpers ---
  function distance(x1, y1, x2, y2) {
    const dx = x1 - x2;
    const dy = y1 - y2;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // --- Init on DOM ready ---
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
