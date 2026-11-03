import assert from 'node:assert/strict'
import { test } from 'node:test'

import { cutAtHalf, lensField } from '../src/renderer.js'

const at = (field, i, j) => {
  const k = (j * field.width + i) * 4
  return [field.data[k], field.data[k + 1]]
}

test('the lens is still in the middle and bends inward at every rim', () => {
  const field = lensField(200, 120, 24, 30)
  assert.deepEqual(at(field, 100, 60), [128, 128])
  const [left] = at(field, 0, 60)
  const [right] = at(field, 199, 60)
  const [, top] = at(field, 100, 0)
  const [, bottom] = at(field, 100, 119)
  // Each edge looks further in: right of 128 on the left edge, left of it on the right, and so on.
  assert.ok(left > 200 && right < 56, `x at the rims: ${left}, ${right}`)
  assert.ok(top > 200 && bottom < 56, `y at the rims: ${top}, ${bottom}`)
})

test('a corner bends along its diagonal, and the bend fades to nothing across the bezel', () => {
  const field = lensField(200, 120, 24, 30)
  const [cx, cy] = at(field, 3, 3)
  assert.ok(cx > 128 && cy > 128 && Math.abs(cx - cy) < 4, `corner: ${cx}, ${cy}`)
  const near = at(field, 2, 60)[0]
  const mid = at(field, 15, 60)[0]
  const past = at(field, 31, 60)[0]
  assert.ok(near > mid && mid > past, `fades: ${near} > ${mid} > ${past}`)
  assert.equal(past, 128)
})

test('goo cuts a blur at about half: overlapping blurs join, a lone faint one vanishes', () => {
  const alphas = [0, 60, 112, 127, 144, 200, 255]
  const data = new Uint8ClampedArray(alphas.flatMap((a) => [0, 0, 0, a]))
  cutAtHalf(data)
  const out = alphas.map((_, index) => data[index * 4 + 3])
  assert.deepEqual(out.slice(0, 3), [0, 0, 0])
  assert.ok(out[3] > 0 && out[3] < 255, 'a soft pixel at the cut, not a stair step')
  assert.deepEqual(out.slice(4), [255, 255, 255])
})

import { windowsMaterialSupported } from '../src/platform.js'

test('Windows glass is offered from Windows 11 22H2 (build 22621) on, and nowhere else', () => {
  assert.equal(windowsMaterialSupported('win32', '10.0.22621'), true)
  assert.equal(windowsMaterialSupported('win32', '10.0.26100'), true)
  assert.equal(windowsMaterialSupported('win32', '10.0.22000'), false, 'Windows 11 21H2 has no Acrylic for apps')
  assert.equal(windowsMaterialSupported('win32', '10.0.20348'), false, 'Windows Server 2022')
  assert.equal(windowsMaterialSupported('win32', 'garbage'), false)
  assert.equal(windowsMaterialSupported('darwin', '25.0.0'), false)
  assert.equal(windowsMaterialSupported('linux', '6.8.0'), false)
})
