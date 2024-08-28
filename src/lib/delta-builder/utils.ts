/* eslint-disable no-console */
import stream from 'stream';
import { promisify } from 'util';
import got from 'got';
import { spawnSync, SpawnSyncOptions } from 'child_process';
import fs from 'fs-extra';
import crypto from 'crypto';
import sevenBin from '7zip-bin';
import { extractFull } from 'node-7z';
import path from 'path';

const pathTo7zip: string = sevenBin.path7za;

const pipeline = promisify(stream.pipeline);

function safeSpawn(
  exe: string,
  args: string[],
  options?: SpawnSyncOptions
): Promise<boolean> {
  return new Promise((resolve, reject) => {
    try {
      spawnSync(exe, args, options);
      resolve(true);
    } catch (error) {
      reject(error);
    }
  });
}

const downloadFile = async (url: string, filePath: string): Promise<string> => {
  console.log(`Downloading ${url}`);
  try {
    const downloadStream = got.stream(url);
    await pipeline(downloadStream, fs.createWriteStream(filePath));
    console.log(`Download completed ${filePath}`);
    return filePath;
  } catch (err) {
    throw new Error(JSON.stringify(err || '{}'));
  }
};

const downloadFileIfNotExists = async (
  url: string,
  filePath: string
): Promise<string> => {
  if (fs.existsSync(filePath)) {
    console.log('Cache exists: ', filePath);
    return filePath;
  }

  return downloadFile(url, filePath);
};

const extract7zip = (
  zipPath: string,
  extractedDir: string
): Promise<string> => {
  return new Promise((resolve, reject) => {
    console.log(`Extracting ${zipPath}`);
    console.log('Start extracting to ', extractedDir);

    const zipStream = extractFull(zipPath, extractedDir, {
      recursive: true,
      $bin: pathTo7zip,
    });

    zipStream.on('error', (err) => {
      console.log('Error extracting: ', err);
      reject(err);
    });

    zipStream.on('end', () => {
      console.log('Extracting completed\n');
      resolve(extractedDir);
    });
  });
};

const removeExt = (str: string): string => str.replace('.exe', '');

const delay = (ms: number): Promise<void> => {
  return new Promise((res) => {
    setTimeout(() => {
      res();
    }, ms);
  });
};

const computeSHA256 = (filePath: string): string => {
  const fileBuffer = fs.readFileSync(filePath);
  const sum = crypto.createHash('sha256');
  sum.update(fileBuffer);
  const hex = sum.digest('hex');
  return hex;
};

function fileNameFromUrl(url: string): string {
  return path.basename(url);
}

export {
  downloadFile,
  safeSpawn,
  downloadFileIfNotExists,
  extract7zip,
  removeExt,
  delay,
  computeSHA256,
  fileNameFromUrl,
};
