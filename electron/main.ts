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
let currentMode: ModelMode = 'Turbo';
let currentPersona: InterviewPersona = 'Technical';
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
  // PHASE 13B: Engage Phantom Bootstrap before anything else
  const proceed = await PhantomBootstrap.bootstrap();
  if (!proceed) return; // Self-relay successful, original process is exiting

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
      if (!aiService) return;
      
      mainWindow?.webContents.send('ai-answer-start');
      const response = await aiService.analyzeVision(`SOLVE THIS METTL TEST QUESTION: ${text}`);
      mainWindow?.webContents.send('ai-answer-end');
      mainWindow?.webContents.send('vision-captured', response || 'Analysis failed');
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
    
    // Instantiate correct AI provider
    if (currentProvider === 'Cloud') {
      aiService = new OpenRouterService(openRouterKey);
    } else {
      aiService = new OllamaService(openRouterKey);
    }
    
    // Apply current settings to new service
    aiService.setMode(currentMode);
    aiService.setPersona(currentPersona);

    // DISCORD MODE: If using a non-default device (e.g. Stereo Mix), skip speaker
    // calibration entirely — all audio IS the interviewer/girlfriend voice.
    const selectedDeviceId = settings.getSetting('selectedDeviceId', 'default');
    const isDiscordMode = selectedDeviceId !== 'default';

    sttService.on('transcript', (result) => {
      // Only run speaker calibration in default mic mode
      if (!isDiscordMode) {
        if (!userSpeakerId && result.isFinal && result.speaker) {
          userSpeakerId = result.speaker;
          console.log('[Altus] Calibrated User Speaker ID:', userSpeakerId);
          mainWindow?.webContents.send('calibration-complete', userSpeakerId);
        }
      }

      mainWindow?.webContents.send('new-transcript', result);
      
      // STEALTH FILTER: In Discord mode, ALL speech triggers AI (it's all the other person).
      // In normal mic mode, filter out the user's own voice.
      const isUserSpeaking = !isDiscordMode && userSpeakerId && result.speaker === userSpeakerId;

      if (!isUserSpeaking && result.isFinal && detector.isQuestion(result.text)) {
        mainWindow?.webContents.send('ai-thinking');
        aiService?.getAnswer(result.text);
      }
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

ipcMain.on('set-ai-mode', (event, mode: ModelMode) => {
  currentMode = mode;
  aiService?.setMode(mode);
});

ipcMain.on('set-ai-persona', (event, persona: InterviewPersona) => {
  currentPersona = persona;
  aiService?.setPersona(persona);
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

// Switch Providers on the fly
ipcMain.on('set-ai-provider', (event, provider: 'Cloud' | 'Local') => {
  if (currentProvider === provider) return;
  currentProvider = provider;
  
  if (aiService) {
    // Teardown old events and abort any active requests
    aiService.abort?.(); 
    aiService.removeAllListeners('answer-chunk');
    aiService.removeAllListeners('answer-end');
    
    // Spin up new service
    const openRouterKey = settings.getKey('openrouter');
    if (provider === 'Cloud') {
      aiService = new OpenRouterService(openRouterKey || '');
    } else {
      aiService = new OllamaService(openRouterKey || '');
    }
    
    // Restore states
    aiService.setMode(currentMode);
    aiService.setPersona(currentPersona);
    
    // Reattach listeners
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
});

function startAutoVisionLoop() {
  if (visionInterval) clearInterval(visionInterval);
  visionInterval = setInterval(async () => {
    if (isAutoVisionEnabled && currentPersona === 'Technical') {
      try {
        const base64Image = await visionService.captureScreen();
        mainWindow?.webContents.send('vision-captured', base64Image);
        aiService?.getAnswer("Analyze the current code/diagram and update your context. Be brief if nothing changed.", base64Image);
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
    aiService?.getAnswer('', base64Image);
  } catch (err) {
    console.error('Vision trigger failed:', err);
  }
});

ipcMain.on('get-settings-status', (event) => {
  event.reply('settings-status', { 
    hasKeys: settings.hasKeys(),
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
  if (assembly) settings.saveKey('assembly', assembly);
  if (openrouter) settings.saveKey('openrouter', openrouter);
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
