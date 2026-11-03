// The locust-glass demo: `npm run demo`. On macOS 26 the window sits on Apple's real glass with a floating sidebar
// panel; on Windows 11 on Acrylic; everywhere, the toolbar melts together, the bubble bends what is under it, and the
// buttons squish.
//
//   --rainbow            the Rainbow under the glass (macOS)
//   --capture            the frame worth a screenshot, shown behind other windows (macOS: scripts/capture.sh takes it)
//   --screenshot <file>  Windows and Linux: a window of colour stripes behind the demo, the whole screen taken through the
//                        system after the glass has drawn, written to <file>, then quit (CI's proof the glass works)
import { app, BrowserWindow, desktopCapturer, nativeTheme, screen } from 'electron'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { applyGlass, glassKind, glassWindowOptions, RAINBOW } from '../src/main.js'

const here = dirname(fileURLToPath(import.meta.url))
const capture = process.argv.includes('--capture')
const screenshotAt = process.argv.indexOf('--screenshot')
const screenshot = screenshotAt >= 0 ? process.argv[screenshotAt + 1] : undefined

/**
 * A window of sharp colour stripes filling the screen behind the demo: something for the glass to blur, where a blur
 * shows at a glance. (A data: page cannot load a file: picture, so the stripes are CSS.)
 */
function backdropWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  const back = new BrowserWindow({ width, height, x: 0, y: 0, frame: false, show: true, focusable: false, skipTaskbar: true })
  const stripes = 'repeating-linear-gradient(115deg,%23ff2d95 0 60px,%2300d0ff 60px 120px,%23ffd400 120px 180px,%237a3cff 180px 240px)'
  back.loadURL(`data:text/html,<body style="margin:0;height:100vh;background:${stripes}"></body>`)
  return back
}

app.whenReady().then(async () => {
  // The demo page is dark; Windows tints its Acrylic by the app's theme, so the material matches the page.
  nativeTheme.themeSource = 'dark'
  if (screenshot !== undefined) backdropWindow()
  // In a screenshot the demo leaves a margin of the backdrop showing, so the frame says what is behind the glass.
  const work = screen.getPrimaryDisplay().workAreaSize
  const win = new BrowserWindow({
    ...glassWindowOptions(),
    width: screenshot === undefined ? 1180 : Math.min(1180, work.width - 160),
    height: screenshot === undefined ? 760 : Math.min(760, work.height - 120),
    minWidth: 760,
    minHeight: 520,
    show: false,
    title: 'locust-glass',
    webPreferences: { preload: join(here, 'preload.cjs'), contextIsolation: true, sandbox: false }
  })
  win.loadFile(join(here, 'index.html'), { query: capture || screenshot !== undefined ? { capture: '1' } : {} })
  win.webContents.once('did-finish-load', async () => {
    // --rainbow puts the Rainbow under the glass; LOCUST_GLASS_BACKDROP any picture, for screenshots of a known desktop.
    const backdrop = process.argv.includes('--rainbow') ? RAINBOW : process.env.LOCUST_GLASS_BACKDROP
    const drawn = applyGlass(win, { backdrop })
    console.log(`locust-glass demo: ${glassKind() ?? 'no system'} glass ${drawn ? 'on' : 'not drawn'} (${process.platform} ${process.getSystemVersion()})`)
    if (capture) win.showInactive()
    else win.show()
    if (screenshot === undefined) return
    win.center()
    win.focus()
    await new Promise((resolve) => setTimeout(resolve, 4000))
    const size = screen.getPrimaryDisplay().size
    const scale = screen.getPrimaryDisplay().scaleFactor
    const [source] = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: size.width * scale, height: size.height * scale } })
    if (source === undefined) throw new Error('no screen to take')
    writeFileSync(screenshot, source.thumbnail.toPNG())
    console.log(`locust-glass demo: wrote ${screenshot}`)
    app.quit()
  })
})

app.on('window-all-closed', () => app.quit())
