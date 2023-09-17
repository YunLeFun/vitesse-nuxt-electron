import { ipcRenderer } from 'electron'

export function toggleElectronDarkMode() {
  ipcRenderer.invoke('dark-mode:toggle')
}
