import { EventEmitter } from 'node:events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  spawn: vi.fn(),
  execFile: vi.fn(),
  watch: vi.fn(),
  createServer: vi.fn(),
  buildElectron: vi.fn(),
}))
vi.mock('node:child_process', () => ({ spawn: mocks.spawn, execFile: mocks.execFile }))
vi.mock('node:fs', () => ({ watch: mocks.watch }))
vi.mock('node:net', () => ({ default: { createServer: mocks.createServer } }))
vi.mock('../../scripts/lib.mjs', () => ({
  buildElectron: mocks.buildElectron,
  packageBin: name => name,
  root: '/template',
}))

class Child extends EventEmitter {
  exitCode = null
  signalCode = null
  constructor(pid) {
    super()
    this.pid = pid
  }

  exit(code = 0, signal = null) {
    this.exitCode = code
    this.signalCode = signal
    this.emit('exit', code, signal)
  }
}

function deferred() {
  let resolve
  let reject
  const promise = new Promise((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

let children
let watcher
let listeners
let exitCode
const events = ['SIGINT', 'SIGTERM', 'exit']
function devListener(event) {
  return process.rawListeners(event).find(listener => !listeners[event].includes(listener))
}
function save(file = 'main.ts') {
  mocks.watch.mock.calls[0][2]('change', file)
}

beforeEach(() => {
  vi.resetModules()
  vi.resetAllMocks()
  vi.useFakeTimers()
  vi.stubEnv('PORT', '3000')
  children = []
  watcher = { close: vi.fn() }
  exitCode = process.exitCode
  listeners = Object.fromEntries(events.map(event => [event, process.rawListeners(event)]))
  mocks.spawn.mockImplementation(() => {
    const child = new Child(children.length + 100000)
    children.push(child)
    return child
  })
  // Deliver exit asynchronously, as real taskkill/process-group termination does.
  const terminate = (pid) => {
    const child = children.find(child => child.pid === Math.abs(pid))
    if (child && child.exitCode === null && child.signalCode === null)
      queueMicrotask(() => child.exit(null, 'SIGTERM'))
  }
  vi.spyOn(process, 'kill').mockImplementation((pid) => {
    terminate(pid)
    return true
  })
  mocks.execFile.mockImplementation((_bin, args, done) => {
    terminate(Number(args[1]))
    done()
  })
  mocks.watch.mockReturnValue(watcher)
  mocks.createServer.mockImplementation(() => ({
    once() {},
    listen(_port, _host, ready) { ready() },
    close(done) { done() },
  }))
  mocks.buildElectron.mockResolvedValue(undefined)
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async () => ({
    ok: true,
    json: async () => ({ template: 'vitesse-nuxt-electron' }),
  })))
})

afterEach(async () => {
  devListener('SIGINT')?.()
  await vi.advanceTimersByTimeAsync(0)
  for (const event of events) {
    for (const listener of process.rawListeners(event)) {
      if (!listeners[event].includes(listener))
        process.removeListener(event, listener)
    }
  }
  process.exitCode = exitCode
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('development process supervision', () => {
  it('loads the final save when more edits arrive during a rebuild', async () => {
    const build = deferred()
    let sourceVersion = 0
    let builtVersion = 0
    let launchedVersion
    mocks.buildElectron.mockImplementation(async () => {
      const version = sourceVersion
      if (version === 1)
        await build.promise
      builtVersion = version
    })
    const spawn = mocks.spawn.getMockImplementation()
    mocks.spawn.mockImplementation((...args) => {
      launchedVersion = builtVersion
      return spawn(...args)
    })
    await import('../../scripts/dev.mjs')
    sourceVersion = 1
    save()
    await vi.advanceTimersByTimeAsync(200)
    sourceVersion = 2
    save('preload.shell.ts')
    await vi.advanceTimersByTimeAsync(200)
    sourceVersion = 3
    save('preload.guest.ts')
    await vi.advanceTimersByTimeAsync(200)
    build.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(builtVersion).toBe(3)
    expect(launchedVersion).toBe(3)
    expect(mocks.buildElectron).toHaveBeenCalledTimes(3)
    expect(children).toHaveLength(3)
  })

  it('stops Nuxt and the watcher if Electron exits while a build is pending', async () => {
    await import('../../scripts/dev.mjs')
    const build = deferred()
    mocks.buildElectron.mockReturnValueOnce(build.promise)
    save()
    await vi.advanceTimersByTimeAsync(200)
    children[1].exit()
    await vi.advanceTimersByTimeAsync(0)
    expect(watcher.close).toHaveBeenCalledOnce()
    expect(children[0].signalCode).toBe('SIGTERM')
    build.resolve()
    await vi.advanceTimersByTimeAsync(0)
    expect(children).toHaveLength(2)
    expect(children[1].listenerCount('exit')).toBe(0)
  })

  it('keeps Nuxt alive for a planned restart and stops it when the new Electron exits', async () => {
    await import('../../scripts/dev.mjs')
    save()
    await vi.advanceTimersByTimeAsync(200)
    expect(children).toHaveLength(3)
    expect(children[1].signalCode).toBe('SIGTERM')
    expect(children[0].signalCode).toBeNull()
    expect(watcher.close).not.toHaveBeenCalled()
    children[2].exit()
    await vi.advanceTimersByTimeAsync(0)
    expect(children[0].signalCode).toBe('SIGTERM')
    expect(watcher.close).toHaveBeenCalledOnce()
    if (process.platform === 'win32')
      expect(mocks.execFile).toHaveBeenCalledWith('taskkill', ['/pid', String(children[0].pid), '/T', '/F'], expect.any(Function))
    else
      expect(process.kill).toHaveBeenCalledWith(-children[0].pid, 'SIGTERM')
  })

  it('cancels pending saves and does not respawn after Ctrl+C during a build', async () => {
    await import('../../scripts/dev.mjs')
    const build = deferred()
    mocks.buildElectron.mockReturnValueOnce(build.promise)
    save()
    await vi.advanceTimersByTimeAsync(200)
    save('preload.shell.ts')
    devListener('SIGINT')()
    build.resolve()
    await vi.advanceTimersByTimeAsync(200)
    expect(watcher.close).toHaveBeenCalledOnce()
    expect(children).toHaveLength(2)
    expect(children.every(child => child.signalCode === 'SIGTERM')).toBe(true)
    expect(mocks.buildElectron).toHaveBeenCalledTimes(2)
  })

  it('retries a queued save after the preceding build fails', async () => {
    await import('../../scripts/dev.mjs')
    const build = deferred()
    mocks.buildElectron.mockReturnValueOnce(build.promise)
    save()
    await vi.advanceTimersByTimeAsync(200)
    save('preload.shell.ts')
    await vi.advanceTimersByTimeAsync(200)
    build.reject(new Error('Compilation failed'))
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.buildElectron).toHaveBeenCalledTimes(3)
    expect(children).toHaveLength(3)
    expect(watcher.close).not.toHaveBeenCalled()
  })
})
