import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import { createRequire } from 'node:module'
import path from 'node:path'

export const root = path.resolve(import.meta.dirname, '..')
const require = createRequire(import.meta.url)
export function packageBin(name, bin) {
  const pkgPath = require.resolve(`${name}/package.json`)
  const pkg = require(pkgPath)
  const entry = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin[bin]
  if (!entry)
    throw new Error(`Missing executable: ${name}/${bin}`)
  return path.resolve(path.dirname(pkgPath), entry)
}
export function runNode(bin, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [bin, ...args], { cwd: root, stdio: 'inherit', ...options })
    child.on('error', reject)
    child.on('exit', (code, signal) => code === 0 ? resolve() : reject(new Error(`${path.basename(bin)} exited with ${signal || code}`)))
  })
}
export async function buildElectron() {
  const { build } = await import('vite')
  await fs.rm(path.join(root, 'dist-electron'), { recursive: true, force: true })
  for (const mode of ['main', 'shell', 'guest'])
    await build({ configFile: path.join(root, 'vite.electron.config.ts'), mode })
}
