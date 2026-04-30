import { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, screen, session, desktopCapturer } from 'electron';
import path from 'path';
import { AssemblyAIService } from './AssemblyAIService';
import { OpenRouterService, ModelMode, InterviewPersona } from './OpenRouterService';
import { OllamaService } from './OllamaService';
import { QuestionDetector } from './QuestionDetector';
import { VisionService } from './VisionService';
import { Exporter } from './Exporter';
import { SettingsService } from './SettingsService';
import { StealthService } from './StealthService';
import { PhantomBootstrap } from './PhantomBootstrap';
import { AccessibilityService } from './AccessibilityService';

const isDev = !app.isPackaged;

// SILENT SENTRY: Suppress all forensic footprints in production
if (!isDev) {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let sttService: AssemblyAIService | null = null;
let aiService: OpenRouterService | OllamaService | null = null;
let settings: SettingsService = new SettingsService();
let visionService: VisionService = new VisionService();
let stealthService: StealthService = new StealthService();
let accessibilityService: AccessibilityService = new AccessibilityService();
let detector: QuestionDetector = new QuestionDetector();
let userSpeakerId: string | null = null;

let currentProvider: 'Cloud' | 'Local' = 'Cloud';
let isAutoVisionEnabled: boolean = false;
let visionInterval: NodeJS.Timeout | null = null;


function createTray() {
  const iconPath = isDev
    ? path.join(__dirname, '../assets/icon.png')
    : path.join(process.resourcesPath, 'assets/icon.png');
  tray = new Tray(iconPath);
  
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show Altus AI', click: () => mainWindow?.show() },
    { label: 'Hide Altus AI', click: () => mainWindow?.hide() },
    { type: 'separator' },
    { label: 'Settings', click: () => mainWindow?.webContents.send('open-settings') },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() }
  ]);

  tray.setToolTip('Altus AI — Stealth AI Interview Assistant');
  tray.setContextMenu(contextMenu);
  
  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow?.show();
    }
  });
}

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: 800,
    height: 800,
    x: width - 820,
    y: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    type: 'toolbar', // Hardening: Further hiding from OS task switcher
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  // STEALTH MODE: Exclude from screen capture tools (Zoom, Teams, OBS, etc.)
  mainWindow.setContentProtection(true);

  const startUrl = isDev 
    ? 'http://localhost:5173' 
    : `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  // Initialize Stealth Sentry
  stealthService.start();
  // Listener will be attached in initializeApp to avoid duplication


  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerShortcuts() {
  // Unregister all existing to prevent duplicates
  globalShortcut.unregisterAll();

  const hotkeys = settings.getSetting('hotkeys', {
    toggleVisibility: 'CommandOrControl+Shift+V',
    visionCapture: 'CommandOrControl+Shift+S'
  });

  // Toggle Visibility
  try {
    globalShortcut.register(hotkeys.toggleVisibility, () => {
      if (mainWindow?.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow?.show();
      }
    });
  } catch (e) { console.error('Failed to register toggleVisibility:', e); }

  // Vision Capture
  try {
    globalShortcut.register(hotkeys.visionCapture, () => {
       mainWindow?.webContents.send('capture-screen');
    });
  } catch (e) { console.error('Failed to register visionCapture:', e); }

  // Emergency Hide: Ctrl+Shift+Q
  globalShortcut.register('CommandOrControl+Shift+Q', () => {
    app.quit();
  });

  // Ghost Mode Toggle: Ctrl+Shift+G
  globalShortcut.register('CommandOrControl+Shift+G', () => {
    mainWindow?.webContents.send('toggle-ghost-mode');
  });

  // NUCLEAR PROTOCOL: Ctrl+Alt+Shift+N (Emergency Purge & Kill)
  globalShortcut.register('CommandOrControl+Alt+Shift+N', () => {
    settings.purgeAll();
    app.exit(0);
  });
}

async function initializeApp() {
  app.whenReady().then(() => {
    createWindow();
    createTray();
    registerShortcuts();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });

    // Environmental Stealth Sentry
    stealthService.on('threat-state-change', (isThreatActive) => {
      // HARDENING: Blackout window in capture streams when threats are near
      mainWindow?.setContentProtection(isThreatActive);
      mainWindow?.webContents.send('camouflage-state-change', isThreatActive);
    });

    // Accessibility Ghost Solver
    accessibilityService.start();
    accessibilityService.on('question-detected', async (text) => {
      ensureAiService();
      if (!aiService) return;
      
      mainWindow?.webContents.send('ai-thinking');
      const response = await aiService.analyzeVision(`SOLVE THIS METTL TEST QUESTION: ${text}`);
      mainWindow?.webContents.send('ai-answer-end', response || 'Analysis failed');
    });

    // STEALTH AUDIO HANDLER
    session.defaultSession.setDisplayMediaRequestHandler((request, callback) => {
      desktopCapturer.getSources({ types: ['screen', 'window'] }).then((sources) => {
        callback({ video: sources[0], audio: 'loopback' });
      });
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}

// STABILITY SHIELD: Prevent silent crashes from unhandled network or system exceptions
process.on('unhandledRejection', (reason) => {
  if (isDev) console.error('[Stability Shield] Unhandled Rejection:', reason);
});

process.on('uncaughtException', (error) => {
  if (isDev) console.error('[Stability Shield] Uncaught Exception:', error);
});

// Start the Phantom Lifecycle
initializeApp();

app.on('before-quit', () => {
  // Hardening: Cleanly unbind all resources to prevent port/cache locks on restart
  globalShortcut.unregisterAll();
  mainWindow?.webContents.send('stop-audio-capture');
});

// Use IPC to handle common window actions from renderer
ipcMain.on('window-hide', () => mainWindow?.hide());
ipcMain.on('window-close', () => app.quit());
ipcMain.on('set-ignore-mouse-events', (event, ignore, options) => {
  mainWindow?.setIgnoreMouseEvents(ignore, options);
});

// AUDIO ENGINE BRIDGING
ipcMain.on('start-audio-capture', () => {
  const assemblyKey = settings.getKey('assembly');
  const openRouterKey = settings.getKey('openrouter');

  if (!assemblyKey || !openRouterKey) {
    mainWindow?.webContents.send('open-settings');
    return;
  }

  if (!sttService) {
    sttService = new AssemblyAIService(assemblyKey);

    // MUTUAL EXCLUSION: Pause Auto-Vision completely while mic is active.
    // Only ONE answer source can be active at a time - voice takes full priority.
    if (visionInterval) {
      clearInterval(visionInterval);
      visionInterval = null;
      console.log('[Altus] Auto-Vision paused — mic is now the sole input source.');
    }
    
    ensureAiService();

    // CALIBRATION FIX (FINAL): AssemblyAI real-time API has NO speaker diarization.
    // result.speaker is ALWAYS undefined in streaming mode — it only exists in async API.
    // Solution: Auto-complete calibration immediately. No "Say Hello" needed. Ever.
    const selectedDeviceId = settings.getSetting('selectedDeviceId', 'default');
    const isDiscordMode = selectedDeviceId !== 'default';

    // Instantly dismiss the calibration toast the moment the connection is established
    sttService.on('connect', () => {
      userSpeakerId = 'AUTO_CALIBRATED';
      mainWindow?.webContents.send('calibration-complete', 'AUTO_CALIBRATED');
      console.log('[Altus] Calibration auto-completed. Mode:', isDiscordMode ? 'Discord/Stereo Mix' : 'Standard Mic');
    });

    let lastTriggerTime = 0;
    const TRIGGER_COOLDOWN_MS = 3000; // 3 second cooldown between triggers

    sttService.on('transcript', (result) => {
      mainWindow?.webContents.send('new-transcript', result);
      
      if (result.isFinal && detector.isQuestion(result.text)) {
        const now = Date.now();
        if (now - lastTriggerTime < TRIGGER_COOLDOWN_MS) {
          console.log(`[Altus] Cooldown active. Skipping duplicate trigger for: "${result.text}"`);
          return;
        }
        lastTriggerTime = now;
        console.log(`[Altus] Question detected: "${result.text}". Triggering AI brain...`);
        mainWindow?.webContents.send('ai-thinking');
        aiService?.getAnswer(result.text);
      } else if (result.isFinal) {
        console.log(`[Altus] Ignored final transcript (not a question): "${result.text}"`);
      }
    });

    sttService.on('error', (err) => {
      mainWindow?.webContents.send('ai-error', `STT Error: ${err}`);
    });

    aiService.on('answer-chunk', (chunk) => {
      mainWindow?.webContents.send('ai-answer-chunk', chunk);
    });

    aiService.on('answer-end', (fullAnswer) => {
      mainWindow?.webContents.send('ai-answer-end', fullAnswer);
    });

    aiService.on('error', (err) => {
      mainWindow?.webContents.send('ai-error', err);
    });

    sttService.connect();
  }
});



let chunkCount = 0;
// CRITICAL: Receive PCM audio chunks from renderer and pipe to AssemblyAI
ipcMain.on('audio-chunk', (event, chunk: ArrayBuffer) => {
  if (sttService) {
    sttService.sendAudio(Buffer.from(chunk));
    chunkCount++;
    if (chunkCount % 50 === 0) {
      console.log(`[Altus AI] Audio pipeline active. Streaming data to AssemblyAI... (${chunkCount} chunks)`);
    }
  }
});

ipcMain.on('stop-audio-capture', () => {
  if (sttService) {
    sttService.disconnect();
    sttService.removeAllListeners();
    sttService = null;
  }
  if (aiService) {
    aiService.abort?.();
    aiService.removeAllListeners();
    aiService = null;
  }
  userSpeakerId = null;
  console.log('[Altus AI] Audio capture fully stopped and services torn down.');

  // MUTUAL EXCLUSION: Resume Auto-Vision if it was previously enabled by the user.
  if (isAutoVisionEnabled && !visionInterval) {
    startAutoVisionLoop();
    console.log('[Altus] Auto-Vision resumed — mic is now off.');
  }
});




ipcMain.on('set-auto-vision', (event, enabled: boolean) => {
  isAutoVisionEnabled = enabled;
  if (!enabled && visionInterval) {
    clearInterval(visionInterval);
    visionInterval = null;
  } else if (enabled && !visionInterval) {
    startAutoVisionLoop();
  }
});



function startAutoVisionLoop() {
  if (visionInterval) clearInterval(visionInterval);
  visionInterval = setInterval(async () => {
    // CRITICAL: Never fire Auto-Vision while a voice answer is being streamed
    const isVoiceStreaming = (aiService as any)?.isStreaming === true;
    if (isAutoVisionEnabled && !isVoiceStreaming) {
      ensureAiService();
      try {
        const base64Image = await visionService.captureScreen();
        mainWindow?.webContents.send('vision-captured', base64Image);
        
        // Run silently in background so it never interrupts voice streams
        const visionResult = await aiService?.analyzeVision(
          "CRITICAL: If there is an explicit coding test or technical interview question visible on the screen, provide exactly 6 conversational sentences of technical explanation to solve it. Keep it strictly to 6 sentences. However, if the question has ALREADY been answered in the visible text on the screen, or if there is NO technical question visible, you MUST reply EXACTLY with '[NO_ACTION]' and say absolutely nothing else.",
          base64Image
        );
        
        if (visionResult && !visionResult.includes('[NO_ACTION]') && !visionResult.includes('failed') && !visionResult.includes('severed')) {
          mainWindow?.webContents.send('ai-answer-end', "\n\n**[Auto-Vision Detected]:**\n" + visionResult);
        }
      } catch (err) {
        console.error('Auto-Vision failed:', err);
      }
    }
  }, 15000); // Every 15 seconds
}

ipcMain.on('capture-screen', async () => {
  const openRouterKey = settings.getKey('openrouter');
  if (!openRouterKey) {
    mainWindow?.webContents.send('open-settings');
    return;
  }
  
  try {
    const base64Image = await visionService.captureScreen();
    mainWindow?.webContents.send('vision-captured', base64Image);
    mainWindow?.webContents.send('ai-thinking');
    
    ensureAiService();
    aiService?.getAnswer('', base64Image);
  } catch (err) {
    console.error('Vision trigger failed:', err);
  }
  }
});

function ensureAiService() {
  if (aiService) return;
  const openRouterKey = settings.getKey('openrouter');
  if (!openRouterKey) return;

  if (currentProvider === 'Cloud') {
    aiService = new OpenRouterService(openRouterKey);
  } else {
    aiService = new OllamaService(openRouterKey);
  }
  
  aiService.on('answer-chunk', (chunk) => {
    mainWindow?.webContents.send('ai-answer-chunk', chunk);
  });
  aiService.on('answer-end', (fullAnswer) => {
    mainWindow?.webContents.send('ai-answer-end', fullAnswer);
  });
  aiService.on('error', (err) => {
    mainWindow?.webContents.send('ai-error', err);
  });
}

ipcMain.on('get-settings-status', (event) => {
  event.reply('settings-status', { 
    hasKeys: settings.hasKeys(),
    assemblyKey: settings.getKey('assembly'),
    openRouterKey: settings.getKey('openrouter'),
    opacity: settings.getSetting('globalOpacity', 0.85),
    selectedModel: settings.getSetting('selectedModel', 'anthropic/claude-3.5-sonnet'),
    selectedDeviceId: settings.getSetting('selectedDeviceId', 'default'),
    hotkeys: settings.getSetting('hotkeys', {
      toggleVisibility: 'CommandOrControl+Shift+V',
      visionCapture: 'CommandOrControl+Shift+S'
    })
  });
});

ipcMain.on('save-settings', (event, { assembly, openrouter }) => {
  if (assembly) {
    settings.saveKey('assembly', assembly);
    if (sttService) {
      sttService.disconnect();
      sttService = new AssemblyAIService(assembly); // Rebuild to use new key
      sttService.connect();
    }
  }
  if (openrouter) {
    settings.saveKey('openrouter', openrouter);
    if (aiService instanceof OpenRouterService) {
      aiService.setApiKey(openrouter); // Hot swap
    }
  }
  event.reply('settings-saved');
});

ipcMain.on('export-session', async (event, { answers, transcript }) => {
  await Exporter.exportMarkdown(answers, transcript);
});

ipcMain.on('reset-calibration', () => {
  userSpeakerId = null;
});

ipcMain.on('set-opacity', (event, opacity: number) => {
  settings.saveSetting('globalOpacity', opacity);
});

ipcMain.on('set-model', (event, modelId: string) => {
  settings.saveSetting('selectedModel', modelId);
  if (aiService instanceof OpenRouterService) {
    aiService.setModel(modelId);
  }
});

ipcMain.on('update-hotkey', (event, { type, value }) => {
  const hotkeys = settings.getSetting('hotkeys', {
    toggleVisibility: 'CommandOrControl+Shift+V',
    visionCapture: 'CommandOrControl+Shift+S'
  });
  hotkeys[type] = value;
  settings.saveSetting('hotkeys', hotkeys);
  registerShortcuts(); // Re-apply immediately
});

ipcMain.on('set-device', (event, deviceId: string) => {
  settings.saveSetting('selectedDeviceId', deviceId);
});

ipcMain.on('set-camouflage', (event, active: boolean) => {
  mainWindow?.setContentProtection(active);
});

ipcMain.on('audio-chunk', (event, pcmBuffer: ArrayBuffer) => {
  sttService?.sendAudio(Buffer.from(pcmBuffer));
});

ipcMain.on('stop-audio-capture', () => {
  sttService?.disconnect();
  sttService = null;
  userSpeakerId = null; // BUG FIX: Reset calibration so next session starts fresh
});
