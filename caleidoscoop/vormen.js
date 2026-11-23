/* vormen.js — Agent Vormen
 * Levert window.KShapes: stijlen, generator (plain data in polaire eenheidscoördinaten)
 * en een snelle tekenfunctie voor één wig van de caleidoscoop.
 * Coördinaten: r in [0,1] (fractie van straal R), a in [0,1] (fractie van de wighoek).
 * Kleuren worden als index in palette.colors bewaard, zodat kleurverschuiving doorwerkt.
 */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var sin = Math.sin, cos = Math.cos;

  var styles = [
    { id: 'geometrisch', name: 'Geometrisch' },
    { id: 'kristal', name: 'Kristal' },
    { id: 'bloemen', name: 'Bloemen' },
    { id: 'glasscherven', name: 'Glasscherven' },
    { id: 'mandala', name: 'Mandala' },
    { id: 'organisch', name: 'Organisch' },
    { id: 'lijnenspel', name: 'Lijnenspel' }
  ];

  /* ---------- hulpjes voor generatie ---------- */
  function rr(rng, a, b) { return a + (b - a) * rng(); }
  function ri(rng, a, b) { return Math.floor(a + (b - a + 1) * rng()); }
  function clampC(c) { c = Math.round(+c || 5); return c < 1 ? 1 : c > 10 ? 10 : c; }
  function shapeCount(c) { return Math.round(8 + (c - 1) * 12.4); } // 8 .. 120
  function rPos(rng) { return Math.pow(rng(), 0.8) * 1.02; }        // iets naar buiten, centrum blijft gevuld
  function colI(rng) { return Math.floor(rng() * 64); }               // modulo aantal kleuren bij tekenen

  // animatieparameters: alles oscilleert rond een basispositie (drijft nooit weg)
  function anim(rng, s, amt) {
    s.ph = rng() * TAU;
    s.w = rr(rng, 0.18, 0.5) * (rng() < 0.5 ? -1 : 1);
    s.dr = rr(rng, 0.004, 0.025) * amt;
    s.da = rr(rng, 0.01, 0.06) * amt;
    s.pu = rr(rng, 0.02, 0.12) * amt;
    s.sp = rr(rng, -0.3, 0.3) * amt;
    return s;
  }

  /* Polaire mozaïekverdeling (voor glasscherven en kristal): ringen met
   * gedeelde, onregelmatige grenzen en schuine sneden. Vult de hele wig. */
  function tessellate(rng, nr, density, out, opts) {
    var K = 9, A0 = -0.18, A1 = 1.18, i, k, j;
    var knotsA = [];
    for (k = 0; k < K; k++) knotsA.push(A0 + (A1 - A0) * k / (K - 1));
    var bnd = [];
    for (i = 0; i <= nr; i++) {
      var base = 1.1 * Math.pow(i / nr, 0.82);
      var row = [];
      for (k = 0; k < K; k++) {
        var jit = (i > 0 && i < nr) ? rr(rng, -0.32, 0.32) * (1.1 / nr) : 0;
        row.push(base + jit);
      }
      bnd.push(row);
    }
    function bval(i, a) {
      var row = bnd[i], f = (a - A0) / (A1 - A0) * (K - 1);
      if (f <= 0) return row[0];
      if (f >= K - 1) return row[K - 1];
      var k0 = Math.floor(f), u = f - k0;
      return row[k0] * (1 - u) + row[k0 + 1] * u;
    }
    for (j = 0; j < nr; j++) {
      var m = Math.max(1, Math.round(density * (j + 0.7) / nr + rr(rng, -0.6, 0.6)));
      var cuts = [];
      for (k = 0; k < m; k++) cuts.push(A0 + (A1 - A0) * (k + 0.5 + rr(rng, -0.3, 0.3)) / m);
      // snede-eindpunten: binnen en buiten verschoven -> schuine scherven, soms waaier (driehoek)
      var ins = [A0], outs = [A0];
      for (k = 0; k < m - 1; k++) {
        var c = (cuts[k] + cuts[k + 1]) / 2, sw = (A1 - A0) / m;
        var ain = c + rr(rng, -0.35, 0.35) * sw, aout = c + rr(rng, -0.35, 0.35) * sw;
        if (k > 0 && rng() < 0.3) ain = ins[ins.length - 1];
        ins.push(ain); outs.push(aout);
      }
      ins.push(A1); outs.push(A1);
      for (k = 0; k < ins.length - 1; k++) {
        var pts = [];
        var a0 = ins[k], a1 = ins[k + 1], b0 = outs[k], b1 = outs[k + 1], q;
        if (j === 0) { pts.push(0, 0.5); }
        else if (a1 - a0 < 1e-6) { pts.push(bval(j, a0), a0); }
        else {
          pts.push(bval(j, a0), a0);
          for (q = 0; q < K; q++) if (knotsA[q] > a0 && knotsA[q] < a1) pts.push(bnd[j][q], knotsA[q]);
          pts.push(bval(j, a1), a1);
        }
        pts.push(bval(j + 1, b1), b1);
        for (q = K - 1; q >= 0; q--) if (knotsA[q] < b1 && knotsA[q] > b0) pts.push(bnd[j + 1][q], knotsA[q]);
        pts.push(bval(j + 1, b0), b0);
        var s = { k: 'pp', pts: pts, c: colI(rng), m: opts.mode, al: rr(rng, opts.al0, opts.al1),
          lw: opts.lw, ph: rng() * TAU, w: rr(rng, 0.3, 0.9), fl: opts.flicker || 0 };
        if (opts.lighter) s.l = 1;
        out.push(s);
      }
    }
  }

  /* ---------- stijlgeneratoren ---------- */
  var gen = {};

  gen.geometrisch = function (rng, c, n) {
    var out = [], i;
    var nb = 3 + Math.round(c / 3), edges = [0];
    for (i = 1; i <= nb; i++) edges.push(1.08 * Math.pow(i / nb, 0.9) + (i < nb ? rr(rng, -0.04, 0.04) : 0));
    for (i = 0; i < nb; i++) out.push(anim(rng, { k: 'band', r0: edges[i], r1: edges[i + 1], c: colI(rng), al: rr(rng, 0.35, 0.65) }, 0.4));
    // grote driehoeken vanuit het centrum (mooie caleidoscoopsterren)
    var nt = 2 + Math.round(c / 3);
    for (i = 0; i < nt; i++) {
      var r1 = rr(rng, 0.3, 1.05), r2 = rr(rng, 0.3, 1.05);
      out.push({ k: 'pp', pts: [rr(rng, 0, 0.3), rr(rng, 0, 1), r1, rng() < 0.5 ? -0.05 : rr(rng, 0, 1), r2, rng() < 0.5 ? 1.05 : rr(rng, 0, 1)],
        c: colI(rng), m: rng() < 0.3 ? 2 : 0, al: rr(rng, 0.45, 0.8), lw: 0.004, ph: rng() * TAU, w: 0.3, fl: 0 });
    }
    var kinds = ['tri', 'ruit', 'cirkel', 'ring', 'vierkant', 'zeshoek', 'ster'];
    for (i = 0; i < n; i++) {
      var r = rPos(rng), kind = kinds[Math.floor(rng() * kinds.length)];
      var s = anim(rng, { r: r, a: rng() < 0.18 ? (rng() < 0.5 ? 0 : 1) : rng(), s: rr(rng, 0.03, 0.11) * (0.6 + r * 0.9) * (1.25 - c * 0.05),
        c: colI(rng), c2: colI(rng), rot: rng() * TAU, al: rr(rng, 0.75, 1), m: rng() < 0.25 ? 1 : (rng() < 0.4 ? 2 : 0), lw: rr(rng, 0.003, 0.007) }, 1);
      if (kind === 'cirkel') s.k = 'circ';
      else if (kind === 'ring') { s.k = 'circ'; s.m = 1; s.lw = rr(rng, 0.006, 0.014); }
      else { s.k = 'poly'; s.n = kind === 'tri' ? 3 : kind === 'zeshoek' ? 6 : kind === 'ster' ? ri(rng, 5, 8) : 4;
        s.asp = kind === 'ruit' ? rr(rng, 0.4, 0.65) : 1; s.si = kind === 'ster' ? rr(rng, 0.4, 0.55) : 0;
        if (kind === 'vierkant') s.rot = TAU / 8; }
      out.push(s);
    }
    out.push({ k: 'circ', r: 0, a: 0.5, s: rr(rng, 0.08, 0.16), c: colI(rng), c2: colI(rng), m: 2, al: 1, lw: 0.006, rot: 0, ph: 0, w: 0.3, dr: 0, da: 0, pu: 0.08, sp: 0, abs: 1 });
    return out;
  };

  gen.kristal = function (rng, c, n) {
    var out = [], i;
    tessellate(rng, 2 + Math.round(c * 0.5), 3 + c * 0.6, out, { mode: 0, al0: 0.25, al1: 0.6, lw: 0.002 });
    tessellate(rng, 2 + Math.round(c * 0.3), 2 + c * 0.4, out, { mode: 1, al0: 0.25, al1: 0.5, lw: 0.0025, lighter: true, flicker: 0.5 });
    var ns = Math.round(n * 0.7);
    for (i = 0; i < ns; i++) {
      var r = rPos(rng);
      var s = anim(rng, { k: 'shard', r: r, a: rng(), s: rr(rng, 0.06, 0.18) * (0.6 + r) * (1.2 - c * 0.04), asp: rr(rng, 0.18, 0.4),
        c: colI(rng), rot: rng() < 0.6 ? rr(rng, -0.4, 0.4) : rng() * TAU, al: rr(rng, 0.3, 0.6), l: 1, m: 2, lw: 0.002 }, 0.7);
      out.push(s);
    }
    // stralende ster in het midden
    out.push(anim(rng, { k: 'shard', r: 0, a: 0, s: rr(rng, 0.25, 0.4), asp: 0.25, c: colI(rng), rot: 0, al: 0.55, l: 1, m: 2, lw: 0.002 }, 0.3));
    out.push(anim(rng, { k: 'shard', r: 0, a: 1, s: rr(rng, 0.2, 0.35), asp: 0.25, c: colI(rng), rot: 0, al: 0.5, l: 1, m: 2, lw: 0.002 }, 0.3));
    return out;
  };

  gen.bloemen = function (rng, c, n) {
    var out = [], i;
    out.push(anim(rng, { k: 'band', r0: 0, r1: 1.1, c: colI(rng), al: 0.35 }, 0));
    // grote bloemblaadjes vanuit het centrum op de wigranden -> centrale bloem na spiegelen
    var layers = 2 + Math.round(c / 4);
    for (i = 0; i < layers; i++) {
      var edge = i % 2;
      out.push(anim(rng, { k: 'petal', r: 0, a: edge, s: rr(rng, 0.45, 1.05) * (1 - i * 0.12), asp: rr(rng, 0.35, 0.6), c: colI(rng), c2: colI(rng),
        rot: 0, al: rr(rng, 0.7, 0.95), m: 2, lw: 0.003, abs: 1 }, 0.4));
    }
    out.push(anim(rng, { k: 'petal', r: 0, a: 0.5, s: rr(rng, 0.5, 0.9), asp: 0.45, c: colI(rng), c2: colI(rng), rot: 0, al: 0.85, m: 2, lw: 0.003, abs: 1 }, 0.4));
    var nRos = Math.round(n * 0.38), nCurl = Math.round(n * 0.22), nLeaf = n - nRos - nCurl;
    for (i = 0; i < nLeaf; i++) {
      var r = rPos(rng);
      out.push(anim(rng, { k: 'petal', r: r, a: rng(), s: rr(rng, 0.08, 0.2) * (0.6 + r), asp: rr(rng, 0.3, 0.5), c: colI(rng), c2: colI(rng),
        rot: rng() * TAU, al: rr(rng, 0.7, 0.95), m: rng() < 0.5 ? 2 : 0, lw: 0.002 }, 1));
    }
    for (i = 0; i < nCurl; i++) {
      var r2 = rPos(rng);
      out.push(anim(rng, { k: 'curl', r: r2, a: rng(), s: rr(rng, 0.06, 0.16) * (0.6 + r2), turns: rr(rng, 1.2, 2.5), dir: rng() < 0.5 ? 1 : -1,
        c: colI(rng), rot: rng() * TAU, al: 0.9, lw: rr(rng, 0.003, 0.007) }, 1));
    }
    for (i = 0; i < nRos; i++) {
      var r3 = rPos(rng);
      out.push(anim(rng, { k: 'ros', r: r3, a: rng() < 0.25 ? Math.round(rng()) : rng(), s: rr(rng, 0.05, 0.13) * (0.6 + r3) * (1.2 - c * 0.04), n: ri(rng, 5, 9),
        c: colI(rng), c2: colI(rng), c3: colI(rng), rot: rng() * TAU, al: 0.95, m: rng() < 0.3 ? 2 : 0, lw: 0.002 }, 1));
    }
    return out;
  };

  gen.glasscherven = function (rng, c, n) {
    var out = [], i;
    tessellate(rng, 3 + Math.round(c * 0.6), 3 + c * 0.9, out, { mode: 2, al0: 0.72, al1: 0.95, lw: 0.0065 });
    // kleine losse scherfjes en glinsteringen
    var extra = Math.round(n * 0.25);
    for (i = 0; i < extra; i++) {
      var r = rPos(rng);
      out.push(anim(rng, { k: 'poly', r: r, a: rng(), s: rr(rng, 0.03, 0.08) * (0.6 + r), n: ri(rng, 3, 5), asp: rr(rng, 0.4, 1), si: 0,
        c: colI(rng), c2: colI(rng), rot: rng() * TAU, al: 0.95, m: 2, lw: 0.004 }, 0.8));
    }
    for (i = 0; i < Math.round(extra * 0.6); i++) {
      var r2 = rPos(rng);
      out.push(anim(rng, { k: 'shard', r: r2, a: rng(), s: rr(rng, 0.04, 0.1) * (0.6 + r2), asp: 0.15, c: colI(rng), rot: rng() * TAU, al: 0.35, l: 1, m: 0, lw: 0.002 }, 0.8));
    }
    return out;
  };

  gen.mandala = function (rng, c, n) {
    var out = [], i;
    var nr = 3 + Math.round(c * 1.1);
    var edges = [rr(rng, 0.06, 0.12)];
    for (i = 1; i <= nr; i++) edges.push(edges[0] + (1.06 - edges[0]) * Math.pow(i / nr, 0.85));
    out.push({ k: 'circ', r: 0, a: 0.5, s: edges[0] * 1.2, c: colI(rng), c2: colI(rng), m: 2, al: 1, lw: 0.004, rot: 0, ph: 0, w: 0.4, dr: 0, da: 0, pu: 0.1, sp: 0, abs: 1 });
    // stervormige lagen met punten op de spiegellijnen: geven de mandala radiale structuur
    var nst = 2 + Math.round(c / 4);
    for (i = 0; i < nst; i++) {
      var ro = rr(rng, 0.35, 1.08) * (1 - i * 0.12), ri_ = ro * rr(rng, 0.35, 0.7), tipA = rng() < 0.5 ? 0 : 0.5;
      out.push({ k: 'pp', pts: tipA === 0 ? [0, 0.5, ro, -0.001, ri_, 0.5, ro, 1.001, 0, 0.5] : [0, 0.5, ri_, 0, ro, 0.5, ri_, 1, 0, 0.5],
        c: colI(rng), m: 2, al: rr(rng, 0.6, 0.9), lw: 0.003, ph: rng() * TAU, w: 0.3, fl: 0, nw: 1 });
    }
    // buitenrand: vult ook de hoeken van het scherm (en uitgezoomd beeld)
    out.push(anim(rng, { k: 'band', r0: 1.06, r1: 2.6, c: colI(rng), al: 0.55 }, 0));
    var motifs = ['dots', 'dots', 'scallop', 'zig', 'petals', 'rings', 'ruit'];
    var dens = rr(rng, 5, 9) * (0.7 + c * 0.06);
    for (i = 0; i < nr; i++) {
      var r0 = edges[i], r1 = edges[i + 1], mid = (r0 + r1) / 2, h = r1 - r0;
      if (rng() < 0.45) out.push(anim(rng, { k: 'band', r0: r0, r1: r1, c: colI(rng), al: rr(rng, 0.25, 0.6) }, 0.15));
      out.push({ k: 'arcl', r: r1, c: colI(rng), al: 0.9, lw: rr(rng, 0.003, 0.008) });
      var mo = motifs[Math.floor(rng() * motifs.length)], col = colI(rng), col2 = colI(rng);
      var d = dens / Math.max(0.25, mid) * (0.6 + rng() * 0.8) * 1.0;
      var base = { r: mid, h: h, d: d / (h * 6 + 0.2) * 0.5, c: col, c2: col2, al: 0.95, ph: rng() * TAU, w: rr(rng, 0.3, 0.7), lw: 0.003 };
      var s = {};
      for (var key in base) s[key] = base[key];
      if (mo === 'dots') { s.k = 'mdots'; s.sh = 0; s.sz = rr(rng, 0.25, 0.42); s.m = rng() < 0.5 ? 2 : 0; }
      else if (mo === 'rings') { s.k = 'mdots'; s.sh = 1; s.sz = rr(rng, 0.25, 0.4); s.m = 1; s.lw = 0.004; }
      else if (mo === 'ruit') { s.k = 'mdots'; s.sh = 2; s.sz = rr(rng, 0.3, 0.45); s.m = 2; }
      else if (mo === 'petals') { s.k = 'mdots'; s.sh = 3; s.sz = rr(rng, 0.38, 0.5); s.m = 2; }
      else if (mo === 'scallop') { s.k = 'scal'; s.r = r0 + h * 0.1; s.hh = h * rr(rng, 0.5, 0.85); s.m = rng() < 0.6 ? 2 : 1; s.lw = 0.004; }
      else { s.k = 'zig'; s.r = r0 + h * 0.2; s.hh = h * 0.6; s.lw = rr(rng, 0.003, 0.007); }
      out.push(s);
      // extra kleine stippen tussen de motieven bij hogere complexiteit
      if (c > 4 && rng() < 0.5) out.push({ k: 'mdots', sh: 0, r: r1, h: h * 0.4, d: base.d * 2, sz: 0.3, c: colI(rng), c2: col, al: 1, m: 0, ph: rng() * TAU, w: 0.5, lw: 0.002 });
    }
    return out;
  };

  gen.organisch = function (rng, c, n) {
    var out = [], i, j;
    out.push(anim(rng, { k: 'band', r0: 0, r1: 1.1, c: colI(rng), al: 0.3 }, 0));
    var big = 3 + Math.round(c / 2);
    for (i = 0; i < big; i++) {
      var rb = rr(rng, 0, 1), rs = [];
      for (j = 0; j < 7; j++) rs.push(rr(rng, 0.65, 1.3));
      out.push(anim(rng, { k: 'blob', r: rb, a: rng(), s: rr(rng, 0.3, 0.55) * (0.6 + rb * 0.6), rs: rs, c: colI(rng), c2: colI(rng), rot: rng() * TAU,
        al: rr(rng, 0.45, 0.75), m: 0, lw: 0.003 }, 1));
    }
    for (i = 0; i < n; i++) {
      var r = rPos(rng), k = ri(rng, 5, 8), rs2 = [];
      for (j = 0; j < k; j++) rs2.push(rr(rng, 0.6, 1.35));
      out.push(anim(rng, { k: 'blob', r: r, a: rng(), s: rr(rng, 0.05, 0.14) * (0.6 + r) * (1.25 - c * 0.04), rs: rs2, c: colI(rng), c2: colI(rng), rot: rng() * TAU,
        al: rr(rng, 0.7, 0.95), m: rng() < 0.35 ? 2 : (rng() < 0.15 ? 1 : 0), lw: rr(rng, 0.002, 0.006), nucleus: rng() < 0.4 ? colI(rng) : -1 }, 1.2));
    }
    return out;
  };

  gen.lijnenspel = function (rng, c, n) {
    var out = [], i;
    // zachte waaiers als ondergrond
    var nf = 3 + Math.round(c / 3);
    for (i = 0; i < nf; i++) {
      var a0 = rr(rng, -0.1, 0.9), r1 = rr(rng, 0.5, 1.1);
      out.push({ k: 'pp', pts: [0, 0.5, r1, a0, rr(rng, 0.5, 1.1), a0 + rr(rng, 0.15, 0.5)], c: colI(rng), m: 0, al: rr(rng, 0.25, 0.5), lw: 0.002, ph: rng() * TAU, w: 0.3, fl: 0 });
    }
    var nArc = Math.round(n * 0.25), nSp = Math.max(2, Math.round(n * 0.15)), nRay = Math.round(n * 0.35), nWeb = n - nArc - nSp - nRay;
    for (i = 0; i < nArc; i++) {
      var ar0 = rng();
      out.push(anim(rng, { k: 'arcl', r: rr(rng, 0.05, 1.02), a0: ar0 < 0.5 ? -0.1 : rr(rng, 0, 0.6), a1: ar0 < 0.5 ? 1.1 : rr(rng, 0.6, 1.1), c: colI(rng), al: rr(rng, 0.6, 1), lw: rr(rng, 0.002, 0.01), q: rng() * 0.6 }, 0.6));
    }
    for (i = 0; i < nSp; i++) {
      out.push(anim(rng, { k: 'spir', r0: rr(rng, 0, 0.2), r1: rr(rng, 0.8, 1.1), a0: rng(), turns: rr(rng, 0.6, 2.5) * (rng() < 0.5 ? -1 : 1), c: colI(rng), al: 0.9, lw: rr(rng, 0.003, 0.01) }, 0.7));
    }
    for (i = 0; i < nRay; i++) {
      var ra = rng(), rs = rr(rng, 0, 0.6);
      out.push(anim(rng, { k: 'ray', r0: rs, a0: ra, r1: Math.min(1.1, rs + rr(rng, 0.2, 0.9)), a1: ra + rr(rng, -0.3, 0.3), c: colI(rng), al: rr(rng, 0.6, 1), lw: rr(rng, 0.002, 0.006), q: rng() }, 0.7));
    }
    for (i = 0; i < nWeb; i++) {
      var p = rPos(rng), q = Math.min(1.08, p + rr(rng, -0.3, 0.3));
      out.push(anim(rng, { k: 'ray', r0: p, a0: rr(rng, -0.05, 1.05), r1: Math.max(0, q), a1: rr(rng, -0.05, 1.05), c: colI(rng), al: rr(rng, 0.4, 0.8), lw: rr(rng, 0.0015, 0.0035), dot: rng() < 0.5, q: rng() }, 0.7));
    }
    return out;
  };

  function generate(rng, styleId, complexity) {
    var c = clampC(complexity);
    var g = gen[styleId] || gen.geometrisch;
    return g(rng, c, shapeCount(c));
  }

  /* ---------- tekenen ---------- */
  var LIGHT = 'lighter', lastBg = '', KEEP = 1, W = 1, R = 1, T = 0, U = 1, P = null, NC = 1, X = 0, Y = 0;
  var colors = null;

  function lum(hex) {
    var h = String(hex || '#000').replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var v = parseInt(h.slice(0, 6), 16);
    if (isNaN(v)) return 0;
    return (0.2126 * (v >> 16 & 255) + 0.7152 * (v >> 8 & 255) + 0.0722 * (v & 255)) / 255;
  }
  function col(i) { return colors[((i % NC) + NC) % NC]; }
  function pol(r, a) { var q = a * W, rp = r * R; X = rp * cos(q); Y = rp * sin(q); }
  // vloeiende, continue vervorming voor mozaïeken: geen naden ontstaan
  function warp(r, a) {
    var k = r < 0.25 ? r * 4 : 1;
    var r2 = r + k * 0.018 * sin(T * 0.37 + a * 5.3 + r * 7.1);
    var a2 = a + k * 0.03 * sin(T * 0.29 + r * 8.3 + 1.7);
    pol(r2, a2);
  }

  function paint(ctx, s, lw) {
    if (s.m !== 1) { ctx.fillStyle = col(s.c); ctx.fill(); }
    if (s.m === 1 || s.m === 2) {
      ctx.strokeStyle = s.m === 2 ? (s.c2 != null && s.k !== 'pp' && s.k !== 'shard' ? col(s.c2) : P.line) : col(s.c);
      ctx.lineWidth = lw; ctx.stroke();
    }
  }

  function drawShape(ctx, s) {
    // lijnen dunnen uit bij smalle wiggen (anders wordt het na spiegelen een warboel)
    if (s.q !== undefined && s.q > KEEP) return;
    ctx.globalAlpha = s.al == null ? 1 : s.al;
    ctx.globalCompositeOperation = s.l ? LIGHT : 'source-over';
    var lw = (s.lw || 0.003) * R, i, n, osc, r, a, pulse, size, ang, ca, sa, x, y, lx, ly, q;
    switch (s.k) {
      case 'band': {
        osc = sin(T * s.w + s.ph);
        var r0 = Math.max(0, s.r0 + (s.r0 > 0 ? s.dr * osc : 0)) * R, r1 = (s.r1 + s.dr * osc) * R;
        ctx.beginPath();
        ctx.arc(0, 0, r1, -0.2 * W, 1.2 * W, false);
        if (r0 > 0.5) ctx.arc(0, 0, r0, 1.2 * W, -0.2 * W, true); else ctx.lineTo(0, 0);
        ctx.closePath();
        ctx.fillStyle = col(s.c); ctx.fill();
        return;
      }
      case 'arcl': {
        osc = s.w ? sin(T * s.w + s.ph) : 0;
        r = (s.r + (s.dr || 0) * osc) * R;
        var aa0 = s.a0 == null ? -0.2 : s.a0 + (s.da || 0) * osc, aa1 = s.a1 == null ? 1.2 : s.a1 - (s.da || 0) * osc;
        ctx.beginPath(); ctx.arc(0, 0, r, aa0 * W, aa1 * W, false);
        ctx.strokeStyle = col(s.c); ctx.lineWidth = lw; ctx.stroke();
        return;
      }
      case 'pp': {
        var pts = s.pts;
        ctx.beginPath();
        if (s.nw) {
          pulse = 1 + 0.04 * sin(T * s.w + s.ph);
          pol(pts[0] * pulse, pts[1]); ctx.moveTo(X, Y);
          for (i = 2; i < pts.length; i += 2) { pol(pts[i] * pulse, pts[i + 1]); ctx.lineTo(X, Y); }
        } else {
          warp(pts[0], pts[1]); ctx.moveTo(X, Y);
          for (i = 2; i < pts.length; i += 2) { warp(pts[i], pts[i + 1]); ctx.lineTo(X, Y); }
        }
        ctx.closePath();
        if (s.fl) ctx.globalAlpha = s.al * (1 - s.fl + s.fl * (0.5 + 0.5 * sin(T * s.w + s.ph)));
        paint(ctx, s, lw);
        return;
      }
      case 'ray': {
        osc = sin(T * s.w + s.ph);
        pol(s.r0 + s.dr * osc, s.a0 + s.da * osc);
        var x0 = X, y0 = Y;
        pol(s.r1 - s.dr * osc, s.a1 - s.da * sin(T * s.w * 0.7 + s.ph));
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(X, Y);
        ctx.strokeStyle = col(s.c); ctx.lineWidth = lw; ctx.stroke();
        if (s.dot) { ctx.beginPath(); ctx.arc(X, Y, lw * 2.2, 0, TAU); ctx.fillStyle = col(s.c); ctx.fill(); }
        return;
      }
      case 'spir': {
        osc = sin(T * s.w + s.ph);
        var m = 32, tw = s.turns + s.da * 4 * osc;
        ctx.beginPath();
        for (i = 0; i <= m; i++) {
          var f = i / m;
          pol(s.r0 + (s.r1 - s.r0) * f, s.a0 + tw * f);
          if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
        }
        ctx.strokeStyle = col(s.c); ctx.lineWidth = lw; ctx.stroke();
        return;
      }
      case 'mdots': case 'scal': case 'zig':
        drawRing(ctx, s, lw);
        return;
    }

    // lokale vormen rond een positie
    osc = sin(T * s.w + s.ph);
    r = s.r + s.dr * osc;
    a = s.a + s.da * sin(T * s.w * 0.8 + s.ph * 1.3);
    if (r < 0) r = 0;
    pulse = 1 + s.pu * sin(T * s.w * 1.7 + s.ph * 0.7);
    size = s.s * (s.abs ? R : U) * pulse;
    pol(r, a); x = X; y = Y;
    ang = a * W + s.rot + (s.abs ? 0 : s.sp * T);
    if (s.abs) ang = a * W + s.sp * 0.3 * sin(T * 0.4 + s.ph);
    ca = cos(ang); sa = sin(ang);

    switch (s.k) {
      case 'circ':
        ctx.beginPath(); ctx.arc(x, y, size, 0, TAU);
        paint(ctx, s, lw);
        if (s.abs) { // centrumschijf met binnenring
          ctx.beginPath(); ctx.arc(x, y, size * 0.55, 0, TAU);
          ctx.fillStyle = col(s.c2); ctx.fill();
        }
        return;
      case 'poly': {
        n = s.si ? s.n * 2 : s.n;
        ctx.beginPath();
        for (i = 0; i < n; i++) {
          q = i * TAU / n;
          var rad = (s.si && (i & 1)) ? size * s.si : size;
          lx = cos(q) * rad; ly = sin(q) * rad * s.asp;
          if (i) ctx.lineTo(x + lx * ca - ly * sa, y + lx * sa + ly * ca);
          else ctx.moveTo(x + lx * ca - ly * sa, y + lx * sa + ly * ca);
        }
        ctx.closePath();
        paint(ctx, s, lw);
        return;
      }
      case 'shard': {
        var L = size, w = size * s.asp;
        var SH = [1, 0, 0.3, 1, -0.5, 0.8, -0.85, 0, -0.5, -0.8, 0.3, -1];
        ctx.beginPath();
        for (i = 0; i < 12; i += 2) {
          lx = SH[i] * L; ly = SH[i + 1] * w;
          if (i) ctx.lineTo(x + lx * ca - ly * sa, y + lx * sa + ly * ca);
          else ctx.moveTo(x + lx * ca - ly * sa, y + lx * sa + ly * ca);
        }
        ctx.closePath();
        ctx.fillStyle = col(s.c); ctx.fill();
        if (s.m === 2) {
          // facetlijn over de lengte
          ctx.moveTo(x + L * ca, y + L * sa);
          ctx.lineTo(x - 0.85 * L * ca, y - 0.85 * L * sa);
          ctx.strokeStyle = col(s.c + 1); ctx.lineWidth = lw; ctx.stroke();
        }
        return;
      }
      case 'petal':
        petalPath(ctx, x, y, ca, sa, size, size * s.asp);
        paint(ctx, s, lw);
        if (s.abs) { // binnenblad
          petalPath(ctx, x, y, ca, sa, size * 0.6, size * s.asp * 0.5);
          ctx.fillStyle = col(s.c2); ctx.fill();
        }
        return;
      case 'ros': {
        n = s.n;
        ctx.beginPath();
        for (i = 0; i < n; i++) {
          q = ang + i * TAU / n;
          petalSub(ctx, x, y, cos(q), sin(q), size, size * 0.42);
        }
        paint(ctx, s, lw);
        ctx.beginPath();
        for (i = 0; i < n; i++) {
          q = ang + (i + 0.5) * TAU / n;
          petalSub(ctx, x, y, cos(q), sin(q), size * 0.62, size * 0.28);
        }
        ctx.fillStyle = col(s.c2); ctx.fill();
        ctx.beginPath(); ctx.arc(x, y, size * 0.2, 0, TAU);
        ctx.fillStyle = col(s.c3); ctx.fill();
        return;
      }
      case 'curl': {
        var M = 18, tt = s.turns * TAU * s.dir;
        ctx.beginPath();
        for (i = 0; i <= M; i++) {
          var f2 = i / M, qq = ang + tt * f2, rad2 = size * (1 - f2 * 0.88);
          // de krul start met een uitloper vanaf het middelpunt
          lx = x + cos(qq) * rad2 - ca * size; ly = y + sin(qq) * rad2 - sa * size;
          if (i) ctx.lineTo(lx, ly); else ctx.moveTo(x - ca * size * 2, y - sa * size * 2), ctx.lineTo(lx, ly);
        }
        ctx.strokeStyle = col(s.c); ctx.lineWidth = lw; ctx.stroke();
        return;
      }
      case 'blob': {
        var rs = s.rs, k = rs.length, px = [], py = [];
        for (i = 0; i < k; i++) {
          q = ang + i * TAU / k;
          var rb = size * rs[i] * (1 + 0.12 * sin(T * s.w * 1.3 + i * 1.7 + s.ph));
          px.push(x + cos(q) * rb); py.push(y + sin(q) * rb);
        }
        ctx.beginPath();
        ctx.moveTo((px[k - 1] + px[0]) / 2, (py[k - 1] + py[0]) / 2);
        for (i = 0; i < k; i++) {
          var nx = (i + 1) % k;
          ctx.quadraticCurveTo(px[i], py[i], (px[i] + px[nx]) / 2, (py[i] + py[nx]) / 2);
        }
        ctx.closePath();
        paint(ctx, s, lw);
        if (s.nucleus >= 0) {
          ctx.beginPath(); ctx.arc(x + ca * size * 0.15, y + sa * size * 0.15, size * 0.3, 0, TAU);
          ctx.fillStyle = col(s.nucleus); ctx.fill();
        }
        return;
      }
    }
  }

  function petalSub(ctx, x, y, ca, sa, L, w) {
    var mx = x + ca * L * 0.5, my = y + sa * L * 0.5;
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(mx - sa * w * 1.6, my + ca * w * 1.6, x + ca * L, y + sa * L);
    ctx.quadraticCurveTo(mx + sa * w * 1.6, my - ca * w * 1.6, x, y);
  }
  function petalPath(ctx, x, y, ca, sa, L, w) { ctx.beginPath(); petalSub(ctx, x, y, ca, sa, L, w); ctx.closePath(); }

  // ringmotieven (mandala): aantal herhalingen past zich aan de wigbreedte aan,
  // met elementen precies op a=0 en a=1 zodat de spiegelnaden naadloos zijn.
  function drawRing(ctx, s, lw) {
    var osc = sin(T * s.w + s.ph), i, a, n;
    var r = s.r, h = s.h;
    n = Math.max(1, Math.round(r * W * s.d));
    var arc = r * W * R / n; // booglengte per element in px
    if (s.k === 'mdots') {
      var sz = Math.min(arc * 0.5, h * R * 0.5) * s.sz / 0.5 * (1 + 0.1 * osc);
      ctx.beginPath();
      for (i = 0; i <= n; i++) {
        a = i / n; pol(r, a);
        var x = X, y = Y, q = a * W, ca = cos(q), sa = sin(q);
        if (s.sh === 0 || s.sh === 1) { ctx.moveTo(x + sz, y); ctx.arc(x, y, sz, 0, TAU); }
        else if (s.sh === 2) {
          var L = sz * 1.5, w = sz * 0.8;
          ctx.moveTo(x + ca * L, y + sa * L); ctx.lineTo(x - sa * w, y + ca * w);
          ctx.lineTo(x - ca * L, y - sa * L); ctx.lineTo(x + sa * w, y - ca * w); ctx.closePath();
        } else {
          var L2 = h * R * 0.9;
          petalSub(ctx, x - ca * L2 * 0.45, y - sa * L2 * 0.45, ca, sa, L2, sz * 0.6);
        }
      }
      paint(ctx, s, lw);
      if (s.sh === 0 && s.m === 2) { // kern in de stippen
        ctx.beginPath();
        for (i = 0; i <= n; i++) { pol(r, i / n); ctx.moveTo(X + sz * 0.4, Y); ctx.arc(X, Y, sz * 0.4, 0, TAU); }
        ctx.fillStyle = col(s.c2); ctx.fill();
      }
    } else if (s.k === 'scal') {
      var hh = s.hh * (1 + 0.08 * osc);
      ctx.beginPath();
      pol(r, -1 / n); ctx.moveTo(X, Y);
      for (i = -1; i <= n; i++) {
        var am = (i + 0.5) / n, a1 = (i + 1) / n;
        pol(r + hh * 2, am); var cx = X, cy = Y;
        pol(r, a1); ctx.quadraticCurveTo(cx, cy, X, Y);
      }
      if (s.m !== 1) { pol(r, (n + 1) / n); ctx.arc(0, 0, r * R, (n + 1) / n * W, -1 / n * W, true); ctx.closePath(); }
      paint(ctx, s, lw);
    } else {
      var h2 = s.hh;
      ctx.beginPath();
      for (i = -1; i <= 2 * n + 1; i++) {
        a = i / (2 * n);
        pol(r + ((i & 1) ? h2 * (0.8 + 0.2 * osc) : 0), a);
        if (i > -1) ctx.lineTo(X, Y); else ctx.moveTo(X, Y);
      }
      ctx.strokeStyle = col(s.c); ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.stroke();
    }
  }

  function draw(ctx, shapes, palette, t, R_, wedge) {
    if (!shapes || !shapes.length || !palette || !palette.colors || !palette.colors.length) return;
    W = wedge; R = R_; T = t || 0; P = palette; colors = palette.colors; NC = colors.length;
    // vormgrootte schaalt mee met de wigbreedte (2π/32 .. 2π/4)
    U = R * Math.min(1.1, 0.12 + wedge * 0.6);
    KEEP = Math.min(1, 0.25 + wedge * 0.7);
    // 'lighter' alleen op donkere achtergronden; op lichte (bv. pastel) zou het tot wit uitbijten
    if (palette.background !== lastBg) { lastBg = palette.background; LIGHT = lum(lastBg) > 0.45 ? 'multiply' : 'lighter'; }
    ctx.save();
    ctx.lineJoin = 'round';
    for (var i = 0; i < shapes.length; i++) drawShape(ctx, shapes[i]);
    ctx.restore();
  }

  window.KShapes = { styles: styles, generate: generate, draw: draw };
})();
