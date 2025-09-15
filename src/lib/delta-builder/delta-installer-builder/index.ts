/* eslint-disable no-nested-ternary */
import fs from 'fs-extra';
import path from 'path';
import envPaths from 'env-paths';
import { downloadFile, safeSpawn, extract7zip } from '../utils';

interface DeltaInstallerBuilderOptions {
  logger?: Console;
  nsisURL?: string;
  APP_GUID?: string;
  PRODUCT_NAME?: string;
  PROCESS_NAME?: string;
}

interface NSISPath {
  makeNSISPath: string;
  nsisRootPath: string;
}

const defaultOptions: DeltaInstallerBuilderOptions = {
  logger: console,
  nsisURL: 'https://github.com/electron-delta/nsis.zip/raw/main/nsis.zip',
};

class DeltaInstallerBuilder {
  private options: DeltaInstallerBuilderOptions;
  private defines: { [key: string]: string | undefined };
  private installerNSIPath!: string;

  constructor(options: DeltaInstallerBuilderOptions = {}) {
    this.options = {
      ...defaultOptions,
      ...options,
    };

    this.defines = {
      APP_GUID: this.options.APP_GUID,
      PRODUCT_NAME: this.options.PRODUCT_NAME,
      PROCESS_NAME: this.options.PROCESS_NAME || this.options.PRODUCT_NAME,
    };
  }

  private get logger() {
    return this.options.logger || console;
  }

  private async getNSISPath(): Promise<NSISPath> {
    const paths = envPaths('electron-delta-bins');
    const deltaBinsDir =
      process.platform === 'win32'
        ? path.join(process.env.APPDATA || '', 'electron-delta-bins')
        : paths.data;
    const nsisRootPath = path.join(deltaBinsDir, 'nsis-3.0.5.0');
    const makeNSISPath = path.join(
      nsisRootPath,
      process.platform === 'darwin'
        ? 'mac'
        : process.platform === 'win32'
        ? 'Bin'
        : 'linux',
      process.platform === 'win32' ? 'makensis.exe' : 'makensis'
    );

    if (fs.existsSync(makeNSISPath)) {
      this.logger.log('Cache exists: ', makeNSISPath);
      return { makeNSISPath, nsisRootPath };
    }

    await fs.ensureDir(deltaBinsDir);

    this.logger.log('Start downloading from', this.options.nsisURL);

    const filePath = await downloadFile(
      this.options.nsisURL || '',
      path.join(deltaBinsDir, 'nsis.zip')
    );

    this.logger.log('Downloaded ', filePath);
    await extract7zip(filePath, deltaBinsDir);
    return { makeNSISPath, nsisRootPath };
  }

  private static getNSISScript(): string {
    return path.resolve(path.join(__dirname, './nsis/installer.nsi'));
  }

  private getNSISArgs(): string[] {
    const args: string[] = [];
    Object.keys(this.defines).forEach((key) => {
      const value = this.defines[key];
      if (value) {
        args.push(`-D${key}=${value}`);
      }
    });
    return args;
  }

  private async executeNSIS(): Promise<boolean> {
    const args = this.getNSISArgs();
    const { makeNSISPath, nsisRootPath } = await this.getNSISPath();
    args.push(this.installerNSIPath);

    this.logger.log('NSIS args ', args);
    try {
      this.logger.log('Compiling with makensis ', this.installerNSIPath);
      await safeSpawn(makeNSISPath, args, {
        cwd: path.dirname(this.installerNSIPath),
        env: { ...process.env, NSISDIR: nsisRootPath },
        stdio: 'inherit',
      });
      return true;
    } catch (err) {
      this.logger.log(err);
      return false;
    }
  }

  public async build({
    installerOutputPath,
    deltaFilePath,
    deltaFileName,
    productIconPath,
  }: {
    installerOutputPath: string;
    deltaFilePath: string;
    deltaFileName: string;
    productIconPath?: string;
  }): Promise<string | null> {
    this.installerNSIPath = DeltaInstallerBuilder.getNSISScript();

    this.defines.INSTALLER_OUTPUT_PATH = installerOutputPath;
    this.defines.DELTA_FILE_PATH = deltaFilePath;
    this.defines.DELTA_FILE_NAME = deltaFileName;
    this.defines.PRODUCT_ICON_PATH = productIconPath;

    let created = false;
    try {
      created = await this.executeNSIS();
    } catch (err) {
      console.error(err);
    }
    if (!created) {
      return null;
    }

    this.logger.log('EXE created: ', installerOutputPath);
    return installerOutputPath;
  }
}

export default DeltaInstallerBuilder;
