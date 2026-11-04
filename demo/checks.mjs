// The demo's own test: every piece of the glass, checked in the page on whatever system it runs on, so Windows and
// Linux are held to what the Mac does. `npx electron demo/main.mjs --check` (add --rainbow for the backdrop), and the
// screens workflow runs it on Windows 11 and Ubuntu. Each check is [name, passed, what was seen].
//
// `kind`: the glass the window went onto ('mac', 'windows' or null); `backdrop`: true when a picture was asked for.
export const pageChecks = ({ kind, backdrop }) => `(async () => {
  const kind = ${JSON.stringify(kind)}
  const backdrop = ${JSON.stringify(Boolean(backdrop))}
  const out = []
  const ok = (name, pass, seen) => out.push([name, Boolean(pass), String(seen).slice(0, 140)])
  const css = (node, prop) => (node ? getComputedStyle(node)[prop] : 'none')
  const urlIn = (value) => (String(value).match(/url\\("?(.*?)"?\\)/) || [])[1]
  const picture = async (src) => {
    if (!src) return null
    const image = new Image()
    image.src = src
    try { await image.decode() } catch { return null }
    return image
  }
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  const root = document.documentElement

  // The system's glass, and the page's ground over it.
  const seen = root.getAttribute('data-glass-drawn')
  ok('the page knows which glass it is on', (seen ?? null) === kind, seen ?? 'none')
  if (kind && !(kind === 'windows' && backdrop)) {
    ok('the page clears its ground so the glass shows', css(document.body, 'backgroundColor') === 'rgba(0, 0, 0, 0)', css(document.body, 'backgroundColor'))
  }
  if (kind === 'windows' && backdrop) {
    const painted = css(document.body, 'backgroundImage')
    const image = await picture(urlIn(painted))
    ok('the backdrop is painted under the page, and the picture loads', image && image.naturalWidth > 0, painted.slice(0, 50) + ' ' + (image ? image.naturalWidth + 'px' : 'not loaded'))
  }

  // Floating panels: real glass under them on a Mac, the page's own tint and frost elsewhere.
  const panel = document.querySelector('.lg-panel[data-glass-panel]')
  if (kind === 'mac') {
    ok('a panel paints nothing over its pane of real glass', css(panel, 'backgroundColor') === 'rgba(0, 0, 0, 0)', css(panel, 'backgroundColor'))
  } else {
    ok('a panel is tinted glass of its own', css(panel, 'backgroundColor') !== 'rgba(0, 0, 0, 0)', css(panel, 'backgroundColor'))
    ok('a panel frosts what is under it', /blur/.test(css(panel, 'backdropFilter')), css(panel, 'backdropFilter'))
  }
  ok('a panel has a lit rim', /inset/.test(css(panel, 'boxShadow')), css(panel, 'boxShadow').slice(0, 60))

  // The lens: an SVG displacement map applied to the backdrop.
  const card = document.querySelector('.player[data-lens]') ?? document.querySelector('[data-lens]')
  const lenses = document.querySelectorAll('[data-lens]').length
  ok('the lens bends what is behind it', /url\\(/.test(css(card, 'backdropFilter')), css(card, 'backdropFilter'))
  const passes = document.querySelectorAll('feDisplacementMap').length
  ok('the lens splits its rim into colour (three passes a lens)', passes >= 3 * lenses, passes + ' passes for ' + lenses + (lenses === 1 ? ' lens' : ' lenses'))
  const maps = [...document.querySelectorAll('feImage')].map((image) => image.getAttribute('href') || '')
  ok('every lens has its map drawn', maps.length >= lenses && maps.every((href) => href.startsWith('data:image/png') && href.length > 2000), maps.map((href) => href.length).join(', ') + ' bytes')

  // Goo: one sheet of glass under the toolbar, shaped like its buttons, melting where two come close.
  const toolbar = document.querySelector('.toolbar')
  const sheet = toolbar.querySelector('.lg-goo__sheet')
  const rim = toolbar.querySelector('.lg-goo__rim')
  const mask = sheet.style.maskImage || sheet.style.webkitMaskImage
  ok('the toolbar sits on one sheet shaped like its buttons', /data:image\\/png/.test(mask), mask.length + ' characters of mask')
  ok('the sheet is frosted', /blur/.test(css(sheet, 'backdropFilter')), css(sheet, 'backdropFilter'))
  ok('the sheet has a lit rim', /data:image\\/png/.test(rim.style.maskImage || rim.style.webkitMaskImage), 'rim mask')
  const shape = await picture(urlIn(mask))
  if (shape) {
    const canvas = document.createElement('canvas')
    canvas.width = shape.naturalWidth
    canvas.height = shape.naturalHeight
    const context = canvas.getContext('2d', { willReadFrequently: true })
    context.drawImage(shape, 0, 0)
    const box = toolbar.getBoundingClientRect()
    const pad = 24
    const scale = shape.naturalWidth / (box.width + pad * 2)
    const alpha = (x, y) => context.getImageData(Math.round((x - box.left + pad) * scale), Math.round((y - box.top + pad) * scale), 1, 1).data[3]
    const [back, forward] = toolbar.querySelectorAll(':scope > .lg-pill')
    const a = back.getBoundingClientRect()
    const b = forward.getBoundingClientRect()
    const bridge = alpha((a.right + b.left) / 2, (a.top + a.bottom) / 2)
    ok('two buttons close together melt into one', bridge > 128, 'alpha ' + bridge + ' across a ' + (b.left - a.right).toFixed(0) + 'px gap')
    const clear = alpha(box.left + box.width / 2, box.top - 18)
    ok('the sheet is clear away from the buttons', clear < 40, 'alpha ' + clear)
  } else {
    ok('the sheet\\'s shape can be read', false, 'mask did not decode')
  }
  // The demo's Add a drop button; any other page gets a button added to its toolbar, which the goo must take in.
  const before = mask
  const drip = document.getElementById('drip')
  if (drip) {
    const drops = toolbar.querySelectorAll('.is-new').length
    drip.click()
    await wait(1200)
    ok('a new drop drips out of the sheet', toolbar.querySelectorAll('.is-new').length === drops + 1, (toolbar.querySelectorAll('.is-new').length - drops) + ' new')
  } else {
    const added = document.createElement('button')
    added.className = 'lg-pill'
    added.textContent = 'New'
    toolbar.append(added)
    await wait(1200)
  }
  ok('the sheet reshapes around a new button', (sheet.style.maskImage || sheet.style.webkitMaskImage) !== before, 'mask changed')
  ;(drip ? toolbar.querySelector('.is-new:last-of-type') : toolbar.querySelector(':scope > .lg-pill:last-of-type'))?.remove()

  // Shine and squish.
  const box = card.getBoundingClientRect()
  card.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: box.left + box.width / 2, clientY: box.top + box.height / 4 }))
  ok('the light follows the pointer', card.style.getPropertyValue('--lg-x') === '50.0%' && card.style.getPropertyValue('--lg-y') === '25.0%', card.style.getPropertyValue('--lg-x') + ' ' + card.style.getPropertyValue('--lg-y'))
  const pill = toolbar.querySelector('.lg-pill')
  // Windows Server, like a person's Windows with animations off, asks for less motion: then the buttons hold still.
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    ok('buttons hold still when the system asks for less motion', css(pill, 'transitionProperty') === 'none' || css(pill, 'transitionDuration') === '0s', css(pill, 'transitionProperty'))
  } else {
    ok('buttons spring when pressed', /transform|all/.test(css(pill, 'transitionProperty')), css(pill, 'transitionProperty'))
  }
  return out
})()`
