import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';

export class AccessibilityService extends EventEmitter {
  private psProcess: ChildProcess | null = null;
  private isScanning: boolean = false;
  private isActive: boolean = false;
  private lastExtractedText: string = '';
  private stdoutBuffer: string = '';

  constructor() {
    super();
  }

  public start() {
    if (this.isActive) return;
    this.isActive = true;
    this.initGhostProcess();
    this.loop();
  }

  private initGhostProcess() {
    // Start a persistent, hidden PowerShell session
    this.psProcess = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command', '-'
    ]);

    this.psProcess.stdout?.on('data', (data) => {
      this.stdoutBuffer += data.toString();
      if (this.stdoutBuffer.includes('__END_EXTRACT__')) {
        const result = this.stdoutBuffer.split('__END_EXTRACT__')[0].trim();
        this.processExtractedText(result);
        this.stdoutBuffer = '';
        this.isScanning = false;
      }
    });

    this.psProcess.on('exit', () => {
      if (this.isActive) this.initGhostProcess(); // Auto-restart if it crashes
    });
  }

  private loop() {
    if (!this.isActive) return;
    this.scanForQuestions();
    setTimeout(() => this.loop(), 3000); // Higher frequency: scan every 3 seconds
  }

  public stop() {
    this.isActive = false;
    if (this.psProcess) {
      this.psProcess.kill();
      this.psProcess = null;
    }
  }

  private scanForQuestions() {
    if (this.isScanning || !this.psProcess) return;
    this.isScanning = true;

    // Hyper-fast traversal script
    const psScript = `
      Add-Type -AssemblyName UIAutomationClient
      Add-Type -AssemblyName UIAutomationTypes
      $target = Get-Process | Where-Object { $_.ProcessName -like "*Diagnostic*" -or $_.ProcessName -like "*Mettl*" -or $_.MainWindowTitle -like "*Secure Browser*" -or $_.ProcessName -like "*Notepad*" } | Select-Object -First 1
      if ($target) {
        $element = [Windows.Automation.AutomationElement]::FromHandle($target.MainWindowHandle)
        $children = $element.FindAll([Windows.Automation.TreeScope]::Descendants, [Windows.Automation.Condition]::TrueCondition)
        foreach ($child in $children) {
          $name = $child.Current.Name
          if ($name -and $name.Length -gt 20) { Write-Host -NoNewline "$name [SEP] " }
        }
      }
      Write-Host "__END_EXTRACT__"
    `.replace(/\s+/g, ' ').trim() + "\n";

    this.psProcess.stdin?.write(psScript);
  }

  private processExtractedText(rawText: string) {
    if (!rawText) return;

    // Advanced heuristics to detect question changes while ignoring clocks/IDs
    const cleanRaw = rawText.replace(/\d/g, '').toLowerCase();
    const cleanLast = this.lastExtractedText.replace(/\d/g, '').toLowerCase();
    
    if (Math.abs(cleanRaw.length - cleanLast.length) > 40 || this.checkEdgeDrift(cleanRaw, cleanLast)) {
      this.lastExtractedText = rawText;
      this.emit('question-detected', rawText);
    }
  }

  private checkEdgeDrift(a: string, b: string): boolean {
    if (a.length < 100 || b.length < 100) return a !== b;
    return a.substring(0, 100) !== b.substring(0, 100) || 
           a.substring(a.length - 100) !== b.substring(b.length - 100);
  }
}
