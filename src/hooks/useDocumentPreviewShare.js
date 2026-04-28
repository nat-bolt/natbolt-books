import { useEffect, useRef, useState } from 'react';
import { getBillPDFBlob, warmPdfResources } from '../utils/pdf';
import {
  generateBillPreviewImage,
  preloadBillPreviewRenderer,
  resolveBillPreviewAssets,
} from '../utils/billPreview';

export default function useDocumentPreviewShare({
  bill,
  shop,
  customer,
  t,
  language,
  filename,
}) {
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewImage, setPdfPreviewImage] = useState('');
  const [previewAssets, setPreviewAssets] = useState({});
  const [showWhatsAppReturnPrompt, setShowWhatsAppReturnPrompt] = useState(false);
  const previewRef = useRef(null);
  const previewAssetsRef = useRef({});
  const awaitingWhatsAppReturnRef = useRef(false);
  const whatsappBackgroundedRef = useRef(false);
  const pdfBlobRef = useRef(null);
  const pdfBlobPromiseRef = useRef(null);

  useEffect(() => {
    previewAssetsRef.current = {};
    pdfBlobRef.current = null;
    pdfBlobPromiseRef.current = null;
    setPreviewAssets({});
  }, [bill?.id, bill?.updatedAt, bill?.jobPhotoUrl, shop?.id, shop?.updatedAt, shop?.shopPhotoUrl, shop?.qrCodeUrl]);

  useEffect(() => {
    const maybeShowPrompt = () => {
      if (awaitingWhatsAppReturnRef.current && whatsappBackgroundedRef.current) {
        awaitingWhatsAppReturnRef.current = false;
        whatsappBackgroundedRef.current = false;
        setShowWhatsAppReturnPrompt(true);
      }
    };

    const handleVisibilityChange = () => {
      if (!awaitingWhatsAppReturnRef.current) return;
      if (document.visibilityState === 'hidden') {
        whatsappBackgroundedRef.current = true;
      } else if (document.visibilityState === 'visible') {
        maybeShowPrompt();
      }
    };

    window.addEventListener('focus', maybeShowPrompt);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', maybeShowPrompt);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  const waitForPreviewRender = () =>
    new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const ensurePreviewAssets = async () => {
    if (!bill || !shop) return {};
    const cached = previewAssetsRef.current;
    if (cached.shopPhotoUrl || cached.jobPhotoUrl || cached.qrCodeUrl) return cached;

    const assets = await resolveBillPreviewAssets({ bill, shop });
    previewAssetsRef.current = assets;
    setPreviewAssets(assets);
    await waitForPreviewRender();
    return assets;
  };

  const buildPdfParams = (assets = {}) => ({
    bill: { ...bill, jobPhotoUrl: assets.jobPhotoUrl || bill.jobPhotoUrl },
    shop: {
      ...shop,
      shopPhotoUrl: assets.shopPhotoUrl || shop.shopPhotoUrl,
      qrCodeUrl: assets.qrCodeUrl || shop.qrCodeUrl,
    },
    customer,
    t,
    lang: language,
  });

  const ensurePdfBlob = async () => {
    if (!bill || !shop) throw new Error('Document preview not ready');
    if (pdfBlobRef.current) return pdfBlobRef.current;
    if (pdfBlobPromiseRef.current) return pdfBlobPromiseRef.current;

    pdfBlobPromiseRef.current = (async () => {
      const assets = await ensurePreviewAssets();
      const blob = await getBillPDFBlob(buildPdfParams(assets));
      pdfBlobRef.current = blob;
      return blob;
    })();

    try {
      return await pdfBlobPromiseRef.current;
    } finally {
      pdfBlobPromiseRef.current = null;
    }
  };

  const downloadBlob = (blob) => {
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  const shareBlob = async (blob) => {
    const file = new File([blob], filename, { type: 'application/pdf' });

    let canShareFile = false;
    try {
      canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
    } catch (_) {}

    if (canShareFile && typeof navigator.share === 'function') {
      await navigator.share({ files: [file], title: filename.replace(/\.pdf$/i, '') });
      return true;
    }

    return false;
  };

  useEffect(() => {
    if (!bill || !shop) return;

    let cancelled = false;
    let timeoutId = null;
    let idleId = null;

    const warm = async () => {
      try {
        await Promise.allSettled([
          ensurePreviewAssets(),
          warmPdfResources(),
          preloadBillPreviewRenderer(),
        ]);
        if (cancelled) return;
        await ensurePdfBlob();
      } catch (_) {}
    };

    if (typeof window.requestIdleCallback === 'function') {
      idleId = window.requestIdleCallback(() => { warm(); }, { timeout: 2200 });
    } else {
      timeoutId = window.setTimeout(() => { warm(); }, 900);
    }

    return () => {
      cancelled = true;
      if (idleId) window.cancelIdleCallback(idleId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [bill?.id, bill?.updatedAt, shop?.id, shop?.updatedAt]);

  const handlePreviewPDF = async () => {
    if (!bill || !shop) return;
    if (pdfPreviewImage) setPdfPreviewImage('');
    setShowPdfPreview(true);
    setPdfLoading(true);
    try {
      await ensurePreviewAssets();
      const previewImage = await generateBillPreviewImage(previewRef.current);
      setPdfPreviewImage(previewImage);
    } catch (err) {
      setShowPdfPreview(false);
      throw err;
    } finally {
      setPdfLoading(false);
    }
  };

  const handleClosePreview = () => {
    setPdfPreviewImage('');
    setShowPdfPreview(false);
  };

  const handleDownloadPreview = async () => {
    if (!bill || !shop) return;
    setPdfLoading(true);
    try {
      const blob = await ensurePdfBlob();
      downloadBlob(blob);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSharePreview = async () => {
    if (!bill || !shop) return;
    setPdfLoading(true);
    try {
      const blob = await ensurePdfBlob();
      const shared = await shareBlob(blob);
      if (!shared) downloadBlob(blob);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSharePdfAfterWhatsApp = async () => {
    if (!bill || !shop) return;
    setPdfLoading(true);
    try {
      const blob = await ensurePdfBlob();
      const shared = await shareBlob(blob);
      if (!shared) downloadBlob(blob);

      setShowWhatsAppReturnPrompt(false);
    } finally {
      setPdfLoading(false);
    }
  };

  const registerWhatsAppLaunch = () => {
    awaitingWhatsAppReturnRef.current = true;
    whatsappBackgroundedRef.current = false;
    setShowWhatsAppReturnPrompt(false);
  };

  return {
    pdfLoading,
    showPdfPreview,
    pdfPreviewImage,
    previewAssets,
    showWhatsAppReturnPrompt,
    setShowWhatsAppReturnPrompt,
    previewRef,
    handlePreviewPDF,
    handleClosePreview,
    handleDownloadPreview,
    handleSharePreview,
    handleSharePdfAfterWhatsApp,
    registerWhatsAppLaunch,
  };
}
