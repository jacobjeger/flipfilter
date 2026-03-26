export async function generatePdfReport(data: {
  model: string;
  androidVersion: string;
  imei: string;
  lockdownLevel: number;
  setupLog: string[];
}): Promise<Blob> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF();
  const now = new Date();

  doc.setFontSize(18);
  doc.setTextColor(30, 58, 138); // blue-900
  doc.text('KosherFlip Setup Report', 20, 25);

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated: ${now.toLocaleString()}`, 20, 33);

  doc.setDrawColor(59, 130, 246);
  doc.line(20, 37, 190, 37);

  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138);
  doc.text('Device Information', 20, 47);

  doc.setFontSize(10);
  doc.setTextColor(50, 50, 50);
  const info = [
    `Phone Model: ${data.model}`,
    `Android Version: ${data.androidVersion}`,
    `IMEI: ${data.imei}`,
    `Lockdown Level: ${data.lockdownLevel}`,
  ];
  info.forEach((line, idx) => {
    doc.text(line, 25, 55 + idx * 7);
  });

  let y = 55 + info.length * 7 + 10;

  doc.setFontSize(12);
  doc.setTextColor(30, 58, 138);
  doc.text('Setup Log', 20, y);
  y += 8;

  doc.setFontSize(8);
  doc.setTextColor(50, 50, 50);
  for (const entry of data.setupLog) {
    if (y > 275) {
      doc.addPage();
      y = 20;
    }
    doc.text(entry, 25, y);
    y += 5;
  }

  return doc.output('blob');
}

export function downloadPdfBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `kosherflip_report_${new Date().toISOString().split('T')[0]}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
