import { app } from 'electron';
import { spawn } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Platinum Phantom Bootstrap
 * Implements Self-Relay and Shadow-Copy logic for absolute stealth.
 */
export class PhantomBootstrap {
  private static readonly RELAY_ENV_VAR = 'ALTUS_SHADOW_RELAY';
  private static readonly SYSTEM_NAME_POOL = [
    'Diagnostic_Service_Host_x64',
    'RuntimeBroker_WinAssistant',
    'SvcHost_System_Analytics',
    'WmiPrvSE_Audit_Helper',
    'Windows_Data_Relay'
  ];

  /**
   * Performs the "Shadow Relay".
   * If running from a branded path, it copies itself to %TEMP%, 
   * launches the copy, and terminates the original.
   */
  public static async bootstrap(): Promise<boolean> {
    // Only engage Shadow-Relay in production/packaged mode
    if (!app.isPackaged) return true;

    // Check if we are already in the "Shadow" process
    if (process.env[this.RELAY_ENV_VAR] === 'true') {
      this.setupMaximumStealthCleanup();
      return true;
    }

    try {
      const currentExe = app.getPath('exe');
      const tempDir = app.getPath('temp');
      
      // Select a random complex system name
      const randomName = this.SYSTEM_NAME_POOL[Math.floor(Math.random() * this.SYSTEM_NAME_POOL.length)];
      const shadowExe = path.join(tempDir, `${randomName}.exe`);

      // 1. Create the Shadow Copy
      fs.copyFileSync(currentExe, shadowExe);

      // 2. Launch the Shadow Process in a detached state
      const child = spawn(shadowExe, process.argv.slice(1), {
        detached: true,
        stdio: 'ignore',
        env: {
          ...process.env,
          [this.RELAY_ENV_VAR]: 'true'
        }
      });

      child.unref();

      // 3. Terminate the original "Branded" process immediately
      app.exit(0);
      return false; // Stop further execution in the original process
    } catch (error) {
      console.error('[Stealth Failure] Falling back to standard launch:', error);
      return true; // Fallback to normal launch if shadow fails
    }
  }

  /**
   * Ensures the shadow file is deleted immediately after the app closes.
   * This is the "Maximum Stealth" protocol.
   */
  private static setupMaximumStealthCleanup() {
    app.on('before-quit', () => {
      const currentExe = app.getPath('exe');
      
      // Spawn a tiny hidden CMD process to delete the shadow file after we exit
      // We wait 2 seconds to ensure the process is fully closed before deleting the file
      const cleanupCmd = `timeout /t 2 /nobreak && del /f /q "${currentExe}"`;
      
      spawn('cmd', ['/c', cleanupCmd], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true
      }).unref();
    });
  }
}
