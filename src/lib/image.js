// image.js: shrink a photo before it is sent to the AI or saved.
// Returns { preview: data URL, image: { mimeType, data: base64 } }.
export async function toSmallJpeg(file, maxSide = 1280, quality = 0.85) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const url = canvas.toDataURL('image/jpeg', quality);
  return { preview: url, image: { mimeType: 'image/jpeg', data: url.split(',')[1] } };
}
