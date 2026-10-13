import { execFile, spawn } from 'node:child_process'
import { watch } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { buildElectron, packageBin, root } from './lib.mjs'

const port = Number(process.env.PORT || 3000)
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error('PORT must be an integer between 1024 and 65535')
const origin = `http://127.0.0.1:${port}`
await new Promise((resolve, reject) => {
  const probe = net.createServer()
  probe.once('error', () => reject(new Error(`Port ${port} is already in use; choose another PORT.`)))
  probe.listen(port, '127.0.0.1', () => probe.close(resolve))
})
const children = new Set()
let stopping = false
let restarting = false
let restartRequested = false
let expectedExit
let electronProcess
let watcher
let debounce

function start(bin, args, env = {}) {
  const child = spawn(process.execPath, [bin, ...args], {
    cwd: root,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    env: { ...process.env, ...env },
  })
  children.add(child)
  child.once('error', (error) => {
    console.error(error)
    shutdown(1)
  })
  child.once('exit', (code) => {
    children.delete(child)
    if (!stopping && child !== expectedExit)
      shutdown(code || 0)
  })
  return child
}
function kill(child) {
  if (!child?.pid || child.exitCode !== null || child.signalCode !== null)
    return
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(child.pid), '/T', '/F'], () => {})
  }
  else {
    try {
      process.kill(-child.pid, 'SIGTERM')
    }
    catch {
      child.kill('SIGTERM')
    }
  }
}
function shutdown(code = 0) {
  if (stopping)
    return
  stopping = true
  restartRequested = false
  clearTimeout(debounce)
  watcher?.close()
  for (const child of children) kill(child)
  process.exitCode = code
}
process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))
process.once('exit', () => {
  for (const child of children) kill(child)
})

start(packageBin('nuxt', 'nuxt'), ['dev', '--host', '127.0.0.1', '--port', String(port)])
try {
  await buildElectron()
  const deadline = Date.now() + 60000
  let ready = false
  while (!ready && !stopping && Date.now() < deadline) {
    try {
      const response = await fetch(`${origin}/desktop-ready.json`, { signal: AbortSignal.timeout(1500) })
      ready = response.ok && (await response.json()).template === 'vitesse-nuxt-electron'
      if (ready)
        ready = (await fetch(origin, { signal: AbortSignal.timeout(1500) })).ok
    }
    catch {}
    if (!ready)
      await delay(250)
  }
  if (!ready)
    throw new Error('Nuxt did not become ready within 60 seconds')
  if (!stopping)
    electronProcess = start(packageBin('@electron-forge/cli', 'electron-forge'), ['start'], { TEMPLATE_DEV_ORIGIN: origin })
  const restart = async () => {
    if (stopping)
      return
    restartRequested = true
    if (restarting)
      return
    restarting = true
    try {
      while (restartRequested && !stopping) {
        restartRequested = false
        try {
          await buildElectron()
        }
        catch (error) {
          console.error(error)
          continue
        }
        if (stopping)
          break
        // Finish queued edits before launching a replacement with stale bundles.
        if (restartRequested)
          continue
        const old = electronProcess
        if (old && old.exitCode === null && old.signalCode === null) {
          expectedExit = old
          try {
            const exited = new Promise(resolve => old.once('exit', resolve))
            kill(old)
            await exited
          }
          finally { expectedExit = undefined }
        }
        electronProcess = undefined
        if (!stopping && !restartRequested)
          electronProcess = start(packageBin('@electron-forge/cli', 'electron-forge'), ['start'], { TEMPLATE_DEV_ORIGIN: origin })
      }
    }
    catch (error) { console.error(error) }
    finally { restarting = false }
  }
  watcher = watch(path.join(root, 'electron'), { recursive: true }, (_event, file) => {
    if (file?.endsWith('.ts')) {
      clearTimeout(debounce)
      debounce = setTimeout(() => void restart(), 200)
    }
  })
}
catch (error) {
  console.error(error)
  shutdown(1)
}
