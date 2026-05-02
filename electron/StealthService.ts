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
    'taskmgr.exe'         // Windows Task Manager (User checking processes)
  ];

  private readonly MSB_SIGNATURES = [
    'MSB.exe',
    'SafeExamBrowser.exe',
    'SafeExamBrowser.Service.exe'
  ];

  constructor() {
    super();
  }

  public start() {
    if (this.scanInterval) return;
    
    // Poll every 3 seconds for high-speed response (V3 Elite Spec)
    this.scanInterval = setInterval(() => this.scanForThreats(), 3000);
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
      let detectedThreat = false;
      let detectedMSB = false;

      for (const sig of this.THREAT_SIGNATURES) {
        if (runningProcesses.includes(sig.toLowerCase())) {
          detectedThreat = true;
          break;
        }
      }

      for (const sig of this.MSB_SIGNATURES) {
        if (runningProcesses.includes(sig.toLowerCase())) {
          detectedMSB = true;
          break;
        }
      }

      if (detectedThreat !== this.isThreatActive) {
        this.isThreatActive = detectedThreat;
        this.emit('threat-state-change', detectedThreat);
      }

      if (detectedMSB) {
        this.emit('msb-detected', true);
      }
    });
  }
}
