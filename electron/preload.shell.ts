import type { DesktopBridge, DesktopRequest, DesktopState } from '../shared/desktop'
import { contextBridge, ipcRenderer } from 'electron'
import { SHELL_REQUEST, SHELL_STATE } from '../shared/desktop'

const invoke = (request: DesktopRequest): Promise<DesktopState> => ipcRenderer.invoke(SHELL_REQUEST, request)
if (process.isMainFrame) {
  const bridge: DesktopBridge = {
    version: 1,
    getState: () => invoke({ type: 'snapshot' }),
    openExample: example => invoke({ type: 'open-example', example }),
    command: command => invoke({ type: 'guest-command', command }),
    setViewport: bounds => invoke({ type: 'viewport', bounds }),
    setTheme: preference => invoke({ type: 'theme', preference }),
    checkUpdates: () => invoke({ type: 'check-updates' }),
    onState(listener) {
      const receive = (_event: unknown, state: DesktopState) => listener(state)
      ipcRenderer.on(SHELL_STATE, receive)
      return () => ipcRenderer.removeListener(SHELL_STATE, receive)
    },
  }
  contextBridge.exposeInMainWorld('desktop', bridge)
}
