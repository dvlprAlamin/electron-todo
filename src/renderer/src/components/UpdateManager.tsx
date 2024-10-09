// src/components/UpdateManager.tsx
import React, { useEffect, useState } from 'react'

interface UpdateInfo {
  version: string
  releaseName: string
  releaseDate: string
}

const UpdateManager: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState<UpdateInfo | null>(null)
  const [updateDownloaded, setUpdateDownloaded] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<number>(0)
  const [message, setMessage] = useState<string>('')

  useEffect(() => {
    // Listener for messages
    // @ts-ignore
    window.autoUpdateApi.onUpdateAvailable((event: any, info: UpdateInfo) => {
      setUpdateAvailable(info)
      alert(`Update available: Version ${info.version}`)
    })
    // @ts-ignore
    window.autoUpdateApi.onUpdateNotAvailable((event: any, info: any) => {
      setMessage('No updates available.')
    })
    // @ts-ignore
    window.autoUpdateApi.onDownloadProgress((event: any, progress: any) => {
      setDownloadProgress(Math.round(progress.percent))
    })
    // @ts-ignore
    window.autoUpdateApi.onUpdateDownloaded((event: any, info: UpdateInfo) => {
      setUpdateDownloaded(info)
      alert('Update downloaded; application will restart to apply the update.')
      // Optionally, prompt the user before restarting
    })

    // window.electron.on('message', (event: any, text: string) => {
    //   setMessage(text);
    // });
  }, [])

  const handleDownloadUpdate = () => {
    // Trigger the download
    // @ts-ignore
    window.autoUpdateApi.send('download_update', null)
  }

  const handleRestart = () => {
    // @ts-ignore
    window.autoUpdateApi.send('restart_app', null)
  }

  return (
    <div>
      {updateAvailable && (
        <div className="update-available">
          <p>Update Available: Version {updateAvailable.version}</p>
          <button onClick={handleDownloadUpdate}>Download Update</button>
        </div>
      )}
      {downloadProgress > 0 && downloadProgress < 100 && (
        <div className="download-progress">
          <p>Downloading Update: {downloadProgress}%</p>
          <progress value={downloadProgress} max="100"></progress>
        </div>
      )}
      {updateDownloaded && (
        <div className="update-downloaded">
          <p>Update Downloaded: Version {updateDownloaded.version}</p>
          <button onClick={handleRestart}>Restart to Update</button>
        </div>
      )}
      {message && <p>{message}</p>}
    </div>
  )
}

export default UpdateManager
