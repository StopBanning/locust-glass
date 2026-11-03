// The locust-glass demo: `npm run demo`. On macOS 26 the window sits on Apple's real glass with a floating sidebar
// panel; everywhere, the toolbar melts together, the bubble bends what is under it, and the buttons squish.
import { app, BrowserWindow } from 'electron'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyGlass, glassSupported, glassWindowOptions, RAINBOW } from '../src/main.js'

const here = dirname(fileURLToPath(import.meta.url))
const capture = process.argv.includes('--capture')

app.whenReady().then(() => {
  const win = new BrowserWindow({
    ...glassWindowOptions(),
    width: 1180,
    height: 760,
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: 'locust-glass',
    webPreferences: { preload: join(here, 'preload.cjs'), contextIsolation: true, sandbox: false }
  })
  win.loadFile(join(here, 'index.html'), { query: capture ? { capture: '1' } : {} })
  win.webContents.once('did-finish-load', () => {
    // --rainbow puts the Rainbow under the glass; LOCUST_GLASS_BACKDROP any picture, for screenshots of a known desktop.
    const backdrop = process.argv.includes('--rainbow') ? RAINBOW : process.env.LOCUST_GLASS_BACKDROP
    const drawn = applyGlass(win, { backdrop })
    console.log(`locust-glass demo: native glass ${glassSupported() ? (drawn ? 'on' : 'offered but not drawn') : 'not on this system'}`)
    if (capture) win.showInactive()
    else win.show()
  })
})

app.on('window-all-closed', () => app.quit())
