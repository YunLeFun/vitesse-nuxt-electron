import { buildElectron, packageBin, runNode } from './lib.mjs'

await runNode(packageBin('nuxt', 'nuxt'), ['generate'])
await buildElectron()
