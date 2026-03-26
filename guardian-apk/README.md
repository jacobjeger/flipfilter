# KosherFlip Guardian APK

Minimal Device Owner app for KosherFlip. No UI, no launcher icon — just enforces lockdown restrictions.

## What It Blocks

### Level 1 (Standard)
- Factory reset
- Safe boot
- Installing apps (unknown sources + Play Store)
- Uninstalling apps
- Adding users
- Modifying accounts (adding Google account)

### Level 2 (Maximum) — everything above plus:
- USB file transfer
- Mounting external media (SD cards)
- Bluetooth

## Build Instructions

1. Open this folder (`guardian-apk/`) in Android Studio
2. Click **Build > Build Bundle(s) / APK(s) > Build APK(s)**
3. The APK will be at `app/build/outputs/apk/debug/app-debug.apk`
4. Upload this APK in the KosherFlip wizard (Step 7: Set Device Owner)

## Usage via ADB

```bash
# Install the APK
adb install app-debug.apk

# Set as Device Owner (phone must have NO Google accounts)
adb shell dpm set-device-owner com.kosherflip/.AdminReceiver

# Set lockdown level (1=Standard, 2=Maximum)
adb shell settings put global kosherflip_lockdown_level 1

# To remove all restrictions (maintenance mode)
adb shell settings put global kosherflip_unlock 1
```

## Requirements
- Phone must be freshly factory reset (no Google accounts)
- USB Debugging must be enabled
- Min SDK: 21 (Android 5.0+)
