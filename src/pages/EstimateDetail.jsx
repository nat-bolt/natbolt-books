import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Pencil, Plus, Trash2, X, Check, Camera, Eye } from 'lucide-react';
import { supabase, mapBill, mapCustomer } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import PdfPreviewModal from '../components/PdfPreviewModal';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { getBillPDFBlob, getBillPDFUrl } from '../utils/pdf';
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

export default function EstimateDetail() {
  const { id }   = useParams();
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const { shop, language } = useStore();

  const [bill, setBill]         = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [converting, setConverting] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [showPdfPreview, setShowPdfPreview] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [convertedBillId, setConvertedBillId] = useState('');

  // ── Edit mode state ──────────────────────────────────────────────────────────
  const [editMode, setEditMode]     = useState(false);
  const [editItems, setEditItems]   = useState([]);
  const [editLabour, setEditLabour] = useState('');
  const [editIsGST, setEditIsGST]   = useState(false);
  const [catalogue, setCatalogue]   = useState([]);
  const [showCat, setShowCat]       = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
    };
  }, [pdfPreviewUrl]);

  useEffect(() => {
    if (!shop) return;
    loadBill();
  }, [id, shop]);

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
      setBill(billMapped);

      if (billMapped.status === 'converted') {
        const { data: convertedBill } = await supabase
          .from('bills')
          .select('id')
          .eq('shop_id', shop.id)
          .eq('type', 'bill')
          .eq('converted_from_estimate', id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setConvertedBillId(convertedBill?.id || '');
      } else {
        setConvertedBillId('');
      }

      if (billMapped.customerId) {
        const { data: custData } = await supabase
          .from('customers')
          .select('*')
          .eq('id', billMapped.customerId)
          .single();
        if (custData) setCustomer(mapCustomer(custData));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  // ── Edit mode helpers ────────────────────────────────────────────────────────
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

  const updateEditQty = (i, qty) => {
    const n = Math.max(1, parseInt(qty) || 1);
    setEditItems((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], qty: n, total: n * updated[i].unitPrice };
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
      const { error } = await supabase
        .from('bills')
        .update({
          items:          editItems,
          parts_subtotal: editPartsSubtotal,
          labour_charge:  labour,
          is_gst:         editIsGST,
          cgst:           editCgst,
          sgst:           editSgst,
          grand_total:    editGrandTotal,
        })
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
        }));
        setEditMode(false);
      }
    } catch (err) { console.error(err); }
    finally { setSavingEdit(false); }
  };

  // ── PDF / WhatsApp ───────────────────────────────────────────────────────────
  const handlePreviewPDF = async () => {
    if (!bill || !shop) return;
    if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
    if (pdfPreviewUrl) setPdfPreviewUrl('');
    setShowPdfPreview(true);
    setPdfLoading(true);
    try {
      const pdfUrl = await getBillPDFUrl({ bill, shop, customer, t, lang: language });
      setPdfPreviewUrl(pdfUrl);
    } catch (err) {
      setShowPdfPreview(false);
      console.error(err);
      alert('PDF preview failed. Please try again.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleClosePreview = () => {
    if (pdfPreviewUrl?.startsWith('blob:')) URL.revokeObjectURL(pdfPreviewUrl);
    setPdfPreviewUrl('');
    setShowPdfPreview(false);
  };

  const handleDownloadPreview = () => {
    if (!pdfPreviewUrl || !bill) return;
    const filename = `${bill.estimateNumber || 'estimate'}.pdf`;
    const a = document.createElement('a');
    a.href = pdfPreviewUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleWhatsApp = async () => {
    if (!bill || !shop) return;

    const phone    = customer?.phone || bill.customerPhone || '';
    const upiLine  = shop.upiId ? `\nPay via UPI: ${shop.upiId}` : '';
    const filename = `${bill.estimateNumber || 'estimate'}.pdf`;
    const msg =
      `Hi ${customer?.name || 'Customer'},\n` +
      `Your estimate *${bill.estimateNumber}* from *${shop.shopName}* is ready.\n` +
      `Vehicle: ${[bill.vehicleNo, bill.vehicleBrand, bill.vehicleModel].filter(Boolean).join(' ')}\n` +
      `Total: ₹${Number(bill.grandTotal || 0).toFixed(2)}${upiLine}\n` +
      `Thank you! 🙏\n\nPowered by NatBolt Billu`;

    // Pre-flight: check file-sharing support synchronously (before any await)
    // so we can call window.open while still in the user-gesture context.
    let canDoFileShare = false;
    try {
      const testFile = new File([new Blob([''], { type: 'application/pdf' })], 't.pdf', { type: 'application/pdf' });
      canDoFileShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [testFile] });
    } catch (_) {}
    if (!canDoFileShare) openWhatsApp(phone, msg);

    setPdfLoading(true);
    try {
      const blob = await getBillPDFBlob({ bill, shop, customer, t, lang: language });
      const file = new File([blob], filename, { type: 'application/pdf' });

      if (canDoFileShare) {
        // ✅ Mobile (Android/iOS): native share sheet — user picks WhatsApp → PDF attached
        await navigator.share({ files: [file], text: msg });
      } else {
        // Desktop: WhatsApp already opened above. Download PDF so user can attach manually.
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = blobUrl; a.download = filename;
        document.body.appendChild(a); a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      }
    } catch (err) {
      if (err?.name !== 'AbortError') { console.error(err); alert('PDF generation failed. Please try again.'); }
    } finally {
      setPdfLoading(false);
    }
  };

  // ── Convert to bill ──────────────────────────────────────────────────────────
  const handleConvertToBill = async () => {
    if (!bill || converting) return;
    setConverting(true);
    try {
      const { data: billNumber, error: rpcErr } = await supabase
        .rpc('next_bill_number', { p_shop_id: shop.id, p_type: 'bill' });
      if (rpcErr) throw rpcErr;

      const { data: newBillData, error: insertErr } = await supabase
        .from('bills')
        .insert({
          shop_id:               bill.shopId,
          customer_id:           bill.customerId,
          type:                  'bill',
          status:                'unpaid',
          bill_number:           billNumber,
          customer_name:         bill.customerName,
          customer_phone:        bill.customerPhone,
          vehicle_no:            bill.vehicleNo,
          vehicle_type:          bill.vehicleType,
          vehicle_brand:         bill.vehicleBrand,
          vehicle_model:         bill.vehicleModel,
          items:                 bill.items,
          parts_subtotal:        bill.partsSubtotal,
          labour_charge:         bill.labourCharge,
          is_gst:                bill.isGST,
          cgst:                  bill.cgst,
          sgst:                  bill.sgst,
          grand_total:           bill.grandTotal,
          converted_from_estimate: id,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      await supabase.from('bills').update({ status: 'converted' }).eq('id', id);
      navigate(`/bill/${newBillData.id}`, { replace: true });
    } catch (err) { console.error('Convert error:', err); }
    finally { setConverting(false); }
  };

  // ── Formatters ───────────────────────────────────────────────────────────────
  const fmtCurrency = (n) => `₹${Number(n || 0).toFixed(2)}`;
  const fmtDate = (ts) =>
    ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  if (loading) return (
    <Layout showBack title={t('estimate.viewTitle')}>
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  if (!bill) return null;

  const isConverted = bill.status === 'converted';
  const isVoid      = bill.status === 'void';
  const isDraft     = !isConverted && !isVoid;

  return (
    <Layout showBack title={`${t('estimate.viewTitle')} ${bill.estimateNumber}`}>
      <PdfPreviewModal
        open={showPdfPreview}
        pdfUrl={pdfPreviewUrl}
        loading={pdfLoading}
        onClose={handleClosePreview}
        onDownload={handleDownloadPreview}
      />

      <div className="p-4 space-y-4 pb-36">

        {isConverted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700">
            <div className="text-center font-semibold text-sm">✓ Converted to Bill</div>
            {convertedBillId && (
              <button
                className="btn-primary w-full mt-3 flex items-center justify-center gap-2 !py-2.5 text-sm"
                onClick={() => navigate(`/bill/${convertedBillId}`)}
              >
                {t('estimate.viewBill')}
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        )}

        {/* Header card */}
        <div className="card">
          <div className="flex justify-between items-start mb-3">
            <div>
              <p className="text-lg font-bold text-brand-dark">{bill.estimateNumber}</p>
              <p className="text-sm text-gray-500">{fmtDate(bill.createdAt)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="badge-estimate text-sm px-3 py-1">ESTIMATE</span>
              {isDraft && !editMode && (
                <button
                  className="p-2 rounded-xl bg-brand-light text-brand-mid active:scale-95"
                  onClick={enterEditMode}
                  title="Edit items"
                >
                  <Pencil className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('customer.name')}</span>
              <span className="font-medium">{bill.customerName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('vehicle.number')}</span>
              <span className="font-medium">{bill.vehicleNo}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('vehicle.brand')}</span>
              <span className="font-medium">{bill.vehicleBrand} {bill.vehicleModel}</span>
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

        {/* ── VIEW MODE: Parts ─────────────────────────────────────────────────── */}
        {!editMode && (
          <>
            <div className="card">
              <p className="section-label">{t('estimate.parts')}</p>
              <div className="space-y-2">
                {(bill.items || []).length === 0 && (
                  <p className="text-sm text-gray-400 py-2 text-center">No items added</p>
                )}
                {(bill.items || []).map((item, i) => (
                  <div key={i} className="flex justify-between items-center py-1.5 border-b border-gray-100 last:border-0">
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-gray-400">Qty: {item.qty} × ₹{item.unitPrice}</p>
                    </div>
                    <span className="font-semibold text-sm">₹{item.total?.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>

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
            </div>
          </>
        )}

        {/* ── EDIT MODE ────────────────────────────────────────────────────────── */}
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
                <div key={i} className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    <p className="text-xs text-gray-400">₹{item.unitPrice} each</p>
                  </div>
                  {/* Qty controls */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 font-bold flex items-center justify-center"
                      onClick={() => updateEditQty(i, item.qty - 1)}
                    >−</button>
                    <span className="w-6 text-center text-sm font-medium">{item.qty}</span>
                    <button
                      className="w-7 h-7 rounded-lg bg-gray-100 text-gray-600 font-bold flex items-center justify-center"
                      onClick={() => updateEditQty(i, item.qty + 1)}
                    >+</button>
                  </div>
                  <span className="text-sm font-semibold w-20 text-right shrink-0">₹{item.total?.toFixed(2)}</span>
                  <button
                    className="text-red-400 p-1 shrink-0"
                    onClick={() => removeEditItem(i)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>

            {/* Labour + GST */}
            <div className="card space-y-3">
              <div>
                <label className="section-label">Labour Charges (₹)</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className="input-field"
                  placeholder="0"
                  value={editLabour}
                  onChange={(e) => setEditLabour(e.target.value)}
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
      </div>

      {/* Catalogue picker modal */}
      {showCat && (
        <CatalogueModal
          catalogue={catalogue}
          onAdd={addEditItem}
          onClose={() => setShowCat(false)}
        />
      )}

      {/* Footer actions (only when not in edit mode) */}
      {isDraft && !editMode && (
        <div className="fixed bottom-14 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-100 p-4 space-y-2 z-10">
          <div className="flex gap-2">
            <button
              className="btn-primary flex-1 flex items-center justify-center gap-2"
              onClick={handlePreviewPDF}
              disabled={pdfLoading}
            >
              <Eye className="w-4 h-4" />
              {pdfLoading ? '…' : t('bill.viewPdf')}
            </button>
            <button
              className="flex-1 flex items-center justify-center gap-2 bg-green-500 text-white rounded-xl py-3 font-semibold active:scale-95 transition-all disabled:opacity-60"
              onClick={handleWhatsApp}
              disabled={pdfLoading}
            >
              <WhatsAppIcon className="w-6 h-6" badge badgeClassName="p-1" />
              {pdfLoading ? '…' : 'WhatsApp'}
            </button>
          </div>
          <button
            className="btn-accent w-full flex items-center justify-center gap-2"
            onClick={handleConvertToBill}
            disabled={converting}
          >
            {converting ? t('estimate.converting') : t('estimate.convertToBill')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </Layout>
  );
}
