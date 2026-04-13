import { jsPDF } from 'jspdf';
// QRCode auto-generation removed — payment QR must be uploaded by shop owner
// to ensure it's verified correct before reaching customers.

// ── DejaVuSans font loader ─────────────────────────────────────────────────────
// DejaVuSans supports ₹ (U+20B9) and is verified compatible with jsPDF v4.
// NotoSans (downloaded previously) fails jsPDF v4's NameTable parser.
// Fonts served from /public/fonts/. Falls back to Helvetica + "Rs." if fetch fails.
let _dvRegB64  = null;
let _dvBoldB64 = null;
let _dvFailed  = false; // once failed, stop retrying on each PDF

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

// Returns font family name: 'DejaVuSans' (with ₹) or 'helvetica' (fallback)
async function loadFont(doc) {
  if (_dvFailed) return 'helvetica';
  try {
    if (!_dvRegB64)  _dvRegB64  = await toBase64('/fonts/DejaVuSans.ttf');
    if (!_dvBoldB64) _dvBoldB64 = await toBase64('/fonts/DejaVuSans-Bold.ttf');
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

// ── Helpers ────────────────────────────────────────────────────────────────────
// currency symbol: ₹ when NotoSans loaded (has the glyph), "Rs." for Helvetica
const mkFmt = (useRupee) => (n) =>
  `${useRupee ? '₹' : 'Rs.'}${Number(n || 0).toFixed(2)}`;

const fmtDate = (ts) => {
  const d = ts?.toDate ? ts.toDate() : new Date(ts || Date.now());
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

// Brand colours
const BRAND_DARK  = [26,  35,  126]; // #1A237E
const BRAND_MID   = [57,  73,  171]; // #3949AB
const BRAND_LIGHT = [232, 234, 246]; // #E8EAF6
const ACCENT      = [245, 124,   0]; // #F57C00
const WHITE       = [255, 255, 255];
const GRAY        = [100, 100, 100];
const LIGHT_GRAY  = [240, 240, 240];
const TEXT        = [33,  33,  33];

// ── Main PDF generator ─────────────────────────────────────────────────────────
export async function generateBillPDF({ bill, shop, customer, t, lang }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a5', orientation: 'portrait' });

  // Load DejaVuSans if available; fall back to Helvetica — PDF always generates
  const F   = await loadFont(doc);             // font family name
  const fmt = mkFmt(F === 'DejaVuSans');       // ₹ with DejaVuSans, Rs. with Helvetica

  const W = doc.internal.pageSize.getWidth();  // 148mm
  const M = 10; // margin

  const isEstimate    = bill.type === 'estimate';
  const isGST         = bill.isGST;
  const items         = bill.items || [];
  const partsSubtotal = items.reduce((s, i) => s + (i.total || 0), 0);
  const cgst          = isGST ? partsSubtotal * 0.09 : 0;
  const sgst          = isGST ? partsSubtotal * 0.09 : 0;
  const grandTotal    = partsSubtotal + (bill.labourCharge || 0) + cgst + sgst;

  let y = M;

  // ── Header band ──────────────────────────────────────────────────────────────
  doc.setFillColor(...BRAND_DARK);
  doc.rect(0, 0, W, 28, 'F');

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
        const photoSize = 24; // 24mm square
        doc.addImage(imgData, imgType, W - M - photoSize, 2, photoSize, photoSize);
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

  doc.setFont(F, 'normal');
  doc.setFontSize(8);
  if (shop?.gstNumber && isGST) {
    doc.text(`GST: ${shop.gstNumber}`, M, 16);
  }
  if (shop?.address) {
    const maxChars = Math.floor(textMaxWidth / 1.5); // rough character limit
    doc.text(shop.address.substring(0, maxChars), M, 21);
  }
  doc.text(`Ph: ${shop?.phone || ''}`, M, 26);

  y = 32;

  // ── Document type badge ──────────────────────────────────────────────────────
  const docLabel = isEstimate
    ? (t('pdf.estimate') + ' — ' + t('pdf.notTaxInvoice'))
    : isGST ? t('pdf.taxInvoice') : t('pdf.serviceBill');

  doc.setFillColor(...ACCENT);
  doc.rect(0, y, W, 8, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont(F, 'bold');
  doc.setFontSize(10);
  doc.text(docLabel.toUpperCase(), W / 2, y + 5.5, { align: 'center' });

  y += 15;

  // ── Bill meta (two columns) ─────────────────────────────────────────────────
  doc.setTextColor(...TEXT);
  doc.setFont(F, 'normal');
  doc.setFontSize(8);

  const metaLeft = [
    [t('pdf.billNo'), bill.billNumber || bill.estimateNumber || '-'],
    [t('pdf.date'),   fmtDate(bill.createdAt)],
  ];
  const metaRight = [
    [t('pdf.customerName'), customer?.name || bill.customerName || '-'],
    [t('pdf.phone'),        customer?.phone || bill.customerPhone || '-'],
    [t('pdf.vehicleNo'),    bill.vehicleNo || '-'],
    [t('pdf.vehicleType'),  `${bill.vehicleBrand || ''} ${bill.vehicleModel || ''}`.trim() || '-'],
  ];

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

  // ── Job Photo (if available) ─────────────────────────────────────────────────
  if (bill.jobPhotoUrl) {
    try {
      const res = await fetch(bill.jobPhotoUrl);
      if (res.ok) {
        const blob = await res.blob();
        const imgData = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload  = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Add photo with max width of 60mm, maintain aspect ratio
        const img = new Image();
        await new Promise((resolve) => {
          img.onload = resolve;
          img.src = imgData;
        });

        const maxW = 60;
        const imgW = Math.min(maxW, (img.width / img.height) * 40);
        const imgH = (img.height / img.width) * imgW;

        // Center the photo
        const photoX = (W - imgW) / 2;
        doc.addImage(imgData, 'JPEG', photoX, y, imgW, imgH);
        y += imgH + 4;
      }
    } catch (err) {
      console.warn('[PDF] Job photo fetch failed:', err.message);
      // Continue without photo
    }
  }

  // ── Parts table ──────────────────────────────────────────────────────────────
  const colW = [8,  51, 12, 24, 28]; // Sr, Description, Qty, Rate, Amount
  const colX = [M, M+11, M+62, M+74, M+98];
  const RX   = colX[4] + colW[4]; // = 136mm — single right-align reference for all money

  const headers = [
    t('pdf.srNo'), t('pdf.description'), t('pdf.qty'), t('pdf.rate'), t('pdf.amount'),
  ];

  // Header row
  doc.setFillColor(...BRAND_DARK);
  doc.rect(M, y, W - 2 * M, 8, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont(F, 'bold');
  doc.setFontSize(8);
  headers.forEach((h, i) => {
    const align = i === 1 ? 'left' : 'right';
    const x     = i === 1 ? colX[i] : colX[i] + colW[i];
    doc.text(h, x, y + 5.5, { align });
  });
  y += 8;

  // Data rows
  doc.setFont(F, 'normal');
  doc.setFontSize(8);
  items.forEach((item, idx) => {
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

  // ── Totals: Parts Subtotal → Labour → GST → Grand Total ──────────────────────
  // Parts Subtotal
  doc.setFillColor(...BRAND_LIGHT);
  doc.rect(M, y, W - 2 * M, 6, 'F');
  doc.setTextColor(...BRAND_MID);
  doc.setFont(F, 'bold');
  doc.setFontSize(8);
  doc.text(t('pdf.partsSubtotal'), colX[1], y + 4.2);
  doc.text(fmt(partsSubtotal), RX, y + 4.2, { align: 'right' });
  y += 6;

  y += 4; // gap between subtotal and labour

  // Labour Charges
  doc.setFillColor(...BRAND_LIGHT);
  doc.rect(M, y, W - 2 * M, 6, 'F');
  doc.setTextColor(...BRAND_MID);
  doc.setFont(F, 'bold');
  doc.text(t('pdf.labourCharges'), colX[1], y + 4.2);
  doc.text(fmt(bill.labourCharge || 0), RX, y + 4.2, { align: 'right' });
  y += 6;

  // GST rows
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

  // Grand Total band
  y += 3;
  doc.setFillColor(...BRAND_DARK);
  doc.rect(M, y, W - 2 * M, 9, 'F');
  doc.setTextColor(...WHITE);
  doc.setFont(F, 'bold');
  doc.setFontSize(10);
  doc.text(t('pdf.grandTotal'), M + 2, y + 6.2);
  doc.text(fmt(grandTotal), RX, y + 6.2, { align: 'right' });
  y += 12;

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
        doc.addImage(imgData, imgType, W - M - 28, y, 28, 28);
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

// ── Convenience: blob for sharing ────────────────────────────────────────────
export async function getBillPDFBlob(params) {
  const doc = await generateBillPDF(params);
  return doc.output('blob');
}
