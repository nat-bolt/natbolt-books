import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Pencil, Camera } from 'lucide-react';
import { supabase, mapBill, mapCustomer } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import DocumentTotalsCard from '../components/DocumentTotalsCard';
import InlineNotice from '../components/InlineNotice';
import StatusBadge from '../components/StatusBadge';
import StickyActionBar from '../components/StickyActionBar';
import WhatsAppIcon from '../components/WhatsAppIcon';
import { optimizeJobPhoto } from '../utils/jobPhoto';
import { openWhatsApp } from '../utils/whatsapp';

export default function EstimateDetail() {
  const { id }   = useParams();
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const { shop } = useStore();

  const [bill, setBill]         = useState(null);
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [converting, setConverting] = useState(false);
  const [convertedBillId, setConvertedBillId] = useState('');

  // ── Edit mode state ──────────────────────────────────────────────────────────
  const [editMode, setEditMode]     = useState(false);
  const [editLabour, setEditLabour] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [editJobPhotoFile, setEditJobPhotoFile] = useState(null);
  const [editJobPhotoPreview, setEditJobPhotoPreview] = useState('');
  const [editJobPhotoRemoved, setEditJobPhotoRemoved] = useState(false);
  const [photoPreparing, setPhotoPreparing] = useState(false);
  const photoInputRef = useRef(null);

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
    setEditLabour(String(bill.labourCharge || ''));
    setEditNotes(bill.notes || '');
    setEditJobPhotoFile(null);
    setEditJobPhotoPreview(bill.jobPhotoUrl || '');
    setEditJobPhotoRemoved(false);
    setPhotoPreparing(false);
    if (photoInputRef.current) photoInputRef.current.value = '';
    setEditMode(true);
  };

  const handleEnterDismissKeyboard = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
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

  const editGrandTotal = parseFloat(editLabour) || 0;

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
          items:          [],
          parts_subtotal: 0,
          labour_charge:  labour,
          notes:          editNotes.trim() || null,
          is_gst:         false,
          cgst:           0,
          sgst:           0,
          grand_total:    editGrandTotal,
          balance_due:    editGrandTotal,
          job_photo_url:  nextJobPhotoUrl,
        })
        .eq('id', id);

      if (!error) {
        setBill((b) => ({
          ...b,
          items:          [],
          partsSubtotal:  0,
          labourCharge:   labour,
          notes:          editNotes.trim(),
          isGST:          false,
          cgst:           0,
          sgst:           0,
          grandTotal:     editGrandTotal,
          balanceDue:     editGrandTotal,
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
    const approxTotal = Number(bill.grandTotal || bill.labourCharge || 0);
    const vehicleLabel = [bill.vehicleNo, bill.vehicleBrand, bill.vehicleModel].filter(Boolean).join(' ');
    const msg =
      `${t('estimate.whatsappGreeting', { name: customer?.name || t('customer.name') })}\n` +
      `${t('estimate.whatsappIntro', { shopName: shop.shopName })}\n` +
      `\n` +
      `${t('estimate.whatsappCardLine', { number: bill.estimateNumber })}\n` +
      `${vehicleLabel ? `${t('estimate.whatsappVehicleLine', { vehicle: vehicleLabel })}\n` : ''}` +
      `${approxTotal > 0 ? `${t('estimate.whatsappApproxLine', { amount: approxTotal.toFixed(2) })}\n` : ''}` +
      `${bill.notes?.trim() ? `${t('estimate.whatsappNotesLine', { notes: bill.notes.trim() })}\n` : ''}` +
      `\n` +
      `${t('estimate.whatsappPurpose')}\n` +
      `\n` +
      `${t('estimate.whatsappClosing')}\n` +
      `${t('pdf.poweredBy')}`;

    if (!phone) {
      setFeedback({
        tone: 'warning',
        title: t('bill.phoneMissingTitle'),
        body: t('bill.phoneMissingBody'),
      });
      return;
    }

    openWhatsApp(phone, msg);
  };

  // ── Convert to bill ──────────────────────────────────────────────────────────
  const handleConvertToBill = async () => {
    if (!bill || converting) return;
    setConverting(true);
    try {
      navigate(`/estimate/new?mode=bill&fromEstimate=${id}`);
    } catch (err) { console.error('Convert error:', err); }
    finally { setConverting(false); }
  };

  // ── Formatters ───────────────────────────────────────────────────────────────
  const fmtCurrency = (n) => `₹${Number(n || 0).toFixed(2)}`;
  const fmtDate = (ts) =>
    ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

  if (loading) return (
    <Layout showBack title={t('estimate.viewTitle')}>
      <div className="p-4 space-y-4 pb-36 animate-pulse">
        <div className="h-12 rounded-xl bg-green-100/70" />
        <div className="card">
          <div className="mb-4 flex items-start justify-between">
            <div className="space-y-2">
              <div className="h-5 w-36 rounded-full bg-gray-200" />
              <div className="h-3 w-20 rounded-full bg-gray-100" />
            </div>
            <div className="h-8 w-24 rounded-full bg-gray-100" />
          </div>
          <div className="space-y-3 border-t border-gray-100 pt-3">
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="flex items-center justify-between gap-3">
                <div className="h-3 w-20 rounded-full bg-gray-100" />
                <div className="h-3 w-28 rounded-full bg-gray-200" />
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="mb-3 h-4 w-24 rounded-full bg-gray-100" />
          <div className="h-56 rounded-xl bg-gray-100" />
        </div>
        <div className="card space-y-3">
          {[0, 1, 2].map((idx) => (
            <div key={idx} className="flex items-center justify-between gap-3">
              <div className="h-3 w-24 rounded-full bg-gray-100" />
              <div className="h-3 w-16 rounded-full bg-gray-200" />
            </div>
          ))}
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-28 rounded-full bg-gray-200" />
              <div className="h-4 w-20 rounded-full bg-gray-200" />
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );

  if (!bill) return null;

  const isConverted = bill.status === 'converted';
  const isVoid      = bill.status === 'void';
  const isDraft     = !isConverted && !isVoid;
  const approxTotal = Number(bill.grandTotal || bill.labourCharge || 0);

  return (
    <Layout showBack title={`${t('estimate.viewTitle')} ${bill.estimateNumber}`}>
      <div className="p-4 space-y-4 pb-36">
        {feedback ? (
          <InlineNotice tone={feedback.tone} title={feedback.title} compact>
            {feedback.body}
          </InlineNotice>
        ) : null}

        {isConverted && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-green-700">
            <div className="text-center font-semibold text-sm">✓ {t('bill.status.converted')}</div>
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
              <StatusBadge variant="estimate" size="md">{t('estimate.badge')}</StatusBadge>
              {isDraft && !editMode && (
                <button
                  className="p-2 rounded-xl bg-brand-light text-brand-mid active:scale-95"
                  onClick={enterEditMode}
                  title={t('common.edit')}
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
              <p className="section-label mb-0">{t('estimate.jobPhoto')}</p>
            </div>
            <div
              className="overflow-hidden rounded-xl border-2 border-gray-200 bg-brand-light/40"
              style={{ aspectRatio: '4 / 3', maxHeight: '300px' }}
            >
              <img
                src={bill.jobPhotoUrl}
                alt={t('estimate.jobPhoto')}
                className="h-full w-full object-cover"
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
        )}

        {bill.notes?.trim() ? (
          <div className="card space-y-2">
            <p className="section-label mb-0">{t('estimate.notes')}</p>
            <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{bill.notes}</p>
          </div>
        ) : null}

        {/* ── VIEW MODE: Approx Total ─────────────────────────────────────────── */}
        {!editMode && (
          <DocumentTotalsCard
            rows={[]}
            grandTotalLabel={t('estimate.approxTotal')}
            grandTotalValue={fmtCurrency(approxTotal)}
          />
        )}

        {/* ── EDIT MODE ────────────────────────────────────────────────────────── */}
        {editMode && (
          <div className="space-y-4">
            <div className="card space-y-3">
              <p className="section-label mb-0">{t('estimate.jobPhoto')}</p>
              {t('estimate.jobPhotoHint') ? <p className="-mt-2 text-xs text-gray-500">{t('estimate.jobPhotoHint')}</p> : null}
              {photoPreparing ? (
                <div className="flex items-center gap-2 text-xs text-brand-mid">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-mid border-t-transparent" />
                  {t('estimate.photoPreparing')}
                </div>
              ) : null}

              {editJobPhotoPreview ? (
                <div className="space-y-3">
                  <img
                    src={editJobPhotoPreview}
                    alt={t('estimate.jobPhoto')}
                    className="h-56 w-full rounded-xl border-2 border-gray-200 object-cover"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex-1 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
                      onClick={() => photoInputRef?.current?.click()}
                    >
                      {t('settings.replacePhoto')}
                    </button>
                    <button
                      type="button"
                      className="rounded-xl px-4 py-2.5 text-sm font-semibold text-red-500"
                      onClick={handleRemoveEditPhoto}
                    >
                      {t('settings.removePhoto')}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-6 text-gray-500 transition-colors hover:border-brand-mid hover:text-brand-mid active:bg-gray-50"
                  onClick={() => photoInputRef?.current?.click()}
                >
                  <Camera className="h-10 w-10" />
                  <div className="text-center">
                    <span className="block text-sm font-medium">{t('estimate.photoTap')}</span>
                    <span className="text-xs">{t('estimate.photoHelp')}</span>
                  </div>
                </button>
              )}

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleEditPhotoSelect}
              />
            </div>

            <div className="card space-y-3">
              <div>
                <label className="section-label">{t('estimate.approxTotal')}</label>
                <input
                  type="tel"
                  inputMode="decimal"
                  className="input-field"
                  placeholder={t('estimate.approxTotalPlaceholder')}
                  value={editLabour}
                  onChange={(e) => setEditLabour(e.target.value)}
                  onKeyDown={handleEnterDismissKeyboard}
                />
                <p className="mt-2 text-xs text-gray-500">{t('estimate.approxTotalHint')}</p>
              </div>
            </div>

            <div className="card space-y-3">
              <div>
                <label className="section-label">{t('estimate.notes')}</label>
                <p className="-mt-2 mb-2 text-xs text-gray-500">{t('estimate.notesHint')}</p>
                <textarea
                  className="input-field min-h-[112px] resize-none"
                  placeholder={t('estimate.notesPlaceholder')}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                />
              </div>
            </div>

            <DocumentTotalsCard
              rows={[]}
              grandTotalLabel={t('estimate.approxTotal')}
              grandTotalValue={fmtCurrency(editGrandTotal)}
            />

            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 rounded-xl border-2 border-gray-200 py-3 text-sm font-semibold text-gray-600"
                onClick={() => setEditMode(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                className="btn-accent flex flex-grow items-center justify-center gap-2"
                onClick={handleSaveEdit}
                disabled={savingEdit}
              >
                {savingEdit ? t('estimate.savingChanges') : t('catalogue.saveChanges')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer actions (only when not in edit mode) */}
      {isDraft && !editMode && (
        <StickyActionBar className="space-y-2">
          <div className="flex gap-2">
            <button
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#1fa855] px-4 text-sm font-semibold text-white active:scale-95 transition-all"
              onClick={handleWhatsApp}
            >
              <WhatsAppIcon className="w-5 h-5" badge badgeClassName="p-1" />
              <span>{t('common.whatsApp')}</span>
            </button>
            <button
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand-mid px-4 text-sm font-semibold text-white shadow-sm"
              onClick={handleConvertToBill}
              disabled={converting}
            >
              {converting ? t('estimate.converting') : t('estimate.convertToBill')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </StickyActionBar>
      )}
    </Layout>
  );
}
