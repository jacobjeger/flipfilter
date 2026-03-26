export function csvToVcf(csvText: string): string {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return '';

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const nameIdx = headers.findIndex(h => h === 'name' || h === 'full name' || h === 'fullname');
  const firstIdx = headers.findIndex(h => h === 'first name' || h === 'firstname' || h === 'first');
  const lastIdx = headers.findIndex(h => h === 'last name' || h === 'lastname' || h === 'last');
  const phoneIdx = headers.findIndex(h => h === 'phone' || h === 'phone number' || h === 'phonenumber' || h === 'mobile' || h === 'telephone');
  const emailIdx = headers.findIndex(h => h === 'email' || h === 'e-mail');

  const vcfEntries: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim());
    if (!cols.length) continue;

    let fullName = '';
    let firstName = '';
    let lastName = '';

    if (nameIdx >= 0) {
      fullName = cols[nameIdx] || '';
      const parts = fullName.split(' ');
      firstName = parts[0] || '';
      lastName = parts.slice(1).join(' ');
    } else {
      firstName = firstIdx >= 0 ? cols[firstIdx] || '' : '';
      lastName = lastIdx >= 0 ? cols[lastIdx] || '' : '';
      fullName = `${firstName} ${lastName}`.trim();
    }

    if (!fullName && phoneIdx < 0) continue;

    const phone = phoneIdx >= 0 ? cols[phoneIdx] || '' : '';
    const email = emailIdx >= 0 ? cols[emailIdx] || '' : '';

    let entry = 'BEGIN:VCARD\nVERSION:3.0\n';
    entry += `FN:${fullName}\n`;
    entry += `N:${lastName};${firstName};;;\n`;
    if (phone) entry += `TEL;TYPE=CELL:${phone}\n`;
    if (email) entry += `EMAIL:${email}\n`;
    entry += 'END:VCARD';
    vcfEntries.push(entry);
  }

  return vcfEntries.join('\n');
}
