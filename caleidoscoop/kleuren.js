/* kleuren.js — kleurpaletten voor de caleidoscoopgenerator.
 * Zet window.KColors (zie CONTRACT.md). Werkt intern in OKLCH (perceptueel gelijkmatig),
 * output altijd '#rrggbb'. Gebruikt uitsluitend de meegegeven rng().
 */
(function () {
  'use strict';

  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;

  /* ---------- snelle conversie OKLCH -> hex ---------- */

  // Opzoektabel lineair licht -> sRGB-byte (vermijdt Math.pow per frame).
  var LUT_N = 8192;
  var LUT = new Uint8Array(LUT_N + 1);
  for (var i = 0; i <= LUT_N; i++) {
    var v = i / LUT_N;
    var s = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
    LUT[i] = Math.max(0, Math.min(255, Math.round(s * 255)));
  }
  var HEX2 = new Array(256);
  for (i = 0; i < 256; i++) HEX2[i] = (i < 16 ? '0' : '') + i.toString(16);

  function enc(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 255;
    return LUT[(x * LUT_N + 0.5) | 0];
  }

  // OKLCH -> lineaire sRGB; schrijft in out[0..2].
  var tmp = [0, 0, 0];
  function lchToLinear(L, C, H, out) {
    var h = H * DEG;
    var a = C * Math.cos(h), b = C * Math.sin(h);
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    var l = l_ * l_ * l_, m = m_ * m_ * m_, ss = s_ * s_ * s_;
    out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * ss;
    out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * ss;
    out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * ss;
    return out;
  }

  function lchToHex(L, C, H) {
    lchToLinear(L, C, H, tmp);
    return '#' + HEX2[enc(tmp[0])] + HEX2[enc(tmp[1])] + HEX2[enc(tmp[2])];
  }

  function inGamut(L, C, H) {
    lchToLinear(L, C, H, tmp);
    var e = 0.0005;
    return tmp[0] >= -e && tmp[0] <= 1 + e && tmp[1] >= -e && tmp[1] <= 1 + e &&
      tmp[2] >= -e && tmp[2] <= 1 + e;
  }

  // Verlaag chroma (behoud L en H) tot de kleur binnen sRGB valt.
  function fitChroma(L, C, H) {
    if (inGamut(L, C, H)) return C;
    var lo = 0, hi = C;
    for (var k = 0; k < 16; k++) {
      var mid = (lo + hi) / 2;
      if (inGamut(L, mid, H)) lo = mid; else hi = mid;
    }
    return lo;
  }

  /* ---------- helpers ---------- */

  function wrap(h) { h %= 360; return h < 0 ? h + 360 : h; }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function range(rng, a, b) { return a + (b - a) * rng(); }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }

  function shuffle(rng, arr) {
    for (var j = arr.length - 1; j > 0; j--) {
      var k = Math.floor(rng() * (j + 1));
      var t = arr[j]; arr[j] = arr[k]; arr[k] = t;
    }
    return arr;
  }

  // Gelijkmatig gespreide helderheden (geschud) zodat kleuren onderling goed contrasteren.
  function spreadL(rng, n, lo, hi) {
    var out = [];
    for (var j = 0; j < n; j++) {
      var t = n === 1 ? 0.5 : j / (n - 1);
      var jitter = n > 1 ? (rng() - 0.5) * (hi - lo) / (n - 1) * 0.35 : 0;
      out.push(clamp(lerp(lo, hi, t) + jitter, 0, 1));
    }
    return shuffle(rng, out);
  }

  // Kies tinten uit een lijst offsets (cyclisch), met kleine variatie.
  function hueSet(rng, base, offsets, n, jitter) {
    var out = [];
    for (var j = 0; j < n; j++) {
      out.push(wrap(base + offsets[j % offsets.length] + (rng() - 0.5) * 2 * jitter));
    }
    return out;
  }

  /* ---------- modi ---------- */
  // Elke modus levert ruwe {bg:[L,C,H], line:[L,C,H], cols:[[L,C,H],...]}; gamut-mapping volgt daarna.

  // Donkere geeltinten worden olijf/modder: geef geel-achtige tinten de hoogste helderheden.
  function liftYellows(hues, Ls) {
    var idx = [], j;
    for (j = 0; j < hues.length; j++) {
      var d = Math.abs(((hues[j] - 95) % 360 + 540) % 360 - 180);
      if (d < 35) idx.push(j);
    }
    if (!idx.length) return;
    var sorted = Ls.slice().sort(function (a, b) { return b - a; });
    for (var k = 0; k < idx.length; k++) {
      var want = sorted[k], at = Ls.indexOf(want), y = idx[k];
      var tmpL = Ls[y]; Ls[y] = want; Ls[at] = tmpL;
    }
  }

  function standard(rng, n, hues, Llo, Lhi, Clo, Chi, bgHue) {
    var Ls = spreadL(rng, n, Llo, Lhi);
    var cols = [];
    liftYellows(hues, Ls);
    for (var j = 0; j < n; j++) cols.push([Ls[j], range(rng, Clo, Chi), hues[j]]);
    return {
      bg: [range(rng, 0.14, 0.19), range(rng, 0.015, 0.035), bgHue],
      line: [0.95, 0.02, bgHue],
      cols: cols
    };
  }

  var MODES = [
    {
      id: 'analoog', name: 'Analoog',
      make: function (rng, n) {
        var base = rng() * 360, width = range(rng, 50, 80), hues = [];
        for (var j = 0; j < n; j++) hues.push(wrap(base - width / 2 + width * (n === 1 ? 0.5 : j / (n - 1))));
        shuffle(rng, hues);
        return standard(rng, n, hues, 0.5, 0.9, 0.11, 0.17, base);
      }
    },
    {
      id: 'complementair', name: 'Complementair',
      make: function (rng, n) {
        var base = rng() * 360;
        var p = standard(rng, n, hueSet(rng, base, [0, 180], n, 12), 0.48, 0.9, 0.11, 0.18, base);
        p.line = [0.96, 0.015, base];
        return p;
      }
    },
    {
      id: 'triadisch', name: 'Triadisch',
      make: function (rng, n) {
        var base = rng() * 360;
        return standard(rng, n, hueSet(rng, base, [0, 120, 240], n, 10), 0.52, 0.88, 0.11, 0.16, base + 60);
      }
    },
    {
      id: 'tetradisch', name: 'Tetradisch',
      make: function (rng, n) {
        var base = rng() * 360;
        return standard(rng, n, hueSet(rng, base, [0, 90, 180, 270], n, 8), 0.52, 0.88, 0.1, 0.16, base + 45);
      }
    },
    {
      id: 'splitcomplementair', name: 'Split-complementair',
      make: function (rng, n) {
        var base = rng() * 360;
        return standard(rng, n, hueSet(rng, base, [0, 150, 210], n, 8), 0.5, 0.9, 0.11, 0.17, base + 180);
      }
    },
    {
      id: 'monochroom', name: 'Monochroom',
      make: function (rng, n) {
        var base = rng() * 360;
        var Ls = spreadL(rng, n, 0.46, 0.95), cols = [];
        for (var j = 0; j < n; j++) {
          // Lichtere tinten minder verzadigd, middentonen het meest.
          var c = 0.17 * (1 - Math.abs(Ls[j] - 0.62) * 1.6);
          cols.push([Ls[j], clamp(c, 0.03, 0.17), wrap(base + (rng() - 0.5) * 12)]);
        }
        return { bg: [0.13, 0.03, base], line: [0.97, 0.02, base], cols: cols };
      }
    },
    {
      id: 'pastel', name: 'Pastel',
      make: function (rng, n) {
        var base = rng() * 360, dark = rng() < 0.35, cols = [];
        var Ls = dark ? spreadL(rng, n, 0.72, 0.88) : spreadL(rng, n, 0.5, 0.74);
        for (var j = 0; j < n; j++) {
          cols.push([Ls[j], range(rng, 0.08, 0.12) + (dark ? -0.015 : 0.02), wrap(base + j * 137.508 + (rng() - 0.5) * 10)]);
        }
        return dark
          ? { bg: [0.24, 0.02, base], line: [0.97, 0.01, base], cols: cols }       // gedempt donker
          : { bg: [0.965, 0.012, base + 40], line: [0.3, 0.05, base], cols: cols }; // licht, crème (kleuren dieper, als waterverf op papier)
      }
    },
    {
      id: 'neon', name: 'Neon',
      make: function (rng, n) {
        var base = rng() * 360, step = 360 / Math.max(n, 3), cols = [];
        var Ls = spreadL(rng, n, 0.68, 0.9);
        for (var j = 0; j < n; j++) cols.push([Ls[j], 0.32, wrap(base + j * step + (rng() - 0.5) * 14)]);
        shuffle(rng, cols);
        return { bg: [0.09, 0.02, base + 270], line: [0.98, 0.01, base], cols: cols };
      }
    },
    {
      id: 'herfst', name: 'Aarde & herfst',
      make: function (rng, n) {
        // Vaste ankers [L, C, H]: baksteen, roest, oker, goud, mos, dennengroen, crème, pruim.
        var anchors = shuffle(rng, [
          [0.5, 0.14, 28], [0.62, 0.14, 45], [0.74, 0.13, 68], [0.85, 0.13, 88],
          [0.58, 0.09, 125], [0.47, 0.06, 165], [0.93, 0.04, 85], [0.45, 0.08, 350]
        ]);
        var cols = [];
        for (var j = 0; j < n; j++) {
          var a = anchors[j % anchors.length], rep = Math.floor(j / anchors.length);
          cols.push([clamp(a[0] + (rng() - 0.5) * 0.06 + (rep % 2 ? 0.1 : 0) * (a[0] < 0.7 ? 1 : -1), 0, 1),
            a[1] * range(rng, 0.85, 1.1), a[2] + (rng() - 0.5) * 12]);
        }
        return { bg: [0.17, 0.025, 55], line: [0.93, 0.03, 80], cols: cols };
      }
    },
    {
      id: 'glasinlood', name: 'Glas-in-lood',
      make: function (rng, n) {
        // Diepe edelsteentinten (robijn, saffier, smaragd, amber, amethist) met donkere loodlijnen.
        var base = rng() * 360, step = 360 / Math.max(n, 4), cols = [];
        var Ls = spreadL(rng, n, 0.42, 0.72);
        for (var j = 0; j < n; j++) cols.push([Ls[j], 0.26, wrap(base + j * step + (rng() - 0.5) * 16)]);
        shuffle(rng, cols);
        return { bg: [0.26, 0.012, base], line: [0.1, 0.004, base], cols: cols };
      }
    },
    {
      id: 'oceaan', name: 'Oceaan',
      make: function (rng, n) {
        var Ls = spreadL(rng, n, 0.47, 0.92), cols = [];
        for (var j = 0; j < n; j++) {
          // Licht = schuim/turquoise, donker = diepblauw.
          var h = lerp(255, 180, (Ls[j] - 0.47) / 0.45) + (rng() - 0.5) * 20;
          cols.push([Ls[j], range(rng, 0.07, 0.14), h]);
        }
        return { bg: [0.16, 0.045, 250], line: [0.95, 0.04, 190], cols: cols };
      }
    },
    {
      id: 'zonsondergang', name: 'Zonsondergang',
      make: function (rng, n) {
        var Ls = spreadL(rng, n, 0.5, 0.9), cols = [];
        for (var j = 0; j < n; j++) {
          // Donker = paars/magenta, licht = oranje/goud.
          var h = lerp(330, 430, (Ls[j] - 0.5) / 0.4) + (rng() - 0.5) * 16;
          cols.push([Ls[j], range(rng, 0.12, 0.19), wrap(h)]);
        }
        return { bg: [0.15, 0.04, 300], line: [0.96, 0.03, 70], cols: cols };
      }
    },
    {
      id: 'regenboog', name: 'Regenboog',
      make: function (rng, n) {
        var base = rng() * 360, cols = [];
        var Ls = spreadL(rng, n, 0.6, 0.85);
        for (var j = 0; j < n; j++) cols.push([Ls[j], 0.16, wrap(base + j * 360 / n)]);
        return { bg: [0.15, 0.01, base], line: [0.97, 0.0, base], cols: cols };
      }
    }
  ];

  var BY_ID = {};
  for (i = 0; i < MODES.length; i++) BY_ID[MODES[i].id] = MODES[i];

  /* ---------- paletobject ---------- */

  // lch: Float64Array [L,C,H]*(2+n): achtergrond, lijn, kleuren. Niet-opsombaar opgeslagen.
  function build(lch, n) {
    var colors = new Array(n);
    for (var j = 0; j < n; j++) {
      var o = 6 + j * 3;
      colors[j] = lchToHex(lch[o], lch[o + 1], lch[o + 2]);
    }
    var p = {
      background: lchToHex(lch[0], lch[1], lch[2]),
      colors: colors,
      line: lchToHex(lch[3], lch[4], lch[5])
    };
    Object.defineProperty(p, '_lch', { value: lch, enumerable: false, writable: false });
    return p;
  }

  function generate(rng, modeId, count) {
    var n = count == null ? 6 : Math.max(1, Math.floor(count));
    var mode = BY_ID[modeId] || MODES[0];
    var raw = mode.make(rng, n);
    var all = [raw.bg, raw.line].concat(raw.cols);
    var lch = new Float64Array(all.length * 3);
    for (var j = 0; j < all.length; j++) {
      var L = clamp(all[j][0], 0, 1), H = wrap(all[j][2]);
      var C = fitChroma(L, Math.max(0, all[j][1]), H);
      lch[j * 3] = L; lch[j * 3 + 1] = C; lch[j * 3 + 2] = H;
    }
    return build(lch, n);
  }

  // Geeft lch-cache van een palet terug; parseert hex alleen als fallback (bv. zelfgemaakt palet).
  function lchOf(p) {
    if (p._lch) return p._lch;
    var list = [p.background, p.line].concat(p.colors || []);
    var lch = new Float64Array(list.length * 3);
    for (var j = 0; j < list.length; j++) hexToLch(list[j], lch, j * 3);
    try { Object.defineProperty(p, '_lch', { value: lch, enumerable: false }); } catch (e) { /* bevroren object */ }
    return lch;
  }

  function hexToLch(hex, out, o) {
    var x = parseInt(String(hex || '#000000').replace('#', ''), 16) || 0;
    var rgb = [(x >> 16) & 255, (x >> 8) & 255, x & 255];
    for (var k = 0; k < 3; k++) {
      var c = rgb[k] / 255;
      rgb[k] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }
    var l = Math.cbrt(0.4122214708 * rgb[0] + 0.5363325363 * rgb[1] + 0.0514459929 * rgb[2]);
    var m = Math.cbrt(0.2119034982 * rgb[0] + 0.6806995451 * rgb[1] + 0.1073969566 * rgb[2]);
    var s = Math.cbrt(0.0883024619 * rgb[0] + 0.2817188376 * rgb[1] + 0.6299787005 * rgb[2]);
    var L = 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s;
    var a = 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s;
    var b = 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s;
    out[o] = L; out[o + 1] = Math.sqrt(a * a + b * b); out[o + 2] = wrap(Math.atan2(b, a) / DEG);
  }

  function shift(palette, degrees) {
    var src = lchOf(palette);
    var d = +degrees || 0;
    var len = src.length, lch = new Float64Array(len);
    for (var j = 0; j < len; j += 3) {
      lch[j] = src[j];
      lch[j + 1] = src[j + 1];
      lch[j + 2] = wrap(src[j + 2] + d);
    }
    // Buiten-gamut tinten worden in lchToHex per kanaal geknipt (snel, visueel prima).
    return build(lch, len / 3 - 2);
  }

  window.KColors = {
    modes: MODES.map(function (m) { return { id: m.id, name: m.name }; }),
    generate: generate,
    shift: shift
  };
})();
