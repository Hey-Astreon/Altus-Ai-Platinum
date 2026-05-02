import { app, BrowserWindow, globalShortcut, Tray, Menu, ipcMain, screen, desktopCapturer } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'path';
import * as dotenv from 'dotenv';
import { GeminiService } from './GeminiService';
import { VisionService } from './VisionService';
import { SettingsService } from './SettingsService';
import { StealthService } from './StealthService';
import { AccessibilityService } from './AccessibilityService';

dotenv.config();
const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let aiService: GeminiService | null = null;
let settings: SettingsService = new SettingsService();
let visionService: VisionService = new VisionService();
let stealthService: StealthService = new StealthService();
let accessibilityService: AccessibilityService = new AccessibilityService();

let isAutoVisionEnabled: boolean = false;
let isSolving = false;
let autoInterval: NodeJS.Timeout | null = null;

function requestLock() {
  const gotTheLock = app.requestSingleInstanceLock();
  if (!gotTheLock) { app.quit(); return false; }
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
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

  // KIOSK-LEVEL DOMINANCE: Ensure we stay above MSB full-screen
  mainWindow.setAlwaysOnTop(true, 'screen-saver', 1);
  mainWindow.setContentProtection(true);

  const startUrl = isDev ? 'http://localhost:5173' : path.join(__dirname, '../dist/index.html');
  if (isDev) mainWindow.loadURL(startUrl); else mainWindow.loadFile(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow?.center();
    mainWindow?.setOpacity(1.0);
    mainWindow?.show();
  });

  // EMERGENCY VISIBILITY: If ready-to-show fails, force show
  setTimeout(() => {
    if (mainWindow && !mainWindow.isVisible()) {
      mainWindow.show();
    }
  }, 5000);
}

function createTray() {
  const iconPath = isDev ? path.join(__dirname, '../assets/icon.png') : path.join(process.resourcesPath, 'assets/icon.png');
  try {
    tray = new Tray(iconPath);
    const contextMenu = Menu.buildFromTemplate([
      { label: 'Show Altus', click: () => mainWindow?.show() },
      { label: 'Hide Altus', click: () => mainWindow?.hide() },
      { type: 'separator' },
      { label: 'Exit', click: () => app.quit() }
    ]);
    tray.setToolTip('System Diagnostic Bridge');
    tray.setContextMenu(contextMenu);
  } catch (e) {}
}

async function performVisionSolve(customText?: string) {
  if (isSolving || !mainWindow) return;
  isSolving = true;

  try {
    let keys = settings.getKeys();
    if (keys.length === 0 && process.env.OPENROUTER_KEY) keys = [process.env.OPENROUTER_KEY];
    
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
  createTray();
  
  globalShortcut.register('CommandOrControl+Shift+V', () => {
    if (mainWindow?.isVisible()) mainWindow.hide(); else mainWindow?.show();
  });
  globalShortcut.register('CommandOrControl+Shift+S', () => performVisionSolve());

  stealthService.start();
  
  // MSB DETECTION LOGIC
  stealthService.on('msb-detected', () => {
    mainWindow?.setOpacity(0.4);
    mainWindow?.setAlwaysOnTop(true, 'screen-saver', 1);
    mainWindow?.setSkipTaskbar(true);
  });

  accessibilityService.start();
  accessibilityService.on('question-detected', (text) => {
    if (isAutoVisionEnabled) performVisionSolve(text);
  });
});

ipcMain.on('window-close', () => app.quit());
ipcMain.on('abort-solve', () => { isSolving = false; aiService?.abort(); });
ipcMain.handle('get-settings', () => ({
  openrouter: settings.getKeys().join(', ') || process.env.OPENROUTER_KEY || '',
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
    autoInterval = setInterval(() => performVisionSolve(), 20000); // 20s interval for better stealth
  }
});
