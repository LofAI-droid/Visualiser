/* kern.js — spiegelmotor van de caleidoscoop (teamleider)
 * Tekent de vormen één keer per frame in een "wig"-tegel en stempelt die tegel
 * N keer rond het middelpunt, waarbij elke tweede kopie gespiegeld wordt —
 * precies zoals de spiegels in een echte caleidoscoop. */
(function () {
  'use strict';

  const TAU = Math.PI * 2;

  function rng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  window.KCore = { rng, clamp, TAU };

  /* ---------- Staat ---------- */
  const state = {
    seed: 1 + Math.floor(Math.random() * 999999),
    segments: 12,
    complexity: 6,
    style: KShapes.styles[0].id,
    colorMode: KColors.modes[0].id,
    speed: 1,
    spin: 0.15,
    hueDrift: 0.2,
    zoom: 1,
    offsetX: 0,
    offsetY: 0,
    paused: false,
    glow: true,
  };

  const LIMITS = {
    segments: [4, 32], complexity: [1, 10], speed: [0, 3], spin: [-1, 1],
    hueDrift: [0, 1], zoom: [0.5, 3], offsetX: [-1, 1], offsetY: [-1, 1],
  };

  let shapes = [];
  let basePalette = null;
  const listeners = [];

  function regenShapes() {
    shapes = KShapes.generate(rng(state.seed), state.style, state.complexity);
  }
  function regenColors() {
    basePalette = KColors.generate(rng((state.seed ^ 0x9e3779b9) >>> 0), state.colorMode, 6);
  }

  function sanitize(p) {
    const out = {};
    for (const k in p) {
      if (!(k in state)) continue;
      let v = p[k];
      if (k in LIMITS) {
        v = Number(v);
        if (!isFinite(v)) continue;
        v = clamp(v, LIMITS[k][0], LIMITS[k][1]);
      }
      if (k === 'segments') v = Math.max(4, Math.round(v / 2) * 2);
      if (k === 'complexity') v = Math.round(v);
      if (k === 'seed') { v = Math.abs(Math.floor(Number(v))) >>> 0; if (!v) continue; }
      if (k === 'style' && !KShapes.styles.some((s) => s.id === v)) continue;
      if (k === 'colorMode' && !KColors.modes.some((m) => m.id === v)) continue;
      if (k === 'paused' || k === 'glow') v = !!v;
      out[k] = v;
    }
    return out;
  }

  function set(partial) {
    const p = sanitize(partial || {});
    const changed = (k) => k in p && p[k] !== state[k];
    const needShapes = changed('seed') || changed('style') || changed('complexity');
    const needColors = changed('seed') || changed('colorMode');
    Object.assign(state, p);
    if (needShapes) regenShapes();
    if (needColors) regenColors();
    listeners.forEach((fn) => fn(state));
  }

  function randomize() {
    set({
      seed: 1 + Math.floor(Math.random() * 999999),
      style: pick(KShapes.styles).id,
      colorMode: pick(KColors.modes).id,
      segments: pick([6, 8, 10, 12, 12, 16, 20, 24]),
      offsetX: 0, offsetY: 0,
    });
  }

  /* ---------- Weergave ---------- */
  const canvas = document.getElementById('caleido');
  const ctx = canvas.getContext('2d');
  const tile = document.createElement('canvas');
  const tctx = tile.getContext('2d');
  const glowCanvas = document.createElement('canvas');
  const gctx = glowCanvas.getContext('2d');

  const PAD = 4;   // marge (px) rond de wig in de tegel
  const SEAM = 2;  // overlap (px) aan de spiegelnaden tegen haarlijntjes

  // Pad van de wig; d > 0 verschuift beide randen d px naar buiten.
  function wedgePath(c, R, w, d) {
    const cw = Math.cos(w), sw = Math.sin(w);
    // snijpunt van de twee verschoven randen (iets achter de oorsprong)
    const s = -d * (1 + cw) / sw;
    const ax = -d * sw + s * cw, ay = -d;
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(R, -d);
    c.arc(0, 0, R, Math.atan2(-d, R), w + Math.atan2(d, R));
    c.closePath();
  }

  function renderTile(R, w, t, palette, s) {
    const tw = Math.ceil(R) + PAD * 2;
    const th = Math.ceil(R * Math.sin(Math.min(w, Math.PI / 2))) + PAD * 2;
    if (tile.width !== tw || tile.height !== th) { tile.width = tw; tile.height = th; }
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalAlpha = 1;
    tctx.globalCompositeOperation = 'source-over';
    tctx.clearRect(0, 0, tw, th);

    // 1. vormen tekenen, exact geknipt op de wig
    tctx.save();
    tctx.translate(PAD, PAD);
    wedgePath(tctx, R + 2, w, 1.5); // ruim knippen: randpixels zonder kleurvermenging
    tctx.clip();
    // bron verschuiven/zoomen (zoals de objectkamer van een caleidoscoop bewegen)
    tctx.translate(s.offsetX * R * 0.35, s.offsetY * R * 0.35);
    tctx.scale(s.zoom, s.zoom);
    KShapes.draw(tctx, shapes, palette, t, R, w);
    tctx.restore();
    // exacte wigrand: destination-in schaalt enkel de alfa, mengt geen kleuren
    tctx.setTransform(1, 0, 0, 1, PAD, PAD);
    tctx.globalCompositeOperation = 'destination-in';
    wedgePath(tctx, R + 2, w, 0);
    tctx.fill();

    // 2. tegel aan beide randen in zichzelf spiegelen (achter de bestaande inhoud),
    //    zodat de overlapstrook exact toont wat het buursegment toont: naadloos.
    tctx.globalCompositeOperation = 'destination-over';
    for (const edge of [0, w]) {
      tctx.setTransform(1, 0, 0, 1, PAD, PAD);
      tctx.rotate(edge);
      tctx.scale(1, -1);
      tctx.rotate(-edge);
      tctx.drawImage(tile, -PAD, -PAD);
    }

    // 3. alles buiten de licht verbrede wig weer wissen
    tctx.setTransform(1, 0, 0, 1, PAD, PAD);
    tctx.globalCompositeOperation = 'destination-in';
    wedgePath(tctx, R + 2, w, SEAM);
    tctx.fill();
    tctx.setTransform(1, 0, 0, 1, 0, 0);
    tctx.globalCompositeOperation = 'source-over';
  }

  function renderFrame(c, W, H, t, angle, palette, s, glow) {
    const R = Math.hypot(W, H) / 2;
    const n = s.segments;
    const w = TAU / n;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalAlpha = 1;
    c.globalCompositeOperation = 'source-over';
    c.fillStyle = palette.background;
    c.fillRect(0, 0, W, H);

    renderTile(R, w, t, palette, s);

    c.save();
    c.translate(W / 2, H / 2);
    c.rotate(angle);
    for (let i = 0; i < n; i++) {
      c.save();
      c.rotate(i * w);
      if (i % 2) { c.rotate(w); c.scale(1, -1); }
      c.drawImage(tile, -PAD, -PAD);
      c.restore();
    }
    c.restore();

    if (glow) {
      // goedkope bloom: verkleinde, vervaagde kopie er licht bovenop
      const gw = Math.max(1, Math.round(W / 8)), gh = Math.max(1, Math.round(H / 8));
      if (glowCanvas.width !== gw || glowCanvas.height !== gh) { glowCanvas.width = gw; glowCanvas.height = gh; }
      gctx.filter = 'blur(3px)';
      gctx.clearRect(0, 0, gw, gh);
      gctx.drawImage(c.canvas, 0, 0, gw, gh);
      gctx.filter = 'none';
      c.globalCompositeOperation = 'screen';
      c.globalAlpha = 0.3;
      c.imageSmoothingEnabled = true;
      c.drawImage(glowCanvas, 0, 0, W, H);
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    }

    // zachte vignet
    const g = c.createRadialGradient(W / 2, H / 2, R * 0.55, W / 2, H / 2, R);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);
  }

  /* ---------- Lus ---------- */
  let t = 0, angle = 0, hue = 0, last = performance.now();

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width * dpr));
    const h = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  }

  function currentPalette() {
    return hue ? KColors.shift(basePalette, hue) : basePalette;
  }

  function loop(now) {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!state.paused) {
      t += dt * state.speed;
      angle += dt * state.spin * 0.6;
      hue = (hue + dt * state.hueDrift * 24) % 360;
    }
    resize();
    renderFrame(ctx, canvas.width, canvas.height, t, angle, currentPalette(), state, state.glow);
    requestAnimationFrame(loop);
  }

  function exportPNG(size) {
    size = size || 2048;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    renderFrame(c.getContext('2d'), size, size, t, angle, currentPalette(), state, state.glow);
    c.toBlob((blob) => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'caleidoscoop-' + state.seed + '.png';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  regenShapes();
  regenColors();

  window.app = {
    state,
    set,
    randomize,
    onChange(fn) { listeners.push(fn); },
    exportPNG,
    canvas,
    options() { return { styles: KShapes.styles, modes: KColors.modes }; },
    // voor tests/debug
    _renderFrame: renderFrame,
  };

  requestAnimationFrame((n) => { last = n; loop(n); });
})();
