import { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, screen, desktopCapturer } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import * as dotenv from 'dotenv';
import { GeminiService } from './GeminiService';
import { VisionService } from './VisionService';
import { SettingsService } from './SettingsService';
import { StealthService } from './StealthService';

dotenv.config();
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let aiService: GeminiService | null = null;
let settings: SettingsService = new SettingsService();
let visionService: VisionService = new VisionService();
let stealthService: StealthService = new StealthService();

let isAutoVisionEnabled: boolean = false;
let isSolving = false;
let autoInterval: NodeJS.Timeout | null = null;
let dominanceInterval: NodeJS.Timeout | null = null;

function requestLock() {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) { app.quit(); return false; }
  return true;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800, height: 800, frame: false, transparent: true,
    alwaysOnTop: true, skipTaskbar: true, show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false, contextIsolation: true,
    },
  });

  mainWindow.setContentProtection(true);

  const startUrl = isDev ? 'http://localhost:5173' : path.join(__dirname, '../dist/index.html');
  if (isDev) mainWindow.loadURL(startUrl); else mainWindow.loadFile(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.center();
    mainWindow?.setOpacity(1.0);
    mainWindow?.show();
  });
}

async function performVisionSolve(customText?: string) {
  if (isSolving || !mainWindow) return;
  isSolving = true;

  try {
    let keys = settings.getKeys();
    if (keys.length === 0 && process.env.GOOGLE_GEMINI_KEY) keys = [process.env.GOOGLE_GEMINI_KEY];
    
    if (keys.length === 0) {
      mainWindow.webContents.send('ai-error', 'CRITICAL: No API Keys in Vault.');
      return;
    }
    
    if (!aiService) {
      aiService = new GeminiService(keys);
      aiService.on('answer-chunk', (chunk: string) => mainWindow?.webContents.send('ai-answer-chunk', chunk));
      aiService.on('answer-end', (full: string) => mainWindow?.webContents.send('ai-answer-end', full));
      aiService.on('error', (err: string) => mainWindow?.webContents.send('ai-error', err));
    }

    mainWindow.webContents.send('ai-thinking');
    
    if (customText) {
      await aiService.getAnswer(customText);
    } else {
      const image = await visionService.captureScreen();
      await aiService.getAnswer('Solve the exam question in this image. Be concise.', image);
    }
  } catch (error: any) {
    mainWindow.webContents.send('ai-error', `System Fault: ${error.message}`);
  } finally {
    isSolving = false;
  }
}

app.whenReady().then(() => {
  if (!requestLock()) return;
  createWindow();
  
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (mainWindow?.isVisible()) mainWindow.hide(); else mainWindow?.show();
  });
  globalShortcut.register('CommandOrControl+Shift+S', () => performVisionSolve());

  stealthService.start();
  
  // MSB DETECTION & DOMINANCE LOOP
  stealthService.on('msb-detected', () => {
    if (mainWindow) {
      mainWindow.setOpacity(0.4);
      mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
      mainWindow.setSkipTaskbar(true);
      
      if (!mainWindow.isVisible()) mainWindow.show();

      // START DOMINANCE LOOP: Ensure we stay on top of the kiosk every 5 seconds
      if (!dominanceInterval) {
        dominanceInterval = setInterval(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
            if (!mainWindow.isVisible()) mainWindow.show();
          }
        }, 5000);
      }
    }
  });

  // START ACCESSIBILITY BRIDGE fallback (silent)
});

ipcMain.on('window-close', () => app.quit());
ipcMain.on('abort-solve', () => { isSolving = false; aiService?.abort(); });
ipcMain.on('set-ignore-mouse', (event, ignore, forward) => {
  mainWindow?.setIgnoreMouseEvents(ignore, forward);
});
ipcMain.handle('get-settings', () => ({
  openrouter: settings.getKeys().join(', ') || process.env.GOOGLE_GEMINI_KEY || '',
  globalOpacity: 0.85
}));
ipcMain.on('save-keys', (event, { openrouter }) => {
  if (openrouter) settings.saveKeys(openrouter.split(',').map((k: any) => k.trim()));
  aiService = null;
});
ipcMain.on('capture-screen', () => performVisionSolve());
ipcMain.on('toggle-auto-vision', (event, enabled) => { 
  isAutoVisionEnabled = enabled; 
  if (autoInterval) clearInterval(autoInterval);
  if (enabled) {
    autoInterval = setInterval(() => performVisionSolve(), 20000);
  }
});
