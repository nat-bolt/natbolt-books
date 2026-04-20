import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import {
  Plus, Store, RefreshCw, LogOut, ChevronRight, X,
  BarChart2, MapPin, Package, TrendingUp, ChevronDown, ChevronUp,
  ExternalLink, QrCode, Upload, Image, Trash2, RotateCcw, Archive, ArrowRight,
} from 'lucide-react';
import { auth } from '../firebase';
import { supabase, mapShop } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import InlineNotice from '../components/InlineNotice';
import ConfirmSheet from '../components/ConfirmSheet';
import StatusBadge from '../components/StatusBadge';
import { FREE_BILL_LIMIT } from '../config';
import { UNIQUE_CITIES } from '../data/cities';
import { ADDRESS_LINE_LIMIT, joinAddressLines, splitAddressForForm } from '../utils/shopAddress';

const FREE_LIMIT = FREE_BILL_LIMIT;
const ADMIN_SHOPS_CACHE_PREFIX = 'nb_admin_shops_v1';

function SetupStepChip({ active, complete, label }) {
  const stateClass = active
    ? 'border-brand-mid bg-brand-mid text-white shadow-[0_10px_24px_rgba(240,96,34,0.2)]'
    : complete
      ? 'border-brand-light bg-brand-light/70 text-brand-mid'
      : 'border-gray-200 bg-white text-gray-500';

  return (
    <div className={`rounded-2xl border px-3 py-2 text-center text-xs font-semibold ${stateClass}`}>
      {label}
    </div>
  );
}

// ── URL safety helper ─────────────────────────────────────────────────────────
// Ensures URLs rendered as <a href> are limited to http/https, preventing
// javascript: or data: URLs from being stored or rendered.
function isSafeUrl(url) {
  if (!url) return true; // empty/null is fine
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false; // not a valid URL at all
  }
}

// ── Create / Edit Shop Modal ──────────────────────────────────────────────────
function ShopFormModal({ existing, onSave, onClose }) {
  const { t } = useTranslation();
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const [step, setStep] = useState(0);
  const [initialAddressLine1, initialAddressLine2] = splitAddressForForm(existing?.address || '');

  const [form, setForm] = useState({
    shopName:  existing?.shopName  || '',
    ownerName: existing?.ownerName || '',
    phone:     existing?.phone     || '',
    gstNumber: existing?.gstNumber || '',
    upiId:     existing?.upiId     || '',
    addressLine1: initialAddressLine1,
    addressLine2: initialAddressLine2,
    city:      existing?.city      || '',
    pincode:   existing?.pincode   || '',
    mapsUrl:   existing?.mapsUrl   || '',
    plan:      existing?.plan      || 'free',
  });

  // QR state
  const [qrFile, setQrFile]       = useState(null);
  const [qrPreview, setQrPreview] = useState('');
  const [qrError, setQrError]     = useState('');

  // Shop photo state
  const [photoFile, setPhotoFile]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [photoError, setPhotoError]     = useState('');

  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');
  const steps = [
    t('setup.stepBusiness'),
    t('setup.stepContact'),
    t('setup.stepPayments'),
    t('setup.stepAssets'),
  ];

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleQrPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setQrError('Must be PNG or JPG'); return; }
    setQrFile(file);
    setQrError('');
    const reader = new FileReader();
    reader.onload = (ev) => setQrPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearQrPick = () => {
    setQrFile(null);
    setQrPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Upload QR to storage, returns public URL or null
  const uploadQr = async (shopId) => {
    if (!qrFile) return null;
    const ext  = qrFile.name.split('.').pop().toLowerCase() || 'png';
    const path = `${shopId}/qr.${ext}`;

    const { data: uploadData, error: upErr } = await supabase.storage
      .from('shop-assets')
      .upload(path, qrFile, { upsert: true, contentType: qrFile.type });

    if (upErr) throw new Error(`QR upload failed: ${upErr.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from('shop-assets')
      .getPublicUrl(uploadData.path);

    return publicUrl;
  };

  const handlePhotoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setPhotoError('Must be PNG or JPG'); return; }
    setPhotoFile(file);
    setPhotoError('');
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearPhotoPick = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // Upload shop photo to storage, returns public URL or null
  const uploadPhoto = async (shopId) => {
    if (!photoFile) return null;
    const ext  = photoFile.name.split('.').pop().toLowerCase() || 'png';
    const path = `${shopId}/photo.${ext}`;

    const { data: uploadData, error: upErr } = await supabase.storage
      .from('shop-assets')
      .upload(path, photoFile, { upsert: true, contentType: photoFile.type });

    if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`);

    const { data: { publicUrl } } = supabase.storage
      .from('shop-assets')
      .getPublicUrl(uploadData.path);

    return publicUrl;
  };

  const handleSave = async () => {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    const rawPhone = form.phone.replace(/\D/g, '');
    const address = joinAddressLines(form.addressLine1, form.addressLine2);
    const e164 = rawPhone.length === 10
      ? `+91${rawPhone}`
      : rawPhone.length === 12 && rawPhone.startsWith('91')
        ? `+${rawPhone}`
        : '';

    if (!e164) {
      setError('Enter a valid 10-digit mobile number');
      return;
    }

    setSaving(true);
    setError('');
    try {
      if (existing) {
        // ── Edit existing shop ──────────────────────────────────────────────
        // Upload files first if new files were selected
        let qrCodeUrl = existing.qrCodeUrl || null;
        let shopPhotoUrl = existing.shopPhotoUrl || null;

        if (qrFile) {
          qrCodeUrl = await uploadQr(existing.id);
        }
        if (photoFile) {
          shopPhotoUrl = await uploadPhoto(existing.id);
        }

        const { error: err } = await supabase
          .from('shops')
          .update({
            shop_name:      form.shopName.trim(),
            owner_name:     form.ownerName.trim() || null,
            gst_number:     form.gstNumber.trim() || null,
            upi_id:         form.upiId.trim()     || null,
            address:        address || null,
            city:           form.city.trim()      || null,
            pincode:        form.pincode.trim()   || null,
            maps_url:       form.mapsUrl.trim()   || null,
            qr_code_url:    qrCodeUrl,
            shop_photo_url: shopPhotoUrl,
            plan:           form.plan,
            updated_at:     new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (err) throw err;
        onSave({
          ...existing,
          ...form,
          address,
          phone: e164,
          qrCodeUrl,
          shopPhotoUrl,
        });

      } else {
        // ── Create new shop ─────────────────────────────────────────────────
        const { data, error: err } = await supabase
          .from('shops')
          .insert({
            phone:      e164,
            shop_name:  form.shopName.trim(),
            owner_name: form.ownerName.trim() || null,
            gst_number: form.gstNumber.trim() || null,
            upi_id:     form.upiId.trim()     || null,
            address:    address || null,
            city:       form.city.trim()      || null,
            pincode:    form.pincode.trim()   || null,
            maps_url:   form.mapsUrl.trim()   || null,
            plan:       form.plan,
          })
          .select()
          .single();

        if (err) throw err;

        // Upload files now that we have the shop ID
        let qrCodeUrl = null;
        let shopPhotoUrl = null;

        if (qrFile) {
          qrCodeUrl = await uploadQr(data.id);
        }
        if (photoFile) {
          shopPhotoUrl = await uploadPhoto(data.id);
        }

        // Update shop with file URLs if any were uploaded
        if (qrCodeUrl || shopPhotoUrl) {
          await supabase
            .from('shops')
            .update({
              qr_code_url: qrCodeUrl,
              shop_photo_url: shopPhotoUrl,
            })
            .eq('id', data.id);
        }

        // Send welcome WhatsApp message (admin → new shop owner)
        try {
          const ownerName = form.ownerName.trim() || 'there';
          const shopName = form.shopName.trim();
          const welcomeMessage = `🎉 Welcome to NatBolt Billu!

Hi ${ownerName}! 👋

Your shop "${shopName}" has been successfully registered with NatBolt Billu - India's simplest billing software for vehicle service shops!

✨ What you can do now:
✅ Create professional bills & estimates
✅ Manage customers & vehicle history
✅ Generate PDF invoices with QR codes
✅ Track daily/monthly income & analytics
✅ Export data to CSV

📱 Login Details:
Phone: ${e164}
Download app: https://natbolt.com/billu

🎁 You're on the FREE plan with 30 bills/month.
Upgrade anytime for unlimited billing at just ₹499/month!

Need help? Reply to this message!

Happy billing! 🚀
- NatBolt Team`;

          const whatsappUrl = `https://wa.me/${e164.replace(/[^\d]/g, '')}?text=${encodeURIComponent(welcomeMessage)}`;

          // Open WhatsApp in a new tab so admin can send the welcome message
          window.open(whatsappUrl, '_blank');
        } catch (whatsappErr) {
          // Don't block shop creation if WhatsApp fails
          console.warn('[AdminPanel] WhatsApp message failed:', whatsappErr);
        }

        onSave(mapShop({ ...data, qr_code_url: qrCodeUrl, shop_photo_url: shopPhotoUrl }));
      }
      onClose();
    } catch (err) {
      console.error(err);
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  const validateStep = (targetStep = step) => {
    if (targetStep === 0) {
      if (!form.shopName.trim()) {
        setError(t('setup.shopNameRequired'));
        return false;
      }
    }

    if (targetStep === 1) {
      if (!form.phone.trim()) {
        setError('Phone number is required');
        return false;
      }
    }

    if (targetStep === 2) {
      if (!form.upiId.trim()) {
        setError(t('setup.upiRequired'));
        return false;
      }
    }

    if (targetStep === 3) {
      if (form.mapsUrl.trim() && !isSafeUrl(form.mapsUrl.trim())) {
        setError('Google Maps link must be a valid https:// URL');
        return false;
      }
      if (!displayPhoto) {
        setError(t('setup.shopPhotoRequired'));
        return false;
      }
    }

    setError('');
    return true;
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 0));
  };

  // Current files to display (new previews take priority over stored URLs)
  const displayQr = qrPreview || existing?.qrCodeUrl || null;
  const displayPhoto = photoPreview || existing?.shopPhotoUrl || null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(8,8,8,0.42)] px-4 py-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-[30px] border border-white/70 bg-white shadow-[0_32px_80px_rgba(0,0,0,0.24)]"
        style={{ maxHeight: 'calc(var(--app-height) - 32px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-brand-dark">
              {existing ? 'Edit Shop' : 'Register New Shop'}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              {steps[step]}
            </p>
          </div>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="overflow-y-auto px-6 py-5" style={{ maxHeight: 'calc(var(--app-height) - 164px)' }}>
          <div className="mb-5 grid grid-cols-4 gap-2">
            {steps.map((label, index) => (
              <SetupStepChip
                key={label}
                label={label}
                active={index === step}
                complete={index < step}
              />
            ))}
          </div>

          <div className="space-y-4">
            {step === 0 ? (
              <>
                <div>
                  <label className="section-label">{t('setup.shopName')} *</label>
                  <input className="input-field" placeholder={t('setup.shopNamePlaceholder')}
                    value={form.shopName} onChange={setField('shopName')} />
                </div>

                <div>
                  <label className="section-label">{t('setup.ownerName')}</label>
                  <input className="input-field" placeholder={t('setup.ownerNamePlaceholder')}
                    value={form.ownerName} onChange={setField('ownerName')} />
                </div>

                <div>
                  <label className="section-label">{t('setup.gstNumber')}</label>
                  <input className="input-field" placeholder={t('setup.gstPlaceholder')}
                    value={form.gstNumber} onChange={setField('gstNumber')} />
                </div>
              </>
            ) : null}

            {step === 1 ? (
              <>
                <div>
                  <label className="section-label">
                    Phone Number * <span className="text-gray-400 font-normal">(10 digits or +91...)</span>
                  </label>
                  <input className="input-field" type="tel" placeholder="9876543210"
                    value={form.phone} onChange={setField('phone')}
                    disabled={!!existing}
                  />
                  {existing && (
                    <p className="text-xs text-gray-400 mt-1">Phone cannot be changed after registration</p>
                  )}
                </div>

                <div>
                  <label className="section-label">{t('settings.addressLine1')}</label>
                  <input
                    className="input-field"
                    maxLength={ADDRESS_LINE_LIMIT}
                    placeholder={t('settings.addressLinePlaceholder', { count: 1 })}
                    value={form.addressLine1}
                    onChange={setField('addressLine1')}
                  />
                  <p className="text-xs text-gray-400 mt-1">{form.addressLine1.length}/{ADDRESS_LINE_LIMIT}</p>
                </div>

                <div>
                  <label className="section-label">{t('settings.addressLine2')}</label>
                  <input
                    className="input-field"
                    maxLength={ADDRESS_LINE_LIMIT}
                    placeholder={t('settings.addressLinePlaceholder', { count: 2 })}
                    value={form.addressLine2}
                    onChange={setField('addressLine2')}
                  />
                  <p className="text-xs text-gray-400 mt-1">{form.addressLine2.length}/{ADDRESS_LINE_LIMIT}</p>
                </div>

                <div>
                  <label className="section-label">{t('setup.city')}</label>
                  <select className="input-field" value={form.city} onChange={setField('city')}>
                    <option value="">{t('setup.cityPlaceholder')}</option>
                    {UNIQUE_CITIES.map((city) => (
                      <option key={city.name + city.code} value={city.name}>
                        {city.name} ({city.state})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">{t('setup.cityHint')}</p>
                </div>

                <div>
                  <label className="section-label">{t('setup.pincode')}</label>
                  <input className="input-field" placeholder={t('setup.pincodePlaceholder')}
                    maxLength={10} inputMode="numeric"
                    value={form.pincode} onChange={setField('pincode')} />
                  <p className="text-xs text-gray-500 mt-1">{t('setup.pincodeHint')}</p>
                </div>
              </>
            ) : null}

            {step === 2 ? (
              <>
                <div>
                  <label className="section-label">{t('setup.upiId')} *</label>
                  <input className="input-field" placeholder={t('setup.upiPlaceholder')}
                    value={form.upiId} onChange={setField('upiId')} />
                  <p className="text-xs text-gray-500 mt-1">{t('setup.upiRequired')}</p>
                </div>

                <div>
                  <label className="section-label flex items-center gap-1.5">
                    <QrCode className="w-3.5 h-3.5" />
                    {t('setup.paymentQr')}
                  </label>

                  {displayQr ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={displayQr}
                        alt="QR"
                        className="w-20 h-20 object-contain rounded-xl border border-gray-200 bg-white flex-shrink-0"
                      />
                      <div className="flex-1 space-y-1.5">
                        {qrPreview
                          ? <p className="text-xs text-amber-600 font-medium">New QR selected — will upload on save</p>
                          : <p className="text-xs text-green-600 font-medium">✓ QR code set</p>
                        }
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-full border border-dashed border-gray-300 rounded-xl py-1.5 text-xs text-gray-500"
                        >
                          {qrPreview ? 'Choose different image' : 'Replace QR image'}
                        </button>
                        {qrPreview && (
                          <button type="button" onClick={clearQrPick} className="w-full text-xs text-gray-400 py-1">
                            Clear selection
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 flex items-center justify-center gap-2 text-gray-400 text-sm"
                    >
                      <Upload className="w-4 h-4" />
                      {t('setup.paymentQrUpload')}
                    </button>
                  )}

                  {qrError && <p className="text-red-500 text-xs mt-1">{qrError}</p>}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handleQrPick}
                  />
                </div>
              </>
            ) : null}

            {step === 3 ? (
              <>
                <div>
                  <label className="section-label">{t('setup.mapsLink')}</label>
                  <input className="input-field" placeholder={t('setup.mapsPlaceholder')}
                    value={form.mapsUrl} onChange={setField('mapsUrl')} />
                  <p className="text-xs text-gray-500 mt-1">{t('setup.mapsHint')}</p>
                </div>

                <div>
                  <label className="section-label">Plan</label>
                  <div className="flex gap-2">
                    {['free', 'paid'].map((p) => (
                      <button
                        type="button"
                        key={p}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${form.plan === p ? 'bg-brand-mid text-white' : 'bg-gray-100 text-gray-600'}`}
                        onClick={() => setForm((f) => ({ ...f, plan: p }))}
                      >
                        {p === 'free' ? '🆓 Free (30 bills/mo)' : '⭐ Paid (Unlimited)'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="section-label flex items-center gap-1.5">
                    <Image className="w-3.5 h-3.5" />
                    {t('setup.shopPhoto')} *
                  </label>

                  {displayPhoto ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={displayPhoto}
                        alt="Shop"
                        className="w-20 h-20 object-cover rounded-xl border border-gray-200 bg-white flex-shrink-0"
                      />
                      <div className="flex-1 space-y-1.5">
                        {photoPreview
                          ? <p className="text-xs text-amber-600 font-medium">New photo selected — will upload on save</p>
                          : <p className="text-xs text-green-600 font-medium">✓ Shop photo set</p>
                        }
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="w-full border border-dashed border-gray-300 rounded-xl py-1.5 text-xs text-gray-500"
                        >
                          {photoPreview ? 'Choose different image' : 'Replace photo'}
                        </button>
                        {photoPreview && (
                          <button type="button" onClick={clearPhotoPick} className="w-full text-xs text-gray-400 py-1">
                            Clear selection
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 flex items-center justify-center gap-2 text-gray-400 text-sm"
                    >
                      <Upload className="w-4 h-4" />
                      {t('setup.shopPhotoUpload')}
                    </button>
                  )}

                  {photoError && <p className="text-red-500 text-xs mt-1">{photoError}</p>}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg"
                    className="hidden"
                    onChange={handlePhotoPick}
                  />
                </div>
              </>
            ) : null}
          </div>

          {error && <p className="text-red-500 text-sm mt-4">{error}</p>}

          <div className="flex gap-3 mt-5">
            {step > 0 ? (
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={handleBack}
                disabled={saving}
              >
                {t('common.back')}
              </button>
            ) : null}

            <button
              type="button"
              className="btn-primary flex-1"
              onClick={step === steps.length - 1 ? handleSave : handleNext}
              disabled={saving}
            >
              {saving
                ? (qrFile || photoFile ? 'Saving files...' : 'Saving...')
                : step === steps.length - 1
                  ? (existing ? 'Save Changes' : 'Register Shop')
                  : (
                    <span className="inline-flex items-center gap-2">
                      {t('setup.next')}
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Network Analytics Section ─────────────────────────────────────────────────
function NetworkAnalytics() {
  const [open, setOpen]         = useState(false);
  const [loading, setLoading]   = useState(false);
  const [parts, setParts]       = useState([]);
  const [byPincode, setByPincode] = useState([]);
  const [days, setDays]         = useState(30);
  const [error, setError]       = useState('');

  const load = async (d = days) => {
    setLoading(true);
    setError('');
    try {
      const [{ data: partsData, error: e1 }, { data: pincodeData, error: e2 }] = await Promise.all([
        supabase.rpc('get_network_parts_stats', { p_days: d }),
        supabase.rpc('get_shops_by_pincode'),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      setParts(partsData || []);
      setByPincode(pincodeData || []);
    } catch (err) {
      console.error('[AdminPanel] analytics error:', err);
      setError(err.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = () => {
    setOpen(true);
    load(days);
  };

  const handleDaysChange = (d) => {
    setDays(d);
    load(d);
  };

  const fmtCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  const maxCount    = parts[0]?.total_count || 1;

  if (!open) {
    return (
      <button
        className="w-full bg-indigo-50 border border-indigo-200 rounded-2xl p-4 flex items-center gap-3 text-left active:bg-indigo-100"
        onClick={handleOpen}
      >
        <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
          <BarChart2 className="w-5 h-5 text-indigo-600" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-indigo-800 text-sm">Network Analytics</p>
          <p className="text-xs text-indigo-500">Cross-shop parts trends · Geographic breakdown</p>
        </div>
        <ChevronDown className="w-5 h-5 text-indigo-400" />
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart2 className="w-5 h-5" />
          <span className="font-bold">Network Analytics</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => load(days)} className="p-1 rounded-lg bg-white/20">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setOpen(false)} className="p-1 rounded-lg bg-white/20">
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="p-4 space-y-5">
        {/* Period selector */}
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold ${days === d ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              onClick={() => handleDaysChange(d)}
            >
              {d === 7 ? 'Last 7 days' : d === 30 ? 'Last 30 days' : 'Last 90 days'}
            </button>
          ))}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-sm">{error}</div>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ── Parts trending ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Package className="w-4 h-4 text-indigo-600" />
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                  Top Parts Across All Shops
                </p>
              </div>

              {parts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No bill data in this period</p>
              ) : (
                <div className="space-y-2">
                  {parts.map((p, i) => (
                    <div key={p.part_name} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs font-bold text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
                          <span className="text-sm font-medium text-gray-800 truncate">{p.part_name}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0 ml-2 text-right">
                          <span className="text-xs text-gray-500">{p.total_count}×</span>
                          <span className="text-xs font-bold text-green-700">{fmtCurrency(p.total_revenue)}</span>
                          <span className="text-xs text-indigo-500">{p.shop_count} {p.shop_count === 1 ? 'shop' : 'shops'}</span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden ml-7">
                        <div
                          className="h-full bg-indigo-400 rounded-full"
                          style={{ width: `${Math.round((p.total_count / maxCount) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upsell insight */}
              {parts.length > 0 && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-xs font-bold text-amber-800 mb-1">💡 Conversion Insight</p>
                  <p className="text-xs text-amber-700">
                    Top parts like <strong>{parts[0]?.part_name}</strong> are used across{' '}
                    <strong>{parts[0]?.shop_count}</strong> shops. Shops on the Paid plan can see
                    these trends themselves — use this to pitch upgrades.
                  </p>
                </div>
              )}
            </div>

            {/* ── By Pincode ── */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-indigo-600" />
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                  Shops by Pincode
                </p>
              </div>

              {byPincode.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No pincode data yet</p>
              ) : (
                <div className="space-y-2">
                  {byPincode.map((row) => (
                    <div key={row.pincode} className="bg-gray-50 rounded-xl px-3 py-2 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-bold text-gray-800">{row.pincode}</p>
                        <p className="text-xs text-gray-500">
                          {row.total_shops} shop{row.total_shops !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-semibold">
                          🆓 {row.free_shops}
                        </span>
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                          ⭐ {row.paid_shops}
                        </span>
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                          {row.total_shops > 0
                            ? `${Math.round((row.paid_shops / row.total_shops) * 100)}%`
                            : '0%'} paid
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Admin Panel ──────────────────────────────────────────────────────────
export default function AdminPanel() {
  const navigate = useNavigate();
  const { user, isAdmin, authLoading, setUser, setShop, setIsAdmin } = useStore();
  const adminCacheKey = `${ADMIN_SHOPS_CACHE_PREFIX}:${user?.uid || 'anon'}`;

  const [shops, setShops] = useState([]);
  const [deactivatedShops, setDeactivatedShops] = useState([]);
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'create' | shop object
  const [busyShopId, setBusyShopId] = useState(null);
  const [busyAction, setBusyAction] = useState('');
  const [notice, setNotice] = useState(null);
  const [confirmState, setConfirmState] = useState(null);

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) return;
    let hasCachedSnapshot = false;

    try {
      const raw = localStorage.getItem(adminCacheKey);
      if (raw) {
        const cached = JSON.parse(raw);
        if (Array.isArray(cached?.active)) setShops(cached.active);
        if (Array.isArray(cached?.deactivated)) setDeactivatedShops(cached.deactivated);
        setLoading(false);
        hasCachedSnapshot = true;
      }
    } catch {
      // Ignore cache parse errors; the fresh fetch below will replace them.
    }

    loadShops(hasCachedSnapshot);
  }, [adminCacheKey, authLoading, isAdmin]);

  useEffect(() => {
    if (!notice) return undefined;
    const timeoutId = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(timeoutId);
  }, [notice]);

  const loadShops = async (backgroundRefresh = false) => {
    if (!backgroundRefresh) {
      setLoading(true);
    }
    try {
      // Load all shops first (works whether deleted_at column exists or not)
      const { data: allShops, error } = await supabase
        .from('shops')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const mapped = (allShops || []).map(mapShop);

      // Separate active and deactivated based on deletedAt field
      // If column doesn't exist, all shops will be active (deletedAt = null)
      const active = mapped.filter(s => !s.deletedAt);
      const deactivated = mapped.filter(s => s.deletedAt);

      setShops(active);
      setDeactivatedShops(deactivated);
      localStorage.setItem(adminCacheKey, JSON.stringify({
        active,
        deactivated,
      }));
    } catch (err) {
      console.error('loadShops error:', err);
    } finally {
      if (!backgroundRefresh) {
        setLoading(false);
      }
    }
  };

  const handleShopSaved = (saved) => {
    setNotice({
      tone: 'success',
      title: modal === 'create' ? 'Shop registered' : 'Shop updated',
      body: `${saved.shopName || 'Shop'} is ready in the admin list.`,
    });
    setShops((prev) => {
      const idx = prev.findIndex((s) => s.id === saved.id);
      if (idx >= 0) {
        const updated = [...prev];
        updated[idx] = saved;
        return updated;
      }
      return [saved, ...prev];
    });
  };

  const togglePlan = async (shop) => {
    const newPlan = shop.plan === 'paid' ? 'free' : 'paid';
    setBusyShopId(shop.id);
    setBusyAction('plan');
    try {
      const { error } = await supabase
        .from('shops')
        .update({ plan: newPlan, updated_at: new Date().toISOString() })
        .eq('id', shop.id);

      if (error) throw error;

      setShops((prev) => prev.map((s) => s.id === shop.id ? { ...s, plan: newPlan } : s));
      setNotice({
        tone: 'success',
        title: newPlan === 'paid' ? 'Plan upgraded' : 'Plan downgraded',
        body: `${shop.shopName} is now on the ${newPlan === 'paid' ? 'Paid' : 'Free'} plan.`,
      });
    } catch (err) {
      console.error('[AdminPanel] toggle plan error:', err);
      setNotice({
        tone: 'danger',
        title: 'Plan update failed',
        body: err.message || 'Please try again.',
      });
    } finally {
      setBusyShopId(null);
      setBusyAction('');
    }
  };

  const resetBillCount = async (shop) => {
    setBusyShopId(shop.id);
    setBusyAction('reset');
    try {
      const { error } = await supabase
        .from('shops')
        .update({ bills_this_month: 0, updated_at: new Date().toISOString() })
        .eq('id', shop.id);

      if (error) throw error;

      setShops((prev) => prev.map((s) => s.id === shop.id ? { ...s, billsThisMonth: 0 } : s));
      setNotice({
        tone: 'success',
        title: 'Bill count reset',
        body: `${shop.shopName} can start a fresh Free-plan billing cycle.`,
      });
    } catch (err) {
      console.error('[AdminPanel] reset bill count error:', err);
      setNotice({
        tone: 'danger',
        title: 'Reset failed',
        body: err.message || 'Please try again.',
      });
    } finally {
      setBusyShopId(null);
      setBusyAction('');
    }
  };

  const deactivateShop = async (shop) => {
    setBusyShopId(shop.id);
    setBusyAction('deactivate');
    try {
      const { error } = await supabase
        .from('shops')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', shop.id);

      if (error) throw error;

      await loadShops();
      setNotice({
        tone: 'warning',
        title: 'Shop deactivated',
        body: `${shop.shopName} is now hidden from the active list and can be restored later.`,
      });
    } catch (err) {
      console.error('[AdminPanel] deactivate shop error:', err);
      setNotice({
        tone: 'danger',
        title: 'Deactivate failed',
        body: err.message || 'Please try again.',
      });
    } finally {
      setBusyShopId(null);
      setBusyAction('');
    }
  };

  const reactivateShop = async (shop) => {
    setBusyShopId(shop.id);
    setBusyAction('reactivate');
    try {
      const { error } = await supabase
        .from('shops')
        .update({
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shop.id);

      if (error) throw error;

      await loadShops();
      setNotice({
        tone: 'success',
        title: 'Shop reactivated',
        body: `${shop.shopName} is back in the active list.`,
      });
    } catch (err) {
      console.error('[AdminPanel] reactivate shop error:', err);
      setNotice({
        tone: 'danger',
        title: 'Reactivate failed',
        body: err.message || 'Please try again.',
      });
    } finally {
      setBusyShopId(null);
      setBusyAction('');
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setUser(null);
    setShop(null);
    setIsAdmin(false);
    navigate('/login', { replace: true });
  };

  // ── Computed stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      total:        shops.length,
      paid:         shops.filter((s) => s.plan === 'paid').length,
      free:         shops.filter((s) => s.plan === 'free').length,
      newThisMonth: shops.filter((s) => new Date(s.createdAt) >= startOfMonth).length,
      conversionPct: shops.length > 0
        ? Math.round((shops.filter((s) => s.plan === 'paid').length / shops.length) * 100)
        : 0,
    };
  }, [shops]);

  if (authLoading) return (
    <Layout title="NatBolt Admin" showNav={false} showLanguage={false}>
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );

  return (
    <Layout
      showNav={false}
      showLanguage={false}
      titleNode={(
        <div>
          <h1 className="text-lg font-bold">NatBolt Admin</h1>
          <p className="text-xs text-gray-500">{user?.phoneNumber}</p>
        </div>
      )}
      headerRight={(
        <button onClick={handleLogout} className="rounded-xl border border-[#E8DED3] bg-white p-2 text-brand-dark shadow-sm">
          <LogOut className="w-5 h-5" />
        </button>
      )}
    >
      <div className="p-4 space-y-4 pb-8">
        {notice ? (
          <InlineNotice tone={notice.tone} title={notice.title} compact>
            {notice.body}
          </InlineNotice>
        ) : null}

        {/* ── Stats grid (4 cards) ── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-brand-dark">{stats.total}</p>
            <p className="text-xs text-gray-500">Total Shops</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-indigo-600">{stats.newThisMonth}</p>
            <p className="text-xs text-gray-500">New This Month</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-green-600">{stats.paid}</p>
            <p className="text-xs text-gray-500">⭐ Paid</p>
          </div>
          <div className="bg-white rounded-2xl p-3 text-center shadow-sm">
            <p className="text-2xl font-bold text-amber-500">{stats.free}</p>
            <p className="text-xs text-gray-500">🆓 Free</p>
          </div>
        </div>

        {/* Conversion rate banner */}
        {stats.total > 0 && (
          <div className="bg-gradient-to-r from-indigo-600 to-brand-mid rounded-2xl p-4 text-white flex items-center gap-3">
            <TrendingUp className="w-8 h-8 opacity-80 flex-shrink-0" />
            <div>
              <p className="font-bold text-lg">{stats.conversionPct}%</p>
              <p className="text-xs opacity-80">
                Conversion rate — {stats.paid} of {stats.total} shops on Paid plan
              </p>
            </div>
          </div>
        )}

        {/* ── Network Analytics (collapsible) ── */}
        <NetworkAnalytics />

        {/* ── Register new shop ── */}
        <button
          className="btn-accent w-full flex items-center justify-center gap-2 py-4 rounded-2xl shadow-md"
          onClick={() => setModal('create')}
        >
          <Plus className="w-5 h-5" />
          Register New Shop
        </button>

        {/* ── Shops list ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold text-brand-mid uppercase tracking-wide">Registered Shops</p>
            <button onClick={loadShops} className="text-brand-mid">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
            </div>
          ) : shops.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
              <Store className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              No shops registered yet
            </div>
          ) : (
            <div className="space-y-2">
              {shops.map((shop) => (
                <div key={shop.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-brand-dark truncate">{shop.shopName}</p>
                        <StatusBadge variant={shop.plan === 'paid' ? 'paid' : 'neutral'}>
                          {shop.plan === 'paid' ? 'Paid' : 'Free'}
                        </StatusBadge>
                        {shop.plan === 'free' ? (
                          <StatusBadge variant="warning">
                            {shop.billsThisMonth || 0}/{FREE_LIMIT} bills
                          </StatusBadge>
                        ) : null}
                      </div>
                      <p className="text-sm text-gray-500">{shop.ownerName}</p>
                      <p className="text-xs text-gray-400 font-mono">{shop.phone}</p>

                      {/* Pincode + Maps link row */}
                      <div className="flex items-center gap-3 mt-0.5">
                        {shop.pincode && (
                          <p className="text-xs text-indigo-600 font-semibold">📍 {shop.pincode}</p>
                        )}
                        {shop.mapsUrl && isSafeUrl(shop.mapsUrl) && (
                          <a
                            href={shop.mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-blue-500 flex items-center gap-0.5"
                            onClick={(e) => e.stopPropagation()}
                          >
                            Maps <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>

                    </div>
                    <button
                      className="inline-flex items-center gap-1 rounded-xl border border-[#E8DED3] bg-[#F8F3EC] px-2.5 py-2 text-xs font-semibold text-brand-dark shadow-sm"
                      onClick={() => setModal(shop)}
                    >
                      Edit
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {shop.plan === 'paid' ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        className="w-full rounded-xl py-2 text-xs font-bold text-red-500 bg-red-50 border border-red-200"
                        onClick={() => setConfirmState({ type: 'deactivate', shop })}
                        disabled={busyShopId === shop.id && busyAction === 'deactivate'}
                      >
                        {busyShopId === shop.id && busyAction === 'deactivate' ? 'Deactivating...' : 'Deactivate Shop'}
                      </button>
                      <button
                        className="w-full rounded-xl py-2 text-xs font-bold bg-gray-100 text-gray-600"
                        onClick={() => togglePlan(shop)}
                        disabled={busyShopId === shop.id && busyAction === 'plan'}
                      >
                        {busyShopId === shop.id && busyAction === 'plan' ? 'Updating...' : 'Downgrade to Free'}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        className="w-full rounded-xl py-2 text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200"
                        onClick={() => togglePlan(shop)}
                        disabled={busyShopId === shop.id && busyAction === 'plan'}
                      >
                        {busyShopId === shop.id && busyAction === 'plan' ? 'Updating...' : 'Upgrade to Paid'}
                      </button>
                      <button
                        className="w-full rounded-xl py-2 text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200"
                        onClick={() => setConfirmState({ type: 'reset', shop })}
                        disabled={busyShopId === shop.id && busyAction === 'reset'}
                      >
                        {busyShopId === shop.id && busyAction === 'reset' ? 'Resetting...' : 'Reset Bill Count'}
                      </button>
                      <button
                        className="w-full rounded-xl py-2 text-xs font-bold text-red-500 bg-red-50 border border-red-200"
                        onClick={() => setConfirmState({ type: 'deactivate', shop })}
                        disabled={busyShopId === shop.id && busyAction === 'deactivate'}
                      >
                        {busyShopId === shop.id && busyAction === 'deactivate' ? 'Deactivating...' : 'Deactivate Shop'}
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Deactivated Shops (collapsible) ── */}
        {deactivatedShops.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
            <button
              onClick={() => setShowDeactivated(!showDeactivated)}
              className="w-full px-4 py-3 flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-2">
                <Archive className="w-4 h-4 text-gray-500" />
                <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                  Deactivated Shops ({deactivatedShops.length})
                </p>
              </div>
              {showDeactivated ? (
                <ChevronUp className="w-4 h-4 text-gray-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400" />
              )}
            </button>

            {showDeactivated && (
              <div className="px-4 pb-4 space-y-2">
                {deactivatedShops.map((shop) => (
                  <div key={shop.id} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-gray-700 truncate">{shop.shopName}</p>
                          <StatusBadge variant="danger">
                            Deactivated
                          </StatusBadge>
                        </div>
                        <p className="text-sm text-gray-500">{shop.ownerName}</p>
                        <p className="text-xs text-gray-400 font-mono">{shop.phone}</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Deactivated: {new Date(shop.deletedAt).toLocaleDateString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>

                    <button
                      className="w-full mt-3 py-2 rounded-xl text-xs font-bold bg-green-50 text-green-600 border border-green-200 flex items-center justify-center gap-1.5"
                      onClick={() => setConfirmState({ type: 'reactivate', shop })}
                      disabled={busyShopId === shop.id && busyAction === 'reactivate'}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {busyShopId === shop.id && busyAction === 'reactivate' ? 'Reactivating...' : 'Reactivate Shop'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Shop create/edit modal */}
      {modal && (
        <ShopFormModal
          existing={modal === 'create' ? null : modal}
          onSave={handleShopSaved}
          onClose={() => setModal(null)}
        />
      )}

      <ConfirmSheet
        open={!!confirmState}
        title={
          confirmState?.type === 'deactivate'
            ? `Deactivate ${confirmState.shop?.shopName || 'shop'}?`
            : confirmState?.type === 'reactivate'
              ? `Reactivate ${confirmState.shop?.shopName || 'shop'}?`
              : confirmState?.type === 'reset'
                ? `Reset bill count for ${confirmState.shop?.shopName || 'shop'}?`
                : ''
        }
        body={
          confirmState?.type === 'deactivate'
            ? 'This hides the shop from the active list, blocks shop-owner login, and keeps all data for audit and recovery.'
            : confirmState?.type === 'reactivate'
              ? 'This returns the shop to the active list and allows the shop owner to log in again.'
              : confirmState?.type === 'reset'
                ? 'This clears the Free-plan bill counter for the current month so the shop can keep billing.'
                : ''
        }
        confirmLabel={
          confirmState?.type === 'deactivate'
            ? 'Deactivate Shop'
            : confirmState?.type === 'reactivate'
              ? 'Reactivate Shop'
              : confirmState?.type === 'reset'
                ? 'Reset Bill Count'
                : 'Confirm'
        }
        tone={confirmState?.type === 'deactivate' ? 'danger' : 'warning'}
        onCancel={() => setConfirmState(null)}
        onConfirm={async () => {
          const nextConfirm = confirmState;
          setConfirmState(null);
          if (!nextConfirm?.shop) return;
          if (nextConfirm.type === 'deactivate') {
            await deactivateShop(nextConfirm.shop);
          } else if (nextConfirm.type === 'reactivate') {
            await reactivateShop(nextConfirm.shop);
          } else if (nextConfirm.type === 'reset') {
            await resetBillCount(nextConfirm.shop);
          }
        }}
      />
    </Layout>
  );
}
