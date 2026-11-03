import { glassPage, lens } from '../src/renderer.js'

glassPage()

// The bubble bends harder than a card: a thick drop of glass.
const bubble = document.getElementById('bubble')
lens(bubble, { bezel: 54, strength: 70, blur: 0.6, dispersion: 0.6 })

// Drag the drop around the art.
let grab = null
bubble.addEventListener('pointerdown', (event) => {
  bubble.setPointerCapture(event.pointerId)
  grab = { x: event.clientX - bubble.offsetLeft, y: event.clientY - bubble.offsetTop }
})
bubble.addEventListener('pointermove', (event) => {
  if (!grab) return
  bubble.style.left = `${event.clientX - grab.x}px`
  bubble.style.top = `${event.clientY - grab.y}px`
})
bubble.addEventListener('pointerup', () => { grab = null })

// "Add a drop": a new button drips out of the toolbar's glass, joined by a neck until it settles.
const drip = document.getElementById('drip')
drip.addEventListener('click', () => {
  const drop = document.createElement('button')
  drop.className = 'lg-pill is-new'
  drop.textContent = '●'
  drop.setAttribute('aria-label', 'A new drop')
  drop.addEventListener('click', () => drop.remove())
  drip.parentElement.append(drop)
})

// --capture: a frame worth a screenshot -- the drop over the halftone, one button pressed, a new drop mid-drip.
if (new URLSearchParams(location.search).has('capture')) {
  bubble.style.left = '430px'
  bubble.style.top = '250px'
  setTimeout(() => drip.click(), 600)
}

// --record: a few seconds that show it moving -- the drop gliding over the art, buttons swelling, drops dripping.
if (new URLSearchParams(location.search).has('record')) {
  const start = performance.now()
  const pills = [...document.querySelectorAll('.toolbar .lg-pill')]
  const step = (now) => {
    const t = (now - start) / 1000
    bubble.style.left = `${400 + Math.sin(t * 0.9) * 260}px`
    bubble.style.top = `${230 + Math.sin(t * 1.8) * 70}px`
    pills.forEach((pill, index) => pill.classList.toggle('is-hot', Math.floor(t * 1.4) % pills.length === index))
    requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
  setTimeout(() => drip.click(), 700)
  setTimeout(() => drip.click(), 2300)
  setTimeout(() => document.querySelector('.toolbar .is-new')?.remove(), 3900)
}
