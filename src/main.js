// locust-glass, the main process: the window on macOS's own glass, and floating panels of it where the page says.
//
//   import { glassWindowOptions, applyGlass } from 'locust-glass'
//   const win = new BrowserWindow({ ...glassWindowOptions(), width: 1100, height: 720 })
//   applyGlass(win)                       // macOS 26+: real NSGlassEffectView; elsewhere: false, and nothing changes
//
// The page then marks its panels with data-glass-panel (see locust-glass/renderer), and they float on real glass.
// Written for Locust (https://locust.lol). MIT licensed.
import { ipcMain } from 'electron'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const CHANNEL = 'locust-glass:panel'

/**
 * Rainbow: a painting of soft colour to put under the glass (applyGlass(win, { backdrop: RAINBOW })), so the window
 * glows the same over any desktop, a dark one included. Locust's "Behind the glass > Rainbow".
 */
export const RAINBOW = join(here, 'rainbow.jpg').replace('app.asar', 'app.asar.unpacked')

/** The window buttons inside a floating sidebar panel's corner, centred on a 50px title bar. */
export const TRAFFIC_LIGHTS = Object.freeze({ x: 20, y: 18 })

let addon
function native() {
  if (addon !== undefined) return addon
  addon = null
  if (process.platform !== 'darwin') return addon
  try {
    // Beside this file in the package, and unpacked from an app's asar when an app ships it (asarUnpack build/**).
    const file = join(here, '..', 'build', 'glass.node').replace('app.asar', 'app.asar.unpacked')
    const loaded = createRequire(import.meta.url)(file)
    if (loaded.supported()) addon = loaded
  } catch {
    addon = null
  }
  return addon
}

/** True on a Mac with macOS's Liquid Glass (macOS 26 and later) and a built addon. */
export function glassSupported() {
  return native() !== null
}

/**
 * BrowserWindow options for a glass window. On a Mac: a hidden inset title bar with the window buttons where a
 * floating sidebar panel's corner will be, and the sidebar material underneath until applyGlass swaps it for real
 * glass, so the window is never opaque. Elsewhere: the plain options, for the page layer alone.
 */
export function glassWindowOptions() {
  if (process.platform !== 'darwin') return { backgroundColor: '#00000000' }
  return {
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { ...TRAFFIC_LIGHTS },
    vibrancy: 'sidebar',
    visualEffectState: 'followWindow',
    backgroundColor: '#00000000'
  }
}

const drawn = new WeakSet()

/**
 * Puts the window on macOS's glass. Returns true when it is drawn on glass now. `style`: 'regular' (default), or
 * 'clear', macOS's more transparent glass. `backdrop`: a picture put under the glass inside the window -- RAINBOW,
 * or your own -- instead of the desktop. Answers the page's panels from then on.
 */
export function applyGlass(win, { style = 'regular', backdrop } = {}) {
  const glass = native()
  if (glass === null || win.isDestroyed()) return false
  const handle = win.getNativeWindowHandle()
  try {
    // The material first: left on, it draws over the glass and blurs it again.
    win.setVibrancy(null)
    if (backdrop) glass.backdrop(handle, backdrop)
    if (!glass.attach(handle, { style: style === 'clear' ? 1 : 0 })) throw new Error('not attached')
  } catch {
    win.setVibrancy('sidebar')
    return false
  }
  drawn.add(win)
  listen()
  win.webContents.send('locust-glass:drawn', true)
  return true
}

/** Takes the window off the glass and puts the sidebar material back. */
export function removeGlass(win) {
  const glass = native()
  if (glass === null || win.isDestroyed() || !drawn.has(win)) return
  try {
    glass.detach(win.getNativeWindowHandle())
  } catch {
    // The material goes back on regardless.
  }
  drawn.delete(win)
  win.setVibrancy('sidebar')
  win.webContents.send('locust-glass:drawn', false)
}

/** Places one floating panel by name, or takes it away (null). Usually called for you by the page's watchPanels. */
export function placePanel(win, name, rect) {
  const glass = native()
  if (glass === null || win.isDestroyed() || !drawn.has(win)) return
  const sane = (n, max) => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= max
  const ok = rect && sane(rect.x, 20000) && sane(rect.y, 20000) && sane(rect.width, 20000) && sane(rect.height, 20000)
  try {
    glass.panel(win.getNativeWindowHandle(), String(name).slice(0, 64), ok ? {
      x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      radius: sane(rect.radius, 200) ? rect.radius : 16,
      style: rect.style === 'clear' ? 1 : 0,
      followHeight: rect.followHeight ? 1 : 0
    } : null)
  } catch {
    // No panel: the page sits on the window's glass.
  }
}

let listening = false
function listen() {
  if (listening) return
  listening = true
  ipcMain.on(CHANNEL, (event, name, rect) => {
    const win = event.sender.getOwnerBrowserWindow?.() ?? null
    if (win) placePanel(win, name, rect)
  })
}

/** The preload's half: exposes what watchPanels needs. Call it from a preload script (see the demo's preload). */
export const PANEL_CHANNEL = CHANNEL
