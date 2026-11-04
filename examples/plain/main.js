import { app, BrowserWindow } from 'electron'
import { applyGlass, glassWindowOptions, PRELOAD } from 'locust-glass'

app.whenReady().then(() => {
  const win = new BrowserWindow({
    ...glassWindowOptions(), // the title bar hidden, the system's window buttons over the page
    width: 1000,
    height: 640,
    show: false,
    webPreferences: { preload: PRELOAD } // the glass's own preload (have one already? see registerGlassPreload)
  })
  win.once('ready-to-show', () => win.show())
  win.loadFile('index.html')
  win.webContents.once('did-finish-load', () => applyGlass(win)) // true on macOS 26+ and Windows 11 22H2+
})

app.on('window-all-closed', () => app.quit())
