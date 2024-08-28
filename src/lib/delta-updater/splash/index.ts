import { BrowserWindow } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';

const MAIN_MESSAGE = '@electron-delta-update/updater:main';

const getWindow = (): BrowserWindow =>
  new BrowserWindow({
    width: 350,
    height: 120,
    resizable: false,
    frame: false,
    show: true,
    titleBarStyle: 'hidden',
    backgroundColor: '#f64f59',
    fullscreenable: false,
    skipTaskbar: false,
    center: true,
    movable: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // enableRemoteModule: false,
      disableBlinkFeatures: 'Auxclick',
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

function getStartURL(): string {
  return pathToFileURL(path.join(__dirname, 'splash.html')).toString();
}

function dispatchEvent(
  updaterWindow: BrowserWindow | null,
  eventName: string,
  payload?: any
): void {
  if (updaterWindow && !updaterWindow.isDestroyed()) {
    updaterWindow.webContents.send(MAIN_MESSAGE, { eventName, payload });
  }
}

export { getWindow, getStartURL, dispatchEvent };
