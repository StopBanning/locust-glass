// locust-glass, the preload: what the page needs to tell the window where its glass panels go.
//   require('locust-glass/preload')   // in your preload script, with contextIsolation on
const { contextBridge, ipcRenderer } = require('electron')

const api = {
  /** Places a floating glass panel by name, at a rectangle from the window's top left, or takes it away (null). */
  place: (name, rect) => ipcRenderer.send('locust-glass:panel', String(name), rect ?? null),
  /** Calls back with the glass the window went onto ('mac' or 'windows'), or false when it comes off. */
  onDrawn: (callback) => {
    const listener = (_event, drawn) => callback(drawn === 'mac' || drawn === 'windows' ? drawn : drawn === true ? 'mac' : false)
    ipcRenderer.on('locust-glass:drawn', listener)
    return () => ipcRenderer.removeListener('locust-glass:drawn', listener)
  },
  platform: process.platform
}

if (process.contextIsolated) contextBridge.exposeInMainWorld('locustGlass', api)
else window.locustGlass = api
