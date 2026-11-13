import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Forcefully terminates a child process and its entire process tree.
 * Uses taskkill /T /F on Windows and SIGKILL on Unix systems.
 * Immediately unpipes/destroys process stdout to avoid pipe contamination.
 */
export const killProcessTree = async (procOrPid) => {
  if (!procOrPid) return;

  const proc = typeof procOrPid === 'object' ? procOrPid : null;
  const pid = proc ? proc.pid : Number(procOrPid);
  if (!pid) return;

  // Immediately disconnect output pipes so no further bytes hit the encoder stdin
  if (proc?.stdout) {
    try {
      proc.stdout.unpipe();
      proc.stdout.destroy();
    } catch { }
  }
  if (proc?.stdin) {
    try {
      proc.stdin.destroy();
    } catch { }
  }

  try {
    if (process.platform === 'win32') {
      await execAsync(`taskkill /pid ${pid} /T /F`).catch(() => { });
    } else {
      try {
        process.kill(-pid, 'SIGKILL');
      } catch {
        try {
          process.kill(pid, 'SIGKILL');
        } catch { }
      }
    }
  } catch {
    // Process may already be dead
  }
};
