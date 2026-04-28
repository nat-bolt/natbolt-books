import { jsPDF } from 'jspdf';
import { getAddressLines } from './shopAddress';
import {
  BADGE_HEIGHT_MM,
  HEADER_HEIGHT_MM,
  HEADER_PHOTO_MM,
  META_GAP_MM,
  META_LABEL_W_MM,
  META_PHOTO_H_MM,
  META_PHOTO_W_MM,
  PAGE_MARGIN_MM,
  QR_SIZE_MM,
  TABLE_COLS_MM,
} from './billLayout';
// QRCode auto-generation removed — payment QR must be uploaded by shop owner
// to ensure it's verified correct before reaching customers.

// ── DejaVuSans font loader ─────────────────────────────────────────────────────
// DejaVuSans supports ₹ (U+20B9) and is verified compatible with jsPDF v4.
// NotoSans (downloaded previously) fails jsPDF v4's NameTable parser.
// Fonts served from /public/fonts/. Falls back to Helvetica + "Rs." if fetch fails.
let _dvRegB64  = null;
let _dvBoldB64 = null;
let _dvFailed  = false; // once failed, stop retrying on each PDF
let _fontWarmPromise = null;

async function toBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font fetch failed: ${res.status} ${url}`);
  const buf   = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CHUNK = 8192;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function warmFontBase64() {
  if (_dvFailed) return;
  if (!_fontWarmPromise) {
    _fontWarmPromise = (async () => {
      if (!_dvRegB64) _dvRegB64 = await toBase64('/fonts/DejaVuSans.ttf');
      if (!_dvBoldB64) _dvBoldB64 = await toBase64('/fonts/DejaVuSans-Bold.ttf');
    })().catch((err) => {
      _dvFailed = true;
      _fontWarmPromise = null;
      throw err;
    });
  }
  await _fontWarmPromise;
}

async function blobToDataUrl(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadImageForPdf(url, outputType = 'JPEG', quality = 0.92) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed: ${res.status} ${url}`);

  const blob = await res.blob();
  const sourceDataUrl = await blobToDataUrl(blob);
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = sourceDataUrl;
  });

  const width = img.naturalWidth || img.width;
  const height = img.naturalHeight || img.height;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');
  ctx.drawImage(img, 0, 0, width, height);

  const mime = outputType === 'PNG' ? 'image/png' : 'image/jpeg';
  return {
    imgData: canvas.toDataURL(mime, outputType === 'JPEG' ? quality : undefined),
    imgType: outputType,
    width,
    height,
  };
}

// Returns font family name: 'DejaVuSans' (with ₹) or 'helvetica' (fallback)
async function loadFont(doc) {
  if (_dvFailed) return 'helvetica';
  try {
    await warmFontBase64();
    doc.addFileToVFS('DejaVuSans.ttf',      _dvRegB64);
    doc.addFileToVFS('DejaVuSans-Bold.ttf', _dvBoldB64);
    doc.addFont('DejaVuSans.ttf',      'DejaVuSans', 'normal');
    doc.addFont('DejaVuSans-Bold.ttf', 'DejaVuSans', 'bold');
    return 'DejaVuSans';
  } catch (e) {
    console.warn('[NatBolt PDF] DejaVuSans load failed — using Helvetica fallback:', e.message);
    _dvFailed = true;
    return 'helvetica';
  }
}

export async function warmPdfResources() {
  try {
    await Promise.allSettled([
      warmFontBase64(),
      fetch('/icons/logo.png'),
    ]);
  } catch (_) {}
}

// ── Helpers ────────────────────────────────────────────────────────────────────
// currency symbol: ₹ when NotoSans loaded (has the glyph), "Rs." for Helvetica
const mkFmt = (useRupee) => (n) =>
  `${useRupee ? '₹' : 'Rs.'}${Number(n || 0).toFixed(2)}`;

const fmtDate = (ts) => {
  const d = ts?.toDate ? ts.toDate() : new Date(ts || Date.now());
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Brand colours — aligned with preview / tailwind config
const BRAND_DARK  = [11,  11,  11];  // #0b0b0b
const BRAND_MID   = [240, 96,  34];  // #f06022
const BRAND_LIGHT = [255, 240, 232]; // #FFF0E8
const ACCENT      = [240, 96,  34];  // #f06022
const WHITE       = [255, 255, 255];
const GRAY        = [107, 114, 128]; // gray-500
const LIGHT_GRAY  = [229, 231, 235]; // gray-200
const TEXT        = [17,  24,  39];  // gray-900

// ── Main PDF generator ─────────────────────────────────────────────────────────
export async function generateBillPDF({ bill, shop, customer, t, lang }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });

  // Load DejaVuSans if available; fall back to Helvetica — PDF always generates
  const F   = await loadFont(doc);             // font family name
  const fmt = mkFmt(F === 'DejaVuSans');       // ₹ with DejaVuSans, Rs. with Helvetica

  const W = doc.internal.pageSize.getWidth();  // 148mm
  const H = doc.internal.pageSize.getHeight(); // 210mm
  const M = PAGE_MARGIN_MM;

  const isEstimate    = bill.type === 'estimate';
  const isGST         = bill.isGST;
  const items         = bill.items || [];
  const partsSubtotal = isEstimate ? 0 : items.reduce((s, i) => s + (i.total || 0), 0);
  const cgst          = isGST ? partsSubtotal * 0.09 : 0;
  const sgst          = isGST ? partsSubtotal * 0.09 : 0;
  const labourCharge  = Number(isEstimate ? (bill.grandTotal || bill.labourCharge || 0) : (bill.labourCharge || 0));
  const grandTotal    = isEstimate ? labourCharge : partsSubtotal + labourCharge + cgst + sgst;

  let y = M;

  // ── Header band ──────────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, W, HEADER_HEIGHT_MM, 'F');

  // Shop photo (top-right corner if available)
  let shopPhotoWidth = 0;
  if (shop?.shopPhotoUrl) {
    try {
      const res = await fetch(shop.shopPhotoUrl);
      if (res.ok) {
        const blob    = await res.blob();
        const imgData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const mime    = blob.type || '';
        const imgType = mime.includes('jpeg') || mime.includes('jpg') ? 'JPEG' : 'PNG';
        const photoSize = HEADER_PHOTO_MM;
        doc.addImage(imgData, imgType, W - M - photoSize, 5, photoSize, photoSize);
        shopPhotoWidth = photoSize + 3; // reserve space for photo + gap
      }
    } catch (err) {
      console.warn('[NatBolt PDF] Shop photo load failed:', err.message);
    }
  }

  // Shop text (left side, adjusted if photo exists)
  const textMaxWidth = W - 2 * M - shopPhotoWidth;
  doc.setTextColor(...WHITE);
  doc.setFont(F, 'bold');
  doc.setFontSize(15);
  doc.text(shop?.shopName || 'Shop Name', M, 10);

  let headerTextY = 16;
  const addressLines = getAddressLines(shop?.address || '');
  doc.setFont(F, 'normal');
  doc.setFontSize(8);
  if (shop?.gstNumber && isGST) {
    doc.text(`GST: ${shop.gstNumber}`, M, headerTextY);
    headerTextY += 4.5;
  }
  if (addressLines.length > 0) {
    doc.setFontSize(7.5);
    doc.text(addressLines, M, headerTextY);
    headerTextY += addressLines.length * 3.8 + 1;
    doc.setFontSize(8);
  }
  doc.text(`Ph: ${shop?.phone || ''}`, M, Math.min(headerTextY, 31));

  y = HEADER_HEIGHT_MM + 4;

  // ── Document type badge ──────────────────────────────────────────────────────
  const docLabel = isEstimate
    ? t('pdf.jobCard')
    : isGST ? t('pdf.taxInvoice') : t('pdf.serviceBill');

  doc.setFillColor(...ACCENT);
  doc.rect(0, y, W, BADGE_HEIGHT_MM, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont(F, 'bold');
  doc.setFontSize(10);
  doc.text(docLabel.toUpperCase(), W / 2, y + 5.5, { align: 'center' });

  y += 15;

  // ── Bill meta / job photo layout ────────────────────────────────────────────
  doc.setTextColor(...TEXT);
  doc.setFont(F, 'normal');
  doc.setFontSize(8);

  const metaEntries = [
    [isEstimate ? t('pdf.estimateNo') : t('pdf.billNo'), bill.billNumber || bill.estimateNumber || '-'],
    [t('pdf.date'), fmtDate(bill.createdAt)],
    [t('pdf.customerName'), customer?.name || bill.customerName || '-'],
    [t('pdf.phone'), customer?.phone || bill.customerPhone || '-'],
    [t('pdf.vehicleNo'), bill.vehicleNo || '-'],
    [t('pdf.vehicleType'), `${bill.vehicleBrand || ''} ${bill.vehicleModel || ''}`.trim() || '-'],
    [t('pdf.odoReading'), bill.odoReading ? `${bill.odoReading} ${t('vehicle.odoUnit')}` : '-'],
  ];

  if (bill.jobPhotoUrl) {
    try {
      const { imgData, imgType, width, height } = await loadImageForPdf(bill.jobPhotoUrl, 'JPEG');
        const photoBoxW = META_PHOTO_W_MM;
        const photoBoxH = META_PHOTO_H_MM;
        const photoGap = META_GAP_MM;
        const imgW = Math.min(photoBoxW, (width / height) * photoBoxH);
        const imgH = (height / width) * imgW;
        const photoX = M;
        const photoY = y;
        const textX = photoX + photoBoxW + photoGap;
        const valueX = textX + META_LABEL_W_MM;
        const textWidth = W - M - textX;
        const lineGap = 5.2;

        doc.setDrawColor(...LIGHT_GRAY);
        doc.rect(photoX, photoY, photoBoxW, photoBoxH);
        doc.addImage(
          imgData,
          imgType,
          photoX + (photoBoxW - imgW) / 2,
          photoY + (photoBoxH - imgH) / 2,
          imgW,
          imgH
        );

        metaEntries.forEach(([label, val], i) => {
          const rowY = photoY + 4 + i * lineGap;
          doc.setFont(F, 'bold');
          doc.text(`${label}:`, textX, rowY);
          doc.setFont(F, 'normal');
          doc.text(String(val).substring(0, 24), valueX, rowY, { maxWidth: Math.max(10, textWidth - 24) });
        });

        y += Math.max(photoBoxH, 4 + metaEntries.length * lineGap) + 4;
    } catch (err) {
      console.warn('[PDF] Job photo fetch failed:', err.message);
      const metaLeft = metaEntries.slice(0, 2);
      const metaRight = metaEntries.slice(2);

      metaLeft.forEach(([label, val], i) => {
        doc.setFont(F, 'bold');
        doc.text(`${label}:`, M + 2, y + i * 6);
        doc.setFont(F, 'normal');
        doc.text(String(val), M + 16, y + i * 6);
      });
      metaRight.forEach(([label, val], i) => {
        doc.setFont(F, 'bold');
        doc.text(`${label}:`, W / 2 + 2, y + i * 6);
        doc.setFont(F, 'normal');
        doc.text(String(val).substring(0, 20), W / 2 + 25, y + i * 6);
      });

      y += Math.max(metaLeft.length, metaRight.length) * 6 + 4;
    }
  } else {
    const metaLeft = metaEntries.slice(0, 2);
    const metaRight = metaEntries.slice(2);

    metaLeft.forEach(([label, val], i) => {
      doc.setFont(F, 'bold');
      doc.text(`${label}:`, M + 2, y + i * 6);
      doc.setFont(F, 'normal');
      doc.text(String(val), M + 16, y + i * 6);
    });
    metaRight.forEach(([label, val], i) => {
      doc.setFont(F, 'bold');
      doc.text(`${label}:`, W / 2 + 2, y + i * 6);
      doc.setFont(F, 'normal');
      doc.text(String(val).substring(0, 20), W / 2 + 25, y + i * 6);
    });

    y += Math.max(metaLeft.length, metaRight.length) * 6 + 4;
  }

  // ── Parts table / Job Card total ────────────────────────────────────────────
  const colW = TABLE_COLS_MM; // Sr, Description, Qty, Rate, Amount
  const colX = [M, M+11, M+62, M+74, M+98];
  const RX   = colX[4] + colW[4]; // = 136mm — single right-align reference for all money

  const headers = [
    t('pdf.srNo'), t('pdf.description'), t('pdf.qty'), t('pdf.rate'), t('pdf.amount'),
  ];

  const resetBodyStyle = () => {
    doc.setTextColor(...TEXT);
    doc.setFont(F, 'normal');
    doc.setFontSize(8);
  };

  const startNewPage = () => {
    doc.addPage('a5', 'portrait');
    y = M;
    resetBodyStyle();
  };

  const ensureSpace = (neededHeight) => {
    if (y + neededHeight <= H - M) return;
    startNewPage();
  };

  const drawTableHeader = () => {
    doc.setFillColor(...BRAND_DARK);
    doc.rect(M, y, W - 2 * M, 8, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont(F, 'bold');
    doc.setFontSize(8);
    headers.forEach((h, i) => {
      const align = i === 1 ? 'left' : 'right';
      const x = i === 1 ? colX[i] : colX[i] + colW[i];
      doc.text(h, x, y + 5.5, { align });
    });
    y += 8;
    resetBodyStyle();
  };

  if (isEstimate) {
    ensureSpace(24);
    doc.setFillColor(...BRAND_LIGHT);
    doc.rect(M, y, W - 2 * M, 17, 'F');
    y += 4;
    doc.setFillColor(...BRAND_DARK);
    doc.rect(M + 4, y, W - (2 * M) - 8, 9, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont(F, 'bold');
    doc.setFontSize(10);
    doc.text(t('pdf.approxTotal'), M + 6, y + 6.2);
    doc.text(fmt(grandTotal), W - M - 6, y + 6.2, { align: 'right' });
    y += 13;
  } else {
    drawTableHeader();

    // Data rows
    items.forEach((item, idx) => {
      if (y + 6 > H - M - 28) {
        startNewPage();
        drawTableHeader();
      }

      const bg = idx % 2 === 0 ? WHITE : LIGHT_GRAY;
      doc.setFillColor(...bg);
      doc.rect(M, y, W - 2 * M, 6, 'F');
      doc.setTextColor(...TEXT);

      const partName = (lang === 'hi' ? item.nameHi : lang === 'te' ? item.nameTe : item.name) || item.name || '';

      doc.text(String(idx + 1),                  colX[0] + colW[0], y + 4.2, { align: 'right' });
      doc.text(partName.substring(0, 28),        colX[1],            y + 4.2);
      doc.text(String(item.qty || 1),            colX[2] + colW[2], y + 4.2, { align: 'right' });
      doc.text(fmt(item.unitPrice),              colX[3] + colW[3], y + 4.2, { align: 'right' });
      doc.text(fmt(item.total),                  RX,                 y + 4.2, { align: 'right' });
      y += 6;
    });

    ensureSpace((isGST ? 31 : 23) + (!isEstimate && (shop?.qrCodeUrl || shop?.upiId) ? 40 : 0) + 24);

    // ── Totals: Parts Subtotal → Labour → GST → Grand Total ───────────────────
    doc.setFillColor(...BRAND_LIGHT);
    doc.rect(M, y, W - 2 * M, 6, 'F');
    doc.setTextColor(...BRAND_MID);
    doc.setFont(F, 'bold');
    doc.setFontSize(8);
    doc.text(t('pdf.partsSubtotal'), colX[1], y + 4.2);
    doc.text(fmt(partsSubtotal), RX, y + 4.2, { align: 'right' });
    y += 6;

    y += 4;

    doc.setFillColor(...BRAND_LIGHT);
    doc.rect(M, y, W - 2 * M, 6, 'F');
    doc.setTextColor(...BRAND_MID);
    doc.setFont(F, 'bold');
    doc.text(t('pdf.labourCharges'), colX[1], y + 4.2);
    doc.text(fmt(labourCharge), RX, y + 4.2, { align: 'right' });
    y += 6;

    if (isGST) {
      y += 4;
      doc.setFont(F, 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GRAY);
      [[t('pdf.cgst'), cgst], [t('pdf.sgst'), sgst]].forEach(([label, val]) => {
        doc.text(label,    RX - 38, y);
        doc.text(fmt(val), RX,      y, { align: 'right' });
        y += 5;
      });
    }

    y += 3;
    doc.setFillColor(...BRAND_DARK);
    doc.rect(M, y, W - 2 * M, 9, 'F');
    doc.setTextColor(...WHITE);
    doc.setFont(F, 'bold');
    doc.setFontSize(10);
    doc.text(t('pdf.grandTotal'), M + 2, y + 6.2);
    doc.text(fmt(grandTotal), RX, y + 6.2, { align: 'right' });
    y += 12;
  }

  // ── Payment section (final bills only) ──────────────────────────────────────
  // SECURITY: We never auto-generate a QR from the UPI ID.
  //   An incorrect UPI ID would silently route money to the wrong account.
  //   Only the shop owner's uploaded & verified QR image is used.
  //
  // Behaviour:
  //   • shop.qrCodeUrl set  → embed uploaded QR image + UPI ID text
  //   • shop.qrCodeUrl null → UPI ID text only (customer types it manually)
  //   • neither set         → skip payment section
  if (!isEstimate && (shop?.qrCodeUrl || shop?.upiId)) {
    ensureSpace(shop?.qrCodeUrl ? 38 : 18);
    doc.setTextColor(...TEXT);
    doc.setFont(F, 'bold');
    doc.setFontSize(9);
    doc.text(t('pdf.payVia'), M, y + 5);

    if (shop?.upiId) {
      doc.setFont(F, 'normal');
      doc.setFontSize(8);
      doc.text(`UPI: ${shop.upiId}`, M, y + 11);
    }

    if (shop?.qrCodeUrl) {
      // Embed shop owner's uploaded & verified QR image
      try {
        const res = await fetch(shop.qrCodeUrl);
        if (!res.ok) throw new Error(`QR image fetch failed: ${res.status}`);
        const blob    = await res.blob();
        const imgData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
        const mime    = blob.type || '';
        const imgType = mime.includes('jpeg') || mime.includes('jpg') ? 'JPEG' : 'PNG';
        doc.addImage(imgData, imgType, W - M - QR_SIZE_MM, y, QR_SIZE_MM, QR_SIZE_MM);
        y += 30;
      } catch (qrErr) {
        // Image load failed — UPI ID text is already drawn above, skip QR image
        console.warn('[NatBolt PDF] QR image load failed — showing UPI ID text only:', qrErr.message);
        y += 16;
      }
    } else {
      // No QR image — just UPI ID text
      y += 16;
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────────
  ensureSpace(22);
  y += 8; // Add extra space after QR/payment section

  doc.setTextColor(...GRAY);
  doc.setFont(F, 'normal');
  doc.setFontSize(7);
  doc.text(t('pdf.thankYou'), W / 2, y, { align: 'center' });

  y += 2; // Space between thank you and logo

  // NatBolt logo (centered)
  try {
    const logoRes = await fetch('/icons/logo.png');
    if (logoRes.ok) {
      const logoBlob = await logoRes.blob();
      const logoData = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload  = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(logoBlob);
      });
      const logoSize = 10; // 10mm square logo
      doc.addImage(logoData, 'PNG', (W - logoSize) / 2, y, logoSize, logoSize);
      y += logoSize + 2; // Logo height + small gap
    }
  } catch (err) {
    console.warn('[NatBolt PDF] Logo load failed:', err.message);
    y += 2; // Small gap even if logo fails
  }

  doc.text(t('pdf.poweredBy'), W / 2, y + 2, { align: 'center' });

  return doc;
}

// ── Convenience: download ─────────────────────────────────────────────────────
export async function downloadBillPDF(params) {
  const doc = await generateBillPDF(params);
  const { bill } = params;
  const filename = `${bill.billNumber || bill.estimateNumber || 'bill'}.pdf`;
  doc.save(filename);
}

// ── Convenience: object URL for in-app preview ───────────────────────────────
export async function getBillPDFUrl(params) {
  const blob = await getBillPDFBlob(params);
  return URL.createObjectURL(blob);
}

// ── Convenience: blob for sharing ────────────────────────────────────────────
export async function getBillPDFBlob(params) {
  const doc = await generateBillPDF(params);
  return doc.output('blob');
}
