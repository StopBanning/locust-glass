// The locust-glass demo: `npm run demo`. On macOS 26 the window sits on Apple's real glass with a floating sidebar
// panel; on Windows 11 on Acrylic; everywhere, the toolbar melts together, the bubble bends what is under it, and the
// buttons squish.
//
//   --rainbow            the Rainbow under the glass (on Windows painted by the page)
//   --capture            the frame worth a screenshot, shown behind other windows (macOS: scripts/capture.sh takes it)
//   --check              test every piece in the page (demo/checks.mjs), print each, and quit: 1 if any failed. Shown
//                        behind other windows, for a few seconds.
//   --frameless          the window with no system title bar, as apps that draw their own make it
//   --screenshot <file>  Windows and Linux: the checks, then the whole screen taken through the system, written to
//                        <file>, and quit (CI's proof the glass works). A window of colour stripes sits behind the demo.
//   --crop               with --screenshot: a plain dark desktop, and the picture cropped to the window -- a sample
import { app, BrowserWindow, desktopCapturer, nativeTheme, screen } from 'electron'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyGlass, glassKind, glassWindowOptions, RAINBOW } from '../src/main.js'
import { pageChecks } from './checks.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const capture = process.argv.includes('--capture')
const check = process.argv.includes('--check')
const screenshotAt = process.argv.indexOf('--screenshot')
const screenshot = screenshotAt >= 0 ? process.argv[screenshotAt + 1] : undefined
const crop = process.argv.includes('--crop')
// --frameless: the window as apps that draw their own title bar make it (frame: false), for the screens workflow.
const frameless = process.argv.includes('--frameless')
const still = capture || check || screenshot !== undefined

/**
 * A window filling the screen behind the demo: sharp colour stripes, something for the glass to blur where a blur
 * shows at a glance, or (--crop) a plain dark desktop for a sample. (A data: page cannot load a file: picture, so the
 * stripes are CSS.)
 */
function backdropWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const back = new BrowserWindow({ width, height, x: 0, y: 0, frame: false, show: true, focusable: false, skipTaskbar: true })
  const ground = crop ? '%2315161a' : 'repeating-linear-gradient(115deg,%23ff2d95 0 60px,%2300d0ff 60px 120px,%23ffd400 120px 180px,%237a3cff 180px 240px)'
  back.loadURL(`data:text/html,<body style="margin:0;height:100vh;background:${ground}"></body>`)
  return back
}

app.whenReady().then(async () => {
  // The demo page is dark; Windows tints its Acrylic by the app's theme, so the material matches the page.
  nativeTheme.themeSource = 'dark'
  if (screenshot !== undefined) backdropWindow()
  // In a CI screenshot the demo leaves a margin of the backdrop showing, so the frame says what is behind the glass.
  const work = screen.getPrimaryDisplay().workAreaSize
  const margin = screenshot !== undefined && !crop
  const win = new BrowserWindow({
    ...glassWindowOptions(),
    ...(frameless ? { frame: false, titleBarStyle: 'hidden', titleBarOverlay: false } : {}),
    width: margin ? Math.min(1180, work.width - 160) : Math.min(1180, work.width),
    height: margin ? Math.min(760, work.height - 120) : Math.min(760, work.height),
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: 'locust-glass',
    webPreferences: { preload: join(here, 'preload.cjs'), contextIsolation: true, sandbox: false }
  })
  win.loadFile(join(here, 'index.html'), { query: still ? { capture: '1' } : {} })
  win.webContents.once('did-finish-load', async () => {
    // --rainbow puts the Rainbow under the glass; LOCUST_GLASS_BACKDROP any picture, for screenshots of a known desktop.
    const backdrop = process.argv.includes('--rainbow') ? RAINBOW : process.env.LOCUST_GLASS_BACKDROP
    const drawn = applyGlass(win, { backdrop })
    console.log(`locust-glass demo: ${glassKind() ?? 'no system'} glass ${drawn ? 'on' : 'not drawn'} (${process.platform} ${process.getSystemVersion()})`)
    if (capture || (check && screenshot === undefined)) win.showInactive()
    else win.show()
    if (!check && screenshot === undefined) return
    if (screenshot !== undefined) {
      win.center()
      win.setAlwaysOnTop(true)
      win.focus()
    }
    await new Promise((resolve) => setTimeout(resolve, 2500))
    const results = await win.webContents.executeJavaScript(pageChecks({ kind: drawn ? glassKind() : null, backdrop: Boolean(backdrop) }))
    for (const [name, passed, seen] of results) console.log(`check ${passed ? 'PASS' : 'FAIL'}: ${name} (${seen})`)
    const failed = results.filter(([, passed]) => !passed).length
    console.log(`locust-glass demo: ${results.length - failed} of ${results.length} checks passed`)
    if (screenshot !== undefined) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
      // Windows draws Acrylic's plain stand-in colour on a window that is not the active one.
      console.log(`locust-glass demo: window ${win.isFocused() ? 'active' : 'not active'}`)
      const display = screen.getPrimaryDisplay()
      const scale = display.scaleFactor
      const [source] = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: display.size.width * scale, height: display.size.height * scale } })
      if (source === undefined) throw new Error('no screen to take')
      const bounds = win.getBounds()
      const taken = crop
        ? source.thumbnail.crop({ x: Math.round(bounds.x * scale), y: Math.round(bounds.y * scale), width: Math.round(bounds.width * scale), height: Math.round(bounds.height * scale) })
        : source.thumbnail
      writeFileSync(screenshot, taken.toPNG())
      console.log(`locust-glass demo: wrote ${screenshot} (${taken.getSize().width}x${taken.getSize().height})`)
    }
    app.exit(failed === 0 ? 0 : 1)
  })
})

app.on('window-all-closed', () => app.quit())
