# locust-glass

**Liquid glass for Electron.** Apple's real glass under your window on macOS 26, and the bubbly part on every system: a lens that bends what is behind it, buttons that melt into each other like drops of water, and light that follows the pointer. Free and open source (MIT).

![The locust-glass demo: a sidebar on macOS's real Liquid Glass, a gooey toolbar, and a glass drop bending the art under it](docs/hero.png)

![Buttons melting together and a drop of glass bending the art under it](docs/goo-and-lens.gif)

Made for **[Locust](https://locust.lol)**, the free app that puts Claude Code, Codex, Gemini, Cursor, Copilot and OpenCode on one team on your own computer. This is the glass its Mac look is built on, given away.

## What you get

| | macOS 26+ | macOS 11–15, Windows, Linux |
| --- | --- | --- |
| The window on Apple's glass (`NSGlassEffectView`) | yes | falls back to the window as you made it |
| Floating panels of real glass where your page says | yes | the page's own frost stands in |
| Window buttons inside the sidebar panel's corner | yes | n/a |
| Lens: the backdrop bends at the rim, with a prism fringe | yes | yes (any Chromium) |
| Goo: shapes melt together and drip apart | yes | yes |
| Squishy buttons, pointer-lit shine, lit rims | yes | yes |
| Light and dark, reduced motion | yes | yes |

Nobody's code was copied: the native part is ~200 lines of Objective-C over Apple's public API, and the page part is plain DOM, canvas and SVG filters. Tested on macOS 26 with Electron 44; the page layer has no platform code of its own, only Chromium features.

## Install

```bash
npm install github:StopBanning/locust-glass
```

On a Mac the install builds a small native addon with `clang` (Xcode's command line tools); there is no `node-gyp` and nothing to download. Anywhere else it builds nothing, and everything on the page still works.

## Use it

**Main process**: make the window, then put it on glass.

```js
import { app, BrowserWindow } from 'electron'
import { glassWindowOptions, applyGlass } from 'locust-glass'

app.whenReady().then(() => {
  const win = new BrowserWindow({
    ...glassWindowOptions(),          // hidden inset title bar, buttons where the sidebar panel's corner will be
    width: 1100,
    height: 720,
    webPreferences: { preload: new URL('./preload.cjs', import.meta.url).pathname }
  })
  win.loadFile('index.html')
  win.webContents.once('did-finish-load', () => applyGlass(win))   // true on macOS 26+, false elsewhere
})
```

**Preload**: one line.

```js
require('locust-glass/preload')
```

**Page**: mark what floats, then turn it on.

```html
<link rel="stylesheet" href="node_modules/locust-glass/src/glass.css">

<aside class="lg-panel" data-glass-panel="sidebar" data-glass-follow>…</aside>   <!-- real glass under it on a Mac -->

<div class="toolbar" data-goo>                                                    <!-- one melting sheet of glass -->
  <button class="lg-pill">Back</button>
  <button class="lg-pill">Forward</button>
</div>

<div class="card" data-lens data-shine>…</div>                                   <!-- bends what is behind it -->

<script type="module">
  import { glassPage } from 'locust-glass/renderer'
  glassPage()
</script>
```

The window's glass shows the desktop. A lens and goo bend and frost **what the page draws behind them**, so put them over content: a photo, a list, a document scrolling underneath, as Apple's own toolbars float over it.

## The pieces

### Main process (`locust-glass`)

- `glassWindowOptions()`: `BrowserWindow` options for a glass window.
- `applyGlass(win, { style, backdrop })`: puts the window on glass and answers the page's panels. `style: 'clear'` is macOS's more transparent glass. `backdrop` puts a picture under the glass inside the window, for screenshots and tests.
- `removeGlass(win)`: back to the sidebar material.
- `placePanel(win, name, rect | null)`: place a panel yourself. `watchPanels` usually does it for you.
- `glassSupported()`: true on macOS 26+ with the addon built.

### Page (`locust-glass/renderer`)

- `watchPanels()`: every `[data-glass-panel="name"]` gets real glass placed under it, following its size and place. Optional `data-glass-radius`, `data-glass-style="clear"`, `data-glass-follow` (a full-height sidebar).
- `lens(element, { bezel, strength, blur, saturate, dispersion })`: the backdrop bends within `bezel` px of the rim, on a circular bevel's curve, and splits into colour at the edge. Uses an SVG displacement map through `backdrop-filter`, which Chromium supports, so it works in every Electron app. Elsewhere it falls back to frost.
- `goo(group, { melt, selector, blur, saturate })`: the group's children share one sheet of glass shaped like all of them: two that come within `melt` px grow a bridge and join, and pull apart with a neck. It redraws only while something in the group moves. Returns `{ wake, stop }`.
- `shine()`: sets `--lg-x` / `--lg-y` under the pointer, so the highlight on `[data-shine]` glass follows it.
- `glassPage()`: all of the above for `[data-glass-panel]`, `[data-lens]` and `[data-goo]`.

### CSS (`locust-glass/glass.css`)

`.lg-surface` (frosted, lit rim, shine), `.lg-panel`, `.lg-lens`, `.lg-pill` (swells on hover, squishes like a drop when pressed, springs back), and the goo layers. Colours are custom properties (`--lg-tint`, `--lg-rim`, `--lg-frost`, `--lg-spring` …), with a light set for `prefers-color-scheme: light` or `<html data-theme="light">`.

## Run the demo

```bash
git clone https://github.com/StopBanning/locust-glass && cd locust-glass
npm install
npm run demo
```

Drag the drop of glass over the art, press **Add a drop**, and hover the buttons.

## How it works

- **Real glass.** macOS 26 made `NSGlassEffectView` public. Electron has no option for it, so the addon puts one behind the page for the window's ground, and more for each panel, at the rectangles the page measures. The page paints nothing there, so the glass shows through. The class is looked up by name, so the addon builds on older SDKs and simply says "not here" on older macOS.
- **Lens.** A displacement map for the element's rounded shape is drawn on a canvas once per size: near the rim each pixel looks further inward, steepest at the edge. An SVG `feDisplacementMap` applies it to the backdrop through `backdrop-filter: url(#…)`, three times with slightly different strengths when `dispersion` is on, so red, green and blue bend apart like a prism.
- **Goo.** The children's shapes are drawn blurred onto a canvas and cut at half strength, so where two blurs overlap they add up and join (metaballs). The result masks a frosted sheet under the children, a highlight layer, and a lit top rim (the shape less itself moved down 1.5 px).

## License

MIT. Use it in anything. A link back to [Locust](https://locust.lol) is appreciated, never required.
