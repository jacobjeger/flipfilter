import { describe, it, expect } from 'vitest';
import { csvToVcf } from '@/utils/csv';

describe('csvToVcf', () => {
  it('converts CSV with name and phone columns', () => {
    const csv = 'Name,Phone\nJohn Doe,555-1234\nJane Smith,555-5678';
    const vcf = csvToVcf(csv);
    expect(vcf).toContain('BEGIN:VCARD');
    expect(vcf).toContain('FN:John Doe');
    expect(vcf).toContain('TEL;TYPE=CELL:555-1234');
    expect(vcf).toContain('FN:Jane Smith');
    expect(vcf).toContain('END:VCARD');
  });

  it('handles first name and last name columns', () => {
    const csv = 'First Name,Last Name,Phone\nJohn,Doe,555-1234';
    const vcf = csvToVcf(csv);
    expect(vcf).toContain('FN:John Doe');
    expect(vcf).toContain('N:Doe;John;;;');
  });

  it('includes email when present', () => {
    const csv = 'Name,Phone,Email\nJohn Doe,555-1234,john@example.com';
    const vcf = csvToVcf(csv);
    expect(vcf).toContain('EMAIL:john@example.com');
  });

  it('returns empty string for single-line CSV', () => {
    expect(csvToVcf('Name,Phone')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(csvToVcf('')).toBe('');
  });

  it('skips rows with no name when phone column is absent', () => {
    const csv = 'Name\n\nJohn Doe';
    const vcf = csvToVcf(csv);
    const entries = vcf.split('BEGIN:VCARD').filter(Boolean);
    expect(entries).toHaveLength(1);
    expect(vcf).toContain('FN:John Doe');
  });

  it('handles mobile column header', () => {
    const csv = 'Name,Mobile\nJohn Doe,555-9999';
    const vcf = csvToVcf(csv);
    expect(vcf).toContain('TEL;TYPE=CELL:555-9999');
  });
});
