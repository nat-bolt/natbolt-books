import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Pencil, Camera, Eye } from 'lucide-react';
import { supabase, mapBill, mapCustomer } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import CatalogueModal from '../components/CatalogueModal';
import DocumentEditPanel from '../components/DocumentEditPanel';
import DocumentItemsCard from '../components/DocumentItemsCard';
import DocumentPreviewLayer from '../components/DocumentPreviewLayer';
import DocumentTotalsCard from '../components/DocumentTotalsCard';
import StatusBadge from '../components/StatusBadge';
import StickyActionBar from '../components/StickyActionBar';
import WhatsAppIcon from '../components/WhatsAppIcon';
import useDocumentPreviewShare from '../hooks/useDocumentPreviewShare';
import { optimizeJobPhoto } from '../utils/jobPhoto';
import { openWhatsApp } from '../utils/whatsapp';

export default function EstimateDetail() {
  const { id }   = useParams();
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const { shop, language } = useStore();

  const [bill, setBill]         = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [converting, setConverting] = useState(false);
  const [convertedBillId, setConvertedBillId] = useState('');

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
    filename: `${bill?.estimateNumber || 'estimate'}.pdf`,
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

  const handleEnterDismissKeyboard = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
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
      console.error('Estimate detail photo preparation failed:', err);
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
          job_photo_url:  nextJobPhotoUrl,
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
          jobPhotoUrl:    nextJobPhotoUrl,
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
      `Your estimate *${bill.estimateNumber}* from *${shop.shopName}* is ready.\n` +
      `Vehicle: ${[bill.vehicleNo, bill.vehicleBrand, bill.vehicleModel].filter(Boolean).join(' ')}\n` +
      `Total: ₹${Number(bill.grandTotal || 0).toFixed(2)}${upiLine}\n` +
      `Thank you! 🙏\n\nPowered by NatBolt Billu`;

    if (!phone) {
      alert('Customer phone number is missing.');
      return;
    }

    registerWhatsAppLaunch();
    openWhatsApp(phone, msg);
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
          odo_reading:           bill.odoReading ? Number.parseInt(bill.odoReading, 10) : null,
          items:                 bill.items,
          parts_subtotal:        bill.partsSubtotal,
          labour_charge:         bill.labourCharge,
          is_gst:                bill.isGST,
          cgst:                  bill.cgst,
          sgst:                  bill.sgst,
          grand_total:           bill.grandTotal,
          job_photo_url:         bill.jobPhotoUrl,
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
  const estimateTotalRows = [
    { label: t('estimate.subtotal'), value: fmtCurrency(bill.partsSubtotal) },
    { label: t('estimate.labour'), value: fmtCurrency(bill.labourCharge) },
    ...(bill.isGST
      ? [
          { label: t('estimate.cgst'), value: fmtCurrency(bill.cgst) },
          { label: t('estimate.sgst'), value: fmtCurrency(bill.sgst) },
        ]
      : []),
  ];
  const editTotalRows = [
    { label: t('estimate.subtotal'), value: fmtCurrency(editPartsSubtotal) },
    { label: t('estimate.labour'), value: fmtCurrency(parseFloat(editLabour) || 0) },
    ...(editIsGST
      ? [
          { label: t('estimate.cgst'), value: fmtCurrency(editCgst) },
          { label: t('estimate.sgst'), value: fmtCurrency(editSgst) },
        ]
      : []),
  ];

  return (
    <Layout showBack title={`${t('estimate.viewTitle')} ${bill.estimateNumber}`}>
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
              <StatusBadge variant="estimate" size="md">Estimate</StatusBadge>
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

        {/* ── VIEW MODE: Parts ─────────────────────────────────────────────────── */}
        {!editMode && (
          <>
            <DocumentItemsCard
              title={t('estimate.parts')}
              items={bill.items || []}
              emptyText="No items added"
              qtyLabel={t('parts.qty')}
            />

            <DocumentTotalsCard
              rows={estimateTotalRows}
              grandTotalLabel={t('estimate.grandTotal')}
              grandTotalValue={fmtCurrency(bill.grandTotal)}
            />
          </>
        )}

        {/* ── EDIT MODE ────────────────────────────────────────────────────────── */}
        {editMode && (
          <>
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
        <StickyActionBar className="space-y-2">
          <div className="flex gap-2">
            <button
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-brand-mid/20 bg-white px-4 text-sm font-semibold text-brand-dark shadow-sm"
              onClick={handlePreviewPDF}
              disabled={pdfLoading}
            >
              <Eye className="w-4 h-4" />
              {pdfLoading ? '…' : t('bill.viewPdf')}
            </button>
            <button
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1fa855] px-4 text-sm font-semibold text-white active:scale-95 transition-all disabled:opacity-60"
              onClick={handleWhatsApp}
              disabled={pdfLoading}
            >
              <WhatsAppIcon className="w-5 h-5" badge badgeClassName="p-1" />
              {pdfLoading ? '…' : 'WhatsApp'}
            </button>
          </div>
          <button
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand-mid px-4 text-sm font-semibold text-white shadow-sm"
            onClick={handleConvertToBill}
            disabled={converting}
          >
            {converting ? t('estimate.converting') : t('estimate.convertToBill')}
            <ArrowRight className="w-4 h-4" />
          </button>
        </StickyActionBar>
      )}
    </Layout>
  );
}
