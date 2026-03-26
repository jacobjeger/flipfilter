export async function generateQrDataUrl(text: string): Promise<string> {
  const QRCode = (await import('qrcode')).default;
  return QRCode.toDataURL(text, { width: 256, margin: 2 });
}
