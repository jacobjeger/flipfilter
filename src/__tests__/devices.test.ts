import { describe, it, expect } from 'vitest';
import { getDeviceByModelId, getDeviceByDetectedModel } from '@/data/devices';

describe('getDeviceByModelId', () => {
  it('finds device by exact model ID', () => {
    const device = getDeviceByModelId('E4810');
    expect(device).toBeDefined();
    expect(device!.displayName).toContain('Kyocera');
  });

  it('returns undefined for unknown model ID', () => {
    expect(getDeviceByModelId('nonexistent')).toBeUndefined();
  });
});

describe('getDeviceByDetectedModel', () => {
  it('matches Kyocera models', () => {
    const device = getDeviceByDetectedModel('E4810');
    expect(device).toBeDefined();
    expect(device!.tier).toBe(1);
  });

  it('matches LG models', () => {
    const device = getDeviceByDetectedModel('VN220');
    expect(device).toBeDefined();
  });

  it('returns undefined for unknown model string', () => {
    expect(getDeviceByDetectedModel('SomeRandomPhone')).toBeUndefined();
  });
});
