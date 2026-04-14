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

async function waitForPaint() {
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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
