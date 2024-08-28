/* eslint-disable no-restricted-syntax */
/* eslint-disable global-require */
import path from 'path';
import createAllDeltas from './create-all-deltas';
import { fileNameFromUrl, removeExt } from './utils';

interface Context {
  outDir: string;
  artifactPaths: string[];
  platformToTargets: Map<any, any>;
}

interface Options {
  logger?: Console;
  sign: (filePath: string) => void;
  productIconPath: string;
  productName: string;
  processName?: string;
  cache?: string;
  latestVersion?: string;
  getPreviousReleases: (options: {
    platform: string;
    target: string;
  }) => Promise<any>;
}

const macOSBinaries = [
  path.join(__dirname, './mac-updater-binaries/hpatchz'),
  path.join(__dirname, './mac-updater-binaries/mac-updater'),
];

const getLatestReleaseInfo = ({
  artifactPaths,
  platform,
  target,
}: {
  artifactPaths: string[];
  platform: string;
  target: string;
}) => {
  const latestReleaseFilePath = artifactPaths.filter((d) => {
    if (platform === 'win' && target === 'nsis' && !d.includes('nsis-web')) {
      return d.endsWith('.exe');
    }
    if (platform === 'win' && target === 'nsis-web') {
      return d.endsWith('.7z');
    }
    if (platform === 'mac') {
      return d.endsWith('.zip');
    }
    return false;
  })[0];

  const latestReleaseFileName = removeExt(
    fileNameFromUrl(latestReleaseFilePath)
  );

  return { latestReleaseFilePath, latestReleaseFileName };
};

const DeltaBuilder = {
  build: async ({
    context,
    options,
  }: {
    context: Context;
    options: Options;
  }) => {
    console.log('Building deltas...');
    console.debug('context', context);
    console.debug('options', options);
    console.log('platformToTargets', context.platformToTargets);

    const { outDir, artifactPaths, platformToTargets } = context;
    const logger = options.logger || console;
    const { sign, productIconPath, productName, getPreviousReleases } = options;
    const processName = options.processName || productName;

    const cacheDir =
      process.env.ELECTRON_DELTA_CACHE ||
      options.cache ||
      path.join(require('os').homedir(), '.electron-delta');

    const latestVersion =
      options.latestVersion || process.env.npm_package_version || '';
    const buildFiles: string[] = [];

    for (const platform of platformToTargets.keys()) {
      const platformName = platform.buildConfigurationKey;
      console.log('Building deltas for platform: ', platformName);

      if (platformName === 'win') {
        // Create delta for Windows
        const targets = platformToTargets.get(platform);
        const target = targets.entries().next().value[0];
        console.log('Only first target name is taken: ', target);
        const { latestReleaseFilePath, latestReleaseFileName } =
          getLatestReleaseInfo({
            artifactPaths,
            platform: platformName,
            target,
          });
        const deltaInstallerFilesWindows = await createAllDeltas({
          platform: platformName,
          outDir,
          logger,
          cacheDir,
          target,
          getPreviousReleases,
          sign,
          productIconPath,
          productName,
          processName,
          latestReleaseFilePath,
          latestReleaseFileName,
          latestVersion,
        });
        if (deltaInstallerFilesWindows && deltaInstallerFilesWindows.length) {
          buildFiles.push(...deltaInstallerFilesWindows);
        }
      }

      if (platformName === 'mac') {
        // Create delta for macOS
        const { latestReleaseFilePath, latestReleaseFileName } =
          getLatestReleaseInfo({
            artifactPaths,
            platform: platformName,
            target: 'zip',
          });
        const deltaInstallerFilesMac = await createAllDeltas({
          platform: platformName,
          outDir,
          logger,
          cacheDir,
          target: 'zip',
          getPreviousReleases,
          sign,
          productIconPath,
          productName,
          processName,
          latestReleaseFilePath,
          latestReleaseFileName,
          latestVersion,
        });
        if (deltaInstallerFilesMac && deltaInstallerFilesMac.length) {
          buildFiles.push(...deltaInstallerFilesMac);
        }
        console.log(
          'Adding macOS updater helper binaries ',
          deltaInstallerFilesMac
        );
        buildFiles.push(...macOSBinaries);
      }
    }
    console.debug('Created delta files', buildFiles);
    return buildFiles;
  },
};

export default DeltaBuilder;
