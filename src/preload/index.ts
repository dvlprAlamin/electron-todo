import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// Custom APIs for renderer
const api = {
  onUpdateAvailable: (callback: (info: any) => void) =>
    ipcRenderer.on('update_available', callback),
  onUpdateNotAvailable: (callback: (info: any) => void) =>
    ipcRenderer.on('update_not_available', callback),
  onDownloadProgress: (callback: (progress: any) => void) =>
    ipcRenderer.on('download_progress', callback),
  onUpdateDownloaded: (callback: (info: any) => void) =>
    ipcRenderer.on('update_downloaded', callback),
  send: (channel: string, data: any) => ipcRenderer.send(channel, data)
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('autoUpdateApi', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
