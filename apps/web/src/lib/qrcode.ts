import QRCode from 'qrcode';

/**
 * Generates a QR code as a data URL from a given URL.
 */
export async function generateQRCodeDataUrl(
  url: string,
  options?: {
    width?: number;
    color?: { dark?: string; light?: string };
  }
): Promise<string> {
  return QRCode.toDataURL(url, {
    width: options?.width ?? 300,
    margin: 1,
    color: {
      dark: options?.color?.dark ?? '#000000',
      light: options?.color?.light ?? '#ffffff',
    },
  });
}
