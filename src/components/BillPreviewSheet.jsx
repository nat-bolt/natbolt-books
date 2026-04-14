function fmtCurrency(n) {
  return `₹${Number(n || 0).toFixed(2)}`;
}

function fmtDate(ts) {
  const d = ts?.toDate ? ts.toDate() : new Date(ts || Date.now());
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function BillPreviewSheet({ bill, shop, customer, t, lang }) {
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
  ];

  return (
    <div className="w-[420px] bg-[#f5f5f5] p-4">
      <div className="overflow-hidden rounded-[24px] bg-white shadow-lg border border-gray-200">
        <div className="bg-brand-dark px-4 py-4 text-white">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xl font-bold leading-tight truncate">{shop?.shopName || 'Shop Name'}</p>
              {shop?.gstNumber && bill.isGST && (
                <p className="mt-1 text-[11px] opacity-90">GST: {shop.gstNumber}</p>
              )}
              {shop?.address && (
                <p className="mt-1 text-[11px] leading-relaxed opacity-90 break-words">{shop.address}</p>
              )}
              {shop?.phone && (
                <p className="mt-1 text-[11px] opacity-90">Ph: {shop.phone}</p>
              )}
            </div>
            {shop?.shopPhotoUrl && (
              <img
                src={shop.shopPhotoUrl}
                alt="Shop"
                crossOrigin="anonymous"
                className="w-16 h-16 rounded-2xl object-cover border border-white/20 bg-white/10"
              />
            )}
          </div>
        </div>

        <div className="bg-accent px-4 py-2 text-center text-xs font-bold tracking-wide text-white uppercase">
          {docLabel}
        </div>

        <div className="p-4 space-y-4">
          <div className={`gap-4 ${bill.jobPhotoUrl ? 'flex items-start' : 'block'}`}>
            {bill.jobPhotoUrl && (
              <img
                src={bill.jobPhotoUrl}
                alt="Job"
                crossOrigin="anonymous"
                className="w-28 h-24 rounded-2xl object-cover border border-gray-200 bg-gray-100 shrink-0"
              />
            )}

            <div className="flex-1 grid grid-cols-1 gap-2 text-[12px]">
              {metaRows.map(([label, value]) => (
                <div key={label} className="flex items-start gap-2">
                  <span className="w-24 shrink-0 font-semibold text-gray-700">{label}:</span>
                  <span className="text-gray-900 break-words">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-gray-200">
            <div className="grid grid-cols-[1fr_3.4fr_1fr_1.4fr_1.6fr] bg-brand-dark px-3 py-2 text-[11px] font-bold text-white">
              <span className="text-right">{t('pdf.srNo')}</span>
              <span className="pl-3">{t('pdf.description')}</span>
              <span className="text-right">{t('pdf.qty')}</span>
              <span className="text-right">{t('pdf.rate')}</span>
              <span className="text-right">{t('pdf.amount')}</span>
            </div>

            <div className="divide-y divide-gray-200">
              {items.map((item, index) => {
                const partName =
                  (lang === 'hi' ? item.nameHi : lang === 'te' ? item.nameTe : item.name) ||
                  item.name ||
                  '';

                return (
                  <div
                    key={`${partName}-${index}`}
                    className="grid grid-cols-[1fr_3.4fr_1fr_1.4fr_1.6fr] px-3 py-2 text-[11px] text-gray-800"
                  >
                    <span className="text-right">{index + 1}</span>
                    <span className="pl-3 pr-2 break-words">{partName}</span>
                    <span className="text-right">{item.qty || 1}</span>
                    <span className="text-right">{fmtCurrency(item.unitPrice)}</span>
                    <span className="text-right font-medium">{fmtCurrency(item.total)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-brand-light p-4 text-[12px] space-y-2">
            <div className="flex justify-between gap-4">
              <span className="font-semibold text-brand-mid">{t('pdf.partsSubtotal')}</span>
              <span className="font-semibold text-brand-mid">{fmtCurrency(partsSubtotal)}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="font-semibold text-brand-mid">{t('pdf.labourCharges')}</span>
              <span className="font-semibold text-brand-mid">{fmtCurrency(labourCharge)}</span>
            </div>
            {bill.isGST && (
              <>
                <div className="flex justify-between gap-4 text-gray-600">
                  <span>{t('pdf.cgst')}</span>
                  <span>{fmtCurrency(cgst)}</span>
                </div>
                <div className="flex justify-between gap-4 text-gray-600">
                  <span>{t('pdf.sgst')}</span>
                  <span>{fmtCurrency(sgst)}</span>
                </div>
              </>
            )}
            <div className="flex justify-between gap-4 rounded-xl bg-brand-dark px-3 py-2 text-white">
              <span className="font-bold">{t('pdf.grandTotal')}</span>
              <span className="font-bold">{fmtCurrency(grandTotal)}</span>
            </div>
          </div>

          {!isEstimate && (shop?.qrCodeUrl || shop?.upiId) && (
            <div className="rounded-2xl border border-gray-200 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-mid">{t('pdf.payVia')}</p>
              {shop?.upiId && (
                <p className="mt-2 text-[12px] text-gray-700 break-all">UPI: {shop.upiId}</p>
              )}
              {shop?.qrCodeUrl && (
                <img
                  src={shop.qrCodeUrl}
                  alt="Payment QR"
                  crossOrigin="anonymous"
                  className="mt-3 w-28 h-28 rounded-2xl border border-gray-200 bg-white"
                />
              )}
            </div>
          )}
        </div>

        <div className="border-t border-gray-200 px-4 py-4 text-center">
          <p className="text-[11px] text-gray-500">{t('pdf.thankYou')}</p>
          <p className="mt-2 text-[11px] font-semibold text-gray-700">{t('pdf.poweredBy')}</p>
        </div>
      </div>
    </div>
  );
}
