#!/usr/bin/env node
/*
 * Builds native/glass.mm into build/glass.node for both Mac chips. Runs on install; anywhere but a Mac there is
 * nothing to build and the native glass is simply not offered (the page layer still works).
 *
 * It needs only clang and the Node-API header that ships with Node, so no node-gyp: Node-API is the same in
 * Electron's Node as in this one. A Mac that cannot build it says so and the install goes on.
 */
const { execFileSync } = require('node:child_process')
const { existsSync, mkdirSync } = require('node:fs')
const { dirname, join } = require('node:path')

if (process.platform !== 'darwin') process.exit(0)

const root = join(__dirname, '..')
const source = join(root, 'native', 'glass.mm')
const target = join(root, 'build', 'glass.node')
const headers = join(dirname(process.execPath), '..', 'include', 'node')

try {
  if (!existsSync(join(headers, 'node_api.h'))) throw new Error(`no node_api.h under ${headers}`)
  mkdirSync(dirname(target), { recursive: true })
  execFileSync(
    'clang++',
    [
      '-std=c++17', '-ObjC++', '-fobjc-arc', '-O2', '-bundle', '-undefined', 'dynamic_lookup',
      '-arch', 'arm64', '-arch', 'x86_64', '-mmacosx-version-min=11.0',
      `-I${headers}`, '-DNODE_GYP_MODULE_NAME=locust_glass', '-framework', 'AppKit',
      source, '-o', target
    ],
    { stdio: ['ignore', 'inherit', 'inherit'] }
  )
  console.log(`locust-glass: built ${target}`)
} catch (error) {
  console.warn(`locust-glass: the native glass was not built, so it is not offered (${error instanceof Error ? error.message : String(error)})`)
}
