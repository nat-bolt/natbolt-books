import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle, Camera, Eye, Pencil, Plus, Trash2, X, Check } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase, mapBill, mapCustomer } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import BillPreviewSheet from '../components/BillPreviewSheet';
import PdfPreviewModal from '../components/PdfPreviewModal';
import StickyActionBar from '../components/StickyActionBar';
import WhatsAppReturnPrompt from '../components/WhatsAppReturnPrompt';
import WhatsAppIcon from '../components/WhatsAppIcon';
import StatusBadge from '../components/StatusBadge';
import { getBillPDFBlob } from '../utils/pdf';
import { generateBillPreviewImage, resolveBillPreviewAssets } from '../utils/billPreview';
import { openWhatsApp } from '../utils/whatsapp';

// ── Simple parts picker modal used in edit mode ────────────────────────────────
function CatalogueModal({ catalogue, onAdd, onClose }) {
  const [q, setQ] = useState('');
  const filtered = catalogue.filter(
    (p) => p.name.toLowerCase().includes(q.toLowerCase())
  );
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg mx-auto rounded-t-2xl p-4 max-h-[70vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="font-bold text-brand-dark">Add Part / Service</p>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>
        <input
          className="input-field mb-3"
          placeholder="Search parts…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="overflow-y-auto space-y-1">
          {filtered.map((p) => (
            <button
              key={p.id || p.name}
              className="w-full flex justify-between items-center px-3 py-2.5 rounded-xl hover:bg-brand-light active:bg-brand-light text-left"
              onClick={() => onAdd(p)}
            >
              <span className="text-sm font-medium">{p.name}</span>
              <span className="text-sm text-brand-mid font-semibold">₹{Number(p.price).toFixed(2)}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-gray-400 text-sm py-6">No parts found</p>
          )}
        </div>
      </div>
    </div>
  );
}

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

  // ── Edit mode state ──────────────────────────────────────────────────────────
  const [editMode, setEditMode]     = useState(false);
  const [editItems, setEditItems]   = useState([]);
  const [editLabour, setEditLabour] = useState('');
  const [editIsGST, setEditIsGST]   = useState(false);
  const [catalogue, setCatalogue]   = useState([]);
  const [showCat, setShowCat]       = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

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

  // ── Edit mode functions ──────────────────────────────────────────────────────
  const enterEditMode = async () => {
    setEditItems(bill.items ? bill.items.map((i) => ({ ...i })) : []);
    setEditLabour(String(bill.labourCharge || ''));
    setEditIsGST(bill.isGST || false);
    setEditMode(true);
    // Load catalogue in background
    if (catalogue.length === 0 && shop) {
      const { data } = await supabase.rpc('get_parts_catalogue', { p_shop_id: shop.id });
      if (data) setCatalogue(data);
    }
  };

  const addEditItem = (part) => {
    setEditItems((prev) => {
      const existing = prev.findIndex((p) => p.id === (part.shop_part_id || part.default_part_id || part.id));
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = {
          ...updated[existing],
          qty:   updated[existing].qty + 1,
          total: (updated[existing].qty + 1) * updated[existing].unitPrice,
        };
        return updated;
      }
      const price = Number(part.price || 0);
      return [...prev, {
        id:        part.shop_part_id || part.default_part_id || part.id,
        name:      part.name,
        qty:       1,
        unitPrice: price,
        total:     price,
      }];
    });
    setShowCat(false);
  };

  const removeEditItem = (i) => setEditItems((prev) => prev.filter((_, idx) => idx !== i));

  const handleEnterDismissKeyboard = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
  };

  const updateEditQty = (i, qty) => {
    const n = Math.max(1, parseInt(qty) || 1);
    setEditItems((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], qty: n, total: n * updated[i].unitPrice };
      return updated;
    });
  };

  const updateEditPrice = (i, price) => {
    const p = parseFloat(price) || 0;
    setEditItems((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], unitPrice: p, total: updated[i].qty * p };
      return updated;
    });
  };

  const editPartsSubtotal = editItems.reduce((s, i) => s + (i.total || 0), 0);
  const editCgst = editIsGST ? editPartsSubtotal * 0.09 : 0;
  const editSgst = editIsGST ? editPartsSubtotal * 0.09 : 0;
  const editGrandTotal = editPartsSubtotal + (parseFloat(editLabour) || 0) + editCgst + editSgst;

  const handleSaveEdit = async () => {
    if (!bill) return;
    setSavingEdit(true);
    try {
      const labour = parseFloat(editLabour) || 0;
      const updateData = {
        items:          editItems,
        parts_subtotal: editPartsSubtotal,
        labour_charge:  labour,
        is_gst:         editIsGST,
        cgst:           editCgst,
        sgst:           editSgst,
        grand_total:    editGrandTotal,
      };

      // Recalculate balance due for advance bills
      if (bill.status === 'advance') {
        updateData.balance_due = Math.max(0, editGrandTotal - bill.paidAmount);
      }

      const { error } = await supabase
        .from('bills')
        .update(updateData)
        .eq('id', id);

      if (!error) {
        setBill((b) => ({
          ...b,
          items:          editItems,
          partsSubtotal:  editPartsSubtotal,
          labourCharge:   labour,
          isGST:          editIsGST,
          cgst:           editCgst,
          sgst:           editSgst,
          grandTotal:     editGrandTotal,
          balanceDue:     bill.status === 'advance' ? Math.max(0, editGrandTotal - bill.paidAmount) : b.balanceDue,
        }));
        setEditMode(false);
      }
    } catch (err) { console.error(err); }
    finally { setSavingEdit(false); }
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
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-lg font-bold text-brand-dark">{bill.billNumber}</p>
              <p className="text-sm text-gray-500">{fmtDate(bill.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge variant="bill" size="md">Bill</StatusBadge>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bill.isGST ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {bill.isGST ? 'GST' : 'Non-GST'}
              </span>
              {(bill.status === 'unpaid' || bill.status === 'advance') && !editMode && (
                <button
                  className="p-2 rounded-xl bg-brand-light text-brand-mid active:scale-95"
                  onClick={enterEditMode}
                  title="Edit bill"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
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
        {!editMode && (
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
        )}

        {/* Totals */}
        {!editMode && (
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
        )}

        {/* Edit mode UI */}
        {editMode && (
          <>
            {/* Edit items list */}
            <div className="card">
              <div className="flex justify-between items-center mb-3">
                <p className="section-label mb-0">Parts &amp; Services</p>
                <button
                  className="flex items-center gap-1 bg-brand-mid text-white px-3 py-1.5 rounded-lg text-sm font-semibold"
                  onClick={() => setShowCat(true)}
                >
                  <Plus className="w-4 h-4" /> Add
                </button>
              </div>

              {editItems.length === 0 && (
                <p className="text-sm text-gray-400 py-3 text-center">Tap Add to add parts or services</p>
              )}

              {editItems.map((item, i) => (
                <div key={i} className="flex flex-col gap-2 py-2 border-b border-gray-100 last:border-0 sm:flex-row sm:items-center sm:gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-gray-400 truncate">₹{item.unitPrice} each</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:gap-1 shrink-0">
                    <div className="flex items-center gap-1 rounded-2xl bg-gray-50 p-1">
                      <button
                        className="w-8 h-8 rounded-xl bg-white text-gray-600 font-bold flex items-center justify-center"
                        onClick={() => updateEditQty(i, item.qty - 1)}
                      >−</button>
                      <span className="min-w-[1.5rem] text-center text-sm font-medium">{item.qty}</span>
                      <button
                        className="w-8 h-8 rounded-xl bg-white text-gray-600 font-bold flex items-center justify-center"
                        onClick={() => updateEditQty(i, item.qty + 1)}
                      >+</button>
                    </div>
                    <input
                      type="tel"
                      inputMode="decimal"
                      enterKeyHint="done"
                      className="w-20 rounded-xl border border-gray-200 px-2 py-1 text-center text-sm"
                      value={item.unitPrice === 0 ? '' : item.unitPrice}
                      onChange={(e) => updateEditPrice(i, e.target.value === '0' ? '' : e.target.value)}
                      onKeyDown={handleEnterDismissKeyboard}
                    />
                    <span className="min-w-[5rem] text-sm font-semibold text-right">₹{item.total?.toFixed(2)}</span>
                    <button
                      className="text-red-400 p-1 shrink-0"
                      onClick={() => removeEditItem(i)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Labour + GST */}
            <div className="card space-y-3">
              <div>
                <label className="section-label">Labour Charges (₹)</label>
                <input
                  type="tel"
                  inputMode="decimal"
                  className="input-field"
                  placeholder="0"
                  value={editLabour}
                  onChange={(e) => setEditLabour(e.target.value)}
                  onKeyDown={handleEnterDismissKeyboard}
                />
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  className={`w-11 h-6 rounded-full transition-colors ${editIsGST ? 'bg-brand-mid' : 'bg-gray-300'}`}
                  onClick={() => setEditIsGST((g) => !g)}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow mt-0.5 transition-transform ${editIsGST ? 'translate-x-5 ml-0.5' : 'translate-x-0.5'}`} />
                </div>
                <span className="text-sm font-medium">GST Bill (18%)</span>
              </label>
            </div>

            {/* Running total */}
            <div className="card space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Parts Subtotal</span>
                <span>{fmtCurrency(editPartsSubtotal)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Labour</span>
                <span>{fmtCurrency(parseFloat(editLabour) || 0)}</span>
              </div>
              {editIsGST && (
                <>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>CGST (9%)</span><span>{fmtCurrency(editCgst)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>SGST (9%)</span><span>{fmtCurrency(editSgst)}</span>
                  </div>
                </>
              )}
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="font-bold text-brand-dark">Grand Total</span>
                <span className="font-bold text-xl text-brand-dark">{fmtCurrency(editGrandTotal)}</span>
              </div>
            </div>

            {/* Save / Cancel */}
            <div className="flex gap-3">
              <button
                className="flex-1 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-semibold text-sm"
                onClick={() => setEditMode(false)}
              >
                Cancel
              </button>
              <button
                className="flex-2 flex-grow btn-accent flex items-center justify-center gap-2"
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                <Check className="w-4 h-4" />
                {savingEdit ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </>
        )}

        {/* UPI QR */}
        {!isVoid && qrUrl && (
          <div className="card text-center">
            <p className="section-label">{t('bill.paymentStatus')}</p>
            <p className="text-sm text-gray-500 mb-3">{t('pdf.payVia')}</p>
            <img src={qrUrl} alt="UPI QR" className="w-40 h-40 mx-auto rounded-xl border border-gray-200" />
            <p className="text-xs text-gray-400 mt-2">UPI: {shop?.upiId}</p>
          </div>
        )}

        {/* Payment Modal */}
        {payPanel && !isPaid && !isVoid && !editMode && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setPayPanel(false)}>
            <div
              className="bg-white w-full max-w-sm mx-auto rounded-2xl p-5 space-y-4 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <p className="font-bold text-brand-dark text-lg">{t('bill.collectPayment')}</p>
                <button onClick={() => setPayPanel(false)} className="p-1 text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {['cash', 'upi', 'advance'].map((m) => (
                  <button key={m}
                    className={`py-3 rounded-xl text-sm font-semibold transition-colors ${payMode === m ? 'bg-brand-mid text-white' : 'bg-gray-100 text-gray-600 active:bg-gray-200'}`}
                    onClick={() => setPayMode(m)}
                  >
                    {m === 'cash' ? 'Cash' : m === 'upi' ? 'UPI' : 'Advance'}
                  </button>
                ))}
              </div>

              {payMode === 'advance' && (
                <div>
                  <label className="section-label">{t('bill.paidAmount')}</label>
                  <input
                    type="tel" inputMode="decimal"
                    className="input-field"
                    placeholder="0"
                    value={paidAmt}
                    onChange={(e) => setPaidAmt(e.target.value)}
                    onKeyDown={handleEnterDismissKeyboard}
                  />
                </div>
              )}

              <button className="btn-primary w-full py-4 text-base font-bold" onClick={handleMarkPayment}>
                {t('bill.markPaid')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Catalogue picker modal */}
      {showCat && (
        <CatalogueModal
          catalogue={catalogue}
          onAdd={addEditItem}
          onClose={() => setShowCat(false)}
        />
      )}

      {/* Actions footer */}
      {!isVoid && !editMode && (
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
            <button className="btn-primary w-full" onClick={() => setPayPanel(true)}>
              {t('bill.collectPayment')}
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
