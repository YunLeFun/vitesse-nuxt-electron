import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ readFile: vi.fn(), listen: vi.fn(), start: vi.fn() }))
vi.mock('node:fs/promises', () => ({ default: { readFile: mocks.readFile } }))
vi.mock('electron', () => ({
  app: { isPackaged: false, getAppPath: () => '/application' },
  autoUpdater: { on: mocks.listen },
}))
vi.mock('update-electron-app', () => ({
  UpdateSourceType: { ElectronPublicUpdateService: 0 },
  updateElectronApp: mocks.start,
}))

const { initializeUpdates } = await import('../../electron/updates')

describe('application update lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.readFile.mockResolvedValue(JSON.stringify({ desktop: {
      updateRepository: 'owner/application',
      updatesEnabled: true,
    } }))
  })
  it('does not initialize a feed in development or on Linux', async () => {
    for (const environment of [{ packaged: false, platform: 'darwin' }, { packaged: true, platform: 'linux' }]) {
      const state = vi.fn()
      expect(await initializeUpdates(state, environment)).toBe(false)
      expect(state).toHaveBeenCalledWith(expect.objectContaining({ status: 'disabled' }))
    }
    expect(mocks.start).not.toHaveBeenCalled()
    expect(mocks.readFile).not.toHaveBeenCalled()
  })
  it('rejects an invalid update source before registering the updater', async () => {
    mocks.readFile.mockResolvedValue(JSON.stringify({ desktop: {
      updateRepository: 'https://untrusted.example/feed',
      updatesEnabled: true,
    } }))
    expect(await initializeUpdates(vi.fn(), { packaged: true, platform: 'win32' })).toBe(false)
    expect(mocks.start).not.toHaveBeenCalled()
  })
  it('uses the configured public repository and reports download state', async () => {
    const state = vi.fn()
    expect(await initializeUpdates(state, { packaged: true, platform: 'darwin' })).toBe(true)
    expect(mocks.start).toHaveBeenCalledWith({
      updateSource: { type: 0, repo: 'owner/application' },
      updateInterval: '1 hour',
      notifyUser: true,
    })
    const downloaded = mocks.listen.mock.calls.find(([event]) => event === 'update-downloaded')![1]
    downloaded()
    expect(state).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'downloaded' }))
  })
})
