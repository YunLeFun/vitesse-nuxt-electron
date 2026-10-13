import { builtinModules } from 'node:module'
import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig(({ mode }) => {
  const entry = mode === 'shell' ? 'preload.shell' : mode === 'guest' ? 'preload.guest' : 'main'
  return {
    publicDir: false,
    build: {
      outDir: 'dist-electron',
      emptyOutDir: false,
      minify: false,
      sourcemap: false,
      target: 'node24',
      lib: { entry: path.resolve('electron', `${entry}.ts`), formats: ['cjs'], fileName: () => `${entry}.cjs` },
      rolldownOptions: {
        external: ['electron', 'electron-squirrel-startup', 'update-electron-app', ...builtinModules, ...builtinModules.map(name => `node:${name}`)],
        output: { codeSplitting: false },
      },
    },
  }
})
