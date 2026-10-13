import type { IpcMainInvokeEvent, WebContents } from 'electron'
import type { DesktopState, ExampleId, ViewportBounds } from '../shared/desktop'
import path from 'node:path'
import { app, BaseWindow, ipcMain, nativeTheme, session, WebContentsView } from 'electron'
import squirrelStartup from 'electron-squirrel-startup'
import { GUEST_ENVIRONMENT, SHELL_ORIGIN, SHELL_REQUEST, SHELL_STATE } from '../shared/desktop'
import { clampViewport, isAllowedPage, isLoopbackOrigin, parseRequest } from './policies'
import { registerScheme, serveShell } from './protocol'
import { initializeUpdates } from './updates'

const securePreferences = {
  contextIsolation: true,
  sandbox: true,
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
  nodeIntegrationInSubFrames: false,
  webSecurity: true,
}
let window: BaseWindow | undefined
let shellView: WebContentsView | undefined
let guest: WebContentsView | undefined
let viewport: ViewportBounds | null = null
let currentExample: ExampleId | undefined
let updatesReady = false
let state: DesktopState
const devOrigin = !app.isPackaged ? process.env.TEMPLATE_DEV_ORIGIN : undefined
if (devOrigin && !isLoopbackOrigin(devOrigin))
  throw new Error('The development origin must be an HTTP loopback origin')
const testOrigin = !app.isPackaged ? process.env.TEMPLATE_TEST_ORIGIN : undefined
if (testOrigin && !isLoopbackOrigin(testOrigin))
  throw new Error('The test origin must be an HTTP loopback origin')
const examples: Record<ExampleId, string> = {
  electron: testOrigin ? `${testOrigin}/electron` : 'https://www.electronjs.org/docs/latest/',
  nuxt: testOrigin ? `${testOrigin}/nuxt` : 'https://nuxt.com/docs/4.x/getting-started/introduction',
}

function sendState() {
  if (shellView && !shellView.webContents.isDestroyed())
    shellView.webContents.send(SHELL_STATE, state)
}
function isCurrentFrame(event: IpcMainInvokeEvent, contents: WebContents, origin: string) {
  return !contents.isDestroyed() && event.sender === contents
    && event.senderFrame === contents.mainFrame && event.senderFrame.origin === origin
}
function requireShell(event: IpcMainInvokeEvent) {
  if (!shellView || !isCurrentFrame(event, shellView.webContents, devOrigin || SHELL_ORIGIN))
    throw new Error('Forbidden: trusted shell main frame required')
}
function closeGuest() {
  if (guest) {
    if (window && !window.isDestroyed())
      window.contentView.removeChildView(guest)
    guest.webContents.close()
    guest = undefined
  }
  currentExample = undefined
  state.guest = { open: false, title: '', url: '', loading: false, canGoBack: false, canGoForward: false, error: '' }
  sendState()
}
function layout() {
  if (!window || !shellView)
    return
  const size = window.getContentBounds()
  shellView.setBounds({ x: 0, y: 0, width: size.width, height: size.height })
  if (guest && viewport) {
    const bounds = clampViewport(viewport, size, shellView.webContents.getZoomFactor())
    guest.setBounds(bounds)
    guest.setVisible(bounds.width > 0 && bounds.height > 0)
  }
  else { guest?.setVisible(false) }
}
function refreshGuest() {
  if (!guest || guest.webContents.isDestroyed())
    return
  const contents = guest.webContents
  state.guest = {
    open: true,
    title: contents.getTitle(),
    url: contents.getURL(),
    loading: contents.isLoading(),
    canGoBack: contents.navigationHistory.canGoBack(),
    canGoForward: contents.navigationHistory.canGoForward(),
    error: state.guest.error,
  }
  sendState()
}
async function openExample(id: ExampleId) {
  if (guest && currentExample === id) {
    guest.webContents.focus()
    return
  }
  closeGuest()
  const origin = new URL(examples[id]).origin
  const appSession = session.fromPartition(`persist:example-${id}`)
  appSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  appSession.setPermissionCheckHandler(() => false)
  appSession.setDevicePermissionHandler(() => false)
  guest = new WebContentsView({ webPreferences: {
    ...securePreferences,
    session: appSession,
    preload: path.join(__dirname, 'preload.guest.cjs'),
  } })
  currentExample = id
  state.guest.open = true
  state.guest.error = ''
  const view = guest
  const contents = view.webContents
  // An ordinary page never inherits the shell protocol or the shell bridge.
  contents.on('will-navigate', (event, url) => {
    if (!isAllowedPage(url, [origin]))
      event.preventDefault()
  })
  contents.on('will-redirect', (event, url) => {
    if (!isAllowedPage(url, [origin]))
      event.preventDefault()
  })
  contents.setWindowOpenHandler(() => ({ action: 'deny' }))
  const refreshCurrent = () => {
    if (guest === view)
      refreshGuest()
  }
  contents.on('did-start-loading', refreshCurrent)
  contents.on('did-stop-loading', refreshCurrent)
  contents.on('did-navigate', refreshCurrent)
  contents.on('did-navigate-in-page', refreshCurrent)
  contents.on('page-title-updated', refreshCurrent)
  contents.on('render-process-gone', () => {
    if (guest !== view)
      return
    state.guest.error = 'This page stopped. Reload it to continue.'
    sendState()
  })
  contents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
    if (guest === view && isMainFrame && code !== -3) {
      state.guest.error = 'Could not load this page. Check your connection and reload.'
      sendState()
    }
  })
  window!.contentView.addChildView(view)
  layout()
  await contents.loadURL(examples[id]).catch(() => undefined)
  if (guest === view)
    refreshGuest()
}

async function createWindow() {
  window = new BaseWindow({ width: 1180, height: 820, minWidth: 800, minHeight: 600, title: 'Vitesse Nuxt Electron', backgroundColor: '#f5f6f8' })
  const shellSession = session.fromPartition('persist:template-shell')
  shellSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
  shellSession.setPermissionCheckHandler(() => false)
  if (!devOrigin)
    await serveShell(shellSession, path.join(app.getAppPath(), '.output/public'))
  shellView = new WebContentsView({ webPreferences: {
    ...securePreferences,
    session: shellSession,
    preload: path.join(__dirname, 'preload.shell.cjs'),
  } })
  window.contentView.addChildView(shellView)
  layout()
  window.on('resize', layout)
  shellView.webContents.on('zoom-changed', layout)
  shellView.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  shellView.webContents.on('will-navigate', (event, url) => {
    try {
      const target = new URL(url)
      const origin = target.protocol === 'app:' ? `${target.protocol}//${target.host}` : target.origin
      if (origin !== (devOrigin || SHELL_ORIGIN))
        event.preventDefault()
    }
    catch { event.preventDefault() }
  })
  window.on('closed', () => {
    closeGuest()
    shellView?.webContents.close()
    shellView = undefined
    window = undefined
  })
  await shellView.webContents.loadURL(`${devOrigin || SHELL_ORIGIN}/`)
  console.info(`[desktop] ready: ${devOrigin || SHELL_ORIGIN}`)
}

registerScheme()
if (squirrelStartup) {
  app.quit()
}
else if (!app.requestSingleInstanceLock()) {
  app.quit()
}
else {
  app.on('second-instance', () => {
    if (window?.isMinimized())
      window.restore()
    window?.focus()
  })
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin')
      app.quit()
  })
  app.on('activate', () => {
    if (!window)
      void createWindow()
  })
  app.whenReady().then(async () => {
    state = {
      version: app.getVersion(),
      platform: process.platform,
      electron: process.versions.electron,
      chromium: process.versions.chrome,
      guest: { open: false, title: '', url: '', loading: false, canGoBack: false, canGoForward: false, error: '' },
      updates: { status: 'disabled', message: 'Automatic updates run in installed releases.' },
    }
    ipcMain.handle(SHELL_REQUEST, async (event, input: unknown) => {
      requireShell(event)
      const request = parseRequest(input)
      switch (request.type) {
        case 'open-example':
          await openExample(request.example)
          break
        case 'guest-command':
          if (request.command === 'close') {
            closeGuest()
          }
          else if (guest) {
            const history = guest.webContents.navigationHistory
            if (request.command === 'back' && history.canGoBack()) {
              history.goBack()
            }
            else if (request.command === 'forward' && history.canGoForward()) {
              history.goForward()
            }
            else if (request.command === 'reload') {
              state.guest.error = ''
              guest.webContents.reload()
            }
          }
          break
        case 'viewport':
          viewport = request.bounds
          layout()
          break
        case 'theme':
          nativeTheme.themeSource = request.preference
          break
        case 'check-updates':
          if (updatesReady && state.updates.status !== 'checking')
            autoCheckUpdates()
          break
      }
      return state
    })
    ipcMain.handle(GUEST_ENVIRONMENT, (event) => {
      const origin = currentExample ? new URL(examples[currentExample]).origin : ''
      if (!guest || !isCurrentFrame(event, guest.webContents, origin))
        throw new Error('Forbidden: current guest main frame required')
      return { platform: process.platform, version: 1, example: currentExample }
    })
    await createWindow()
    updatesReady = await initializeUpdates((updates) => {
      state.updates = updates
      sendState()
    })
  }).catch((error) => {
    console.error(error)
    app.exit(1)
  })
}

function autoCheckUpdates() {
  import('electron').then(({ autoUpdater }) => autoUpdater.checkForUpdates()).catch((error) => {
    console.error('[updates]', error)
    state.updates = { status: 'error', message: 'Could not check for updates.' }
    sendState()
  })
}
