// locust-glass, the page: floating panels on the window's glass, a lens that bends what is behind it, and glass that
// melts together as it gets close -- the bubbly part of Apple's Liquid Glass, drawn by Chromium on every system.
//
//   import { watchPanels, lens, goo, shine } from 'locust-glass/renderer'
//   import 'locust-glass/glass.css'
//
// Written for Locust (https://locust.lol). MIT licensed.

const SVG = 'http://www.w3.org/2000/svg'
let counter = 0
const nextId = (what) => `lg-${what}-${(counter += 1).toString(36)}`

/** One hidden <svg> holding every filter this file makes. */
function defs() {
  let svg = document.getElementById('lg-defs')
  if (!svg) {
    svg = document.createElementNS(SVG, 'svg')
    svg.id = 'lg-defs'
    svg.setAttribute('aria-hidden', 'true')
    svg.setAttribute('width', '0')
    svg.setAttribute('height', '0')
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none'
    document.body.appendChild(svg)
  }
  return svg
}

function el(name, attributes, parent) {
  const node = document.createElementNS(SVG, name)
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value))
  if (parent) parent.appendChild(node)
  return node
}

// ------------------------------------------------------------------------------------------------------------------
// Panels: elements marked data-glass-panel float on macOS's real glass (the main process places it under them).

/**
 * Watches every [data-glass-panel] and tells the window where each is. `data-glass-panel="name"`; optional
 * `data-glass-radius`, `data-glass-style="clear"`, `data-glass-follow` (a full-height sidebar). Returns the stop.
 */
export function watchPanels(place = globalThis.locustGlass?.place) {
  if (typeof place !== 'function') return () => {}
  const sent = new Map()
  let frame = 0
  const resize = new ResizeObserver(() => schedule())
  const watched = new Set()
  const measure = () => {
    frame = 0
    const seen = new Set()
    for (const node of document.querySelectorAll('[data-glass-panel]')) {
      const name = node.getAttribute('data-glass-panel') || 'panel'
      seen.add(name)
      if (!watched.has(node)) {
        watched.add(node)
        resize.observe(node)
      }
      const box = node.getBoundingClientRect()
      const shown = box.width > 0 && box.height > 0 && getComputedStyle(node).visibility !== 'hidden'
      const radius = Number(node.getAttribute('data-glass-radius') ?? parseFloat(getComputedStyle(node).borderTopLeftRadius)) || 16
      const rect = shown ? {
        x: Math.round(box.left), y: Math.round(box.top), width: Math.round(box.width), height: Math.round(box.height),
        radius, style: node.getAttribute('data-glass-style') === 'clear' ? 'clear' : 'regular',
        followHeight: node.hasAttribute('data-glass-follow')
      } : null
      const key = JSON.stringify(rect)
      if (sent.get(name) === key) continue
      sent.set(name, key)
      place(name, rect)
    }
    for (const name of [...sent.keys()]) {
      if (seen.has(name)) continue
      sent.delete(name)
      place(name, null)
    }
  }
  function schedule() {
    if (frame === 0) frame = requestAnimationFrame(measure)
  }
  const tree = new MutationObserver(schedule)
  tree.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-glass-panel', 'class', 'style', 'hidden'] })
  addEventListener('resize', schedule)
  schedule()
  return () => {
    cancelAnimationFrame(frame)
    resize.disconnect()
    tree.disconnect()
    removeEventListener('resize', schedule)
    for (const name of sent.keys()) place(name, null)
  }
}

// ------------------------------------------------------------------------------------------------------------------
// The lens: what is behind an element bends at its edges, as through a thick, rounded piece of glass.

/**
 * The displacement field for a rounded rectangle: near the edge, within `bezel`, each pixel looks further in, the most at
 * the very edge, on a curve like a rounded slab of glass seen face on. Red is x, green is y, 128 is still.
 */
export function lensField(width, height, radius, bezel) {
  const w = Math.max(1, Math.round(width))
  const h = Math.max(1, Math.round(height))
  const r = Math.min(radius, w / 2, h / 2)
  const data = new Uint8ClampedArray(w * h * 4)
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const px = Math.min(i + 0.5, w - i - 0.5)
      const py = Math.min(j + 0.5, h - j - 0.5)
      let distance
      let nx = 0
      let ny = 0
      if (px < r && py < r) {
        const cx = r - px
        const cy = r - py
        const length = Math.hypot(cx, cy) || 1
        distance = r - length
        nx = (i < w / 2 ? 1 : -1) * (cx / length)
        ny = (j < h / 2 ? 1 : -1) * (cy / length)
      } else if (px < py) {
        distance = px
        nx = i < w / 2 ? 1 : -1
      } else {
        distance = py
        ny = j < h / 2 ? 1 : -1
      }
      const t = Math.max(0, Math.min(1, distance / bezel))
      // A circular bevel's slope: steep at the rim, flat where the bevel meets the face.
      const strength = t >= 1 ? 0 : 1 - Math.sqrt(1 - (1 - t) * (1 - t))
      const k = (j * w + i) * 4
      data[k] = 128 + nx * strength * 127
      data[k + 1] = 128 + ny * strength * 127
      data[k + 2] = 128
      data[k + 3] = 255
    }
  }
  return { width: w, height: h, data }
}

/** The lens field as a picture, for an SVG feImage. */
export function lensMap(width, height, radius, bezel) {
  const field = lensField(width, height, radius, bezel)
  const canvas = document.createElement('canvas')
  canvas.width = field.width
  canvas.height = field.height
  canvas.getContext('2d').putImageData(new ImageData(field.data, field.width, field.height), 0, 0)
  return canvas.toDataURL()
}

/** Cuts a blurred alpha channel at about half, softly: where two blurs overlap they pass half and join. In place. */
export function cutAtHalf(data) {
  for (let k = 3; k < data.length; k += 4) {
    const a = (data[k] - 112) * 8
    data[k] = a < 0 ? 0 : a > 255 ? 255 : a
  }
  return data
}

/**
 * Makes an element a lens. Options: `bezel` (px of rim that bends, default 22), `strength` (how far it bends, default
 * 36), `blur` (px of frost, default 1.5), `saturate` (default 1.6), `dispersion` (0-1: the rim splits light into
 * colour, default 0.35). Chromium only (Electron, Chrome, Edge): elsewhere it falls back to plain frost. Follows the
 * element's size. Returns the stop.
 */
export function lens(node, { bezel = 22, strength = 36, blur = 1.5, saturate = 1.6, dispersion = 0.35 } = {}) {
  const id = nextId('lens')
  const filter = el('filter', { id, x: 0, y: 0, width: '100%', height: '100%', filterUnits: 'objectBoundingBox', 'color-interpolation-filters': 'sRGB' }, defs())
  const map = el('feImage', { result: 'map', preserveAspectRatio: 'none', x: 0, y: 0 }, filter)
  // Three passes when the rim splits light: red bends most, blue least, as a prism does.
  const spread = Math.max(0, Math.min(1, dispersion))
  const passes = spread > 0
    ? [['R', 1 + spread * 0.12, '1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0'], ['G', 1, '0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0'], ['B', 1 - spread * 0.12, '0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0']]
    : [['A', 1, null]]
  for (const [channel, scale, matrix] of passes) {
    el('feDisplacementMap', { in: 'SourceGraphic', in2: 'map', scale: strength * scale, xChannelSelector: 'R', yChannelSelector: 'G', result: `bent${channel}` }, filter)
    if (matrix) el('feColorMatrix', { in: `bent${channel}`, type: 'matrix', values: matrix, result: `only${channel}` }, filter)
  }
  if (passes.length === 3) {
    el('feBlend', { in: 'onlyR', in2: 'onlyG', mode: 'screen', result: 'rg' }, filter)
    el('feBlend', { in: 'rg', in2: 'onlyB', mode: 'screen' }, filter)
  }
  node.classList.add('lg-lens')
  const apply = () => {
    const box = node.getBoundingClientRect()
    if (box.width < 2 || box.height < 2) return
    const radius = parseFloat(getComputedStyle(node).borderTopLeftRadius) || 0
    map.setAttribute('href', lensMap(box.width, box.height, radius, bezel))
    map.setAttribute('width', String(Math.round(box.width)))
    map.setAttribute('height', String(Math.round(box.height)))
    node.style.setProperty('--lg-lens', `url(#${id}) blur(${blur}px) saturate(${saturate})`)
  }
  let timer = 0
  const resize = new ResizeObserver(() => {
    clearTimeout(timer)
    timer = setTimeout(apply, 60)
  })
  resize.observe(node)
  apply()
  return () => {
    resize.disconnect()
    clearTimeout(timer)
    filter.remove()
    node.classList.remove('lg-lens')
    node.style.removeProperty('--lg-lens')
  }
}

// ------------------------------------------------------------------------------------------------------------------
// Goo: glass that melts together. The children of a group sit on one sheet of glass shaped like all of them at once,
// so two that come close grow a bridge and become one, and come apart again with a neck, like drops of water.

/**
 * Makes a group's children (default: its direct children) share one gooey sheet of glass. Options: `melt` (px: how
 * close two shapes must come to join, default 12), `selector` (which children count), `blur` and `saturate` (the
 * sheet's frost). Redraws only while something in the group moves. Returns the stop.
 */
export function goo(group, { melt = 12, selector = ':scope > *', blur = 16, saturate = 1.8 } = {}) {
  group.classList.add('lg-goo')
  const sheet = document.createElement('div')
  sheet.className = 'lg-goo__sheet'
  sheet.setAttribute('aria-hidden', 'true')
  const light = document.createElement('div')
  light.className = 'lg-goo__light'
  light.setAttribute('aria-hidden', 'true')
  const rim = document.createElement('div')
  rim.className = 'lg-goo__rim'
  rim.setAttribute('aria-hidden', 'true')
  group.prepend(rim)
  group.prepend(light)
  group.prepend(sheet)
  sheet.style.setProperty('--lg-goo-frost', `blur(${blur}px) saturate(${saturate})`)

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d', { willReadFrequently: true })
  const edge = document.createElement('canvas')
  const edgeContext = edge.getContext('2d')
  const pad = melt * 2
  let last = ''
  let frame = 0
  let quiet = 0

  const shapes = () => [...group.querySelectorAll(selector)].filter((node) => node !== sheet && node !== light && node !== rim)

  const draw = () => {
    frame = 0
    const box = group.getBoundingClientRect()
    const parts = shapes().map((node) => {
      const r = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      return [r.left - box.left, r.top - box.top, r.width, r.height, parseFloat(style.borderTopLeftRadius) || 0, Number(style.opacity)]
    })
    const key = `${box.width}x${box.height}|${parts.map((p) => p.map((n) => n.toFixed(1)).join(',')).join(';')}`
    if (key === last) {
      quiet += 1
      if (quiet < 20) frame = requestAnimationFrame(draw)
      return
    }
    last = key
    quiet = 0
    const scale = Math.min(2, devicePixelRatio || 1)
    const w = Math.ceil((box.width + pad * 2) * scale)
    const h = Math.ceil((box.height + pad * 2) * scale)
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w
      canvas.height = h
    }
    context.setTransform(1, 0, 0, 1, 0, 0)
    context.clearRect(0, 0, w, h)
    // Each shape blurred, then the blur cut at half: where two blurs overlap they add up past half and join.
    context.filter = `blur(${melt * scale * 0.5}px)`
    context.setTransform(scale, 0, 0, scale, pad * scale, pad * scale)
    context.fillStyle = '#000'
    for (const [x, y, width, height, radius, opacity] of parts) {
      if (opacity <= 0.01 || width <= 0 || height <= 0) continue
      context.globalAlpha = Math.min(1, opacity)
      context.beginPath()
      context.roundRect(x, y, width, height, Math.min(radius, width / 2, height / 2))
      context.fill()
    }
    context.globalAlpha = 1
    context.filter = 'none'
    context.setTransform(1, 0, 0, 1, 0, 0)
    const image = context.getImageData(0, 0, w, h)
    // A smooth step around half, so the cut edge stays soft by a pixel instead of stair-stepped.
    cutAtHalf(image.data)
    context.putImageData(image, 0, 0)
    // The lit edge: the shape less itself moved down a little, so only its top rim is left, as light catches glass.
    if (edge.width !== w || edge.height !== h) {
      edge.width = w
      edge.height = h
    }
    edgeContext.globalCompositeOperation = 'source-over'
    edgeContext.clearRect(0, 0, w, h)
    edgeContext.drawImage(canvas, 0, 0)
    edgeContext.globalCompositeOperation = 'destination-out'
    edgeContext.drawImage(canvas, 0, 1.5 * scale)
    const masks = [[sheet, `url(${canvas.toDataURL()})`], [light, null], [rim, `url(${edge.toDataURL()})`]]
    masks[1][1] = masks[0][1]
    for (const [layer, url] of masks) {
      layer.style.inset = `${-pad}px`
      layer.style.maskImage = url
      layer.style.webkitMaskImage = url
      layer.style.maskSize = '100% 100%'
      layer.style.webkitMaskSize = '100% 100%'
    }
    frame = requestAnimationFrame(draw)
  }
  const wake = () => {
    quiet = 0
    if (frame === 0) frame = requestAnimationFrame(draw)
  }
  const events = ['pointerenter', 'pointermove', 'pointerdown', 'pointerup', 'pointerleave', 'transitionrun', 'transitionend', 'animationstart', 'animationend', 'focusin', 'focusout']
  for (const name of events) group.addEventListener(name, wake, true)
  const resize = new ResizeObserver(wake)
  resize.observe(group)
  const tree = new MutationObserver(wake)
  tree.observe(group, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style'] })
  wake()
  return {
    /** Redraw now and keep drawing until things settle: call it after moving children yourself. */
    wake,
    stop() {
      cancelAnimationFrame(frame)
      for (const name of events) group.removeEventListener(name, wake, true)
      resize.disconnect()
      tree.disconnect()
      sheet.remove()
      light.remove()
      rim.remove()
      group.classList.remove('lg-goo')
    }
  }
}

// ------------------------------------------------------------------------------------------------------------------
// Shine: the light on glass follows the pointer, as a lit edge catches it.

/** Sets --lg-x and --lg-y (0-100%) on each [data-shine] element under the pointer. Returns the stop. */
export function shine(root = document) {
  const move = (event) => {
    const node = event.target instanceof Element ? event.target.closest('[data-shine], .lg-goo') : null
    if (!node) return
    const box = node.getBoundingClientRect()
    node.style.setProperty('--lg-x', `${(((event.clientX - box.left) / box.width) * 100).toFixed(1)}%`)
    node.style.setProperty('--lg-y', `${(((event.clientY - box.top) / box.height) * 100).toFixed(1)}%`)
  }
  root.addEventListener('pointermove', move, { passive: true })
  return () => root.removeEventListener('pointermove', move)
}

/** Everything at once: panels (when the preload is there), every [data-lens], every [data-goo], and shine. */
export function glassPage() {
  const stops = [watchPanels(), shine()]
  for (const node of document.querySelectorAll('[data-lens]')) stops.push(lens(node))
  for (const node of document.querySelectorAll('[data-goo]')) {
    const g = goo(node)
    stops.push(g.stop)
  }
  // 'mac' or 'windows': the page clears its ground over the system's glass, and on a Mac its panels too.
  globalThis.locustGlass?.onDrawn?.((drawn) => {
    if (drawn) document.documentElement.setAttribute('data-glass-drawn', drawn)
    else document.documentElement.removeAttribute('data-glass-drawn')
  })
  // Windows: the backdrop the window asked for, painted by the page under everything (glass.css).
  globalThis.locustGlass?.onBackdrop?.((url) => {
    const root = document.documentElement
    if (url) {
      root.style.setProperty('--lg-backdrop', `url(${JSON.stringify(url)})`)
      root.setAttribute('data-glass-backdrop', '')
    } else {
      root.style.removeProperty('--lg-backdrop')
      root.removeAttribute('data-glass-backdrop')
    }
  })
  return () => { for (const stop of stops) stop() }
}
