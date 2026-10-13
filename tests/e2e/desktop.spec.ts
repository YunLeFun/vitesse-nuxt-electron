import type { ElectronApplication } from '@playwright/test'
import fs from 'node:fs/promises'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

test('static Nuxt routes, restricted bridges, isolated web applications and cleanup', async () => {
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html')
    if (request.url === '/child') {
      response.end('<!doctype html><title>Child frame</title><p>Child frame</p>')
      return
    }
    const label = request.url?.startsWith('/nuxt') ? 'Nuxt fixture' : 'Electron fixture'
    response.end(`<!doctype html><html><head><title>${label}</title></head><body><h1>${label}</h1><a href="/next">Next page</a><a href="https://nuxt.com/">Outside origin</a><button onclick="window.open('/popup')">Popup</button><iframe src="/child"></iframe></body></html>`)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const address = server.address() as { port: number }
  const origin = `http://127.0.0.1:${address.port}`
  const userData = await fs.mkdtemp(path.join(os.tmpdir(), 'vitesse-electron-test-'))
  let application: ElectronApplication | undefined
  try {
    const env: Record<string, string> = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    env.TEMPLATE_TEST_ORIGIN = origin
    delete env.ELECTRON_RUN_AS_NODE
    delete env.TEMPLATE_DEV_ORIGIN
    application = await electron.launch({ args: [path.resolve('.'), `--user-data-dir=${userData}`], env })
    const shell = await application.firstWindow()
    const errors: string[] = []
    shell.on('pageerror', error => errors.push(error.message))
    await expect(shell.getByRole('heading', { name: 'One interface. Separate applications.' })).toBeVisible()
    expect(shell.url()).toBe('app://shell/')
    await expect(shell.getByText(/^Electron \d+\./)).toBeVisible()
    expect(await shell.evaluate(() => ({ node: typeof (window as any).require, ipc: typeof (window as any).ipcRenderer, bridge: window.desktop?.version })))
      .toEqual({ node: 'undefined', ipc: 'undefined', bridge: 1 })
    await shell.getByRole('link', { name: 'About the starter' }).click()
    await expect(shell.getByRole('heading', { name: 'Nuxt for the interface. Electron for the host.' })).toBeVisible()
    await shell.reload()
    await expect(shell.getByRole('heading', { name: 'Nuxt for the interface. Electron for the host.' })).toBeVisible()
    await shell.getByRole('link', { name: 'Back to the application' }).click()
    const guestPage = application.context().waitForEvent('page')
    await shell.getByRole('button', { name: 'Open Electron docs' }).click()
    const guest = await guestPage
    await expect(guest.getByRole('heading', { name: 'Electron fixture' })).toBeVisible()
    expect(await guest.evaluate(() => ({ node: typeof (window as any).require, desktop: typeof (window as any).desktop })))
      .toEqual({ node: 'undefined', desktop: 'undefined' })
    expect(await guest.evaluate(() => (window as any).templateHost.getEnvironment())).toMatchObject({ example: 'electron', version: 1 })
    await expect(guest.frameLocator('iframe').getByText('Child frame', { exact: true })).toBeVisible()
    const childFrame = guest.frames().find(frame => frame.url().endsWith('/child'))!
    expect(await childFrame.evaluate(() => typeof (window as any).templateHost)).toBe('undefined')
    await guest.evaluate(() => localStorage.setItem('isolation', 'electron-only'))
    await guest.getByRole('link', { name: 'Next page' }).click()
    await expect(shell.getByRole('button', { name: 'Go back' })).toBeEnabled()
    await shell.getByRole('button', { name: 'Go back' }).click()
    await expect(guest.getByRole('heading', { name: 'Electron fixture' })).toBeVisible()
    await shell.getByRole('button', { name: 'Go forward' }).click()
    await expect(guest).toHaveURL(`${origin}/next`)
    await shell.getByRole('button', { name: 'Go back' }).click()
    await expect(guest).toHaveURL(`${origin}/electron`)
    await shell.getByRole('button', { name: 'Reload', exact: true }).click()
    await expect(guest.getByRole('heading', { name: 'Electron fixture' })).toBeVisible()
    // Observe the real native navigation decision; blocked navigation has no commit.
    await application.evaluate(({ webContents }, targetOrigin) => {
      const contents = webContents.getAllWebContents().find(value => value.getURL().startsWith(targetOrigin))!
      ;(globalThis as any).__blockedNavigation = false
      contents.once('will-navigate', (event) => {
        ;(globalThis as any).__blockedNavigation = event.defaultPrevented
      })
    }, origin)
    await guest.evaluate(() => {
      location.assign('https://nuxt.com/')
    })
    await expect.poll(() => application!.evaluate(() => (globalThis as any).__blockedNavigation)).toBe(true)
    expect(guest.url()).toBe(`${origin}/electron`)
    const pageCount = application.context().pages().length
    await guest.evaluate(() => {
      window.open('/popup')
    })
    expect(application.context().pages()).toHaveLength(pageCount)
    const nextGuestPage = application.context().waitForEvent('page')
    await shell.getByRole('button', { name: 'Open Nuxt docs' }).click()
    const nextGuest = await nextGuestPage
    await expect(nextGuest.getByRole('heading', { name: 'Nuxt fixture' })).toBeVisible()
    expect(await nextGuest.evaluate(() => localStorage.getItem('isolation'))).toBeNull()
    await shell.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(shell.getByRole('heading', { name: 'Your web application goes here' })).toBeVisible()
    await expect.poll(() => application!.context().pages().length).toBe(1)
    const restoredPage = application.context().waitForEvent('page')
    await shell.getByRole('button', { name: 'Open Electron docs' }).click()
    const restored = await restoredPage
    await restored.waitForLoadState('domcontentloaded')
    expect(await restored.evaluate(() => localStorage.getItem('isolation'))).toBe('electron-only')
    await shell.getByRole('button', { name: 'Close', exact: true }).click()
    await shell.screenshot({ path: path.join(os.tmpdir(), 'vitesse-nuxt-electron-desktop.png') })
    expect(errors).toEqual([])
  }
  finally {
    await application?.close()
    await new Promise<void>(resolve => server.close(() => resolve()))
    await fs.rm(userData, { recursive: true, force: true })
  }
})
