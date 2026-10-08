import type { Photo } from './types';

const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_DIMENSION = 1200;
const JPEG_QUALITY = 0.85;

/**
 * Shrinks a photo to at most 1200px on its longest side and re-encodes it as JPEG,
 * so uploads stay small (~200–400 KB) regardless of the phone camera.
 */
export async function resizeImage(file: File): Promise<Photo> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Please choose an image file (JPG or PNG).');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error('That photo is too large. Please choose one under 20 MB.');
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("We couldn't read that photo. Please try a JPG or PNG.");
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser could not process the photo.');
  ctx.fillStyle = '#fff'; // flatten transparent PNGs onto white
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  return {
    base64: dataUrl.slice(dataUrl.indexOf(',') + 1),
    mimeType: 'image/jpeg',
    previewUrl: dataUrl,
  };
}
