import { spawn } from 'child_process';

export function spawnTaskKill(pid: number) {
  // /f = force, /t = mata subárvore
  spawn('taskkill', ['/pid', pid.toString(), '/f', '/t']);
}
