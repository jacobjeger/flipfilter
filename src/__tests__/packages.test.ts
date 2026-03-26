import { describe, it, expect } from 'vitest';
import { getAppName, getAppCategory } from '@/data/packages';

describe('getAppName', () => {
  it('returns display name for known packages', () => {
    expect(getAppName('com.google.android.chrome')).toBe('Chrome');
    expect(getAppName('com.google.android.youtube')).toBe('YouTube');
  });

  it('falls back to package name for unknown packages', () => {
    expect(getAppName('com.example.unknown')).toBe('com.example.unknown');
  });
});

describe('getAppCategory', () => {
  it('categorizes browser packages', () => {
    expect(getAppCategory('com.android.chrome')).toBe('browser');
    expect(getAppCategory('org.mozilla.firefox')).toBe('browser');
  });

  it('categorizes social packages', () => {
    expect(getAppCategory('com.facebook.katana')).toBe('social');
    expect(getAppCategory('com.instagram.android')).toBe('social');
  });

  it('categorizes google packages', () => {
    expect(getAppCategory('com.google.android.gms')).toBe('google');
  });

  it('returns other for unrecognized packages', () => {
    expect(getAppCategory('com.example.custom')).toBe('other');
  });
});
