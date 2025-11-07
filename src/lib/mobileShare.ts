// src/lib/mobileShare.ts
import { Share, Clipboard } from 'react-native';
export async function copyText(t: string) {
  // If you use @react-native-clipboard/clipboard, import from there
  await Clipboard.setString(t);
}
export async function shareText(t: string) {
  try { await Share.share({ message: t }); } catch {}
}