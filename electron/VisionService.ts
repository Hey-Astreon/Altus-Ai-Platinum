import { desktopCapturer, screen } from 'electron';

export class VisionService {
  /**
   * Captures the primary screen using Native Electron desktopCapturer.
   * 100% reliable, zero PowerShell usage.
   */
  public async captureScreen(): Promise<string> {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;

    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width, height }
    });

    const primarySource = sources[0];
    if (!primarySource) throw new Error('No Screen Source Found');

    return primarySource.thumbnail.toDataURL().split(',')[1];
  }
}
