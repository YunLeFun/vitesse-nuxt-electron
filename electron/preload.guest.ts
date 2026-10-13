import { contextBridge, ipcRenderer } from 'electron'
import { GUEST_ENVIRONMENT } from '../shared/desktop'

if (process.isMainFrame) {
  contextBridge.exposeInMainWorld('templateHost', {
    version: 1,
    getEnvironment: () => ipcRenderer.invoke(GUEST_ENVIRONMENT),
  })
}
