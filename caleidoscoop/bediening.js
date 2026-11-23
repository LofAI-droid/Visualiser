/* bediening.js — Beweging & Bediening voor de caleidoscoopgenerator.
 * Zet alleen window.KControls. Klassiek script, geen libraries.
 * KControls.init(app, panelEl) bouwt het paneel, sneltoetsen, muis/touch, URL-hash en volledig scherm.
 */
(function () {
  'use strict';

  // ---------- grenzen & helpers ----------
  var LIM = {
    segments: [4, 32], complexity: [1, 10], speed: [0, 3], spin: [-1, 1],
    hueDrift: [0, 1], zoom: [0.5, 3], offsetX: [-1, 1], offsetY: [-1, 1]
  };
  var MAX_SEED = 4294967295;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function lim(key, v) { return clamp(v, LIM[key][0], LIM[key][1]); }
  function evenSeg(v) { v = Math.round(lim('segments', v)); return v % 2 ? Math.min(32, v + 1) : v; }
  function round(v, d) { var m = Math.pow(10, d); return Math.round(v * m) / m; }
  function num(s) { if (s == null || s === '') return NaN; return Number(s); }
  function el(tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else e.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  var uid = 0;
  function nid(p) { uid += 1; return 'kc-' + p + '-' + uid; }

  // ---------- CSS ----------
  var CSS = [
    ':root{--kc-bg:var(--bg,#0c0d0f);--kc-panel:var(--panel,#151719);--kc-panel2:var(--panel2,#1c1e21);',
    '--kc-edge:var(--edge,#303338);--kc-muted:var(--muted,#888d94);--kc-soft:var(--soft,#babdc3);',
    '--kc-text:var(--text,#f4f2ec);--kc-hi:var(--hi,#d6e3db)}',
    '.kc-paneel{box-sizing:border-box;background:var(--kc-panel);color:var(--kc-text);',
    'font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:18px 18px 14px;',
    'overflow-y:auto;overscroll-behavior:contain;display:flex;flex-direction:column;gap:18px;-webkit-font-smoothing:antialiased}',
    '.kc-paneel *,.kc-paneel *::before,.kc-paneel *::after{box-sizing:border-box}',
    '.kc-paneel[hidden]{display:none!important}',
    '.kc-kop{display:flex;align-items:center;justify-content:space-between;gap:8px}',
    '.kc-titel{margin:0;font-size:15px;font-weight:600;letter-spacing:.02em;color:var(--kc-text)}',
    '.kc-kopknoppen{display:flex;gap:6px}',
    '.kc-rond{width:28px;height:28px;border-radius:50%;border:1px solid var(--kc-edge);background:transparent;',
    'color:var(--kc-soft);font:600 13px/1 inherit;font-family:inherit;cursor:pointer;display:grid;place-items:center;padding:0}',
    '.kc-rond:hover{color:var(--kc-text);border-color:var(--kc-muted)}',
    '.kc-groep{display:flex;flex-direction:column;gap:12px;padding-top:14px;border-top:1px solid var(--kc-edge)}',
    '.kc-label{margin:0;font-size:10.5px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--kc-muted)}',
    '.kc-veld{display:flex;flex-direction:column;gap:6px}',
    '.kc-rij{display:flex;justify-content:space-between;align-items:baseline;gap:8px}',
    '.kc-naam{font-size:12px;color:var(--kc-soft)}',
    '.kc-waarde{font-size:12px;color:var(--kc-text);font-variant-numeric:tabular-nums;min-width:3.5em;text-align:right}',
    '.kc-chips{display:flex;flex-wrap:wrap;gap:5px}',
    '.kc-chip{border:1px solid var(--kc-edge);background:var(--kc-panel2);color:var(--kc-soft);border-radius:999px;',
    'padding:4px 10px;font:12px/1.3 inherit;font-family:inherit;cursor:pointer;transition:background .12s,color .12s,border-color .12s}',
    '.kc-chip:hover{color:var(--kc-text);border-color:var(--kc-muted)}',
    '.kc-chip[aria-pressed="true"]{background:var(--kc-hi);border-color:var(--kc-hi);color:#111312}',
    // range
    '.kc-paneel input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:18px;background:transparent;margin:0;cursor:pointer}',
    '.kc-paneel input[type=range]::-webkit-slider-runnable-track{height:3px;border-radius:2px;background:linear-gradient(to right,var(--kc-hi) 0,var(--kc-hi) var(--kc-p,50%),var(--kc-edge) var(--kc-p,50%))}',
    '.kc-paneel input[type=range]::-moz-range-track{height:3px;border-radius:2px;background:var(--kc-edge)}',
    '.kc-paneel input[type=range]::-moz-range-progress{height:3px;border-radius:2px;background:var(--kc-hi)}',
    '.kc-paneel input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;margin-top:-5.5px;border-radius:50%;background:var(--kc-text);border:0;box-shadow:0 0 0 3px var(--kc-panel)}',
    '.kc-paneel input[type=range]::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--kc-text);border:0;box-shadow:0 0 0 3px var(--kc-panel)}',
    '.kc-paneel input[type=range].kc-midden::-webkit-slider-runnable-track{background:linear-gradient(to right,var(--kc-edge) 0,var(--kc-edge) calc(50% - 1px),var(--kc-muted) calc(50% - 1px),var(--kc-muted) calc(50% + 1px),var(--kc-edge) calc(50% + 1px))}',
    // toggle / knoppen
    '.kc-schakel{display:flex;justify-content:space-between;align-items:center;width:100%;background:none;border:0;padding:2px 0;',
    'color:var(--kc-soft);font:12px/1.4 inherit;font-family:inherit;cursor:pointer;text-align:left}',
    '.kc-schakel .kc-knop-s{width:30px;height:17px;border-radius:999px;background:var(--kc-edge);position:relative;transition:background .15s;flex:none}',
    '.kc-schakel .kc-knop-s::after{content:"";position:absolute;top:2px;left:2px;width:13px;height:13px;border-radius:50%;background:var(--kc-soft);transition:transform .15s,background .15s}',
    '.kc-schakel[aria-pressed="true"] .kc-knop-s{background:var(--kc-hi)}',
    '.kc-schakel[aria-pressed="true"] .kc-knop-s::after{transform:translateX(13px);background:#111312}',
    '.kc-knop{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:8px 12px;border-radius:7px;',
    'border:1px solid var(--kc-edge);background:var(--kc-panel2);color:var(--kc-text);font:13px/1.3 inherit;font-family:inherit;cursor:pointer;transition:background .12s,border-color .12s}',
    '.kc-knop:hover{border-color:var(--kc-muted);background:#23262a}',
    '.kc-knop.kc-primair{background:var(--kc-hi);border-color:var(--kc-hi);color:#111312;font-weight:600;padding:10px 12px}',
    '.kc-knop.kc-primair:hover{background:#e6efe9}',
    '.kc-knop[aria-pressed="true"]{border-color:var(--kc-hi);color:var(--kc-hi)}',
    '.kc-knoppen2{display:grid;grid-template-columns:1fr 1fr;gap:6px}',
    '.kc-kbd{font:11px/1 ui-monospace,SFMono-Regular,Menlo,monospace;color:var(--kc-muted);border:1px solid var(--kc-edge);border-radius:4px;padding:2px 5px}',
    '.kc-primair .kc-kbd{color:#3c423e;border-color:#9aa59e}',
    '.kc-voet{margin-top:auto;display:flex;align-items:center;gap:8px;padding-top:12px;border-top:1px solid var(--kc-edge)}',
    '.kc-voet label{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--kc-muted)}',
    '.kc-seed{flex:1;min-width:0;background:transparent;border:1px solid transparent;border-radius:5px;color:var(--kc-soft);',
    'font:12px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;padding:4px 6px}',
    '.kc-seed:hover{border-color:var(--kc-edge)}',
    '.kc-seed:focus{border-color:var(--kc-muted);color:var(--kc-text);background:var(--kc-panel2);outline:none}',
    '.kc-tip{font-size:11px;color:var(--kc-muted);margin:0}',
    // focus
    '.kc-paneel :focus{outline:none}',
    '.kc-paneel :focus-visible,.kc-dlg :focus-visible,.kc-toon :focus-visible{outline:2px solid var(--kc-hi);outline-offset:2px}',
    '.kc-paneel input[type=range]:focus-visible{outline-offset:4px;border-radius:3px}',
    // toast, help, toon-knop
    '.kc-toast{position:fixed;left:50%;bottom:24px;transform:translate(-50%,10px);background:var(--kc-text);color:#111312;',
    'font:13px/1.3 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:8px 14px;border-radius:999px;opacity:0;pointer-events:none;',
    'transition:opacity .2s,transform .2s;z-index:1000;box-shadow:0 6px 24px rgba(0,0,0,.4)}',
    '.kc-toast.kc-aan{opacity:1;transform:translate(-50%,0)}',
    '.kc-dlg-achter{position:fixed;inset:0;background:rgba(5,6,7,.6);display:grid;place-items:center;z-index:999;padding:16px}',
    '.kc-dlg-achter[hidden]{display:none}',
    '.kc-dlg{background:var(--kc-panel);color:var(--kc-text);border:1px solid var(--kc-edge);border-radius:12px;padding:18px 20px;',
    'width:min(380px,100%);max-height:calc(100vh - 32px);overflow:auto;font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;box-shadow:0 20px 60px rgba(0,0,0,.5)}',
    '.kc-dlg h2{margin:0 0 12px;font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--kc-muted);font-weight:600}',
    '.kc-dlg dl{display:grid;grid-template-columns:auto 1fr;gap:7px 14px;margin:0 0 14px;align-items:center}',
    '.kc-dlg dt{white-space:nowrap;text-align:right}',
    '.kc-dlg dd{margin:0;color:var(--kc-soft)}',
    '.kc-dlg .kc-knop{margin-top:4px}',
    '.kc-toon{position:fixed;top:12px;right:12px;z-index:998;border:1px solid var(--kc-edge);background:rgba(21,23,25,.85);color:var(--kc-soft);',
    'font:12px/1 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:8px 12px;border-radius:999px;cursor:pointer;backdrop-filter:blur(6px)}',
    '.kc-toon[hidden]{display:none}',
    '.kc-toon:hover{color:var(--kc-text)}',
    '.kc-canvas{touch-action:none;cursor:grab;-webkit-user-select:none;user-select:none}',
    '.kc-canvas.kc-sleep{cursor:grabbing}',
    '@media (hover:none) and (pointer:coarse){.kc-paneel .kc-kbd{display:none}}',
    '@media (prefers-reduced-motion:reduce){.kc-paneel *,.kc-toast{transition:none!important}}'
  ].join('');

  function injectCSS() {
    if (document.getElementById('kc-stijl')) return;
    var s = document.createElement('style');
    s.id = 'kc-stijl';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  // ---------- URL-hash ----------
  // s=seed n=segments c=complexity v=style k=colorMode t=speed r=spin d=hueDrift z=zoom g=glow x/y=offset
  function encodeHash(st) {
    var p = [];
    function add(k, v) { p.push(k + '=' + encodeURIComponent(v)); }
    add('s', st.seed >>> 0);
    add('n', st.segments);
    add('c', st.complexity);
    if (st.style != null) add('v', st.style);
    if (st.colorMode != null) add('k', st.colorMode);
    add('t', round(st.speed, 2));
    add('r', round(st.spin, 2));
    add('d', round(st.hueDrift, 2));
    add('z', round(st.zoom, 2));
    add('g', st.glow ? 1 : 0);
    if (st.offsetX) add('x', round(st.offsetX, 3));
    if (st.offsetY) add('y', round(st.offsetY, 3));
    return '#' + p.join('&');
  }

  function decodeHash(hash, opts) {
    var out = {};
    var h = String(hash || '').replace(/^#/, '');
    if (!h) return out;
    var q = {};
    h.split('&').forEach(function (part) {
      var i = part.indexOf('=');
      if (i < 1) return;
      try { q[part.slice(0, i)] = decodeURIComponent(part.slice(i + 1)); } catch (e) { /* ongeldig */ }
    });
    var v;
    v = num(q.s); if (isFinite(v) && v >= 1) out.seed = Math.floor(Math.min(v, MAX_SEED));
    v = num(q.n); if (isFinite(v)) out.segments = evenSeg(v);
    v = num(q.c); if (isFinite(v)) out.complexity = Math.round(lim('complexity', v));
    v = num(q.t); if (isFinite(v)) out.speed = lim('speed', v);
    v = num(q.r); if (isFinite(v)) out.spin = lim('spin', v);
    v = num(q.d); if (isFinite(v)) out.hueDrift = lim('hueDrift', v);
    v = num(q.z); if (isFinite(v)) out.zoom = lim('zoom', v);
    v = num(q.x); if (isFinite(v)) out.offsetX = lim('offsetX', v);
    v = num(q.y); if (isFinite(v)) out.offsetY = lim('offsetY', v);
    if (q.g === '1' || q.g === '0') out.glow = q.g === '1';
    var styles = (opts && opts.styles) || [], modes = (opts && opts.modes) || [];
    if (q.v && styles.some(function (o) { return o.id === q.v; })) out.style = q.v;
    if (q.k && modes.some(function (o) { return o.id === q.k; })) out.colorMode = q.k;
    return out;
  }

  // ---------- init ----------
  var started = false;

  function init(app, panelEl) {
    if (started) return;
    started = true;
    if (!app) throw new Error('KControls.init: app ontbreekt');
    panelEl = panelEl || document.getElementById('paneel');
    injectCSS();

    var opts = (app.options && app.options()) || { styles: [], modes: [] };
    var styles = opts.styles || [], modes = opts.modes || [];
    var S = function () { return app.state || {}; };
    var sync = [];           // functies(state) om het paneel bij te werken

    function set(p) { app.set(p); }

    // ---- toast ----
    var toast = el('div', { class: 'kc-toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toast);
    var toastT = 0;
    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('kc-aan');
      clearTimeout(toastT);
      toastT = setTimeout(function () { toast.classList.remove('kc-aan'); }, 1600);
    }

    // ---- bouwstenen ----
    function group(title, kids) {
      var id = nid('g');
      return el('section', { class: 'kc-groep', 'aria-labelledby': id },
        [el('h2', { class: 'kc-label', id: id, text: title })].concat(kids));
    }

    function chips(label, items, key) {
      var id = nid('c');
      var wrap = el('div', { class: 'kc-chips', role: 'group', 'aria-labelledby': id });
      var btns = items.map(function (it, i) {
        var b = el('button', { type: 'button', class: 'kc-chip', 'aria-pressed': 'false', 'data-id': it.id,
          title: (i < 9 && key === 'style') ? it.name + ' (' + (i + 1) + ')' : it.name,
          onclick: function () { var p = {}; p[key] = it.id; set(p); } }, [it.name || it.id]);
        wrap.appendChild(b);
        return b;
      });
      sync.push(function (st) {
        btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-id') === st[key])); });
      });
      return el('div', { class: 'kc-veld' }, [el('span', { class: 'kc-naam', id: id, text: label }), wrap]);
    }

    function slider(label, key, min, max, step, fmt, o) {
      o = o || {};
      var id = nid('r');
      var inp = el('input', { type: 'range', id: id, min: min, max: max, step: step, 'data-key': key });
      if (o.center) inp.classList.add('kc-midden');
      var out = el('output', { class: 'kc-waarde', for: id });
      function paint(v) {
        out.textContent = fmt(v);
        inp.style.setProperty('--kc-p', ((v - min) / (max - min) * 100) + '%');
        inp.setAttribute('aria-valuetext', fmt(v));
      }
      inp.addEventListener('input', function () {
        var v = Number(inp.value);
        if (o.snap != null && Math.abs(v) < o.snap) { v = 0; }
        if (o.map) v = o.map(v);
        paint(v);
        var p = {}; p[key] = v; set(p);
      });
      if (o.reset != null) {
        inp.addEventListener('dblclick', function () { var p = {}; p[key] = o.reset; set(p); });
      }
      sync.push(function (st) {
        var v = st[key];
        if (typeof v !== 'number' || !isFinite(v)) return;
        if (document.activeElement !== inp || String(inp.value) !== String(v)) inp.value = v;
        paint(v);
      });
      return el('div', { class: 'kc-veld' }, [
        el('div', { class: 'kc-rij' }, [el('label', { class: 'kc-naam', for: id, text: label }), out]), inp]);
    }

    function kbd(t) { return el('span', { class: 'kc-kbd', 'aria-hidden': 'true', text: t }); }

    // ---- paneel ----
    panelEl.classList.add('kc-paneel');
    panelEl.setAttribute('aria-label', 'Bediening');
    panelEl.innerHTML = '';

    var helpBtn = el('button', { type: 'button', class: 'kc-rond', 'aria-label': 'Sneltoetsen tonen',
      title: 'Sneltoetsen (?)', 'aria-haspopup': 'dialog', onclick: function () { openHelp(); } }, ['?']);
    var hideBtn = el('button', { type: 'button', class: 'kc-rond', 'aria-label': 'Paneel verbergen',
      title: 'Paneel verbergen (H)', onclick: function () { togglePanel(false); } }, ['×']);

    var fmtInt = function (v) { return String(Math.round(v)); };
    var fmtX = function (d) { return function (v) { return v.toFixed(d) + '×'; }; };
    var fmtPct = function (v) { return Math.round(v * 100) + '%'; };
    var fmtSpin = function (v) {
      if (Math.abs(v) < 0.005) return '0';
      return (v > 0 ? '↻ ' : '↺ ') + Math.abs(v).toFixed(2);
    };

    var glowBtn = el('button', { type: 'button', class: 'kc-schakel', 'aria-pressed': 'false',
      onclick: function () { set({ glow: !S().glow }); } },
      [el('span', { text: 'Gloed' }), el('span', { class: 'kc-knop-s', 'aria-hidden': 'true' })]);
    sync.push(function (st) { glowBtn.setAttribute('aria-pressed', String(!!st.glow)); });

    var pauseLbl = el('span', { text: 'Pauze' });
    var pauseBtn = el('button', { type: 'button', class: 'kc-knop', 'aria-pressed': 'false',
      onclick: function () { set({ paused: !S().paused }); } }, [pauseLbl, kbd('spatie')]);
    sync.push(function (st) {
      pauseBtn.setAttribute('aria-pressed', String(!!st.paused));
      pauseLbl.textContent = st.paused ? 'Afspelen' : 'Pauze';
    });

    var fsLbl = el('span', { text: 'Volledig scherm' });
    var fsBtn = el('button', { type: 'button', class: 'kc-knop', onclick: function () { toggleFullscreen(); } }, [fsLbl, kbd('F')]);

    var seedId = nid('s');
    var seedInp = el('input', { type: 'text', id: seedId, class: 'kc-seed', inputmode: 'numeric',
      autocomplete: 'off', spellcheck: 'false', title: 'Seed bewerken en Enter drukken' });
    seedInp.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var v = Number(seedInp.value.trim());
        if (seedInp.value.trim() !== '' && isFinite(v) && v >= 1) {
          set({ seed: Math.floor(Math.min(v, MAX_SEED)) });
        } else {
          seedInp.value = S().seed;
          showToast('Ongeldige seed');
        }
        seedInp.blur();
      } else if (e.key === 'Escape') {
        seedInp.value = S().seed; seedInp.blur();
      }
    });
    seedInp.addEventListener('blur', function () { seedInp.value = S().seed; });
    sync.push(function (st) { if (document.activeElement !== seedInp) seedInp.value = st.seed; });

    var kids = [
      el('div', { class: 'kc-kop' }, [el('h1', { class: 'kc-titel', text: 'Caleidoscoop' }),
        el('div', { class: 'kc-kopknoppen' }, [helpBtn, hideBtn])]),
      el('button', { type: 'button', class: 'kc-knop kc-primair', onclick: function () { app.randomize(); } },
        [el('span', { text: 'Nieuwe caleidoscoop' }), kbd('R')]),
      group('Vorm', [
        styles.length ? chips('Stijl', styles, 'style') : null,
        slider('Segmenten', 'segments', 4, 32, 2, fmtInt, { map: evenSeg }),
        slider('Complexiteit', 'complexity', 1, 10, 1, fmtInt)
      ]),
      group('Kleur', [
        modes.length ? chips('Kleurmodus', modes, 'colorMode') : null,
        slider('Kleurdrift', 'hueDrift', 0, 1, 0.01, fmtPct),
        glowBtn
      ]),
      group('Beweging', [
        slider('Snelheid', 'speed', 0, 3, 0.05, fmtX(2), { reset: 1 }),
        slider('Draaien', 'spin', -1, 1, 0.01, fmtSpin, { center: true, snap: 0.04, reset: 0 }),
        slider('Zoom', 'zoom', 0.5, 3, 0.01, fmtX(2), { reset: 1 }),
        pauseBtn,
        el('p', { class: 'kc-tip', text: 'Sleep op het beeld om te verschuiven, scroll of knijp om te zoomen, dubbelklik voor een nieuwe.' })
      ]),
      group('Acties', [
        el('button', { type: 'button', class: 'kc-knop', onclick: savePNG }, [el('span', { text: 'Opslaan als PNG' }), kbd('S')]),
        el('div', { class: 'kc-knoppen2' }, [
          el('button', { type: 'button', class: 'kc-knop', onclick: shareLink }, ['Deel link']),
          fsBtn
        ])
      ]),
      el('div', { class: 'kc-voet' }, [el('label', { for: seedId, text: 'Seed' }), seedInp])
    ];
    kids.forEach(function (k) { panelEl.appendChild(k); });

    // ---- paneel tonen/verbergen ----
    var showBtn = el('button', { type: 'button', class: 'kc-toon', hidden: '', title: 'Paneel tonen (H)',
      onclick: function () { togglePanel(true); } }, ['Paneel tonen']);
    document.body.appendChild(showBtn);
    function togglePanel(show) {
      if (show == null) show = panelEl.hidden;
      var had = panelEl.contains(document.activeElement);
      panelEl.hidden = !show;
      showBtn.hidden = show;
      document.body.classList.toggle('kc-paneel-verborgen', !show);
      if (had && !show) showBtn.focus();
      if (show && document.activeElement === showBtn) hideBtn.focus();
      window.dispatchEvent(new Event('resize'));
    }

    // ---- help ----
    var KEYS = [
      ['Spatie', 'Pauze / afspelen'], ['R / Enter', 'Nieuwe caleidoscoop'], ['S', 'Opslaan als PNG'],
      ['F', 'Volledig scherm'], ['H', 'Paneel verbergen / tonen'], ['← →', 'Segmenten − / + 2'],
      ['↑ ↓', 'Complexiteit + / −'], ['1 – 9', 'Stijl kiezen'], ['?', 'Dit overzicht'],
      ['Slepen', 'Bron verschuiven'], ['Wiel / knijpen', 'Zoomen'], ['Dubbelklik', 'Nieuwe caleidoscoop']
    ];
    var dl = el('dl');
    KEYS.forEach(function (k) { dl.appendChild(el('dt', null, [kbd(k[0])])); dl.appendChild(el('dd', { text: k[1] })); });
    dl.querySelectorAll('.kc-kbd').forEach(function (n) { n.removeAttribute('aria-hidden'); });
    var helpTitle = nid('h');
    var helpClose = el('button', { type: 'button', class: 'kc-knop', onclick: function () { closeHelp(); } }, ['Sluiten']);
    var helpDlg = el('div', { class: 'kc-dlg', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': helpTitle },
      [el('h2', { id: helpTitle, text: 'Sneltoetsen' }), dl, helpClose]);
    var helpBack = el('div', { class: 'kc-dlg-achter', hidden: '' }, [helpDlg]);
    helpBack.addEventListener('click', function (e) { if (e.target === helpBack) closeHelp(); });
    document.body.appendChild(helpBack);
    var helpReturn = null;
    function openHelp() { helpReturn = document.activeElement; helpBack.hidden = false; helpClose.focus(); }
    function closeHelp() {
      helpBack.hidden = true;
      if (helpReturn && helpReturn.focus && document.contains(helpReturn)) helpReturn.focus();
    }

    // ---- acties ----
    function savePNG() {
      try { app.exportPNG(2048); showToast('PNG wordt opgeslagen'); } catch (e) { showToast('Opslaan mislukt'); }
    }

    function shareLink() {
      writeHash(true);
      var url = location.href.split('#')[0] + encodeHash(S());
      var done = function () { showToast('Link gekopieerd'); };
      var fallback = function () {
        var ta = el('textarea', { readonly: '', style: 'position:fixed;top:-1000px;opacity:0' });
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        var ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        if (ok) done(); else window.prompt('Kopieer deze link:', url);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(done, fallback);
      } else fallback();
    }

    function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
    function toggleFullscreen() {
      try {
        if (fsElement()) {
          (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
          var t = (app.canvas && app.canvas.parentElement) || document.documentElement;
          var req = t.requestFullscreen || t.webkitRequestFullscreen;
          if (req) { var p = req.call(t); if (p && p.catch) p.catch(function () { showToast('Volledig scherm niet beschikbaar'); }); }
          else showToast('Volledig scherm niet beschikbaar');
        }
      } catch (e) { showToast('Volledig scherm niet beschikbaar'); }
    }
    function onFs() { fsLbl.textContent = fsElement() ? 'Venster' : 'Volledig scherm'; }
    document.addEventListener('fullscreenchange', onFs);
    document.addEventListener('webkitfullscreenchange', onFs);

    // ---- toetsen ----
    function typing(t) {
      if (!t || !t.tagName) return false;
      var n = t.tagName;
      return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT' || t.isContentEditable;
    }
    document.addEventListener('keydown', function (e) {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
      if (!helpBack.hidden) {
        if (e.key === 'Escape' || e.key === '?') { e.preventDefault(); closeHelp(); }
        else if (e.key === 'Tab') { e.preventDefault(); helpClose.focus(); }
        return;
      }
      if (typing(e.target)) return;
      var onBtn = e.target && e.target.tagName === 'BUTTON';
      var st = S(), k = e.key, handled = true;
      if (k === ' ' || k === 'Spacebar') { if (onBtn) return; set({ paused: !st.paused }); }
      else if (k === 'Enter') { if (onBtn) return; app.randomize(); }
      else if (k === 'r' || k === 'R') app.randomize();
      else if (k === 's' || k === 'S') savePNG();
      else if (k === 'f' || k === 'F') toggleFullscreen();
      else if (k === 'h' || k === 'H') togglePanel();
      else if (k === '?') openHelp();
      else if (k === 'ArrowLeft') set({ segments: evenSeg((st.segments || 12) - 2) });
      else if (k === 'ArrowRight') set({ segments: evenSeg((st.segments || 12) + 2) });
      else if (k === 'ArrowUp') set({ complexity: Math.round(lim('complexity', (st.complexity || 5) + 1)) });
      else if (k === 'ArrowDown') set({ complexity: Math.round(lim('complexity', (st.complexity || 5) - 1)) });
      else if (/^[1-9]$/.test(k)) { var s = styles[Number(k) - 1]; if (s) set({ style: s.id }); else handled = false; }
      else handled = false;
      if (handled) e.preventDefault();
    });

    // ---- muis / touch op canvas ----
    var cv = app.canvas;
    if (cv) {
      cv.classList.add('kc-canvas');
      var ptrs = {};            // id -> {x,y}
      var pinch = null;         // {dist, zoom}
      var pending = null, raf = 0;
      var lastTap = { t: 0, x: 0, y: 0 }, downAt = null, moved = 0;

      var queue = function (p) {
        pending = Object.assign(pending || {}, p);
        if (!raf) raf = requestAnimationFrame(function () { raf = 0; var q = pending; pending = null; if (q) set(q); });
      };
      var cur = function (key, def) {
        if (pending && pending[key] != null) return pending[key];
        var v = S()[key]; return typeof v === 'number' && isFinite(v) ? v : def;
      };
      var ids = function () { return Object.keys(ptrs); };
      var dist = function () {
        var a = ptrs[ids()[0]], b = ptrs[ids()[1]];
        return Math.hypot(a.x - b.x, a.y - b.y) || 1;
      };

      cv.addEventListener('pointerdown', function (e) {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
        try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
        if (ids().length === 1) { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; moved = 0; }
        if (ids().length === 2) { pinch = { dist: dist(), zoom: cur('zoom', 1) }; moved = 999; }
        cv.classList.add('kc-sleep');
      });
      cv.addEventListener('pointermove', function (e) {
        var p = ptrs[e.pointerId];
        if (!p) return;
        var dx = e.clientX - p.x, dy = e.clientY - p.y;
        p.x = e.clientX; p.y = e.clientY;
        if (pinch && ids().length >= 2) {
          queue({ zoom: lim('zoom', pinch.zoom * dist() / pinch.dist) });
          return;
        }
        moved += Math.abs(dx) + Math.abs(dy);
        var r = cv.getBoundingClientRect();
        var size = Math.max(120, Math.min(r.width, r.height));
        var k = 2.2 / size;     // halve canvas slepen ≈ volledige bereik
        queue({ offsetX: lim('offsetX', cur('offsetX', 0) + dx * k), offsetY: lim('offsetY', cur('offsetY', 0) + dy * k) });
      });
      var up = function (e) {
        if (!ptrs[e.pointerId]) return;
        delete ptrs[e.pointerId];
        if (ids().length < 2) pinch = null;
        if (!ids().length) cv.classList.remove('kc-sleep');
        if (e.type === 'pointerup' && e.pointerType !== 'mouse' && downAt && moved < 10 && performance.now() - downAt.t < 300) {
          var now = performance.now();
          if (now - lastTap.t < 350 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
            lastTap.t = 0; app.randomize();
          } else lastTap = { t: now, x: e.clientX, y: e.clientY };
        }
        if (!ids().length) downAt = null;
      };
      cv.addEventListener('pointerup', up);
      cv.addEventListener('pointercancel', up);
      cv.addEventListener('dblclick', function (e) { e.preventDefault(); app.randomize(); });
      cv.addEventListener('wheel', function (e) {
        e.preventDefault();
        var d = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1);
        if (e.ctrlKey) d *= 3; // trackpad-pinch
        queue({ zoom: lim('zoom', cur('zoom', 1) * Math.exp(-clamp(d, -200, 200) * 0.0015)) });
      }, { passive: false });
      cv.addEventListener('contextmenu', function (e) { if (ids().length) e.preventDefault(); });
    }

    // ---- hash schrijven/lezen ----
    var hashT = 0, lastHash = '';
    function writeHash(now) {
      clearTimeout(hashT);
      var go = function () {
        var h = encodeHash(S());
        if (h === lastHash && location.hash === h) return;
        lastHash = h;
        try { history.replaceState(history.state, '', location.pathname + location.search + h); }
        catch (e) { /* bv. file:// beperkingen */ }
      };
      if (now) go(); else hashT = setTimeout(go, 300);
    }
    function applyHash() {
      if (!location.hash || location.hash === lastHash) return;
      var p = decodeHash(location.hash, opts);
      if (Object.keys(p).length) { lastHash = location.hash; set(p); }
    }
    window.addEventListener('hashchange', applyHash);

    // ---- sync ----
    function render(st) { st = st || S(); sync.forEach(function (f) { f(st); }); }
    app.onChange(function (st) { render(st); writeHash(false); });

    applyHash();
    render();
    writeHash(false);
  }

  window.KControls = { init: init, encodeHash: encodeHash, decodeHash: decodeHash };
})();
