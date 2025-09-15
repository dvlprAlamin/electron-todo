import path from 'path';
import { spawnSync } from 'child_process';

const hdiffz = path.join(
  __dirname,
  process.platform === 'darwin'
    ? 'macOS'
    : process.platform === 'win32'
      ? 'windows'
      : 'linux',
  process.platform === 'win32' ? 'hdiffz.exe' : 'hdiffz',
);

/**
 * Creates a delta patch using the hdiffz tool.
 *
 * @param oldDir - The path to the old unpacked app
 * @param newDir - The path to the new unpacked app
 * @param patchOut - The expected output path of the created patch file
 * @returns A boolean indicating success or failure
 */
const createDelta = (oldDir: string, newDir: string, patchOut: string): boolean | null => {
  try {
    spawnSync(hdiffz, ['-f', '-c-lzma2', oldDir, newDir, patchOut], {
      stdio: 'inherit',
    });

    return true;
  } catch (err) {
    console.log('Compute hdiffz error', err);
    return null;
  }
};

export default createDelta;
