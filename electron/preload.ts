import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

// SECURE GHOST BRIDGE: Minimalist, High-Speed, Synchronized
const createHandler = (channel: string) => (callback: (...args: any[]) => void) => {
  const subscription = (_event: IpcRendererEvent, ...args: any[]) => callback(...args);
  ipcRenderer.on(channel, subscription);
  return () => {
    ipcRenderer.removeListener(channel, subscription);
  };
};

contextBridge.exposeInMainWorld('api', {
  // SYSTEM CONTROLS
  send: (channel: string, data?: any) => {
    const validChannels = [
      'window-hide', 
      'window-close', 
      'set-opacity', 
      'save-keys', 
      'start-audio-capture', 
      'stop-audio-capture', 
      'capture-screen', 
      'toggle-auto-vision',
      'abort-solve',
      'set-camouflage',
      'install-update'
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  handle: async (channel: string, data?: any) => {
    const validChannels = ['get-settings'];
    if (validChannels.includes(channel)) {
      return await ipcRenderer.invoke(channel, data);
    }
  },

  // COMPATIBILITY WRAPPERS (For App.tsx getSettings call)
  getSettings: () => ipcRenderer.invoke('get-settings'),

  // INTELLIGENCE EVENTS
  onAiThinking: createHandler('ai-thinking'),
  onAiAnswerChunk: createHandler('ai-answer-chunk'),
  onAiAnswerEnd: createHandler('ai-answer-end'),
  onAiError: createHandler('ai-error'),
  onCaptureScreen: createHandler('capture-screen'),
  onTranscript: createHandler('new-transcript'),
  onUpdateAvailable: createHandler('update-available'),
  onUpdateReady: createHandler('update-ready'),
  
  // CLEANUP
  removeAllListeners: (channel: string) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
