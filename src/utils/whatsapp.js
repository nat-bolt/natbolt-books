function normalizeWhatsAppPhone(rawPhone) {
  const digits = String(rawPhone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 13 && digits.startsWith('091')) return digits.slice(1);
  return digits;
}

export function buildWhatsAppUrls(phone, message) {
  const normalizedPhone = normalizeWhatsAppPhone(phone);
  const encoded = encodeURIComponent(message);

  return {
    webUrl: normalizedPhone
      ? `https://wa.me/${normalizedPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`,
    appUrl: normalizedPhone
      ? `whatsapp://send?phone=${normalizedPhone}&text=${encoded}`
      : `whatsapp://send?text=${encoded}`,
  };
}

export function openWhatsApp(phone, message) {
  const { webUrl, appUrl } = buildWhatsAppUrls(phone, message);
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  const isMobile = /Android|iPhone|iPad|iPod/i.test(window.navigator.userAgent || '');

  if (isMobile || isStandalone) {
    let appOpened = false;
    let fallbackTimer = null;

    const cleanup = () => {
      window.removeEventListener('blur', markOpened);
      window.removeEventListener('pagehide', markOpened);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (fallbackTimer) {
        window.clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
    };

    const markOpened = () => {
      appOpened = true;
      cleanup();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') markOpened();
    };

    window.addEventListener('blur', markOpened, { once: true });
    window.addEventListener('pagehide', markOpened, { once: true });
    document.addEventListener('visibilitychange', handleVisibilityChange);

    fallbackTimer = window.setTimeout(() => {
      cleanup();
      if (!appOpened && document.visibilityState === 'visible') {
        window.location.replace(webUrl);
      }
    }, 1800);

    window.location.href = appUrl;

    return;
  }

  const popup = window.open(webUrl, '_blank', 'noopener,noreferrer');
  if (!popup) window.location.href = webUrl;
}
