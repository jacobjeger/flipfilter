export interface DeviceCompatibility {
  modelId: string;
  displayName: string;
  tier: 1 | 2 | 3;
  supportsDeviceOwner: boolean;
  supportsKyoceraDeviceControl: boolean;
  supportsLGServiceMenu: boolean;
  adbDebugCode?: string;
  firmwareWarning?: string;
}

export const deviceCompatibility: DeviceCompatibility[] = [
  // TIER 1 — Full support (ADB + Device Owner + MDM)
  {
    modelId: 'E4810',
    displayName: 'Kyocera DuraXV Extreme E4810',
    tier: 1,
    supportsDeviceOwner: true,
    supportsKyoceraDeviceControl: true,
    supportsLGServiceMenu: false,
  },
  {
    modelId: 'E4610',
    displayName: 'Kyocera DuraXV LTE E4610',
    tier: 1,
    supportsDeviceOwner: true,
    supportsKyoceraDeviceControl: true,
    supportsLGServiceMenu: false,
  },
  {
    modelId: 'VN220',
    displayName: 'LG Exalt LTE VN220',
    tier: 1,
    supportsDeviceOwner: true,
    supportsKyoceraDeviceControl: false,
    supportsLGServiceMenu: true,
    adbDebugCode: '##7764726220',
  },
  {
    modelId: 'L125DL',
    displayName: 'LG Classic Flip L125DL',
    tier: 1,
    supportsDeviceOwner: true,
    supportsKyoceraDeviceControl: false,
    supportsLGServiceMenu: true,
    adbDebugCode: '##228378',
  },

  // TIER 2 — ADB only (partial filtering)
  {
    modelId: 'T408DL',
    displayName: 'TCL Flip 2 KEFH T408DL',
    tier: 2,
    supportsDeviceOwner: false,
    supportsKyoceraDeviceControl: false,
    supportsLGServiceMenu: false,
    firmwareWarning: 'Only KEFH firmware is supported. KEFS firmware has limited/no ADB support.',
  },
  {
    modelId: '2780',
    displayName: 'Nokia 2780 Flip',
    tier: 2,
    supportsDeviceOwner: false,
    supportsKyoceraDeviceControl: false,
    supportsLGServiceMenu: false,
  },
  {
    modelId: '2720',
    displayName: 'Nokia 2720 Flip',
    tier: 2,
    supportsDeviceOwner: false,
    supportsKyoceraDeviceControl: false,
    supportsLGServiceMenu: false,
  },
  {
    modelId: '225',
    displayName: 'Nokia 225',
    tier: 2,
    supportsDeviceOwner: false,
    supportsKyoceraDeviceControl: false,
    supportsLGServiceMenu: false,
  },

  // TIER 3 — Limited
  {
    modelId: '4052',
    displayName: 'Alcatel 4052',
    tier: 3,
    supportsDeviceOwner: false,
    supportsKyoceraDeviceControl: false,
    supportsLGServiceMenu: false,
    firmwareWarning: 'Limited ADB support. Some commands may not work on all firmware versions.',
  },
  {
    modelId: 'JOURNEY',
    displayName: 'Orbic Journey',
    tier: 3,
    supportsDeviceOwner: false,
    supportsKyoceraDeviceControl: false,
    supportsLGServiceMenu: false,
    firmwareWarning: 'Very limited ADB support. Proceed with caution.',
  },
  {
    modelId: 'FIG_FLIP',
    displayName: 'Fig Flip',
    tier: 3,
    supportsDeviceOwner: false,
    supportsKyoceraDeviceControl: false,
    supportsLGServiceMenu: false,
    firmwareWarning: 'Limited support. Not all features available.',
  },
];

export function getCompatibility(modelId: string): DeviceCompatibility | undefined {
  return deviceCompatibility.find(d => d.modelId === modelId);
}

export function getTierBadge(tier: 1 | 2 | 3): { label: string; color: string; description: string } {
  switch (tier) {
    case 1:
      return { label: 'Full Support', color: 'green', description: 'ADB + Device Owner + MDM' };
    case 2:
      return { label: 'Partial Support', color: 'yellow', description: 'ADB only — partial filtering' };
    case 3:
      return { label: 'Limited Support', color: 'red', description: 'Limited ADB — proceed with caution' };
  }
}
