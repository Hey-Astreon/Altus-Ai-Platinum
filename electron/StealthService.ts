import { EventEmitter } from 'events';
import { exec } from 'child_process';

/**
 * Platinum Stealth Service: Camouflage Sentry
 * Monitors the system for "Capture Threats" (Screen sharing apps).
 */
export class StealthService extends EventEmitter {
  private scanInterval: NodeJS.Timeout | null = null;
  private isThreatActive: boolean = false;

  // List of processes that indicate EXTERNAL screen recording/sharing (not user's own apps)
  // NOTE: Discord.exe intentionally excluded — it's a user communication tool, not a threat
  private readonly THREAT_SIGNATURES = [
    'CptHost.exe',        // Zoom screen sharing component
    'Teams.exe',          // Microsoft Teams
    'ms-teams.exe',
    'obs64.exe',          // OBS Studio
    'obs32.exe',
    'Loom.exe',           // Loom recorder
    'ScreenRecorder.exe', // Windows Screen Recorder
    'GoTo.exe',           // GoToMeeting
  ];

  constructor() {
    super();
  }

  public start() {
    if (this.scanInterval) return;
    
    // Poll every 10 seconds to keep overhead low
    this.scanInterval = setInterval(() => this.scanForThreats(), 10000);
    this.scanForThreats();
  }

  public stop() {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }
  }

  private scanForThreats() {
    exec('tasklist /NH', { timeout: 2000 }, (error, stdout) => {
      if (error) return;

      const runningProcesses = stdout.toLowerCase();
      let detected = false;

      for (const sig of this.THREAT_SIGNATURES) {
        if (runningProcesses.includes(sig.toLowerCase())) {
          detected = true;
          break;
        }
      }

      if (detected !== this.isThreatActive) {
        this.isThreatActive = detected;
        this.emit('threat-state-change', detected);
      }
    });
  }
}
