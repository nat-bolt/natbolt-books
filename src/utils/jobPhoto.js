const MAX_UPLOAD_BYTES = 1.2 * 1024 * 1024;
const SKIP_IF_BYTES_BELOW = 900 * 1024;
const SKIP_IF_MAX_EDGE_BELOW = 1400;
const TARGET_MAX_EDGE = 1600;
const JPEG_QUALITY = 0.88;
const JPEG_QUALITY_FALLBACK = 0.82;

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    image.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Failed to encode image'));
    }, type, quality);
  });
}

export async function optimizeJobPhoto(file) {
  if (!file || !file.type.startsWith('image/')) return file;
  if (file.size <= SKIP_IF_BYTES_BELOW) return file;

  const image = await loadImage(file);
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const maxEdge = Math.max(width, height);

  // Small or already low-res images should stay untouched to protect clarity.
  if (maxEdge <= SKIP_IF_MAX_EDGE_BELOW && file.size <= MAX_UPLOAD_BYTES) return file;

  const scale = maxEdge > TARGET_MAX_EDGE ? TARGET_MAX_EDGE / maxEdge : 1;
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) return file;
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const targetType = file.type === 'image/png' ? 'image/jpeg' : (file.type || 'image/jpeg');
  let blob = await canvasToBlob(canvas, targetType, JPEG_QUALITY);

  if (blob.size > MAX_UPLOAD_BYTES && targetType === 'image/jpeg') {
    blob = await canvasToBlob(canvas, targetType, JPEG_QUALITY_FALLBACK);
  }

  // Keep the original if optimization did not help enough.
  if (blob.size >= file.size * 0.9) return file;

  const name = file.name.replace(/\.(png|jpg|jpeg|webp)$/i, '') + '.jpg';
  return new File([blob], name, {
    type: blob.type || 'image/jpeg',
    lastModified: Date.now(),
  });
}
