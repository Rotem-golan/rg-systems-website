(function () {
  'use strict';

  const canvas = document.getElementById('head-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let W, H;
  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    W = canvas.width;
    H = canvas.height;
  }
  window.addEventListener('resize', resize);
  resize();

  // ── Helpers ───────────────────────────────────────────────────
  const clamp   = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp    = (a, b, t) => a + (b - a) * clamp(t, 0, 1);
  const easeOut = t => 1 - (1 - t) * (1 - t);
  const easeIO  = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  // Rounded-rect path (manual — full browser compat)
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }

  // ── Phase state machine ───────────────────────────────────────
  //   idle → noticing → waving → returning → working (∞)
  const DUR = { idle: 1.2, noticing: 0.6, waving: 2.4, returning: 0.5, working: Infinity };
  let phase  = 'idle';
  let phaseT = 0;
  let gt     = 0;     // global elapsed seconds
  let fadeIn = 0;
  let prev   = null;

  // ── Desk ─────────────────────────────────────────────────────
  function drawDesk(lx, ty, w, h, a) {
    ctx.save();
    ctx.globalAlpha = a * 0.92;
    ctx.fillStyle = '#161610';
    ctx.fillRect(lx, ty, w, h);
    ctx.fillStyle = '#252518';
    ctx.fillRect(lx, ty, w, 2.5);   // top-edge highlight
    ctx.restore();
  }

  // ── Monitor ───────────────────────────────────────────────────
  function drawMonitor(cx, ty, mW, mH, a) {
    const pulse = 0.7 + 0.3 * Math.sin(gt * 0.9);
    ctx.save();
    // bezel
    ctx.globalAlpha = a;
    ctx.fillStyle = '#111109';
    rr(cx - mW / 2, ty, mW, mH, 4);
    ctx.fill();
    // screen gradient
    const sg = ctx.createLinearGradient(cx, ty, cx, ty + mH);
    sg.addColorStop(0,   `rgba(201,168,76,${0.16 * pulse})`);
    sg.addColorStop(0.5, `rgba(201,168,76,${0.07 * pulse})`);
    sg.addColorStop(1,   'rgba(0,0,0,0)');
    ctx.fillStyle = sg;
    rr(cx - mW / 2 + 3, ty + 3, mW - 6, mH - 6, 2);
    ctx.fill();
    // animated code lines
    const widths = [0.70, 0.92, 0.45, 0.78, 0.58];
    for (let i = 0; i < 5; i++) {
      const lp = 0.35 + 0.65 * Math.sin(gt * 2 + i * 1.5);
      ctx.globalAlpha = a * 0.22 * lp * pulse;
      ctx.fillStyle = '#c9a84c';
      ctx.fillRect(cx - mW / 2 + 7, ty + 6 + i * 5.2, widths[i] * (mW - 14), 1.8);
    }
    // stand
    ctx.globalAlpha = a;
    ctx.fillStyle = '#161610';
    ctx.fillRect(cx - 4, ty + mH, 8, 9);
    ctx.restore();
  }

  // ── Single goggle eye ─────────────────────────────────────────
  function drawEye(ex, ey, gR, lR, pR, pShift, a) {
    ctx.save();
    ctx.globalAlpha = a;
    // outer rim
    ctx.fillStyle = '#686858';
    ctx.beginPath(); ctx.arc(ex, ey, gR, 0, Math.PI * 2); ctx.fill();
    // metallic top-sheen
    ctx.fillStyle = '#8a8a72';
    ctx.beginPath();
    ctx.ellipse(ex, ey - gR * 0.3, gR * 0.72, gR * 0.3, 0, Math.PI, 0);
    ctx.fill();
    // lens
    ctx.fillStyle = 'rgba(188,224,242,0.60)';
    ctx.beginPath(); ctx.arc(ex, ey, lR, 0, Math.PI * 2); ctx.fill();
    // pupil
    ctx.fillStyle = '#080808';
    ctx.beginPath(); ctx.arc(ex + pShift, ey, pR, 0, Math.PI * 2); ctx.fill();
    // specular highlight
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    ctx.arc(ex + pShift - pR * 0.4, ey - pR * 0.42, pR * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ── Minion character ──────────────────────────────────────────
  // cx       = horizontal center of character
  // deskY    = Y coordinate of the desk surface top
  // s        = size scale (derived from viewport height)
  // twoEyes  = manager has two goggles, worker has one
  // waveT    = 0 (arm at desk) … 1 (arm fully raised)
  // waveOsc  = oscillation value during wave (-1…+1)
  // lookLeft = 0…1  pupil shift toward viewer
  // bodyRise = 0…1  lean-forward nudge
  // typing   = global time used for keyboard-bob animation
  // alpha    = overall draw alpha
  function drawMinion(cx, deskY, s, {
    twoEyes  = false,
    waveT    = 0,
    waveOsc  = 0,
    lookLeft = 0,
    bodyRise = 0,
    typing   = 0,
    alpha    = 0.4,
  } = {}) {

    // ── Measurements ─────────────────────────────────────────
    const bRy  = 145 * s;   // body vertical radius   (tall)
    const bRx  =  38 * s;   // body horizontal radius (narrow)
    const dW   = 210 * s;   // desk width
    const dH   =  17 * s;   // desk height
    const mW   =  95 * s;   // monitor width
    const mH   =  64 * s;   // monitor height
    const gR   =  17 * s;   // goggle outer radius
    const lR   =  13 * s;   // lens radius
    const pR   =   6 * s;   // pupil radius
    const aLn  =  58 * s;   // upper arm length
    const fLn  =  42 * s;   // forearm length

    // ── Derived positions ────────────────────────────────────
    const rise    = bodyRise * 8 * s;
    const bodyCY  = deskY - dH - bRy * 0.50 - rise;   // body center Y
    const bodyTop = bodyCY - bRy;
    const shldrY  = bodyCY - bRy * 0.22;              // shoulder level
    const gogY    = bodyTop + bRy * 0.68;              // goggle center Y
    const monCX   = cx + 8 * s;                        // monitor slightly off-center
    const monTY   = deskY - dH - mH;                   // monitor top
    const typBob  = Math.sin(typing * 7) * 5 * s;
    const pShift  = lerp(0, -5 * s, lookLeft);         // pupil shift

    // ── Draw order: body → overalls → straps → desk → monitor → arms → eyes

    // 1. Body (yellow capsule)
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#e8c84a';
    ctx.beginPath();
    ctx.ellipse(cx, bodyCY, bRx, bRy, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 2. Overalls (dark navy, lower ~50% of body, clipped to capsule)
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.ellipse(cx, bodyCY, bRx, bRy, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = '#28385a';
    ctx.fillRect(cx - bRx, bodyCY + 6 * s, bRx * 2, bRy);
    ctx.restore();

    // 3. Overall straps
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#28385a';
    const strapW = 7 * s;
    const strapTY = bodyTop + 14 * s;
    const strapBY = bodyCY + 8 * s;
    ctx.fillRect(cx - bRx * 0.48, strapTY, strapW, strapBY - strapTY);
    ctx.fillRect(cx + bRx * 0.48 - strapW, strapTY, strapW, strapBY - strapTY);
    // Gold pocket square on manager
    if (twoEyes) {
      ctx.fillStyle = '#c9a84c';
      ctx.fillRect(cx + bRx * 0.22, bodyCY - 2 * s, 9 * s, 7 * s);
    }
    ctx.restore();

    // 4. Desk (covers lower body — drawn after body so it occludes it)
    drawDesk(cx - dW / 2, deskY - dH, dW, dH, alpha);

    // 5. Monitor
    drawMonitor(monCX, monTY, mW, mH, alpha);

    // 6. Arms
    ctx.save();
    ctx.lineCap    = 'round';
    ctx.lineWidth  = 9 * s;
    ctx.strokeStyle = '#e8c84a';

    // Left arm → keyboard (typing bob)
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(cx - bRx + 2 * s, shldrY);
    ctx.lineTo(cx - 52 * s, deskY - dH + typBob);
    ctx.stroke();

    // Right arm → keyboard or wave
    if (waveT > 0.01) {
      // Upper arm swings up
      const uA  = lerp(Math.PI / 2, -Math.PI * 0.3, easeOut(waveT));
      const ueX = cx + bRx - 2 * s + Math.cos(uA) * aLn;
      const ueY = shldrY           + Math.sin(uA) * aLn;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(cx + bRx - 2 * s, shldrY);
      ctx.lineTo(ueX, ueY);
      ctx.stroke();
      // Forearm oscillates (the wave)
      const fA = uA - 0.65 + waveOsc * 0.55;
      ctx.lineWidth = 8 * s;
      ctx.beginPath();
      ctx.moveTo(ueX, ueY);
      ctx.lineTo(ueX + Math.cos(fA) * fLn, ueY + Math.sin(fA) * fLn);
      ctx.stroke();
    } else {
      // Typing
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(cx + bRx - 2 * s, shldrY);
      ctx.lineTo(cx + 48 * s, deskY - dH - typBob * 0.6);
      ctx.stroke();
    }
    ctx.restore();

    // 7. Goggles (always on top)
    if (twoEyes) {
      const sep = gR * 1.1;
      drawEye(cx - sep, gogY, gR, lR, pR, pShift, alpha);
      drawEye(cx + sep, gogY, gR, lR, pR, pShift, alpha);
      // goggle bridge
      ctx.save();
      ctx.globalAlpha = alpha * 0.75;
      ctx.strokeStyle = '#686858';
      ctx.lineWidth = 3 * s;
      ctx.beginPath();
      ctx.moveTo(cx - sep + lR, gogY);
      ctx.lineTo(cx + sep - lR, gogY);
      ctx.stroke();
      ctx.restore();
    } else {
      drawEye(cx, gogY, gR, lR, pR, pShift, alpha);
    }
  }

  // ── Edge fades — destination-out (identical pattern to head-tracker) ─
  function edgeFades() {
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;

    let g;
    // left
    g = ctx.createLinearGradient(0, 0, W * 0.05, 0);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W * 0.05, H);

    // right (scene blends into text area)
    g = ctx.createLinearGradient(W * 0.50, 0, W * 0.64, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g; ctx.fillRect(W * 0.50, 0, W, H);

    // top
    g = ctx.createLinearGradient(0, 0, 0, H * 0.07);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.07);

    // bottom
    g = ctx.createLinearGradient(0, H * 0.87, 0, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.87, W, H);

    ctx.restore();
  }

  // ── Render loop ───────────────────────────────────────────────
  function render(ts) {
    requestAnimationFrame(render);
    const dt = prev !== null ? Math.min((ts - prev) / 1000, 0.05) : 0;
    prev = ts;
    gt     += dt;
    phaseT += dt;
    if (fadeIn < 1) fadeIn = Math.min(1, fadeIn + dt * 0.55);

    // Advance phase
    if (phaseT >= (DUR[phase] ?? Infinity)) {
      phaseT = 0;
      const next = { idle: 'noticing', noticing: 'waving', waving: 'returning', returning: 'working' };
      if (next[phase]) phase = next[phase];
    }
    const p01 = clamp(phaseT / (DUR[phase] ?? 1), 0, 1);

    // Derive animation values from current phase
    let waveT = 0, waveOsc = 0, lookLeft = 0, bodyRise = 0;
    if (phase === 'noticing') {
      lookLeft = easeIO(p01);
    }
    if (phase === 'waving') {
      lookLeft = 1;
      bodyRise = 1;
      waveT    = easeOut(Math.min(1, p01 * 2.8));   // arm raises quickly at start
      waveOsc  = Math.sin(phaseT * 9);              // wave oscillation
    }
    if (phase === 'returning') {
      lookLeft = 1 - easeIO(p01);
      bodyRise = 1 - easeIO(p01);
      waveT    = 1 - easeOut(p01);                  // arm lowers
    }

    ctx.clearRect(0, 0, W, H);

    const isMobile = W < 768;
    const s  = H / 650;
    const A  = (isMobile ? 0.14 : 0.42) * fadeIn;
    const sx = isMobile ? W * 0.5 : W * 0.33;
    const sy = H * 0.73;

    const typing = (phase === 'idle' || phase === 'working') ? gt : 0;

    // Worker — left, one goggle, 82% size, always typing
    drawMinion(sx - 108 * s, sy, s * 0.82, {
      twoEyes: false,
      typing:  gt * 0.88,
      alpha:   A * 0.72,
    });

    // Manager — right, two goggles, full size, does the greeting
    drawMinion(sx + 52 * s, sy, s, {
      twoEyes:  true,
      waveT,
      waveOsc,
      lookLeft,
      bodyRise,
      typing,
      alpha: A,
    });

    edgeFades();
  }

  requestAnimationFrame(render);
})();
