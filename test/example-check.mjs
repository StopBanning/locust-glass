// Runs demo/checks.mjs against an app built on locust-glass, the way the README tells people to build one: loaded
// into the app's main process ahead of its own code, so the app itself is unchanged.
//
//   cd examples/plain && NODE_OPTIONS=--import=../../test/example-check.mjs npx electron .
//
// Prints each check and quits: 1 if any failed, or if no window loaded within 30 seconds. Its window is shown without
// taking focus.
import { app, BrowserWindow } from 'electron'

import { glassKind } from '../src/main.js'
import { pageChecks } from '../demo/checks.mjs'

BrowserWindow.prototype.show = BrowserWindow.prototype.showInactive
const timeout = setTimeout(() => {
  console.log('example check FAIL: no window loaded')
  app.exit(1)
}, 30_000)

app.on('browser-window-created', (_event, win) => {
  // Behind other windows Chromium slows a page's animation frames, and the goo draws on them.
  win.webContents.setBackgroundThrottling(false)
  win.webContents.on('preload-error', (_e, path, error) => console.log(`example check FAIL: preload ${path}: ${error.message}`))
  win.webContents.on('console-message', (event) => {
    if (event.level === 'error') console.log(`page error: ${event.message}`)
  })
  win.webContents.once('did-finish-load', async () => {
    clearTimeout(timeout)
    await new Promise((resolve) => setTimeout(resolve, 2500))
    const kind = await win.webContents.executeJavaScript(`document.documentElement.getAttribute('data-glass-drawn')`)
    const bridge = await win.webContents.executeJavaScript(`typeof window.locustGlass`)
    const results = [['the preload reached the page', bridge === 'object', bridge]]
    results.push(...(await win.webContents.executeJavaScript(pageChecks({ kind: kind ? glassKind() : null, backdrop: false }))))
    for (const [name, passed, seen] of results) console.log(`check ${passed ? 'PASS' : 'FAIL'}: ${name} (${seen})`)
    const failed = results.filter(([, passed]) => !passed).length
    console.log(`example check: ${results.length - failed} of ${results.length} checks passed (${glassKind() ?? 'no system'} glass)`)
    app.exit(failed === 0 ? 0 : 1)
  })
})
