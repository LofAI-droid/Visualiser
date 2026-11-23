# Caleidoscoopgenerator — teamcontract

Pure HTML/JS, geen build, geen externe libraries. Alle bestanden in `caleidoscoop/`.
Scripts worden als klassieke `<script>` geladen in deze volgorde:
`kleuren.js`, `vormen.js`, `kern.js`, `bediening.js`. Elk bestand zet één globaal object op `window`.
UI-taal: Nederlands.

## Gedeelde helpers (in kern.js, beschikbaar als `window.KCore`)
- `KCore.rng(seed:number) -> () => number` — deterministische mulberry32, waarden in [0,1).
  Modules krijgen altijd een `rng`-functie aangereikt; gebruik **nooit** `Math.random()`,
  zodat dezelfde seed altijd hetzelfde beeld geeft.

## kleuren.js → `window.KColors` (agent Kleuren)
```js
KColors.modes            // [{id:'analoog', name:'Analoog'}, ...]  minstens 7 modi
KColors.generate(rng, modeId, count=6)
   // -> { background:'#rrggbb', colors:['#rrggbb', ...count], line:'#rrggbb' }
KColors.shift(palette, degrees)
   // -> nieuw palet-object met alle tinten (hue) gedraaid over `degrees`. Snel: wordt elke frame aangeroepen.
```

## vormen.js → `window.KShapes` (agent Vormen)
```js
KShapes.styles           // [{id:'geometrisch', name:'Geometrisch'}, ...] minstens 6 stijlen
KShapes.generate(rng, styleId, complexity)   // complexity: 1..10
   // -> array van vorm-objecten (plain data), posities in POLAIRE eenheidscoördinaten:
   //    r in [0,1] (fractie van straal), a in [0,1] (fractie van de wigboog)
KShapes.draw(ctx, shapes, palette, t, R, wedge)
   // ctx: oorsprong staat al in het middelpunt van de caleidoscoop.
   // R: straal in px. wedge: wighoek in radialen (2π/segmenten).
   // Alleen de wig tussen hoek 0 en `wedge` (vanaf positieve x-as, met de klok mee in canvas) wordt gebruikt;
   // vormen mogen er wat over gaan (wordt geknipt). Zet pos: x = r*R*cos(a*wedge), y = r*R*sin(a*wedge).
   // t: tijd in seconden (al vermenigvuldigd met snelheid) — gebruik voor subtiele beweging (drijven, pulseren, draaien).
   // palette: object van KColors.generate/shift. Vul ook de achtergrond NIET; dat doet de kern.
```

## kern.js → `window.KCore`, `window.app` (teamleider)
```js
app.state = {
  seed, segments /*4..32, even*/, complexity /*1..10*/, style, colorMode,
  speed /*0..3*/, spin /*-1..1 draaisnelheid geheel*/, hueDrift /*0..1*/,
  zoom /*0.5..3*/, offsetX, offsetY /*-1..1 verschuiving bron*/, paused /*bool*/,
  glow /*bool*/
}
app.set(partial)        // merge; regenereert vormen/kleuren als seed/style/complexity/colorMode wijzigt
app.randomize()         // nieuwe seed + willekeurige stijl/modus/segmenten
app.onChange(fn)        // fn(state) na elke set()
app.exportPNG(size=2048) // downloadt PNG
app.canvas              // het zichtbare <canvas>
app.options()           // { styles: KShapes.styles, modes: KColors.modes }
```

## bediening.js → `window.KControls` (agent Beweging & Bediening)
```js
KControls.init(app, panelEl /* <aside id="paneel"> */)
```
Bouwt het paneel, toetsenbord- en muisbediening, URL-hash (deellink), fullscreen.

## Stijl
Donker, sober, zoals de bestaande SHAPES LAB-pagina:
`--bg:#0c0d0f; --panel:#151719; --panel2:#1c1e21; --edge:#303338; --muted:#888d94; --soft:#babdc3; --text:#f4f2ec; --hi:#d6e3db`
Systeemfont, kleine uppercase labels (10–11px, letter-spacing .16em).
