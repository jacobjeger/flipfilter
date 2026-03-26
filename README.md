# KosherFlip

Browser-based kosher phone setup tool. Connect a flip phone via USB, remove unwanted apps, apply lockdown restrictions, and set up Device Owner protection — all from the browser.

## Features

- **Setup Wizard** — Step-by-step guided setup: connect, detect model, remove apps, set lockdown level, install Device Owner
- **App Manager** — Browse, filter, remove, and restore installed packages
- **Tools** — Sideload APKs (Waze, MATVT), import contacts from CSV, generate PDF reports, run health checks
- **Technician Mode** — Save reusable profiles, batch queue for multiple devices, changelog, QR code export
- **Guardian APK** — Companion Android app that enforces lockdown as Device Owner (blocks factory reset, unknown sources, etc.)
- **Internationalization** — English, Hebrew, Yiddish (with RTL support)

## Prerequisites

- **Node.js** 18+
- **Browser** with WebUSB support (Chrome, Edge, Opera)
- **Android phone** with USB Debugging enabled
- For Device Owner setup: freshly factory-reset phone with no Google accounts

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in a WebUSB-compatible browser.

## Building for Production

```bash
npm run build
npm start
```

## Guardian APK

The Guardian APK is a minimal Device Owner app (no UI, no launcher icon) that enforces lockdown restrictions on the phone.

### Lockdown Levels

| Level | Restrictions |
|-------|-------------|
| **1 — Standard** | Factory reset, safe boot, unknown sources, add user, install/uninstall apps |
| **2 — Maximum** | Everything in Level 1 + USB file transfer, Bluetooth, ADB (permanent) |

### Building the APK

Requires JDK 17 and Android SDK (compileSdk 34):

```bash
cd guardian-apk
gradle wrapper --gradle-version 8.5
./gradlew assembleDebug
```

Output: `guardian-apk/app/build/outputs/apk/debug/app-debug.apk`

### Manual Installation

```bash
adb install app-debug.apk
adb shell dpm set-device-owner com.kosherflip/.AdminReceiver
adb shell settings put global kosherflip_lockdown_level 1
```

## Supported Devices

| Device | Tier | Notes |
|--------|------|-------|
| Kyocera DuraXV Extreme+ (E4810) | 1 | Full support, Kyocera Device Control |
| Kyocera DuraXV Extreme (E4610) | 1 | Full support, Kyocera Device Control |
| LG Exalt LTE (VN220) | 1 | Full support |
| LG Classic Flip (L125DL) | 1 | Full support |
| TCL Flip 2 (T408DL) | 2 | ADB only |
| Nokia 2780 Flip | 2 | ADB only |
| Nokia 2720 V Flip | 2 | ADB only |
| Alcatel 4052 | 3 | Limited support |

## Architecture

```
src/
  app/              Next.js App Router
  components/       React components (Wizard, AppManager, Tools, Technician)
  services/adb.ts   WebUSB ADB communication layer
  data/             Device profiles, package names
  context/          Global app state
  utils/            Shared utilities (PDF, QR, CSV)
  i18n/             Translations (en, he, yi)
guardian-apk/       Android Studio project for Device Owner APK
```

All operations run entirely in the browser via WebUSB. No data is sent to any server.

## Running Tests

```bash
npm test
```

## License

MIT
