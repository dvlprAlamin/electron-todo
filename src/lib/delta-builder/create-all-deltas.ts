/* eslint-disable no-console, no-restricted-syntax, no-await-in-loop */
import path from 'path';
import fs from 'fs-extra';
import semverClean from 'semver/functions/clean';
import DeltaInstallerBuilder from './delta-installer-builder';
import createDelta from './delta-installer-builder/create-delta';
import {
  downloadFileIfNotExists,
  extract7zip,
  computeSHA256,
  fileNameFromUrl,
} from './utils';

interface Release {
  url: string;
  version: string;
}

interface CreateAllDeltasOptions {
  platform: string;
  outDir: string;
  logger: Console;
  cacheDir: string;
  target: string;
  getPreviousReleases: (options: {
    platform: string;
    target: string;
  }) => Promise<Release[]>;
  sign: (filePath: string) => void;
  productIconPath: string;
  productName: string;
  processName: string;
  latestReleaseFilePath: string;
  latestReleaseFileName: string;
  latestVersion: string;
}

const preparePreviousReleases = (previousReleases: Release[]) =>
  previousReleases.map((release) => {
    const { url } = release;
    const version = semverClean(release.version) as string;
    const fileName = fileNameFromUrl(url);
    return { url, version, fileName };
  });

const createAllDeltas = async ({
  platform,
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
}: CreateAllDeltasOptions): Promise<string[] | null> => {
  const dataDir = path.join(cacheDir, './data');
  const deltaDir = path.join(cacheDir, './deltas');
  fs.ensureDirSync(cacheDir);
  fs.ensureDirSync(dataDir);
  fs.ensureDirSync(deltaDir);

  let allReleases: Release[] = [];
  try {
    allReleases = await getPreviousReleases({
      platform,
      target,
    });
  } catch (e) {
    logger.error('Unable to fetch previous releases', e);
  }

  if (!allReleases.length) {
    logger.warn('No previous releases found');
    return null;
  }

  // Last 10 releases only
  allReleases = allReleases.slice(0, 10);

  logger.log('Current release info ', {
    latestReleaseFilePath,
    latestVersion,
    latestReleaseFileName,
  });

  const deltaInstallerBuilder = new DeltaInstallerBuilder({
    PRODUCT_NAME: productName,
    PROCESS_NAME: processName,
  });

  const previousReleases = preparePreviousReleases(allReleases);

  // Download all the installers
  for (const { url, fileName } of previousReleases) {
    const filePath = path.join(dataDir, fileName);
    logger.log('Downloading file ', filePath, ' from ', url);
    await downloadFileIfNotExists(url, filePath);
  }

  // Extract the installers
  for (const { fileName, version } of previousReleases) {
    const extractedDir = path.join(dataDir, version);
    const filePath = path.join(dataDir, fileName);
    if (
      !fs.existsSync(
        path.join(
          extractedDir,
          `${processName}${platform === 'mac' ? '.app' : '.exe'}`
        )
      )
    ) {
      fs.ensureDirSync(extractedDir);
      fs.emptyDirSync(extractedDir);
      await extract7zip(filePath, extractedDir);
    }
  }

  const latestReleaseDir = path.join(dataDir, latestVersion);
  // Extract the latest release
  await extract7zip(latestReleaseFilePath, latestReleaseDir);
  const outputDir = path.join(outDir, `${latestVersion}-${platform}-deltas`);

  await fs.ensureDir(latestReleaseDir);
  await fs.ensureDir(outputDir);
  await fs.emptyDir(outputDir);

  // Compute the delta between any two versions
  for (const { version } of previousReleases) {
    const deltaFileName = `${productName}-${version}-to-${latestVersion}.delta`;
    const deltaFilePath = path.join(deltaDir, deltaFileName);
    logger.log(`Creating delta for ${version}`);

    const oldDir =
      platform === 'win'
        ? path.join(dataDir, version)
        : path.join(dataDir, version, `${productName}.app`);
    const newDir =
      platform === 'win'
        ? latestReleaseDir
        : path.join(latestReleaseDir, `${productName}.app`);
    logger.debug(`Creating delta for ${version} from ${oldDir} to ${newDir}`);
    createDelta(oldDir, newDir, deltaFilePath);
    logger.log('Delta file created ', deltaFilePath);
  }

  if (platform === 'win') {
    const deltaJSON: Record<string, any> = {
      productName,
      latestVersion,
    };

    // Create the installer and sign it
    for (const { version } of previousReleases) {
      const deltaFileName = `${productName}-${version}-to-${latestVersion}.delta`;
      const deltaFilePath = path.resolve(path.join(deltaDir, deltaFileName));
      const installerFileName = `${productName}-${version}-to-${latestVersion}-delta.exe`;
      const installerOutputPath = path.resolve(
        path.join(outputDir, installerFileName)
      );
      console.log(`Creating delta installer for ${version}`);
      await deltaInstallerBuilder.build({
        installerOutputPath,
        deltaFilePath,
        deltaFileName,
        productIconPath,
      });
      sign(installerOutputPath);

      logger.log('Delta installer created ', installerOutputPath);
      deltaJSON[version] = { path: installerFileName };
    }

    // Compute checksum
    for (const { version } of previousReleases) {
      const installerFileName = `${productName}-${version}-to-${latestVersion}-delta.exe`;
      const installerOutputPath = path.join(outputDir, installerFileName);
      console.log('Compute the sha256 of the installer ', installerOutputPath);
      const sha256 = computeSHA256(installerOutputPath);
      console.log('Computed sha256 ', sha256);
      deltaJSON[version] = { ...deltaJSON[version], sha256 };
    }

    const deltaJSONPath = path.join(outputDir, `delta-${platform}.json`);
    fs.writeFileSync(deltaJSONPath, JSON.stringify(deltaJSON, null, 2));
  } else {
    // mac
    const deltaJSON: Record<string, any> = {
      productName,
      latestVersion,
    };

    // Move deltas
    for (const { version } of previousReleases) {
      const deltaFileName = `${productName}-${version}-to-${latestVersion}.delta`;
      const deltaFilePath = path.resolve(path.join(deltaDir, deltaFileName));
      const deltaOutputPath = path.resolve(path.join(outputDir, deltaFileName));

      console.log(`Moving deltas for ${version}`);
      await fs.move(deltaFilePath, deltaOutputPath);
      logger.log('Delta installer created ', deltaOutputPath);
      deltaJSON[version] = { path: deltaFileName };
    }

    // Compute checksum
    for (const { version } of previousReleases) {
      const deltaFileName = `${productName}-${version}-to-${latestVersion}.delta`;
      const deltaFilePath = path.resolve(path.join(outputDir, deltaFileName));
      console.log('Compute the sha256 of the installer ', deltaFilePath);
      const sha256 = computeSHA256(deltaFilePath);
      console.log('Computed sha256 ', sha256);
      deltaJSON[version] = { ...deltaJSON[version], sha256 };
    }

    const deltaJSONPath = path.join(outputDir, `delta-${platform}.json`);
    fs.writeFileSync(deltaJSONPath, JSON.stringify(deltaJSON, null, 2));
  }

  return fs
    .readdirSync(outputDir)
    .map((fileName) => path.join(outputDir, fileName));
};

export default createAllDeltas;
