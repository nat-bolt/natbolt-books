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
    const probe = document.createElement('iframe');
    probe.style.display = 'none';
    probe.src = appUrl;
    document.body.appendChild(probe);

    window.setTimeout(() => {
      if (probe.parentNode) probe.parentNode.removeChild(probe);
    }, 1200);

    window.setTimeout(() => {
      if (!document.hidden) window.location.href = webUrl;
    }, 900);

    return;
  }

  const popup = window.open(webUrl, '_blank', 'noopener,noreferrer');
  if (!popup) window.location.href = webUrl;
}
