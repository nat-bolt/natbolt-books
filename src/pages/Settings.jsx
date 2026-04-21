import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Save, LogOut, Globe, Crown, QrCode, MapPin, Upload, X, CheckCircle, Image, Store, Phone } from 'lucide-react';
import { auth } from '../firebase';
import { supabase } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import ConfirmSheet from '../components/ConfirmSheet';
import i18n from '../i18n/index';
import { UNIQUE_CITIES } from '../data/cities';
import { ADDRESS_LINE_LIMIT, joinAddressLines, splitAddressForForm } from '../utils/shopAddress';

const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi',   native: 'हिंदी'   },
  { code: 'te', label: 'Telugu',  native: 'తెలుగు'  },
];

export default function Settings() {
  const { t }      = useTranslation();
  const navigate   = useNavigate();
  const { shop, setShop, setUser, language, setLanguage } = useStore();
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);

  const [initialAddressLine1, initialAddressLine2] = splitAddressForForm(shop?.address || '');
  const [form, setForm] = useState({
    shopName:  shop?.shopName  || '',
    ownerName: shop?.ownerName || '',
    gstNumber: shop?.gstNumber || '',
    upiId:     shop?.upiId     || '',
    addressLine1: initialAddressLine1,
    addressLine2: initialAddressLine2,
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
      return t('settings.errorConnection');
    if (msg.includes('duplicate') || msg.includes('unique'))
      return t('settings.errorDuplicate');
    if (msg.includes('JWT') || msg.includes('session') || msg.includes('auth'))
      return t('settings.errorSession');
    return t('common.error');
  };

  // ── Shop details save ─────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!shop) return;
    setSaving(true);
    setError('');
    try {
      const address = joinAddressLines(form.addressLine1, form.addressLine2);
      const { error: err } = await supabase
        .from('shops')
        .update({
          shop_name:  form.shopName.trim(),
          owner_name: form.ownerName.trim() || null,
          gst_number: form.gstNumber.trim() || null,
          upi_id:     form.upiId.trim()     || null,
          address:    address || null,
          city:       form.city.trim()      || null,
          pincode:    form.pincode.trim()   || null,
          maps_url:   form.mapsUrl.trim()   || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shop.id);

      if (err) throw err;
      setShop({
        ...shop,
        shopName: form.shopName,
        ownerName: form.ownerName,
        gstNumber: form.gstNumber,
        upiId: form.upiId,
        address,
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
      setQrError(t('setup.qrImageError'));
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
      setQrError(friendlyError(err));
    }
  };

  // ── Shop photo file picker ────────────────────────────────────────────────
  const handlePhotoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError(t('setup.photoImageError'));
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
      setPhotoError(friendlyError(err));
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

  const confirmConfig = confirmDialog === 'removeQr'
    ? {
        title: t('settings.removeQrTitle'),
        body: t('settings.removeQrBody'),
        confirmLabel: t('settings.removeQrConfirm'),
        cancelLabel: t('settings.keepQr'),
        onConfirm: doQrRemove,
      }
    : confirmDialog === 'removePhoto'
      ? {
          title: t('settings.removePhotoTitle'),
          body: t('settings.removePhotoBody'),
          confirmLabel: t('settings.removePhotoConfirm'),
          cancelLabel: t('settings.keepPhoto'),
          onConfirm: doPhotoRemove,
        }
      : confirmDialog === 'logout'
        ? {
            title: t('settings.logoutTitle'),
            body: t('settings.logoutBody'),
            confirmLabel: t('settings.logoutConfirmCta'),
            cancelLabel: t('settings.logoutStay'),
            onConfirm: doLogout,
          }
        : null;

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
                  {t('estimate.paidFeatureOffer')}
                </div>
              </div>
              <button
                className="w-full text-xs font-bold text-white bg-accent rounded-xl px-4 py-2.5 flex items-center justify-center gap-2"
                onClick={() => window.open(`https://wa.me/919738007523?text=${encodeURIComponent('Hi, I want to unlock unlimited billing on NatBolt Billu. Shop: ' + shop?.shopName)}`, '_blank')}
              >
                <span>{t('dashboard.upgradeFeatureCta')}</span>
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

        {/* ── Shop ── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-brand-mid" />
            <p className="section-label mb-0">{t('setup.stepBusiness')}</p>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.shopName')}</label>
            <input className="input-field" value={form.shopName} onChange={set('shopName')} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.ownerName')}</label>
            <input className="input-field" value={form.ownerName} onChange={set('ownerName')} />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.gstNumber')}</label>
            <input className="input-field" value={form.gstNumber} onChange={set('gstNumber')} />
          </div>
        </div>

        {/* ── Contact ── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <Phone className="w-4 h-4 text-brand-mid" />
            <p className="section-label mb-0">{t('setup.stepContact')}</p>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.signedInAs')}</label>
            <input className="input-field bg-gray-50 text-gray-500" value={shop?.phone || ''} readOnly />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.addressLine1')}</label>
            <input
              className="input-field"
              maxLength={ADDRESS_LINE_LIMIT}
              placeholder={t('settings.addressLinePlaceholder', { count: 1 })}
              value={form.addressLine1}
              onChange={set('addressLine1')}
            />
            <p className="text-xs text-gray-400 mt-1">
              {form.addressLine1.length}/{ADDRESS_LINE_LIMIT}
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.addressLine2')}</label>
            <input
              className="input-field"
              maxLength={ADDRESS_LINE_LIMIT}
              placeholder={t('settings.addressLinePlaceholder', { count: 2 })}
              value={form.addressLine2}
              onChange={set('addressLine2')}
            />
            <p className="text-xs text-gray-400 mt-1">
              {form.addressLine2.length}/{ADDRESS_LINE_LIMIT}
            </p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('setup.city')}</label>
            <select
              className="input-field"
              value={form.city}
              onChange={set('city')}
            >
              <option value="">{t('setup.cityPlaceholder')}</option>
              {UNIQUE_CITIES.map((city) => (
                <option key={city.name + city.code} value={city.name}>
                  {city.name} ({city.state})
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-400 mt-1">{t('setup.cityHint')}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('setup.pincode')}</label>
            <input
              className="input-field"
              placeholder={t('setup.pincodePlaceholder')}
              maxLength={10}
              inputMode="numeric"
              value={form.pincode}
              onChange={set('pincode')}
            />
            <p className="text-xs text-gray-400 mt-1">{t('setup.pincodeHint')}</p>
          </div>
        </div>

        {/* ── Payments ── */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-brand-mid" />
            <p className="section-label mb-0">{t('setup.stepPayments')}</p>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('settings.upiId')}</label>
            <input className="input-field" value={form.upiId} onChange={set('upiId')} />
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div>
              <p className="section-label mb-0">{t('settings.paymentQr')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('settings.paymentQrDesc')}</p>
            </div>

            {(qrPreview || shop?.qrCodeUrl) ? (
              <div className="flex items-start gap-4">
                <div className="relative">
                  <img
                    src={qrPreview || shop?.qrCodeUrl}
                    alt="Payment QR"
                    className="w-28 h-28 object-contain rounded-xl border border-gray-200 bg-white"
                  />
                  {qrPreview ? (
                    <button
                      onClick={clearQrPick}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center shadow"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
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
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-5 flex flex-col items-center gap-2 text-gray-400 active:bg-brand-light"
              >
                <Upload className="w-6 h-6" />
                <span className="text-sm font-medium">{t('settings.uploadQrBtn')}</span>
                <span className="text-xs">{t('settings.uploadQrHint')}</span>
              </button>
            )}

            {qrError ? <p className="text-red-500 text-sm">{qrError}</p> : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleQrPick}
            />
          </div>
        </div>

        {/* ── Assets ── */}
        <div className="card space-y-4">
          <div className="flex items-center gap-2">
            <Image className="w-4 h-4 text-brand-mid" />
            <p className="section-label mb-0">{t('setup.stepAssets')}</p>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-brand-mid" />
              {t('setup.mapsLink')}
            </label>
            <input
              className="input-field"
              placeholder={t('setup.mapsPlaceholder')}
              value={form.mapsUrl}
              onChange={set('mapsUrl')}
            />
            <p className="text-xs text-gray-400 mt-1">{t('setup.mapsHint')}</p>
          </div>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <div>
              <p className="section-label mb-0">{t('settings.shopPhoto')}</p>
              <p className="text-xs text-gray-500 mt-1">{t('settings.shopPhotoDesc')}</p>
            </div>

            {(photoPreview || shop?.shopPhotoUrl) ? (
              <div className="flex items-start gap-4">
                <div className="relative">
                  <img
                    src={photoPreview || shop?.shopPhotoUrl}
                    alt="Shop Photo"
                    className="w-28 h-28 object-cover rounded-xl border border-gray-200 bg-white"
                  />
                  {photoPreview ? (
                    <button
                      onClick={clearPhotoPick}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-gray-500 text-white rounded-full flex items-center justify-center shadow"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : null}
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
              <button
                onClick={() => photoInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-5 flex flex-col items-center gap-2 text-gray-400 active:bg-brand-light"
              >
                <Upload className="w-6 h-6" />
                <span className="text-sm font-medium">{t('settings.uploadPhotoBtn')}</span>
                <span className="text-xs">{t('settings.uploadPhotoHint')}</span>
              </button>
            )}

            {photoError ? <p className="text-red-500 text-sm">{photoError}</p> : null}

            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handlePhotoPick}
            />
          </div>

          {error ? <p className="text-red-500 text-sm">{error}</p> : null}

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

      <ConfirmSheet
        open={Boolean(confirmConfig)}
        title={confirmConfig?.title}
        body={confirmConfig?.body}
        confirmLabel={confirmConfig?.confirmLabel}
        cancelLabel={confirmConfig?.cancelLabel}
        onConfirm={confirmConfig?.onConfirm}
        onCancel={() => setConfirmDialog(null)}
      />
    </Layout>
  );
}
