import { BrowserWindow } from 'electron'
import { autoUpdater, UpdateInfo } from 'electron-updater'

export default function setupAutoUpdater(mainWindow: BrowserWindow | null) {
  // Configure the feed URL if not using the default electron-updater setup
  // autoUpdater.setFeedURL({ provider: 's3', bucket: 'your-s3-bucket', ... });

  // Optional: Set the channel based on your versioning strategy
  // autoUpdater.channel = 'beta'; // or 'latest'

  autoUpdater.autoDownload = false // We'll handle download manually to show progress

  // Event listeners
  autoUpdater.on('checking-for-update', () => {
    sendStatusToRenderer('Checking for updates...')
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    sendStatusToRenderer('Update available.')
    mainWindow?.webContents.send('update_available', info)
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    sendStatusToRenderer('Update not available.')
    mainWindow?.webContents.send('update_not_available', info)
  })

  autoUpdater.on('error', (err) => {
    sendStatusToRenderer(
      `Error in auto-updater: ${err == null ? 'unknown' : (err.stack || err).toString()}`
    )
    mainWindow?.webContents.send('update_error', err)
  })

  autoUpdater.on('download-progress', (progress) => {
    sendStatusToRenderer(
      `Download speed: ${progress.bytesPerSecond} - Downloaded ${progress.percent}%`
    )
    mainWindow?.webContents.send('download_progress', progress)
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    sendStatusToRenderer('Update downloaded; will install now')
    mainWindow?.webContents.send('update_downloaded', info)
  })

  // Check for updates
  autoUpdater.checkForUpdates()

  function sendStatusToRenderer(text: string) {
    console.log(text)
    mainWindow?.webContents.send('message', text)
  }
}
