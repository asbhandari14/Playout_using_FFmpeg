import { exec } from 'child_process';

/**
 * Forcefully terminates a child process and its entire process tree.
 * Uses taskkill /T /F on Windows and SIGKILL on Unix systems.
 */
export const killProcessTree = (proc) => {
  if (!proc || !proc.pid) return;

  try {
    if (process.platform === 'win32') {
      exec(`taskkill /pid ${proc.pid} /T /F`, (err) => {
        // Silently ignore already dead process errors (e.g. process not found)
      });
    } else {
      proc.kill('SIGKILL');
    }
  } catch {
    try {
      proc.kill('SIGKILL');
    } catch { }
  }
};

