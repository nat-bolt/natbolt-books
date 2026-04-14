async function waitForImages(container) {
  const images = Array.from(container.querySelectorAll('img'));
  await Promise.all(images.map((img) => {
    if (img.complete) return Promise.resolve();
    return new Promise((resolve) => {
      img.addEventListener('load', resolve, { once: true });
      img.addEventListener('error', resolve, { once: true });
    });
  }));
}

async function toDataUrl(url) {
  if (!url) return '';
  try {
    const res = await fetch(url);
    if (!res.ok) return url;
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (_) {
    return url;
  }
}

async function waitForPaint() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

export async function resolveBillPreviewAssets({ bill, shop }) {
  const [shopPhotoUrl, jobPhotoUrl, qrCodeUrl] = await Promise.all([
    toDataUrl(shop?.shopPhotoUrl || ''),
    toDataUrl(bill?.jobPhotoUrl || ''),
    toDataUrl(shop?.qrCodeUrl || ''),
  ]);

  return { shopPhotoUrl, jobPhotoUrl, qrCodeUrl };
}

export async function generateBillPreviewImage(container) {
  if (!container) throw new Error('Preview container not available');

  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch (_) {}
  }

  await waitForImages(container);
  await waitForPaint();

  const { default: html2canvas } = await import('html2canvas');
  const canvas = await html2canvas(container, {
    backgroundColor: '#f5f5f5',
    useCORS: true,
    allowTaint: false,
    logging: false,
    imageTimeout: 15000,
    scale: Math.min(window.devicePixelRatio || 1, 2),
    windowWidth: container.scrollWidth,
    windowHeight: container.scrollHeight,
  });

  return canvas.toDataURL('image/jpeg', 0.92);
}
