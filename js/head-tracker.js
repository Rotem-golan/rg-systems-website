(function () {
  const canvas = document.getElementById('head-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  const COLS = 5, ROWS = 3;
  const sprite = new Image();
  sprite.src = 'assets/head-sprite.png';

  let frameW = 0, frameH = 0, loaded = false, fadeIn = 0;

  sprite.onload = () => {
    frameW = sprite.naturalWidth / COLS;
    frameH = sprite.naturalHeight / ROWS;
    loaded = true;
  };
  sprite.onerror = () => {
    console.warn('[head-tracker] Missing image: assets/head-sprite.png');
  };

  // Mouse / touch
  let mx = 0.5, my = 0.5;
  document.addEventListener('mousemove', e => {
    mx = e.clientX / window.innerWidth;
    my = e.clientY / window.innerHeight;
  });
  document.addEventListener('touchmove', e => {
    const t = e.touches[0];
    mx = t.clientX / window.innerWidth;
    my = t.clientY / window.innerHeight;
  }, { passive: true });

  // Spring state — col and row are continuous floats, not snapped integers
  let col = 0, row = 0;
  let velCol = 0, velRow = 0;
  let flipped = false;

  // Spring tuning:
  //   stiffness → how fast it chases the target (higher = snappier)
  //   damping   → how much velocity bleeds off each frame (lower = more bounce)
  const STIFFNESS = 0.12;
  const DAMPING   = 0.74;
  const TREMOR    = 0.006; // tiny organic micro-movement

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function render() {
    requestAnimationFrame(render);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!loaded) return;

    if (fadeIn < 1) fadeIn = Math.min(1, fadeIn + 0.012);

    // Normalise mouse to -1 … +1
    const nx   = (mx - 0.5) * 2;
    const ny   = (my - 0.5) * 2;
    const absX = Math.abs(nx);

    // Target frame position (continuous)
    let targetCol, targetRow;
    if (ny < -0.30) {
      targetRow = 2;
      targetCol = 2 + Math.min(2, absX * 2.5);
    } else if (ny > 0.30) {
      targetRow = 2;
      targetCol = Math.min(1.8, absX * 1.8);
    } else {
      targetRow = 0;
      targetCol = Math.min(4, absX * 4.4);
    }

    // --- Spring physics (instead of lerp) ---
    // Gives natural acceleration, overshoot & settle — like a real head.
    velCol = velCol * DAMPING + (targetCol - col) * STIFFNESS;
    velRow = velRow * DAMPING + (targetRow - row) * STIFFNESS;
    col   += velCol;
    row   += velRow;
    col    = Math.max(0, Math.min(COLS - 1, col));
    row    = Math.max(0, Math.min(ROWS - 1, row));

    // Tiny organic tremor so the head never feels frozen
    const tc = col + (Math.random() - 0.5) * TREMOR;
    const tr = row + (Math.random() - 0.5) * TREMOR;

    // Flip when mouse is to the RIGHT so the face turns toward the cursor
    const wantsFlip = nx > 0.08;
    if (wantsFlip !== flipped && col < 0.45) flipped = wantsFlip;

    const isMobile = canvas.width < 768;
    const headH = canvas.height * (isMobile ? 0.70 : 0.95);
    const headW = headH * (frameW / frameH);
    const baseX = isMobile ? (canvas.width - headW) / 2 : canvas.width * 0.46;
    const baseY = (canvas.height - headH) / 2;
    const BASE_ALPHA = (isMobile ? 0.15 : 0.42) * fadeIn;

    // --- Bilinear frame crossfade ---
    // Split the continuous float position into its 4 surrounding frames and
    // draw each at a weight proportional to how close we are to that frame.
    // Result: perfectly smooth morphing between any two adjacent angles.
    //
    //   colFrac = how far between colA and colB  (0 = all colA, 1 = all colB)
    //   rowFrac = how far between rowA and rowB
    //
    //   w(colA,rowA) = (1-colFrac)*(1-rowFrac)
    //   w(colB,rowA) =    colFrac *(1-rowFrac)
    //   w(colA,rowB) = (1-colFrac)*   rowFrac
    //   w(colB,rowB) =    colFrac *   rowFrac

    const colA  = Math.floor(Math.max(0, Math.min(COLS - 1 - 1e-6, tc)));
    const colB  = Math.min(COLS - 1, colA + 1);
    const colFr = tc - colA;

    const rowA  = Math.floor(Math.max(0, Math.min(ROWS - 1 - 1e-6, tr)));
    const rowB  = Math.min(ROWS - 1, rowA + 1);
    const rowFr = tr - rowA;

    const blendFrames = [
      { c: colA, r: rowA, w: (1 - colFr) * (1 - rowFr) },
      { c: colB, r: rowA, w:      colFr  * (1 - rowFr) },
      { c: colA, r: rowB, w: (1 - colFr) *      rowFr  },
      { c: colB, r: rowB, w:      colFr  *      rowFr  },
    ];

    ctx.save();

    if (flipped) {
      ctx.translate(baseX + headW, baseY);
      ctx.scale(-1, 1);
      for (const f of blendFrames) {
        if (f.w < 0.005) continue;
        ctx.globalAlpha = BASE_ALPHA * f.w;
        ctx.drawImage(sprite, f.c * frameW, f.r * frameH, frameW, frameH,
                              0, 0, headW, headH);
      }
    } else {
      for (const f of blendFrames) {
        if (f.w < 0.005) continue;
        ctx.globalAlpha = BASE_ALPHA * f.w;
        ctx.drawImage(sprite, f.c * frameW, f.r * frameH, frameW, frameH,
                              baseX, baseY, headW, headH);
      }
    }

    ctx.restore();

    // --- Soft edge fades (destination-out erases canvas pixels at the edges) ---
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 1;

    const leftFade = ctx.createLinearGradient(baseX, 0, baseX + headW * 0.28, 0);
    leftFade.addColorStop(0, 'rgba(0,0,0,1)');
    leftFade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = leftFade;
    ctx.fillRect(0, 0, baseX + headW * 0.28, canvas.height);

    const topFade = ctx.createLinearGradient(0, baseY, 0, baseY + headH * 0.09);
    topFade.addColorStop(0, 'rgba(0,0,0,1)');
    topFade.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = topFade;
    ctx.fillRect(0, 0, canvas.width, baseY + headH * 0.09);

    const botFade = ctx.createLinearGradient(0, baseY + headH * 0.91, 0, canvas.height);
    botFade.addColorStop(0, 'rgba(0,0,0,0)');
    botFade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = botFade;
    ctx.fillRect(0, baseY + headH * 0.91, canvas.width, canvas.height);

    ctx.restore();
  }

  requestAnimationFrame(render);
})();
