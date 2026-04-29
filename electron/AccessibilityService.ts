import { exec } from 'child_process';
import { EventEmitter } from 'events';

/**
 * Platinum Accessibility Service
 * Uses Windows UI Automation (via PowerShell) to read text metadata from proctored windows.
 * Bypasses OS-level screen capture blackout.
 */
export class AccessibilityService extends EventEmitter {
  private isScanning: boolean = false;
  private scanTimer: NodeJS.Timeout | null = null;
  private lastExtractedText: string = '';

  constructor() {
    super();
  }

  public start() {
    if (this.scanTimer) return;
    this.loop();
  }

  private loop() {
    this.scanForQuestions().finally(() => {
      this.scanTimer = setTimeout(() => this.loop(), 5000);
    });
  }

  public stop() {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
  }

  private async scanForQuestions(): Promise<void> {
    if (this.isScanning) return;
    this.isScanning = true;

    return new Promise((resolve) => {
      const psScript = `
        Add-Type -AssemblyName UIAutomationClient
        Add-Type -AssemblyName UIAutomationTypes
        $msb = Get-Process | Where-Object { $_.ProcessName -like "*Diagnostic*" -or $_.ProcessName -like "*Mettl*" -or $_.MainWindowTitle -like "*Secure Browser*" } | Select-Object -First 1
        if ($msb) {
          $element = [Windows.Automation.AutomationElement]::FromHandle($msb.MainWindowHandle)
          $condition = [Windows.Automation.Condition]::TrueCondition
          $children = $element.FindAll([Windows.Automation.TreeScope]::Descendants, $condition)
          $output = ""
          foreach ($child in $children) {
            $name = $child.Current.Name
            if ($name -and $name.Length -gt 15) { $output += $name + " [SEP] " }
          }
          Write-Output $output
        }
      `.replace(/\s+/g, ' ').trim();

      exec(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, 
        { timeout: 4000 }, // Kill the PS process if it hangs > 4s
        (error, stdout) => {
        this.isScanning = false;
        if (error || !stdout) {
          resolve(); 
          return;
        }

        const rawText = stdout.trim();
        if (rawText && rawText !== this.lastExtractedText) {
          this.lastExtractedText = rawText;
          this.emit('question-detected', rawText);
        }
        resolve();
      });
    });
  }
}
