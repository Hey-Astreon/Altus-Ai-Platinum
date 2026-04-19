import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

const createHandler = (channel: string) => (callback: (...args: any[]) => void) => {
  const subscription = (_event: IpcRendererEvent, ...args: any[]) => callback(...args);
  ipcRenderer.on(channel, subscription);
  return () => {
    ipcRenderer.removeListener(channel, subscription);
  };
};

contextBridge.exposeInMainWorld('auraApi', {
  hideWindow: () => ipcRenderer.send('window-hide'),
  closeApp: () => ipcRenderer.send('window-close'),
  setIgnoreMouseEvents: (ignore: boolean, options?: { forward: boolean }) => 
    ipcRenderer.send('set-ignore-mouse-events', ignore, options),
  
  onSettings: createHandler('open-settings'),
  
  saveSettings: (keys: { assembly: string, openrouter: string }) => ipcRenderer.send('save-settings', keys),
  getSettingsStatus: () => ipcRenderer.send('get-settings-status'),
  onSettingsStatus: createHandler('settings-status'),
  onSettingsSaved: createHandler('settings-saved'),

  // Audio Capture & STT
  startAudioCapture: () => ipcRenderer.send('start-audio-capture'),
  stopAudioCapture: () => ipcRenderer.send('stop-audio-capture'),
  sendAudioChunk: (chunk: Float32Array) => ipcRenderer.send('audio-chunk', chunk),
  
  onInitCapture: createHandler('init-audio-capture'),
  onTranscript: createHandler('new-transcript'),
  
  // Platinum Features: Speaker Diarization
  resetCalibration: () => ipcRenderer.send('reset-calibration'),
  onCalibrationComplete: createHandler('calibration-complete'),

  // Platinum Features: Session Export
  exportSession: (data: { answers: any[], transcript: any[] }) => ipcRenderer.send('export-session', data),

  // Obsidian UI: Opacity control
  setOpacity: (opacity: number) => ipcRenderer.send('set-opacity', opacity),

  // AI Answer Engine
  setAiMode: (mode: 'Turbo' | 'Genius') => ipcRenderer.send('set-ai-mode', mode),
  setAiProvider: (provider: 'Cloud' | 'Local') => ipcRenderer.send('set-ai-provider', provider),
  setAiPersona: (persona: 'Technical' | 'SystemDesign' | 'Behavioral') => ipcRenderer.send('set-ai-persona', persona),
  setAutoVision: (enabled: boolean) => ipcRenderer.send('set-auto-vision', enabled),
  
  captureScreen: () => ipcRenderer.send('capture-screen'),

  onAiThinking: createHandler('ai-thinking'),
  onAiAnswerChunk: createHandler('ai-answer-chunk'),
  onAiAnswerEnd: createHandler('ai-answer-end'),
  onVisionCaptured: createHandler('vision-captured'),
  onGhostModeToggle: createHandler('toggle-ghost-mode'),
});
