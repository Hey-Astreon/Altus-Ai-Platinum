# 🧛‍♂️ Altus AI Platinum — Master Field Guide
**Version 2.7.0 — The Accessibility Ghost Edition**

> *"Visibility is a liability. Intelligence is an absolute."*

This is the **single source of truth** for installing, configuring, and operating Altus AI Platinum — including how to deploy it inside Mettl Secure Browser (MSB) and other proctored environments.

---

## 📋 Table of Contents

1. [Installation Guide](#-phase-1-installation)
2. [Certificate Setup (MSB Mode)](#-phase-2-the-security-handshake-msb-only)
3. [First Launch & API Setup](#-phase-3-first-launch--api-configuration)
4. [Live Operation Guide](#-phase-4-live-operation)
5. [MSB Bypass Protocol](#-phase-5-engaging-the-phantom-msb-bypass)
6. [Hotkeys & Controls](#-phase-6-hotkeys--controls)
7. [Emergency Protocols](#-phase-7-emergency-protocols)
8. [Troubleshooting](#-phase-8-troubleshooting--fixes)
9. [Technical Architecture](#-technical-architecture)

---

## 📦 Phase 1: Installation

> [!IMPORTANT]
> There are **two ways** to run Altus AI. Choose based on your situation.

### Option A — Developer Launch (Recommended for Daily Use)
If you have the project source code (`F:\Altus Ai Platinum`):

1. Double-click **`Launch_Altus.bat`** inside the project folder.
2. The app will appear within **5–10 seconds**.
3. No installation or certificate needed. All features work.

> [!TIP]
> This is the **most reliable** method. Use it for practice and daily sessions.

---

### Option B — Installed Shortcut (For MSB Exam Day)
This method installs the app to `Program Files` and creates a desktop shortcut.

1. Run **`npm run dist`** in the project terminal to build the installer.
2. Go to `release\` folder and run **`Altus-AI-Platinum-Setup-v2.7.0.exe`**.
3. Do **not** change the install path — keep it at `C:\Program Files\`.
4. After install, launch from the **Desktop shortcut** labelled "Altus AI".

> [!WARNING]
> If the shortcut doesn't open the app after installation, the certificate is not yet trusted. Follow **Phase 2** below to fix it.

---

## 🔐 Phase 2: The Security Handshake (MSB Only)

This step is **only required for MSB exam-day use**. It grants the app "System-Class" status so it can remain visible while MSB blacks out the screen.

### Method A — PowerShell (Recommended)
Open **PowerShell as Administrator** and run:

```powershell
Import-PfxCertificate -FilePath "F:\Altus Ai Platinum\assets\Altus_Accessibility.pfx" -Password (ConvertTo-SecureString -String "altusplatinum" -Force -AsPlainText) -CertStoreLocation Cert:\LocalMachine\Root
```

### Method B — Manual (GUI)
1. Locate **`assets\Altus_Accessibility.pfx`** in the project folder.
2. Double-click it → Choose **Local Machine** → Click Next.
3. Enter password: **`altusplatinum`** → Click Next.
4. Select **"Place all certificates in the following store"**.
5. Browse → Select **Trusted Root Certification Authorities** → OK.
6. Click Finish. Click **Yes** on the Windows Security warning.

After this, the installed shortcut will work and MSB bypass will be active.

---

## ⚙️ Phase 3: First Launch & API Configuration

1. Open the **Settings Drawer** (Gear ⚙️ icon in the top-right).
2. Enter your API keys:
   - **AssemblyAI Key** — Powers real-time voice transcription (STT).
   - **OpenRouter Key** — Powers the AI answer engine.
3. Keys are **AES-256 encrypted** using your system's hardware. They are never stored in plain text.
4. Click **Save**. The app will confirm and close the drawer.

> [!TIP]
> Get your free **AssemblyAI key** at [assemblyai.com](https://www.assemblyai.com/) and your **OpenRouter key** at [openrouter.ai](https://openrouter.ai/).

---

## 🚀 Phase 4: Live Operation

### 4.1 Choose Your Intelligence Core 🧠
From the dashboard header, pick your AI model:
| Model | Best For | Cost |
|---|---|---|
| **Claude 3.5 Sonnet** | System Design, LeetCode Hard, Deep Reasoning | Paid |
| **GPT-4o** | Rapid-fire Algorithms & General Problems | Paid |
| **Gemini Flash** | Speed, General QA, Short Answers | Free Tier |
| **Local (Ollama)** | Maximum secrecy, air-gapped operation | Free |

### 4.2 Select Audio Device 🎙️
- Open the Settings Drawer → **Audio Hardware** dropdown.
- Select your microphone (headset recommended).
- **Auto Hot-Swap:** Altus detects mic changes instantly — no restart needed.

### 4.3 Voice Calibration
1. Click the **Zap ⚡ (Capture)** button to start listening.
2. Speak a few sentences naturally: *"Testing, one two three."*
3. Altus AI locks your voice profile and will now **ignore you** — it only responds to the **interviewer's voice**.

### 4.4 Vision Context 👁️
- Click the **Eye 👁️** icon or press your Vision hotkey.
- The AI will "see" your current screen and factor it into its answer.
- **Auto-Vision:** Enable in settings to automatically scan your screen every 15 seconds (best for technical/coding interviews).

### 4.5 Ghost Mode 🌑
- Press **Ctrl+Shift+G** to toggle Ghost Mode — the window becomes near-invisible.
- Use the **Opacity Slider** in settings to tune transparency (40% is ideal for stealth reading).
- Press **Ctrl+Shift+V** to toggle between fully visible and fully hidden.

---

## 🕵️ Phase 5: Engaging the Phantom (MSB Bypass)

> [!IMPORTANT]
> Complete **Phase 2 (Certificate Setup)** before attempting this. The app must be installed to `Program Files` for full MSB bypass.

1. Open Altus AI **before** launching MSB.
2. Configure your API keys and select your model (Phase 3).
3. Click the **Shield 🛡️** button in the top header to engage **Phantom Camouflage**.
   - The window minimizes and becomes highly transparent.
   - The **Phantom Lens HUD** appears at the **top-center** of your screen.
4. Launch **Mettl Secure Browser** and start your test.
5. MSB will blackout all standard tools — but Altus AI uses **Accessibility Metadata Extraction** to read your test questions through the blackout.
6. Answers appear live in the **top-center HUD** as you progress.

### 👁️ Eye-Line Camouflage Strategy
> [!TIP]
> The HUD is intentionally placed at the **top-center** of your screen. Most webcams are at the top of your monitor. By reading the HUD, your eyes naturally point **toward the webcam** — to a proctor, you look perfectly focused on the test.

> [!CAUTION]
> Never look at your phone or a secondary monitor during a proctored test. Keep your gaze on the HUD at all times. This is both a technical and psychological strategy.

---

## ⌨️ Phase 6: Hotkeys & Controls

| Hotkey | Action |
|---|---|
| `Ctrl+Shift+V` | Toggle window visibility (show/hide) |
| `Ctrl+Shift+G` | Toggle Ghost Mode (near-invisible) |
| `Ctrl+Shift+S` | Manual Vision Capture (screenshot for AI) |
| `Ctrl+Shift+Q` | Emergency Quit — terminates the app instantly |
| `Ctrl+Alt+Shift+N` | ☢️ **Nuclear Purge** — wipes all keys & data then kills the app |

### Custom Hotkeys
Go to **Settings Drawer → Hardware Hotkeys**:
1. Click the record button for the hotkey you want to remap.
2. Press your desired key combo (e.g., `Alt+C`).
3. Saved instantly system-wide.

---

## ☢️ Phase 7: Emergency Protocols

### Standard Exit
Press **`Ctrl+Shift+Q`** — Closes the app cleanly.

### Nuclear Purge Protocol
Press **`Ctrl+Alt+Shift+N`** — This is a **clinical dismissal**:
1. Wipes **every byte** from encrypted storage (keys, history, settings).
2. Terminates the process in under 1ms.
3. Leaves **zero forensic traces** on disk.

> [!CAUTION]
> Use Nuclear Purge only in a genuine emergency. All your API keys and settings will be wiped and must be re-entered when you next launch the app.

---

## 🔧 Phase 8: Troubleshooting & Fixes

| Problem | Cause | Fix |
|---|---|---|
| **Desktop shortcut does nothing** | Certificate not trusted | Run the PowerShell import command in Phase 2 |
| **App closes immediately after launch** | `uiAccess` blocked by Windows | Use `Launch_Altus.bat` instead of the installed shortcut |
| **`npm run dist` fails with "file in use"** | Old installer is locked by Explorer | Close the `release\` folder in Explorer, then retry |
| **No AI answers appearing** | API key missing or invalid | Open Settings Drawer and re-enter your OpenRouter key |
| **Voice not being captured** | Wrong mic selected | Open Settings → Audio Hardware → select correct device |
| **MSB blacks out the HUD** | Certificate not in Trusted Root | Complete Phase 2 on the exam machine |
| **App not visible after Ghost Mode** | Window is hidden | Press `Ctrl+Shift+V` to toggle visibility back |
| **Nuclear hotkey accidentally triggered** | `Ctrl+Alt+Shift+N` pressed | Re-enter API keys in Settings. Everything else is intact. |

---

## 🏗️ Technical Architecture

| Pillar | Mechanism | What It Does |
| :--- | :--- | :--- |
| **Accessibility Ghost** | Windows UI Automation API | Reads test question metadata through MSB's blackout — cannot be blocked |
| **Z-Order Dominator** | `UIAccess` Privilege + Certificate | Forces Altus to sit *above* the lockdown window at the OS kernel level |
| **Phantom Bootstrap** | Self-Relay Process | On launch, clones itself to a system name (e.g., `Diagnostic_Broker.exe`) to hide from MSB's process scanner |
| **Physical Shield** | `setContentProtection(true)` | Makes the Altus window invisible to all screen-sharing and recording tools |
| **Nuclear Protocol** | `purgeAll()` + `app.exit(0)` | Synchronous full-wipe and instant termination in one keystroke |

---

<div align="center">

**Altus AI Platinum v2.7.0 — Mastery through Intelligence.**

*Stay calm. Eyes on the lens. Let the AI lead the way.* 🏎️💨🌑

</div>
