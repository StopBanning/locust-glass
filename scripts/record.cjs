// Records the demo page off screen, frame by frame, for the README clip: no window is shown.
//   electron scripts/record.cjs <out-folder> [seconds]
const { app, BrowserWindow } = require('electron')
const { mkdirSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')
const out = process.argv[process.argv.length - 2]
const seconds = Number(process.argv[process.argv.length - 1]) || 6
app.whenReady().then(async () => {
  mkdirSync(out, { recursive: true })
  const win = new BrowserWindow({ width: 1180, height: 760, show: false, webPreferences: { offscreen: true } })
  win.webContents.setFrameRate(30)
  await win.loadFile(join(__dirname, '..', 'demo', 'index.html'), { query: { record: '1' } })
  await new Promise((r) => setTimeout(r, 400))
  let n = 0
  const started = Date.now()
  win.webContents.on('paint', (_event, _dirty, image) => {
    if (Date.now() - started > seconds * 1000) return
    writeFileSync(join(out, `f${String(n++).padStart(4, '0')}.png`), image.toPNG())
  })
  win.webContents.invalidate()
  setTimeout(() => { console.log(`recorded ${n} frames to ${out}`); app.quit() }, seconds * 1000 + 300)
})
