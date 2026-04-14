import { getAddressLines } from '../utils/shopAddress';
import {
  ADDRESS_TEXT_PT,
  BADGE_HEIGHT_MM,
  BADGE_TEXT_PT,
  BODY_TEXT_PT,
  GRAND_TOTAL_TEXT_PT,
  HEADER_HEIGHT_MM,
  HEADER_PHOTO_MM,
  HEADER_TEXT_PT,
  META_GAP_MM,
  META_LABEL_W_MM,
  META_PHOTO_H_MM,
  META_PHOTO_W_MM,
  PAGE_MARGIN_MM,
  PAGE_WIDTH_MM,
  QR_SIZE_MM,
  SHOP_NAME_PT,
  TABLE_COLS_MM,
  TOTAL_TEXT_PT,
  mm,
  pt,
} from '../utils/billLayout';

function fmtCurrency(n) {
  return `₹${Number(n || 0).toFixed(2)}`;
}

function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts || Date.now());
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const SECTION_GAP_MM = 4;

export default function BillPreviewSheet({ bill, shop, customer, t, lang, previewAssets = {} }) {
  const isEstimate = bill.type === 'estimate';
  const items = bill.items || [];
  const partsSubtotal = Number(
    bill.partsSubtotal ??
    items.reduce((sum, item) => sum + Number(item.total || 0), 0)
  );
  const labourCharge = Number(bill.labourCharge || 0);
  const cgst = Number(bill.cgst || 0);
  const sgst = Number(bill.sgst || 0);
  const grandTotal = Number(bill.grandTotal || partsSubtotal + labourCharge + cgst + sgst);
  const docLabel = isEstimate
    ? `${t('pdf.estimate')} - ${t('pdf.notTaxInvoice')}`
    : bill.isGST ? t('pdf.taxInvoice') : t('pdf.serviceBill');
  const metaRows = [
    [isEstimate ? t('pdf.estimateNo') : t('pdf.billNo'), bill.billNumber || bill.estimateNumber || '-'],
    [t('pdf.date'), fmtDate(bill.createdAt)],
    [t('pdf.customerName'), customer?.name || bill.customerName || '-'],
    [t('pdf.phone'), customer?.phone || bill.customerPhone || '-'],
    [t('pdf.vehicleNo'), bill.vehicleNo || '-'],
    [t('pdf.vehicleType'), `${bill.vehicleBrand || ''} ${bill.vehicleModel || ''}`.trim() || '-'],
    [t('pdf.odoReading'), bill.odoReading ? `${bill.odoReading} ${t('vehicle.odoUnit')}` : '-'],
  ];

  const jobPhotoSrc = previewAssets.jobPhotoUrl || bill.jobPhotoUrl;
  const shopPhotoSrc = previewAssets.shopPhotoUrl || shop?.shopPhotoUrl;
  const qrCodeSrc = previewAssets.qrCodeUrl || shop?.qrCodeUrl;
  const logoSrc = '/icons/logo.png';
  const addressLines = getAddressLines(shop?.address || '');

  return (
    <div style={{ width: mm(PAGE_WIDTH_MM), background: '#ffffff', color: '#111827' }}>
      <div style={{ border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        <div
          style={{
            minHeight: mm(HEADER_HEIGHT_MM),
            background: '#0b0b0b',
            color: '#ffffff',
            padding: `${mm(2.2)} ${mm(PAGE_MARGIN_MM)}`,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: mm(3),
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: pt(SHOP_NAME_PT), fontWeight: 700, lineHeight: 1.1, wordBreak: 'break-word' }}>
              {shop?.shopName || 'Shop Name'}
            </div>
            {shop?.gstNumber && bill.isGST && (
              <div style={{ marginTop: mm(1.6), fontSize: pt(HEADER_TEXT_PT), opacity: 0.9 }}>GST: {shop.gstNumber}</div>
            )}
            {addressLines.length > 0 && (
              <div style={{ marginTop: mm(1.2), fontSize: pt(ADDRESS_TEXT_PT), lineHeight: 1.35, opacity: 0.9 }}>
                {addressLines.map((line, index) => (
                  <div key={`${line}-${index}`}>{line}</div>
                ))}
              </div>
            )}
            {shop?.phone && (
              <div style={{ marginTop: mm(1.2), fontSize: pt(HEADER_TEXT_PT), opacity: 0.9 }}>Ph: {shop.phone}</div>
            )}
          </div>
          {shopPhotoSrc && (
            <img
              src={shopPhotoSrc}
              alt="Shop"
              style={{
                width: mm(HEADER_PHOTO_MM),
                height: mm(HEADER_PHOTO_MM),
                objectFit: 'cover',
                borderRadius: mm(4),
                border: '1px solid rgba(255,255,255,0.2)',
                background: 'rgba(255,255,255,0.1)',
                flexShrink: 0,
              }}
            />
          )}
        </div>

        <div
          style={{
            height: mm(BADGE_HEIGHT_MM),
            background: '#f06022',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: pt(BADGE_TEXT_PT),
            fontWeight: 700,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {docLabel}
        </div>

        <div style={{ padding: `${mm(5)} ${mm(PAGE_MARGIN_MM)}`, display: 'grid', gap: mm(SECTION_GAP_MM) }}>
          <div style={{ display: 'flex', gap: mm(META_GAP_MM), alignItems: 'flex-start' }}>
            {jobPhotoSrc && (
              <div
                style={{
                  width: mm(META_PHOTO_W_MM),
                  height: mm(META_PHOTO_H_MM),
                  border: '1px solid #e5e7eb',
                  background: '#f3f4f6',
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <img
                  src={jobPhotoSrc}
                  alt="Job"
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}

            <div style={{ flex: 1, display: 'grid', gap: mm(2.6), fontSize: pt(BODY_TEXT_PT) }}>
              {metaRows.map(([label, value]) => (
                <div key={label} style={{ display: 'flex', alignItems: 'flex-start', gap: mm(2) }}>
                  <span style={{ width: mm(META_LABEL_W_MM), flexShrink: 0, fontWeight: 700, color: '#374151' }}>
                    {label}:
                  </span>
                  <span style={{ color: '#111827', wordBreak: 'break-word' }}>{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ border: '1px solid #e5e7eb', overflow: 'hidden' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: TABLE_COLS_MM.map(mm).join(' '),
                background: '#0b0b0b',
                color: '#ffffff',
                fontSize: pt(BODY_TEXT_PT),
                fontWeight: 700,
                padding: `${mm(2)} 0`,
              }}
            >
              <div style={{ textAlign: 'right', paddingRight: mm(1) }}>{t('pdf.srNo')}</div>
              <div style={{ paddingLeft: mm(2) }}>{t('pdf.description')}</div>
              <div style={{ textAlign: 'right', paddingRight: mm(1) }}>{t('pdf.qty')}</div>
              <div style={{ textAlign: 'right', paddingRight: mm(1) }}>{t('pdf.rate')}</div>
              <div style={{ textAlign: 'right', paddingRight: mm(2) }}>{t('pdf.amount')}</div>
            </div>

            {items.map((item, index) => {
              const partName =
                (lang === 'hi' ? item.nameHi : lang === 'te' ? item.nameTe : item.name) ||
                item.name ||
                '';
              const bg = index % 2 === 0 ? '#ffffff' : '#e5e7eb';

              return (
                <div
                  key={`${partName}-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: TABLE_COLS_MM.map(mm).join(' '),
                    background: bg,
                    color: '#111827',
                    fontSize: pt(BODY_TEXT_PT),
                    padding: `${mm(1.8)} 0`,
                    borderTop: index === 0 ? 'none' : '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ textAlign: 'right', paddingRight: mm(1) }}>{index + 1}</div>
                  <div style={{ paddingLeft: mm(2), paddingRight: mm(2), wordBreak: 'break-word' }}>{partName}</div>
                  <div style={{ textAlign: 'right', paddingRight: mm(1) }}>{item.qty || 1}</div>
                  <div style={{ textAlign: 'right', paddingRight: mm(1) }}>{fmtCurrency(item.unitPrice)}</div>
                  <div style={{ textAlign: 'right', paddingRight: mm(2) }}>{fmtCurrency(item.total)}</div>
                </div>
              );
            })}
          </div>

          <div style={{ background: '#FFF0E8', padding: mm(4), display: 'grid', gap: mm(2.5) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: mm(4), color: '#f06022', fontSize: pt(TOTAL_TEXT_PT), fontWeight: 700 }}>
              <span>{t('pdf.partsSubtotal')}</span>
              <span>{fmtCurrency(partsSubtotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: mm(4), color: '#f06022', fontSize: pt(TOTAL_TEXT_PT), fontWeight: 700 }}>
              <span>{t('pdf.labourCharges')}</span>
              <span>{fmtCurrency(labourCharge)}</span>
            </div>
            {bill.isGST && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: mm(4), color: '#6b7280', fontSize: pt(TOTAL_TEXT_PT) }}>
                  <span>{t('pdf.cgst')}</span>
                  <span>{fmtCurrency(cgst)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: mm(4), color: '#6b7280', fontSize: pt(TOTAL_TEXT_PT) }}>
                  <span>{t('pdf.sgst')}</span>
                  <span>{fmtCurrency(sgst)}</span>
                </div>
              </>
            )}
            <div
              style={{
                background: '#0b0b0b',
                color: '#ffffff',
                display: 'flex',
                justifyContent: 'space-between',
                gap: mm(4),
                padding: `${mm(3)} ${mm(4)}`,
                fontSize: pt(GRAND_TOTAL_TEXT_PT),
                fontWeight: 700,
              }}
            >
              <span>{t('pdf.grandTotal')}</span>
              <span>{fmtCurrency(grandTotal)}</span>
            </div>
          </div>

          {!isEstimate && (qrCodeSrc || shop?.upiId) && (
            <div style={{ border: '1px solid #e5e7eb', padding: mm(4) }}>
              <div style={{ fontSize: pt(BODY_TEXT_PT), fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#f06022' }}>
                {t('pdf.payVia')}
              </div>
              {shop?.upiId && (
                <div style={{ marginTop: mm(2), fontSize: pt(BODY_TEXT_PT), color: '#374151', wordBreak: 'break-all' }}>
                  UPI: {shop.upiId}
                </div>
              )}
              {qrCodeSrc && (
                <img
                  src={qrCodeSrc}
                  alt="Payment QR"
                  style={{
                    width: mm(QR_SIZE_MM),
                    height: mm(QR_SIZE_MM),
                    marginTop: mm(3),
                    border: '1px solid #e5e7eb',
                    background: '#ffffff',
                  }}
                />
              )}
            </div>
          )}
        </div>

        <div
          style={{
            borderTop: '1px solid #e5e7eb',
            padding: mm(4),
            display: 'grid',
            justifyItems: 'center',
            rowGap: mm(2),
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: pt(7), color: '#6b7280' }}>{t('pdf.thankYou')}</div>
          <img
            src={logoSrc}
            alt="NatBolt"
            style={{ width: mm(10), height: mm(10), display: 'block', objectFit: 'contain' }}
          />
          <div style={{ fontSize: pt(7), fontWeight: 700, color: '#374151' }}>
            {t('pdf.poweredBy')}
          </div>
        </div>
      </div>
    </div>
  );
}
