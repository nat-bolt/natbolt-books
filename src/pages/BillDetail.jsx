import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle, Camera, Eye } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase, mapBill, mapCustomer } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import BillPreviewSheet from '../components/BillPreviewSheet';
import PdfPreviewModal from '../components/PdfPreviewModal';
import StickyActionBar from '../components/StickyActionBar';
import WhatsAppReturnPrompt from '../components/WhatsAppReturnPrompt';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { getBillPDFBlob } from '../utils/pdf';
import { generateBillPreviewImage, resolveBillPreviewAssets } from '../utils/billPreview';
import { openWhatsApp } from '../utils/whatsapp';

export default function BillDetail() {
  const { id }   = useParams();
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const { shop, language } = useStore();

  const [bill, setBill]         = useState(null);
  const [customer, setCustomer] = useState(null);
  const [qrUrl, setQrUrl]       = useState('');
  const [loading, setLoading]   = useState(true);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewImage, setPdfPreviewImage] = useState('');
  const [previewAssets, setPreviewAssets] = useState({});
  const [showWhatsAppReturnPrompt, setShowWhatsAppReturnPrompt] = useState(false);
  const [payMode, setPayMode]   = useState('cash');
  const [paidAmt, setPaidAmt]   = useState('');
  const [payPanel, setPayPanel] = useState(false);
  const previewRef = useRef(null);
  const previewAssetsRef = useRef({});
  const awaitingWhatsAppReturnRef = useRef(false);
  const whatsappBackgroundedRef = useRef(false);

  useEffect(() => {
    if (!shop) return;
    loadBill();
  }, [id, shop]);

  useEffect(() => {
    previewAssetsRef.current = {};
    setPreviewAssets({});
  }, [bill?.id, bill?.updatedAt, shop?.id, shop?.updatedAt]);

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

  const loadBill = async () => {
    try {
      const { data: billData, error: billErr } = await supabase
        .from('bills')
        .select('*')
        .eq('id', id)
        .eq('shop_id', shop.id)
        .single();

      if (billErr || !billData) { navigate(-1); return; }
      const billMapped = mapBill(billData);

      if (!billMapped.jobPhotoUrl && billMapped.convertedFromEstimate) {
        const { data: estimateData } = await supabase
          .from('bills')
          .select('job_photo_url')
          .eq('id', billMapped.convertedFromEstimate)
          .eq('shop_id', shop.id)
          .maybeSingle();

        const inheritedJobPhotoUrl = estimateData?.job_photo_url || null;
        if (inheritedJobPhotoUrl) {
          billMapped.jobPhotoUrl = inheritedJobPhotoUrl;

          // Backfill the converted bill so future loads/PDFs use the same photo directly.
          await supabase
            .from('bills')
            .update({ job_photo_url: inheritedJobPhotoUrl })
            .eq('id', billMapped.id)
            .eq('shop_id', shop.id);
        }
      }

      setBill(billMapped);

      // ── Fetch customer and generate UPI QR in parallel ────────────────────
      const [custResult, qrDataUrl] = await Promise.all([
        billMapped.customerId
          ? supabase.from('customers').select('*').eq('id', billMapped.customerId).single()
          : Promise.resolve({ data: null }),
        shop?.upiId && billMapped.grandTotal
          ? QRCode.toDataURL(
              `upi://pay?pa=${shop.upiId}&pn=${encodeURIComponent(shop.shopName || '')}&am=${Number(billMapped.grandTotal).toFixed(2)}&cu=INR`,
              { width: 200, margin: 2 }
            )
          : Promise.resolve(''),
      ]);

      if (custResult.data) setCustomer(mapCustomer(custResult.data));
      if (qrDataUrl) setQrUrl(qrDataUrl);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const handleMarkPayment = async () => {
    if (!bill) return;
    const paid = parseFloat(paidAmt) || bill.grandTotal;
    const status = paid >= bill.grandTotal ? 'paid' : 'advance';
    try {
      const { error } = await supabase
        .from('bills')
        .update({
          status,
          payment_mode: payMode,
          paid_amount:  paid,
          balance_due:  Math.max(0, bill.grandTotal - paid),
        })
        .eq('id', id)
        .eq('shop_id', shop.id);

      if (!error) {
        setBill((b) => ({
          ...b,
          status,
          paymentMode: payMode,
          paidAmount:  paid,
          balanceDue:  Math.max(0, bill.grandTotal - paid),
        }));
        setPayPanel(false);
      }
    } catch (err) { console.error(err); }
  };

  const handleVoid = async () => {
    if (!confirm(t('bill.voidConfirm'))) return;
    const { error } = await supabase
      .from('bills')
      .update({ status: 'void' })
      .eq('id', id)
      .eq('shop_id', shop.id);

    if (!error) setBill((b) => ({ ...b, status: 'void' }));
  };

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
      console.error(err);
      alert('PDF preview failed: ' + err.message);
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
    const filename = `${bill.billNumber || 'bill'}.pdf`;
    setPdfLoading(true);
    try {
      const assets = await ensurePreviewAssets();
      const blob = await getBillPDFBlob(buildPdfParams(assets));
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error(err);
      alert('PDF download failed: ' + err.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const handleSharePdfAfterWhatsApp = async () => {
    if (!bill || !shop) return;
    const filename = `${bill.billNumber || 'bill'}.pdf`;
    setPdfLoading(true);
    try {
      const assets = await ensurePreviewAssets();
      const blob = await getBillPDFBlob(buildPdfParams(assets));
      const file = new File([blob], filename, { type: 'application/pdf' });

      let canShareFile = false;
      try {
        canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
      } catch (_) {}

      if (canShareFile && typeof navigator.share === 'function') {
        await navigator.share({ files: [file] });
      } else {
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }

      setShowWhatsAppReturnPrompt(false);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        console.error(err);
        alert('PDF share failed: ' + err.message);
      }
    } finally {
      setPdfLoading(false);
    }
  };

  const handleWhatsApp = () => {
    if (!bill || !shop) return;

    const phone    = customer?.phone || bill.customerPhone || '';
    const upiLine  = shop.upiId ? `\nPay via UPI: ${shop.upiId}` : '';
    const msg =
      `Hi ${customer?.name || 'Customer'},\n` +
      `Your Bill:${bill.billNumber} from ${shop.shopName}\n` +
      `Vehicle: ${[bill.vehicleNo, bill.vehicleBrand, bill.vehicleModel].filter(Boolean).join(' ')} is ready.\n` +
      '\n' +
      `Total: ₹${Number(bill.grandTotal || 0).toFixed(2)}${upiLine}\n` +
      '\n' +
      `Thank you! 🙏\nPowered by NatBolt Billu`;

    if (!phone) {
      alert('Customer phone number is missing.');
      return;
    }

    awaitingWhatsAppReturnRef.current = true;
    whatsappBackgroundedRef.current = false;
    setShowWhatsAppReturnPrompt(false);
    openWhatsApp(phone, msg);
  };

  const fmtCurrency = (n) => `₹${Number(n || 0).toFixed(2)}`;
  const fmtDate = (ts) =>
    ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  if (loading) return (
    <Layout showBack title={t('bill.title')}>
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  if (!bill) return null;

  const isPaid = bill.status === 'paid';
  const isVoid = bill.status === 'void';

  return (
    <Layout showBack title={`${t('bill.title')} ${bill.billNumber}`}>
      <PdfPreviewModal
        open={showPdfPreview}
        previewImageUrl={pdfPreviewImage}
        loading={pdfLoading}
        onClose={handleClosePreview}
        onDownload={handleDownloadPreview}
      />
      <WhatsAppReturnPrompt
        open={showWhatsAppReturnPrompt}
        loading={pdfLoading}
        onAction={handleSharePdfAfterWhatsApp}
        onClose={() => setShowWhatsAppReturnPrompt(false)}
      />

      {bill && shop && (
        <div className="fixed left-[-10000px] top-0 pointer-events-none">
          <div ref={previewRef}>
            <BillPreviewSheet
              bill={bill}
              shop={shop}
              customer={customer}
              t={t}
              lang={language}
              previewAssets={previewAssets}
            />
          </div>
        </div>
      )}

      <div className="p-4 space-y-4 pb-40">
        {/* Status */}
        <div className={`flex items-center gap-2 p-3 rounded-xl font-semibold ${isPaid ? 'bg-green-50 text-green-700' : isVoid ? 'bg-gray-100 text-gray-500' : 'bg-red-50 text-red-600'}`}>
          {isPaid ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {t(`bill.status.${bill.status || 'unpaid'}`)}
          {bill.paymentMode && <span className="ml-1 text-sm font-normal">({bill.paymentMode})</span>}
        </div>

        {/* Bill info */}
        <div className="card">
          <div className="flex justify-between mb-3">
            <div>
              <p className="text-lg font-bold text-brand-dark">{bill.billNumber}</p>
              <p className="text-sm text-gray-500">{fmtDate(bill.createdAt)}</p>
            </div>
            <span className={`text-sm font-bold px-2 py-0.5 rounded-full ${bill.isGST ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
              {bill.isGST ? 'GST' : 'Non-GST'}
            </span>
          </div>
          <div className="space-y-1.5 border-t border-gray-100 pt-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('customer.name')}</span>
              <span className="font-medium">{bill.customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('vehicle.number')}</span>
              <span className="font-medium">{bill.vehicleNo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Vehicle</span>
              <span className="font-medium">{bill.vehicleBrand} {bill.vehicleModel}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('vehicle.odoReading')}</span>
              <span className="font-medium">{bill.odoReading ? `${bill.odoReading} ${t('vehicle.odoUnit')}` : '-'}</span>
            </div>
          </div>
        </div>

        {/* Job Photo */}
        {bill.jobPhotoUrl && (
          <div className="card">
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4 text-brand-mid" />
              <p className="section-label mb-0">Job Photo</p>
            </div>
            <img
              src={bill.jobPhotoUrl}
              alt="Job photo"
              className="w-full rounded-xl border-2 border-gray-200 object-cover"
              style={{ maxHeight: '300px' }}
            />
          </div>
        )}

        {/* Parts */}
        <div className="card">
          <p className="section-label">{t('estimate.parts')}</p>
          {bill.items?.map((item, i) => (
            <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0 text-sm">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-xs text-gray-400">Qty: {item.qty} × ₹{item.unitPrice}</p>
              </div>
              <span className="font-semibold">₹{item.total?.toFixed(2)}</span>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="card space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{t('estimate.subtotal')}</span>
            <span>{fmtCurrency(bill.partsSubtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Labour</span>
            <span>{fmtCurrency(bill.labourCharge)}</span>
          </div>
          {bill.isGST && (
            <>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('estimate.cgst')}</span>
                <span>{fmtCurrency(bill.cgst)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('estimate.sgst')}</span>
                <span>{fmtCurrency(bill.sgst)}</span>
              </div>
            </>
          )}
          <div className="border-t border-gray-200 pt-2 flex justify-between">
            <span className="font-bold text-brand-dark">{t('estimate.grandTotal')}</span>
            <span className="font-bold text-xl text-brand-dark">{fmtCurrency(bill.grandTotal)}</span>
          </div>
          {bill.paidAmount > 0 && bill.status !== 'paid' && (
            <>
              <div className="flex justify-between text-sm text-green-600">
                <span>Paid</span>
                <span>{fmtCurrency(bill.paidAmount)}</span>
              </div>
              <div className="flex justify-between text-sm text-red-600 font-semibold">
                <span>Balance Due</span>
                <span>{fmtCurrency(bill.balanceDue)}</span>
              </div>
            </>
          )}
        </div>

        {/* UPI QR */}
        {!isVoid && qrUrl && (
          <div className="card text-center">
            <p className="section-label">{t('bill.paymentStatus')}</p>
            <p className="text-sm text-gray-500 mb-3">{t('pdf.payVia')}</p>
            <img src={qrUrl} alt="UPI QR" className="w-40 h-40 mx-auto rounded-xl border border-gray-200" />
            <p className="text-xs text-gray-400 mt-2">UPI: {shop?.upiId}</p>
          </div>
        )}

        {/* Payment panel */}
        {payPanel && !isPaid && !isVoid && (
          <div className="card space-y-3 border-2 border-brand-mid">
            <p className="font-bold text-brand-dark">{t('bill.collectPayment')}</p>
            <div className="flex gap-2">
              {['cash', 'upi', 'advance'].map((m) => (
                <button key={m}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold ${payMode === m ? 'bg-brand-mid text-white' : 'bg-gray-100 text-gray-600'}`}
                  onClick={() => setPayMode(m)}
                >
                  {t(`bill.${m}`)}
                </button>
              ))}
            </div>
            {payMode === 'advance' && (
              <div>
                <label className="section-label">{t('bill.paidAmount')}</label>
                <input
                  type="number" inputMode="decimal"
                  className="input-field"
                  placeholder="0"
                  value={paidAmt}
                  onChange={(e) => setPaidAmt(e.target.value)}
                />
              </div>
            )}
            <button className="btn-primary w-full" onClick={handleMarkPayment}>
              {t('bill.markPaid')}
            </button>
          </div>
        )}
      </div>

      {/* Actions footer */}
      {!isVoid && (
        <StickyActionBar className="space-y-2">
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1 flex items-center justify-center gap-1.5 text-sm"
              onClick={handlePreviewPDF}
              disabled={pdfLoading}
            >
              <Eye className="w-4 h-4" /> {pdfLoading ? '…' : t('bill.viewPdf')}
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold text-white bg-green-500 rounded-xl py-3 active:scale-95"
              onClick={handleWhatsApp} disabled={pdfLoading}>
              <WhatsAppIcon className="w-6 h-6" badge badgeClassName="p-1" /> WhatsApp
            </button>
          </div>
          {!isPaid && (
            <button className="btn-primary w-full" onClick={() => setPayPanel(!payPanel)}>
              {payPanel ? 'Hide Payment' : t('bill.collectPayment')}
            </button>
          )}
          {!isPaid && (
            <button className="w-full text-red-500 text-sm font-medium py-2" onClick={handleVoid}>
              {t('bill.voidBill')}
            </button>
          )}
        </StickyActionBar>
      )}
    </Layout>
  );
}
