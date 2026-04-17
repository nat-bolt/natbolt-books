import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle, AlertCircle, Camera, Eye, Pencil, X } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase, mapBill, mapCustomer } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import CatalogueModal from '../components/CatalogueModal';
import DocumentEditPanel from '../components/DocumentEditPanel';
import DocumentItemsCard from '../components/DocumentItemsCard';
import DocumentPreviewLayer from '../components/DocumentPreviewLayer';
import DocumentTotalsCard from '../components/DocumentTotalsCard';
import StickyActionBar from '../components/StickyActionBar';
import WhatsAppIcon from '../components/WhatsAppIcon';
import StatusBadge from '../components/StatusBadge';
import useDocumentPreviewShare from '../hooks/useDocumentPreviewShare';
import { optimizeJobPhoto } from '../utils/jobPhoto';
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
  const [payMode, setPayMode]   = useState('cash');
  const [paidAmt, setPaidAmt]   = useState('');
  const [payPanel, setPayPanel] = useState(false);

  // ── Edit mode state ──────────────────────────────────────────────────────────
  const [editMode, setEditMode]     = useState(false);
  const [editItems, setEditItems]   = useState([]);
  const [editLabour, setEditLabour] = useState('');
  const [editIsGST, setEditIsGST]   = useState(false);
  const [catalogue, setCatalogue]   = useState([]);
  const [showCat, setShowCat]       = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editJobPhotoFile, setEditJobPhotoFile] = useState(null);
  const [editJobPhotoPreview, setEditJobPhotoPreview] = useState('');
  const [editJobPhotoRemoved, setEditJobPhotoRemoved] = useState(false);
  const [photoPreparing, setPhotoPreparing] = useState(false);
  const photoInputRef = useRef(null);
  const {
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
    handleSharePdfAfterWhatsApp,
    registerWhatsAppLaunch,
  } = useDocumentPreviewShare({
    bill,
    shop,
    customer,
    t,
    language,
    filename: `${bill?.billNumber || 'bill'}.pdf`,
  });

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
    setEditJobPhotoFile(null);
    setEditJobPhotoPreview(bill.jobPhotoUrl || '');
    setEditJobPhotoRemoved(false);
    setPhotoPreparing(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
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

  const handleEditPhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return;
    setPhotoPreparing(true);
    try {
      const prepared = await optimizeJobPhoto(file);
      setEditJobPhotoFile(prepared);
      setEditJobPhotoRemoved(false);
      const reader = new FileReader();
      reader.onload = (event) => setEditJobPhotoPreview(event.target.result);
      reader.readAsDataURL(prepared);
    } catch (err) {
      console.error('Bill detail photo preparation failed:', err);
      setEditJobPhotoFile(file);
      setEditJobPhotoRemoved(false);
      const reader = new FileReader();
      reader.onload = (event) => setEditJobPhotoPreview(event.target.result);
      reader.readAsDataURL(file);
    } finally {
      setPhotoPreparing(false);
    }
  };

  const handleRemoveEditPhoto = () => {
    setEditJobPhotoFile(null);
    setEditJobPhotoPreview('');
    setEditJobPhotoRemoved(true);
    if (photoInputRef.current) photoInputRef.current.value = '';
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
      let nextJobPhotoUrl = editJobPhotoRemoved ? null : (bill.jobPhotoUrl || null);

      if (editJobPhotoFile && shop?.id && bill.id) {
        const ext = editJobPhotoFile.name.split('.').pop().toLowerCase() || 'jpg';
        const path = `${shop.id}/jobs/${bill.id}.${ext}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('shop-assets')
          .upload(path, editJobPhotoFile, { upsert: true, contentType: editJobPhotoFile.type });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('shop-assets')
          .getPublicUrl(uploadData.path);

        nextJobPhotoUrl = publicUrl;
      }

      const updateData = {
        items:          editItems,
        parts_subtotal: editPartsSubtotal,
        labour_charge:  labour,
        is_gst:         editIsGST,
        cgst:           editCgst,
        sgst:           editSgst,
        grand_total:    editGrandTotal,
        job_photo_url:  nextJobPhotoUrl,
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
          jobPhotoUrl:    nextJobPhotoUrl,
          balanceDue:     bill.status === 'advance' ? Math.max(0, editGrandTotal - bill.paidAmount) : b.balanceDue,
        }));
        setEditMode(false);
      }
    } catch (err) { console.error(err); }
    finally { setSavingEdit(false); }
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

    registerWhatsAppLaunch();
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
  const billTotalRows = [
    { label: t('estimate.subtotal'), value: fmtCurrency(bill.partsSubtotal) },
    { label: t('estimate.labour'), value: fmtCurrency(bill.labourCharge) },
    ...(bill.isGST
      ? [
          { label: t('estimate.cgst'), value: fmtCurrency(bill.cgst) },
          { label: t('estimate.sgst'), value: fmtCurrency(bill.sgst) },
        ]
      : []),
  ];
  const billFooterRows = bill.paidAmount > 0 && bill.status !== 'paid'
    ? [
        { label: 'Paid', value: fmtCurrency(bill.paidAmount), className: 'text-green-600' },
        { label: 'Balance Due', value: fmtCurrency(bill.balanceDue), className: 'font-semibold text-red-600' },
      ]
    : [];
  const editTotalRows = [
    { label: 'Parts Subtotal', value: fmtCurrency(editPartsSubtotal) },
    { label: 'Labour', value: fmtCurrency(parseFloat(editLabour) || 0) },
    ...(editIsGST
      ? [
          { label: 'CGST (9%)', value: fmtCurrency(editCgst) },
          { label: 'SGST (9%)', value: fmtCurrency(editSgst) },
        ]
      : []),
  ];

  return (
    <Layout showBack title={`${t('bill.title')} ${bill.billNumber}`}>
      <DocumentPreviewLayer
        bill={bill}
        shop={shop}
        customer={customer}
        t={t}
        language={language}
        previewAssets={previewAssets}
        previewRef={previewRef}
        showPdfPreview={showPdfPreview}
        pdfPreviewImage={pdfPreviewImage}
        pdfLoading={pdfLoading}
        onClosePreview={handleClosePreview}
        onDownloadPreview={handleDownloadPreview}
        showWhatsAppReturnPrompt={showWhatsAppReturnPrompt}
        onSharePdfAfterWhatsApp={handleSharePdfAfterWhatsApp}
        onCloseWhatsAppPrompt={() => setShowWhatsAppReturnPrompt(false)}
      />

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
          <DocumentItemsCard
            title={t('estimate.parts')}
            items={bill.items || []}
            emptyText="No items added"
            qtyLabel={t('parts.qty')}
          />
        )}

        {/* Totals */}
        {!editMode && (
          <DocumentTotalsCard
            rows={billTotalRows}
            grandTotalLabel={t('estimate.grandTotal')}
            grandTotalValue={fmtCurrency(bill.grandTotal)}
            footerRows={billFooterRows}
          />
        )}

        {/* Edit mode UI */}
        {editMode && (
          <DocumentEditPanel
            items={editItems}
            onAddClick={() => setShowCat(true)}
            onRemoveItem={removeEditItem}
            onDecreaseQty={(i) => updateEditQty(i, editItems[i].qty - 1)}
            onIncreaseQty={(i) => updateEditQty(i, editItems[i].qty + 1)}
            onPriceChange={updateEditPrice}
            onPriceKeyDown={handleEnterDismissKeyboard}
            itemsTitle="Parts & Services"
            addLabel={t('common.add')}
            emptyText="Tap Add to add parts or services"
            photoTitle={t('estimate.jobPhoto')}
            photoHint={t('estimate.jobPhotoHint')}
            photoPreparing={photoPreparing}
            photoPreview={editJobPhotoPreview}
            photoInputRef={photoInputRef}
            onPhotoSelect={handleEditPhotoSelect}
            onPhotoRemove={handleRemoveEditPhoto}
            photoTapLabel={t('estimate.photoTap')}
            photoHelpLabel={t('estimate.photoHelp')}
            photoPreparingLabel={t('estimate.photoPreparing')}
            replacePhotoLabel={t('settings.replacePhoto')}
            removePhotoLabel={t('settings.removePhoto')}
            labourLabel="Labour Charges (₹)"
            labourValue={editLabour}
            onLabourChange={(e) => setEditLabour(e.target.value)}
            onLabourKeyDown={handleEnterDismissKeyboard}
            gstLabel="GST Bill (18%)"
            isGST={editIsGST}
            onToggleGST={() => setEditIsGST((g) => !g)}
            totalRows={editTotalRows}
            grandTotalLabel="Grand Total"
            grandTotalValue={fmtCurrency(editGrandTotal)}
            onCancel={() => setEditMode(false)}
            onSave={handleSaveEdit}
            saving={savingEdit}
            cancelLabel={t('common.cancel')}
            saveLabel="Save Changes"
            savingLabel="Saving…"
          />
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
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-brand-mid/20 bg-white px-4 text-sm font-semibold text-brand-dark shadow-sm"
              onClick={handlePreviewPDF}
              disabled={pdfLoading}
            >
              <Eye className="w-4 h-4" /> {pdfLoading ? '…' : t('bill.viewPdf')}
            </button>
            <button
              className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#1fa855] px-4 text-sm font-semibold text-white active:scale-95"
              onClick={handleWhatsApp} disabled={pdfLoading}>
              <WhatsAppIcon className="w-5 h-5" badge badgeClassName="p-1" /> WhatsApp
            </button>
          </div>
          {!isPaid && (
            <button className="flex h-11 w-full items-center justify-center rounded-xl bg-brand-mid px-4 text-sm font-semibold text-white shadow-sm" onClick={() => setPayPanel(true)}>
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
