import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Save, LogOut, Globe, Crown, QrCode, MapPin, Upload, X, CheckCircle, Image } from 'lucide-react';
import { auth } from '../firebase';
import { supabase } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import i18n from '../i18n/index';
import { UNIQUE_CITIES } from '../data/cities';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi',   native: 'हिंदी'   },
  { code: 'te', label: 'Telugu',  native: 'తెలుగు'  },
];

// ── Reusable confirmation modal ───────────────────────────────────────────────
function ConfirmModal({ title, body, confirmLabel, cancelLabel = 'Keep it', onConfirm, onCancel }) {
  // Rendered via createPortal so it escapes the Layout <main> overflow/stacking
  // context — fixes modals appearing behind the bottom nav on iOS WebKit PWA.
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onCancel}>
      <div
        className="bg-white rounded-3xl p-6 max-h-[85vh] overflow-y-auto"
        style={{ width: 'calc(100vw - 32px)', maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag indicator — signals the sheet is scrollable if content overflows */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
        <h3 className="text-base font-bold text-brand-dark mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{body}</p>
        <div className="flex gap-3">
          <button
            className="flex-1 py-3 rounded-2xl border border-gray-200 text-sm font-semibold text-gray-600"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            className="flex-1 py-3 rounded-2xl bg-red-500 text-white text-sm font-semibold"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default function Settings() {
  const { t }      = useTranslation();
  const navigate   = useNavigate();
  const { shop, setShop, setUser, language, setLanguage } = useStore();
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);

  const [form, setForm] = useState({
    shopName:  shop?.shopName  || '',
    ownerName: shop?.ownerName || '',
    gstNumber: shop?.gstNumber || '',
    upiId:     shop?.upiId     || '',
    address:   shop?.address   || '',
    city:      shop?.city      || '',
    pincode:   shop?.pincode   || '',
    mapsUrl:   shop?.mapsUrl   || '',
  });

  // QR upload state
  const [qrFile, setQrFile]         = useState(null);
  const [qrPreview, setQrPreview]   = useState('');      // data URL for new file preview
  const [qrUploading, setQrUploading] = useState(false);
  const [qrSaved, setQrSaved]       = useState(false);
  const [qrError, setQrError]       = useState('');

  // Shop photo upload state
  const [photoFile, setPhotoFile]         = useState(null);
  const [photoPreview, setPhotoPreview]   = useState('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoSaved, setPhotoSaved]       = useState(false);
  const [photoError, setPhotoError]       = useState('');

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  // ── Confirm dialog state ──────────────────────────────────────────────────
  const [confirmDialog, setConfirmDialog] = useState(null); // null | 'removeQr' | 'removePhoto'

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // ── Friendly error mapper ─────────────────────────────────────────────────
  const friendlyError = (err) => {
    const msg = err?.message || '';
    if (!navigator.onLine || msg.includes('Failed to fetch') || msg.includes('NetworkError'))
      return "Couldn't save — check your connection and try again.";
    if (msg.includes('duplicate') || msg.includes('unique'))
      return 'This information is already registered.';
    if (msg.includes('JWT') || msg.includes('session') || msg.includes('auth'))
      return 'Your session expired. Please sign in again.';
    return 'Something went wrong. Please try again.';
  };

  // ── Shop details save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!shop) return;
    setSaving(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('shops')
        .update({
          shop_name:  form.shopName.trim(),
          owner_name: form.ownerName.trim() || null,
          gst_number: form.gstNumber.trim() || null,
          upi_id:     form.upiId.trim()     || null,
          address:    form.address.trim()   || null,
          city:       form.city.trim()      || null,
          pincode:    form.pincode.trim()   || null,
          maps_url:   form.mapsUrl.trim()   || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shop.id);

      if (err) throw err;
      setShop({
        ...shop,
        ...form,
        city: form.city.trim() || null,
        pincode: form.pincode.trim() || null,
        mapsUrl: form.mapsUrl.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Settings save error:', err);
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  // ── QR file picker ────────────────────────────────────────────────────────
  const handleQrPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setQrError('QR code must be an image file (PNG/JPG)');
      return;
    }
    setQrFile(file);
    setQrError('');
    const reader = new FileReader();
    reader.onload = (ev) => setQrPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearQrPick = () => {
    setQrFile(null);
    setQrPreview('');
    setQrError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── QR upload to Supabase Storage ─────────────────────────────────────────
  const handleQrUpload = async () => {
    if (!qrFile || !shop?.id) return;
    setQrUploading(true);
    setQrError('');
    try {
      const ext  = qrFile.name.split('.').pop().toLowerCase() || 'png';
      const path = `${shop.id}/qr.${ext}`;

      const { data: uploadData, error: upErr } = await supabase.storage
        .from('shop-assets')
        .upload(path, qrFile, { upsert: true, contentType: qrFile.type });

      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(uploadData.path);

      // Update shop row
      const { error: updateErr } = await supabase
        .from('shops')
        .update({ qr_code_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', shop.id);

      if (updateErr) throw updateErr;

      // Update store so PDF picks it up immediately
      setShop({ ...shop, qrCodeUrl: publicUrl });
      setQrFile(null);
      setQrPreview('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      setQrSaved(true);
      setTimeout(() => setQrSaved(false), 2500);
    } catch (err) {
      console.error('QR upload error:', err);
      setQrError(friendlyError(err));
    } finally {
      setQrUploading(false);
    }
  };

  // ── Remove QR ─────────────────────────────────────────────────────────────
  const handleQrRemove = () => {
    if (!shop?.qrCodeUrl) return;
    setConfirmDialog('removeQr');
  };

  const doQrRemove = async () => {
    setConfirmDialog(null);
    try {
      await supabase
        .from('shops')
        .update({ qr_code_url: null, updated_at: new Date().toISOString() })
        .eq('id', shop.id);
      setShop({ ...shop, qrCodeUrl: null });
    } catch (err) {
      console.error('QR remove error:', err);
    }
  };

  // ── Shop photo file picker ────────────────────────────────────────────────
  const handlePhotoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Shop photo must be an image file (PNG/JPG)');
      return;
    }
    setPhotoFile(file);
    setPhotoError('');
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const clearPhotoPick = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    setPhotoError('');
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // ── Shop photo upload to Supabase Storage ─────────────────────────────────
  const handlePhotoUpload = async () => {
    if (!photoFile || !shop?.id) return;
    setPhotoUploading(true);
    setPhotoError('');
    try {
      const ext  = photoFile.name.split('.').pop().toLowerCase() || 'png';
      const path = `${shop.id}/photo.${ext}`;

      const { data: uploadData, error: upErr } = await supabase.storage
        .from('shop-assets')
        .upload(path, photoFile, { upsert: true, contentType: photoFile.type });

      if (upErr) throw upErr;

      const { data: { publicUrl } } = supabase.storage
        .from('shop-assets')
        .getPublicUrl(uploadData.path);

      // Update shop row
      const { error: updateErr } = await supabase
        .from('shops')
        .update({ shop_photo_url: publicUrl, updated_at: new Date().toISOString() })
        .eq('id', shop.id);

      if (updateErr) throw updateErr;

      // Update store so it's available immediately
      setShop({ ...shop, shopPhotoUrl: publicUrl });
      setPhotoFile(null);
      setPhotoPreview('');
      if (photoInputRef.current) photoInputRef.current.value = '';
      setPhotoSaved(true);
      setTimeout(() => setPhotoSaved(false), 2500);
    } catch (err) {
      console.error('Shop photo upload error:', err);
      setPhotoError(friendlyError(err));
    } finally {
      setPhotoUploading(false);
    }
  };

  // ── Remove shop photo ─────────────────────────────────────────────────────
  const handlePhotoRemove = () => {
    if (!shop?.shopPhotoUrl) return;
    setConfirmDialog('removePhoto');
  };

  const doPhotoRemove = async () => {
    setConfirmDialog(null);
    try {
      await supabase
        .from('shops')
        .update({ shop_photo_url: null, updated_at: new Date().toISOString() })
        .eq('id', shop.id);
      setShop({ ...shop, shopPhotoUrl: null });
    } catch (err) {
      console.error('Shop photo remove error:', err);
    }
  };

  const handleLangChange = (code) => {
    setLanguage(code);
    i18n.changeLanguage(code);
  };

  const handleLogout = () => {
    setConfirmDialog('logout');
  };

  const doLogout = async () => {
    setConfirmDialog(null);
    await signOut(auth);
    await supabase.auth.signOut().catch(() => {});
    setUser(null);
    setShop(null);
    navigate('/login', { replace: true });
  };

  return (
    <Layout title={t('settings.title')}>
      <div className="p-4 space-y-4">

        {/* ── Plan banner ── */}
        <div className={`rounded-2xl p-4 ${shop?.plan === 'paid' ? 'bg-amber-50 border border-amber-200' : 'bg-brand-light border border-brand-mid/20'}`}>
          <div className="flex items-center gap-3">
            <Crown className={`w-6 h-6 flex-shrink-0 ${shop?.plan === 'paid' ? 'text-amber-500' : 'text-brand-mid'}`} />
            <div className="flex-1">
              <p className="font-bold text-sm text-brand-dark">
                {shop?.plan === 'paid' ? t('settings.paidPlan') : t('settings.freePlan')}
              </p>
              {shop?.plan !== 'paid' && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {t('settings.billsUsedThisMonth', { used: shop?.billsThisMonth || 0 })}
                </p>
              )}
            </div>
          </div>
          {shop?.plan !== 'paid' && (
            <div className="mt-3 space-y-2">
              <div className="flex justify-center">
                <div className="inline-block bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  Save 38% • Limited Time Offer
                </div>
              </div>
              <button
                className="w-full text-xs font-bold text-white bg-accent rounded-xl px-4 py-2.5 flex items-center justify-center gap-2"
                onClick={() => window.open(`https://wa.me/919738007523?text=${encodeURIComponent('Hi, I want to unlock unlimited billing on NatBolt Billu. Shop: ' + shop?.shopName)}`, '_blank')}
              >
                <span>Unlock at <span className="line-through opacity-70">₹799</span> ₹499/month</span>
              </button>
            </div>
          )}
        </div>

        {/* ── Language ── */}
        <div className="card">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-4 h-4 text-brand-mid" />
            <p className="section-label mb-0">{t('settings.language')}</p>
          </div>
          <div className="flex gap-2">
            {LANGUAGES.map((lng) => (
              <button
                key={lng.code}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${language === lng.code ? 'bg-brand-mid text-white' : 'bg-gray-100 text-gray-600'}`}
                onClick={() => handleLangChange(lng.code)}
              >
                {lng.native}
              </button>
            ))}
          </div>
        </div>

        {/* ── Shop details ── */}
        <div className="card space-y-3">
          <p className="section-label">{t('settings.shop')}</p>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.shopName')}</label>
            <input className="input-field" value={form.shopName} onChange={set('shopName')} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.ownerName')}</label>
            <input className="input-field" value={form.ownerName} onChange={set('ownerName')} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.upiId')}</label>
            <input className="input-field" value={form.upiId} onChange={set('upiId')} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.gstNumber')}</label>
            <input className="input-field" value={form.gstNumber} onChange={set('gstNumber')} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.address')}</label>
            <textarea className="input-field" rows={2} value={form.address} onChange={set('address')} />
          </div>

          {/* City */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">City</label>
            <select
              className="input-field"
              value={form.city}
              onChange={set('city')}
            >
              <option value="">Select your city</option>
              {UNIQUE_CITIES.map((city) => (
                <option key={city.name + city.code} value={city.name}>
                  {city.name} ({city.state})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">Used to generate your shop code and for analytics.</p>
          </div>

          {/* Pincode */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Pincode</label>
            <input
              className="input-field"
              placeholder="e.g. 500032"
              maxLength={10}
              inputMode="numeric"
              value={form.pincode}
              onChange={set('pincode')}
            />
            <p className="text-xs text-gray-400 mt-1">Used to generate your shop code and for analytics.</p>
          </div>

          {/* Google Maps share link */}
          <div>
            <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-brand-mid" />
              Google Maps Link <span className="text-gray-400">(optional)</span>
            </label>
            <input
              className="input-field"
              placeholder="Paste share link from Google Maps app"
              value={form.mapsUrl}
              onChange={set('mapsUrl')}
            />
            <p className="text-xs text-gray-400 mt-1">
              Open Google Maps → tap your shop → Share → Copy link
            </p>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            className="btn-primary w-full flex items-center justify-center gap-2"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : saved ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saved ? t('settings.saved') : saving ? t('settings.saving') : t('settings.save')}
          </button>
        </div>

        {/* ── Shop Photo ── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-brand-mid" />
            <p className="section-label mb-0">{t('settings.shopPhoto')}</p>
          </div>
          <p className="text-xs text-gray-500 -mt-1">
            {t('settings.shopPhotoDesc')}
          </p>

          {/* Current / new photo preview */}
          {(photoPreview || shop?.shopPhotoUrl) ? (
            <div className="flex items-start gap-4">
              <div className="relative">
                <img
                  src={photoPreview || shop?.shopPhotoUrl}
                  alt="Shop Photo"
                  className="w-28 h-28 object-cover rounded-xl border border-gray-200 bg-white"
                />
                {photoPreview && (
                  /* New file selected — show clear button */
                  <button
                    onClick={clearPhotoPick}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center shadow"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-2">
                {photoPreview ? (
                  <>
                    <p className="text-xs text-gray-500">{photoFile?.name}</p>
                    <button
                      className="btn-primary w-full text-sm py-2 flex items-center justify-center gap-2"
                      onClick={handlePhotoUpload}
                      disabled={photoUploading}
                    >
                      {photoUploading
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : photoSaved
                        ? <CheckCircle className="w-4 h-4" />
                        : <Upload className="w-4 h-4" />}
                      {photoUploading ? t('settings.uploading') : photoSaved ? t('settings.savedShort') : t('settings.savePhoto')}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-green-600 font-semibold">{t('settings.shopPhotoSet')}</p>
                    <button
                      className="w-full border border-dashed border-gray-300 rounded-xl py-2 text-xs text-gray-500 font-medium"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      {t('settings.replacePhoto')}
                    </button>
                    <button
                      className="w-full text-xs text-red-400 font-medium py-1"
                      onClick={handlePhotoRemove}
                    >
                      {t('settings.removePhoto')}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* No photo yet */
            <button
              onClick={() => photoInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-5 flex flex-col items-center gap-2 text-gray-400 active:bg-brand-light"
            >
              <Upload className="w-6 h-6" />
              <span className="text-sm font-medium">{t('settings.uploadPhotoBtn')}</span>
              <span className="text-xs">{t('settings.uploadPhotoHint')}</span>
            </button>
          )}

          {photoError && <p className="text-red-500 text-sm">{photoError}</p>}

          <input
            ref={photoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={handlePhotoPick}
          />
        </div>

        {/* ── Payment QR Code ── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-brand-mid" />
            <p className="section-label mb-0">{t('settings.paymentQr')}</p>
          </div>
          <p className="text-xs text-gray-500 -mt-1">
            {t('settings.paymentQrDesc')}
          </p>

          {/* Current / new QR preview */}
          {(qrPreview || shop?.qrCodeUrl) ? (
            <div className="flex items-start gap-4">
              <div className="relative">
                <img
                  src={qrPreview || shop?.qrCodeUrl}
                  alt="Payment QR"
                  className="w-28 h-28 object-contain rounded-xl border border-gray-200 bg-white"
                />
                {qrPreview && (
                  /* New file selected — show clear button */
                  <button
                    onClick={clearQrPick}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center shadow"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex-1 space-y-2">
                {qrPreview ? (
                  <>
                    <p className="text-xs text-gray-500">{qrFile?.name}</p>
                    <button
                      className="btn-primary w-full text-sm py-2 flex items-center justify-center gap-2"
                      onClick={handleQrUpload}
                      disabled={qrUploading}
                    >
                      {qrUploading
                        ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        : qrSaved
                        ? <CheckCircle className="w-4 h-4" />
                        : <Upload className="w-4 h-4" />}
                      {qrUploading ? t('settings.uploading') : qrSaved ? t('settings.savedShort') : t('settings.saveQr')}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-green-600 font-semibold">{t('settings.qrSet')}</p>
                    <button
                      className="w-full border border-dashed border-gray-300 rounded-xl py-2 text-xs text-gray-500 font-medium"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {t('settings.replaceQr')}
                    </button>
                    <button
                      className="w-full text-xs text-red-400 font-medium py-1"
                      onClick={handleQrRemove}
                    >
                      {t('settings.removeQr')}
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* No QR yet */
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-5 flex flex-col items-center gap-2 text-gray-400 active:bg-brand-light"
            >
              <Upload className="w-6 h-6" />
              <span className="text-sm font-medium">{t('settings.uploadQrBtn')}</span>
              <span className="text-xs">{t('settings.uploadQrHint')}</span>
            </button>
          )}

          {qrError && <p className="text-red-500 text-sm">{qrError}</p>}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg"
            className="hidden"
            onChange={handleQrPick}
          />
        </div>

        {/* ── Account ── */}
        <div className="card">
          <p className="text-sm text-gray-500 mb-1">{t('settings.signedInAs')}</p>
          <p className="font-semibold">{shop?.phone}</p>
          <button
            className="mt-4 w-full flex items-center justify-center gap-2 text-red-500 font-semibold py-3 border border-red-200 rounded-xl"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            {t('settings.logout')}
          </button>
        </div>

      </div>

      {/* ── Confirm modals ── */}
      {confirmDialog === 'removeQr' && (
        <ConfirmModal
          title="Remove payment QR?"
          body="Your bill PDFs will show only the UPI ID text. You can re-upload anytime."
          confirmLabel="Remove QR"
          cancelLabel="Keep QR"
          onConfirm={doQrRemove}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
      {confirmDialog === 'removePhoto' && (
        <ConfirmModal
          title="Remove shop photo?"
          body="Your bill PDFs won't show a shop photo. You can re-upload anytime."
          confirmLabel="Remove photo"
          cancelLabel="Keep photo"
          onConfirm={doPhotoRemove}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
      {confirmDialog === 'logout' && (
        <ConfirmModal
          title="Sign out?"
          body="You'll need to enter your phone number and OTP to sign back in."
          confirmLabel="Sign out"
          cancelLabel="Stay signed in"
          onConfirm={doLogout}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </Layout>
  );
}
