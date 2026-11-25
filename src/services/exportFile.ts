import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function exportTextFile(filename: string, contents: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  file.create({ overwrite: true });
  await file.write(contents);
  const available = await Sharing.isAvailableAsync();
  if (!available) {
    throw new Error('Sharing is not available on this device.');
  }
  await Sharing.shareAsync(file.uri, {
    mimeType,
    dialogTitle: 'Export SpendSense',
  });
}
