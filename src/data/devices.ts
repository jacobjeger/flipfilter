export interface DeviceProfile {
  modelId: string;
  displayName: string;
  tier: 1 | 2 | 3;
  debugMethod: 'build_number' | 'service_menu' | 'browser';
  debugInstructions: string;
  serviceMenuCode?: string;
  defaultPackagesToRemove: string[];
  notes: string;
}

export const devices: DeviceProfile[] = [
  {
    modelId: 'E4810',
    displayName: 'Kyocera DuraXV Extreme E4810',
    tier: 1,
    debugMethod: 'build_number',
    debugInstructions: 'Go to Settings → About Phone → Tap "Build Number" 7 times → Go back to Settings → Developer Options → Enable USB Debugging',
    defaultPackagesToRemove: [
      'com.android.browser',
      'com.google.android.youtube',
      'com.google.android.chrome',
      'com.google.android.gm',
      'com.google.android.apps.maps',
      'com.google.android.googlequicksearchbox',
      'com.google.android.assistant',
      'com.google.android.music',
      'com.google.android.videos',
      'com.google.android.apps.photos',
      'com.google.android.apps.docs',
      'com.google.android.apps.tachyon',
      'com.google.android.apps.youtube.music',
      'com.google.android.apps.magazines',
      'com.facebook.katana',
      'com.instagram.android',
      'com.twitter.android',
      'com.tiktok.android',
      'com.snapchat.android',
      'com.spotify.music',
      'com.netflix.mediaclient',
    ],
    notes: 'Full Device Control support. Use *#*#*# sequence to access Device Control at language screen.',
  },
  {
    modelId: 'E4610',
    displayName: 'Kyocera DuraXV LTE E4610',
    tier: 1,
    debugMethod: 'build_number',
    debugInstructions: 'Go to Settings → About Phone → Tap "Build Number" 7 times → Go back to Settings → Developer Options → Enable USB Debugging',
    defaultPackagesToRemove: [
      'com.android.browser',
      'com.google.android.youtube',
      'com.google.android.chrome',
      'com.google.android.gm',
      'com.google.android.apps.maps',
      'com.google.android.googlequicksearchbox',
      'com.google.android.music',
      'com.google.android.videos',
      'com.facebook.katana',
      'com.instagram.android',
      'com.twitter.android',
      'com.spotify.music',
      'com.netflix.mediaclient',
    ],
    notes: 'Full Device Control support. Older model, fewer pre-installed apps.',
  },
  {
    modelId: 'VN220',
    displayName: 'LG Exalt LTE VN220',
    tier: 1,
    debugMethod: 'service_menu',
    debugInstructions: 'On the phone dial ##7764726220 → Enter service code 000000 → Navigate to USB Debugging and enable it',
    serviceMenuCode: '##7764726220',
    defaultPackagesToRemove: [
      'com.android.browser',
      'com.google.android.youtube',
      'com.google.android.chrome',
      'com.google.android.gm',
      'com.google.android.apps.maps',
      'com.google.android.googlequicksearchbox',
      'com.facebook.katana',
      'com.instagram.android',
      'com.spotify.music',
      'com.netflix.mediaclient',
    ],
    notes: 'Use service menu dial code to enable ADB. Default service code is 000000.',
  },
  {
    modelId: 'L125DL',
    displayName: 'LG Classic Flip L125DL',
    tier: 1,
    debugMethod: 'service_menu',
    debugInstructions: 'On the phone dial ##228378 → Enter service code 000000 → Navigate to USB Debugging and enable it',
    serviceMenuCode: '##228378',
    defaultPackagesToRemove: [
      'com.android.browser',
      'com.google.android.youtube',
      'com.google.android.chrome',
      'com.google.android.gm',
      'com.google.android.apps.maps',
      'com.google.android.googlequicksearchbox',
      'com.facebook.katana',
      'com.instagram.android',
      'com.spotify.music',
    ],
    notes: 'TracFone variant. Use service menu dial code to enable ADB.',
  },
  {
    modelId: 'T408DL',
    displayName: 'TCL Flip 2 KEFH T408DL',
    tier: 2,
    debugMethod: 'build_number',
    debugInstructions: 'Go to Settings → About Phone → Tap "Build Number" 7 times → Go back to Settings → Developer Options → Enable USB Debugging',
    defaultPackagesToRemove: [
      'com.android.browser',
      'com.google.android.youtube',
      'com.google.android.chrome',
      'com.google.android.gm',
      'com.google.android.googlequicksearchbox',
      'com.facebook.katana',
      'com.instagram.android',
      'com.spotify.music',
    ],
    notes: 'KEFH firmware supports ADB. KEFS firmware has limited support (Tier 3).',
  },
  {
    modelId: '2780',
    displayName: 'Nokia 2780 Flip',
    tier: 2,
    debugMethod: 'build_number',
    debugInstructions: 'Go to Settings → About Phone → Tap "Build Number" 7 times → Go back to Settings → Developer Options → Enable USB Debugging',
    defaultPackagesToRemove: [
      'com.android.browser',
      'com.google.android.youtube',
      'com.google.android.chrome',
      'com.google.android.googlequicksearchbox',
      'com.facebook.katana',
      'com.spotify.music',
    ],
    notes: 'KaiOS-based. Limited ADB support.',
  },
  {
    modelId: '2720',
    displayName: 'Nokia 2720 Flip',
    tier: 2,
    debugMethod: 'build_number',
    debugInstructions: 'Go to Settings → About Phone → Tap "Build Number" 7 times → Enable USB Debugging in Developer Options',
    defaultPackagesToRemove: [
      'com.android.browser',
      'com.google.android.youtube',
      'com.google.android.googlequicksearchbox',
      'com.facebook.katana',
    ],
    notes: 'KaiOS-based. Limited app removal options.',
  },
  {
    modelId: '225',
    displayName: 'Nokia 225',
    tier: 2,
    debugMethod: 'build_number',
    debugInstructions: 'Enable developer mode through Settings → Developer Options',
    defaultPackagesToRemove: [
      'com.android.browser',
      'com.google.android.youtube',
    ],
    notes: 'Very limited Android feature phone. Few removable apps.',
  },
  {
    modelId: '4052',
    displayName: 'Alcatel 4052',
    tier: 3,
    debugMethod: 'build_number',
    debugInstructions: 'Settings → About Phone → Build Number (tap 7 times) → Developer Options → USB Debugging. May require additional steps depending on firmware.',
    defaultPackagesToRemove: [
      'com.android.browser',
      'com.google.android.youtube',
    ],
    notes: 'Limited support. Some firmware versions may not respond to ADB commands properly.',
  },
];

export function getDeviceByModelId(modelId: string): DeviceProfile | undefined {
  return devices.find(d => d.modelId === modelId);
}

export function getDeviceByDetectedModel(model: string): DeviceProfile | undefined {
  const normalized = model.toLowerCase().trim();
  return devices.find(d =>
    normalized.includes(d.modelId.toLowerCase()) ||
    d.displayName.toLowerCase().includes(normalized)
  );
}
