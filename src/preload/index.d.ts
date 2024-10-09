import { ElectronAPI } from '@electron-toolkit/preload'

declare global {
  interface Window {
    electron: ElectronAPI
    autoUpdateApi: {
      onUpdateAvailable: (event: any, info: UpdateInfo) => void
      onUpdateNotAvailable: (event: any, info: UpdateInfo) => void
      onDownloadProgress: (event: any, info: UpdateInfo) => void
      onUpdateDownloaded: (event: any, info: UpdateInfo) => void
      send: unknown
    }
  }
}
