import { ipcRenderer } from 'electron'

const RENDERER_MESSAGE = '@electron-delta-update/updater:renderer'
const MAIN_MESSAGE = '@electron-delta-update/updater:main'

process.once('loaded', () => {
  window.addEventListener(RENDERER_MESSAGE, (event: Event) => {
    const customEvent = event as CustomEvent
    ipcRenderer.send(RENDERER_MESSAGE, customEvent.detail)
  })

  ipcRenderer.removeAllListeners(MAIN_MESSAGE)

  ipcRenderer.on(MAIN_MESSAGE, (_event, data) => {
    window.dispatchEvent(new CustomEvent(MAIN_MESSAGE, { detail: data }))
  })
})
