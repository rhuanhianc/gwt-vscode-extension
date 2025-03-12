import { spawn } from 'child_process';
import { exec } from 'child_process';
import { logInfo, logError } from './logChannel';

export function spawnTaskKill(pid: number) {
  // /f = force, /t = mata subárvore
  spawn('taskkill', ['/pid', pid.toString(), '/f', '/t']);
}

/**
 * Utility function to check if a port is in use
 * @param port The port number to check
 * @returns Promise that resolves to true if the port is in use, false otherwise
 */
export async function checkPortInUse(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const platform = process.platform;
    let command = '';
    
    // Different commands based on platform
    if (platform === 'win32') {
      command = `netstat -ano | findstr :${port}`;
    } else {
      command = `lsof -i:${port} | grep LISTEN`;
    }
    
    exec(command, (error, stdout) => {
      if (error) {
        // If there's an error, the port is probably not in use
        logInfo('utils', `Port ${port} check returned: not in use (error: ${error.message})`);
        resolve(false);
        return;
      }
      
      // If we get output, the port is in use
      const isInUse = stdout.trim().length > 0;
      logInfo('utils', `Port ${port} check returned: ${isInUse ? 'in use' : 'not in use'}`);
      resolve(isInUse);
    });
  });
}

/**
 * Utility function to kill a process using a specific port
 * @param port The port number whose process should be killed
 */
export function killProcessByPort(port: number): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const platform = process.platform;
    
    if (platform === 'win32') {
      // On Windows, first find the PID
      exec(`netstat -ano | findstr :${port}`, (error, stdout) => {
        if (error || !stdout) {
          logError('utils', `Error finding process on port ${port}: ${error?.message || 'No output'}`);
          resolve(false);
          return;
        }
        
        // Extract PID from output
        const lines = stdout.trim().split('\n');
        if (lines.length > 0) {
          // The PID is usually the last column in the output
          const lastColumn = lines[0].trim().split(/\s+/).pop();
          if (lastColumn) {
            const pid = parseInt(lastColumn, 10);
            if (!isNaN(pid)) {
              spawnTaskKill(pid);
              logInfo('utils', `Killed process with PID ${pid} that was using port ${port}`);
              resolve(true);
              return;
            }
          }
          logError('utils', `Could not extract PID from netstat output: ${lines[0]}`);
        } else {
          logError('utils', `No processes found using port ${port}`);
        }
        resolve(false);
      });
    } else {
      // On Unix systems
      exec(`lsof -i:${port} | grep LISTEN`, (error, stdout) => {
        if (error || !stdout) {
          logError('utils', `Error finding process on port ${port}: ${error?.message || 'No output'}`);
          resolve(false);
          return;
        }
        
        // Extract PID from output (second column in lsof output)
        const lines = stdout.trim().split('\n');
        if (lines.length > 0) {
          const parts = lines[0].trim().split(/\s+/);
          if (parts.length > 1) {
            const pid = parseInt(parts[1], 10);
            if (!isNaN(pid)) {
              try {
                process.kill(pid, 'SIGTERM');
                logInfo('utils', `Killed process with PID ${pid} that was using port ${port}`);
                resolve(true);
                return;
              } catch (err) {
                logError('utils', `Error killing process with PID ${pid}: ${err}`);
              }
            } else {
              logError('utils', `Could not parse PID from output: ${parts[1]}`);
            }
          } else {
            logError('utils', `Could not extract PID from lsof output: ${lines[0]}`);
          }
        } else {
          logError('utils', `No processes found using port ${port}`);
        }
        resolve(false);
      });
    }
  });
}
