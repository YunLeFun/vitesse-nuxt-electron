import fs from 'node:fs/promises'
import path from 'node:path'
import { extractFile, listPackage } from '@electron/asar'
import { FuseState, FuseV1Options, getCurrentFuseWire } from '@electron/fuses'
import forge from '../forge.config.cjs'
import { root } from './lib.mjs'

const metadata = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'))
const archives = []
for (const entry of await fs.readdir(path.join(root, 'out'), { withFileTypes: true })) {
  if (!entry.isDirectory() || entry.name === 'make')
    continue
  for (const relative of ['resources/app.asar', `${metadata.productName}.app/Contents/Resources/app.asar`]) {
    const file = path.join(root, 'out', entry.name, relative)
    if (await fs.stat(file).then(() => true, () => false))
      archives.push(file)
  }
}
if (!archives.length)
  throw new Error('No packaged app found. Run pnpm package first.')
for (const archive of archives) {
  const files = listPackage(archive)
  for (const required of ['/package.json', '/dist-electron/main.cjs', '/dist-electron/preload.shell.cjs', '/dist-electron/preload.guest.cjs', '/.output/public/index.html']) {
    if (!files.includes(required))
      throw new Error(`Missing packaged file: ${required}`)
  }
  for (const file of files) {
    if (/^\/(?:electron|scripts|tests|server|app|\.git|\.env)(?:\/|$)/.test(file) || file.startsWith('/.output/server/'))
      throw new Error(`Unexpected source or server content in package: ${file}`)
  }
  const pkg = JSON.parse(extractFile(archive, 'package.json').toString())
  if (pkg.main !== 'dist-electron/main.cjs')
    throw new Error('Incorrect packaged entry')
  if (!files.includes('/node_modules/update-electron-app/package.json'))
    throw new Error('Updater dependency is missing')
  const binary = archive.includes('/Contents/Resources/')
    ? path.resolve(path.dirname(archive), '../..')
    : path.join(path.dirname(path.dirname(archive)), forge.packagerConfig.executableName + (archive.includes('-win32-') ? '.exe' : ''))
  const fuses = await getCurrentFuseWire(binary)
  for (const key of [FuseV1Options.RunAsNode, FuseV1Options.EnableNodeOptionsEnvironmentVariable, FuseV1Options.EnableNodeCliInspectArguments]) {
    if (fuses[key] !== FuseState.DISABLE)
      throw new Error(`Packaged development feature is enabled: ${key}`)
  }
  for (const key of [FuseV1Options.EnableCookieEncryption, FuseV1Options.OnlyLoadAppFromAsar]) {
    if (fuses[key] !== FuseState.ENABLE)
      throw new Error(`Packaged protection is disabled: ${key}`)
  }
  console.info(`Verified static renderer, isolated preloads and updater: ${archive}`)
}
