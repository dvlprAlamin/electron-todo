import { EventEmitter } from 'events';
import electron, { App, BrowserWindow, Notification } from 'electron';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs-extra';
import fetch from 'cross-fetch';
import semver from 'semver';
import { spawnSync, execFile, execSync } from 'child_process';
import yaml from 'yaml';
import { downloadFile, niceBytes } from './download';
import { getGithubFeedURL } from './github-provider';
import { getGenericFeedURL } from './generic-provider';
import { newBaseUrl, newUrlFromBase } from './utils';
import { getStartURL, getWindow, dispatchEvent } from './splash';

const { app } = electron;
const oneMinute = 60 * 1000;
const fifteenMinutes = 15 * oneMinute;

const getChannel = (): string => {
  const version = app.getVersion();
  const preRelease = semver.prerelease(version);
  if (!preRelease) return 'latest';

  return preRelease[0] as string;
};

const getAppName = (): string => app.getName();

const computeSHA256 = (filePath: string): string | null => {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const fileBuffer = fs.readFileSync(filePath);
  const sum = crypto.createHash('sha256');
  sum.update(fileBuffer);
  const hex = sum.digest('hex');
  return hex;
};

const isSHACorrect = (filePath: string, correctSHA: string): boolean => {
  try {
    const sha = computeSHA256(filePath);
    return sha === correctSHA;
  } catch (e) {
    return false;
  }
};

const stripTrailingSlash = (str: string): string =>
  str.endsWith('/') ? str.slice(0, -1) : str;

interface DeltaUpdaterOptions {
  logger?: Console;
  autoUpdater?: any;
  hostURL?: string | null;
}

class DeltaUpdater extends EventEmitter {
  private autoUpdateInfo: any = null;
  private logger: Console;
  private autoUpdater: any;
  private hostURL: string | null;
  private appPath: string | null = null;
  private appName: string | null = null;
  private updateConfig: any;
  private updaterWindow: BrowserWindow | null = null;
  private deltaUpdaterRootPath: string | null = null;
  private updateDetailsJSON: string | null = null;
  private deltaHolderPath: string | null = null;
  private macUpdaterPath: string | null = null;
  private hpatchzPath: string | null = null;

  constructor(options: DeltaUpdaterOptions) {
    super();
    this.logger = options.logger || console;
    this.autoUpdater =
      options.autoUpdater || require('electron-updater').autoUpdater;
    this.hostURL = options.hostURL || null;

    if (app.isPackaged) {
      this.setConfigPath();
      this.prepareUpdater();
      this.appPath = stripTrailingSlash(path.dirname(app.getPath('exe')));
      this.appName = getAppName();
      this.logger.info('[Updater] App path = ', this.appPath);
    }
  }

  private setConfigPath() {
    const updateConfigPath = path.join(process.resourcesPath, 'app-update.yml');
    this.updateConfig = yaml.parse(fs.readFileSync(updateConfigPath, 'utf8'));
  }

  private async guessHostURL(): Promise<string | null> {
    if (!this.updateConfig) {
      return null;
    }

    let hostURL: string | null = null;
    try {
      switch (this.updateConfig.provider) {
        case 'github':
          hostURL = await getGithubFeedURL(this.updateConfig);
          break;
        case 'generic':
          hostURL = await getGenericFeedURL(this.updateConfig);
          break;
        default:
          hostURL = await this.computeHostURL();
      }
    } catch (e) {
      this.logger.error('[Updater] Guess host url error ', e);
    }
    if (!hostURL) {
      return null;
    }
    hostURL = newBaseUrl(hostURL);
    return hostURL;
  }

  private async computeHostURL(): Promise<string> {
    const provider = await this.autoUpdater.clientPromise;
    return provider.baseUrl.href;
  }

  private async prepareUpdater() {
    const channel = getChannel();
    if (!channel) return;

    this.logger.info('[Updater]  CHANNEL = ', channel);
    this.autoUpdater.channel = channel;
    this.autoUpdater.logger = this.logger;

    this.autoUpdater.allowDowngrade = false;
    this.autoUpdater.autoDownload = false;
    this.autoUpdater.autoInstallOnAppQuit = false;

    this.deltaUpdaterRootPath = path.join(
      app.getPath('appData'),
      `../Local/${this.updateConfig.updaterCacheDirName}`
    );

    this.updateDetailsJSON = path.join(
      this.deltaUpdaterRootPath,
      './update-details.json'
    );
    this.deltaHolderPath = path.join(this.deltaUpdaterRootPath, './deltas');

    if (app.isPackaged && process.platform === 'darwin') {
      this.macUpdaterPath = path.join(
        this.deltaUpdaterRootPath,
        './mac-updater'
      );
      this.hpatchzPath = path.join(this.deltaUpdaterRootPath, './hpatchz');
    }
  }

  private checkForUpdates(resolve: Function, reject: Function) {
    this.logger.log('[Updater] Checking for updates...');
    if (
      !this.hostURL &&
      this.updateConfig &&
      this.updateConfig.provider === 'github'
    ) {
      getGithubFeedURL(this.updateConfig)
        .then((hostURL) => {
          this.logger.log('[Updater] github hostURL = ', hostURL);
          this.hostURL = newBaseUrl(hostURL as string);
          this.autoUpdater.checkForUpdates();
        })
        .catch((err) => {
          this.logger.error('[Updater] check for updates failed.');
          dispatchEvent(this.updaterWindow, 'error', err);
          reject(err);
        });
    } else {
      this.autoUpdater.checkForUpdates();
    }
  }

  private pollForUpdates(resolve: Function, reject: Function) {
    this.checkForUpdates(resolve, reject);
    setInterval(() => {
      this.checkForUpdates(resolve, reject);
    }, fifteenMinutes);
  }

  private ensureSafeQuitAndInstall() {
    this.logger.info('[Updater] Ensure safe-quit and install');
    app.removeAllListeners('window-all-closed');
    const browserWindows = BrowserWindow.getAllWindows();
    browserWindows.forEach((browserWindow) => {
      browserWindow.removeAllListeners('close');
      if (!browserWindow.isDestroyed()) {
        browserWindow.close();
      }
    });
  }

  private async writeAutoUpdateDetails({
    isDelta,
    attemptedVersion,
  }: {
    isDelta: boolean;
    attemptedVersion: string;
  }) {
    if (process.platform === 'darwin') return;

    const date = new Date();
    const data = {
      isDelta,
      attemptedVersion,
      appVersion: app.getVersion(),
      timestamp: date.getTime(),
      timeHuman: date.toString(),
    };
    try {
      await fs.writeJSON(this.updateDetailsJSON!, data);
    } catch (e) {
      this.logger.error('[Updater] ', e);
    }
  }

  private async getAutoUpdateDetails(): Promise<any> {
    let data = null;
    try {
      data = await fs.readJSON(this.updateDetailsJSON!);
    } catch (e) {
      this.logger.error(`[Updater] ${this.updateDetailsJSON} file not found`);
    }
    return data;
  }

  private async setFeedURL(feedURL: string) {
    try {
      this.logger.log(
        '[Updater] Setting Feed URL for native updater: ',
        feedURL
      );
      await this.autoUpdater.setFeedURL(feedURL);
    } catch (e) {
      this.logger.error('[Updater] FeedURL set error ', e);
    }
  }

  private createSplashWindow() {
    this.updaterWindow = getWindow();
  }

  private attachListeners(resolve: Function, reject: Function) {
    if (!app.isPackaged) {
      setTimeout(() => {
        resolve();
      }, 1000);
      return;
    }
    this.autoUpdater.removeAllListeners();
    this.pollForUpdates(resolve, reject);

    this.logger.log('[Updater] Attaching listeners');

    this.autoUpdater.on('checking-for-update', () => {
      this.logger.log('[Updater] Checking for update');
      dispatchEvent(this.updaterWindow, 'checking-for-update');
    });

    this.autoUpdater.on('error', (error: Error) => {
      this.logger.error('[Updater] Error: ', error);
      this.emit('error', error);
      dispatchEvent(this.updaterWindow, 'error', error);
      reject(error);
    });

    this.autoUpdater.on('update-available', async (info: any) => {
      this.logger.info('[Updater] Update available ', info);
      this.emit('update-available', info);
      dispatchEvent(this.updaterWindow, 'update-available', info);

      const updateDetails = await this.getAutoUpdateDetails();
      if (updateDetails) {
        this.logger.info('[Updater] Last Auto Update details: ', updateDetails);
        const appVersion = app.getVersion();
        this.logger.info('[Updater] Current app version ', appVersion);
        if (updateDetails.appVersion === appVersion) {
          this.logger.info(
            '[Updater] Last attempted update failed, trying using normal updater'
          );
          this.autoUpdater.downloadUpdate();
          return;
        }
      }

      this.doSmartDownload(info);
    });

    this.autoUpdater.on('download-progress', (info: any) => {
      this.emit('download-progress', info);
      this.logger.info(
        '[Updater] Download speed: ',
        niceBytes(info.bytesPerSecond)
      );
      this.logger.info('[Updater] Download progress: ', info.percent);
      this.logger.info('[Updater] Downloaded ', niceBytes(info.transferred));
      this.logger.info('[Updater] Out of ', niceBytes(info.total));
      dispatchEvent(this.updaterWindow, 'download-progress', info);
    });

    this.autoUpdater.on('update-downloaded', (info: any) => {
      this.logger.info('[Updater] Update downloaded ', info);
      this.emit('update-downloaded', info);
      dispatchEvent(this.updaterWindow, 'update-downloaded', info);
      const notification = new Notification({
        title: 'Update Ready!',
        body: 'The update is ready. Please quit the app and reopen to apply the update.',
      });
      notification.show();
    });
  }

  private async runMacDeltaApply(fileName: string): Promise<boolean> {
    if (!this.macUpdaterPath || !this.hpatchzPath || !this.deltaHolderPath) {
      this.logger.error('[Updater] Mac Delta path not set.');
      return false;
    }
    const deltaPath = path.join(this.deltaHolderPath, fileName);
    const verifySHAFail = isSHACorrect(deltaPath, 'some-correct-sha'); // Replace with actual correct SHA
    if (!verifySHAFail) {
      this.logger.error('[Updater] SHA256 verification failed');
      return false;
    }

    const cmd = `${this.macUpdaterPath} ${this.hpatchzPath} ${this.appPath} ${deltaPath}`;
    try {
      execSync(cmd);
      return true;
    } catch (e) {
      this.logger.error('[Updater] Mac Delta apply failed ', e);
      return false;
    }
  }

  private doSmartDownload(info: any) {
    const downloadURL = newUrlFromBase(this.hostURL!, info.path);
    this.logger.info('[Updater] Download URL: ', downloadURL);

    downloadFile(downloadURL, this.deltaHolderPath!, (fileName) => {
      if (process.platform === 'darwin') {
        // this.runMacDeltaApply(fileName).then((success) => {
        //   if (success) {
        //     this.logger.info('[Updater] Delta update applied successfully');
        //     this.writeAutoUpdateDetails({ isDelta: true, attemptedVersion: info.version });
        //   } else {
        //     this.autoUpdater.downloadUpdate();
        //   }
        // });
      } else {
        this.autoUpdater.downloadUpdate();
      }
    });
  }

  public start() {
    return new Promise((resolve, reject) => {
      this.createSplashWindow();
      this.attachListeners(resolve, reject);
    });
  }
}

export default DeltaUpdater;
