import type { DesktopState } from '../shared/desktop'
import fs from 'node:fs/promises'
import path from 'node:path'
import { app, autoUpdater } from 'electron'
import { updateElectronApp, UpdateSourceType } from 'update-electron-app'
import { validUpdateRepository } from './policies'

export async function initializeUpdates(
  onState: (state: DesktopState['updates']) => void,
  environment = { packaged: app.isPackaged, platform: process.platform as string },
): Promise<boolean> {
  if (!environment.packaged || !['darwin', 'win32'].includes(environment.platform)) {
    onState({ status: 'disabled', message: environment.packaged ? 'Use your Linux package manager to update.' : 'Automatic updates run in installed releases.' })
    return false
  }
  const metadata = JSON.parse(await fs.readFile(path.join(app.getAppPath(), 'package.json'), 'utf8'))
  const repo = metadata.desktop?.updateRepository
  if (!validUpdateRepository(repo) || metadata.desktop?.updatesEnabled !== true) {
    onState({ status: 'disabled', message: 'Configure the release repository to enable updates.' })
    return false
  }
  autoUpdater.on('checking-for-update', () => onState({ status: 'checking', message: 'Checking for updates…' }))
  autoUpdater.on('update-available', () => onState({ status: 'available', message: 'An update is downloading.' }))
  autoUpdater.on('update-not-available', () => onState({ status: 'idle', message: 'You are up to date.' }))
  autoUpdater.on('update-downloaded', () => onState({ status: 'downloaded', message: 'Update ready. Restart when prompted.' }))
  autoUpdater.on('error', (error) => {
    console.error('[updates]', error.message)
    onState({ status: 'error', message: 'Update check failed. Try again later.' })
  })
  onState({ status: 'idle', message: 'Automatic updates are enabled.' })
  updateElectronApp({ updateSource: { type: UpdateSourceType.ElectronPublicUpdateService, repo }, updateInterval: '1 hour', notifyUser: true })
  return true
}
