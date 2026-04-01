import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { Save, LogOut, Globe, Crown, QrCode, MapPin, Upload, X, CheckCircle } from 'lucide-react';
import { auth } from '../firebase';
import { supabase } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import i18n from '../i18n/index';

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

  const [form, setForm] = useState({
    shopName:  shop?.shopName  || '',
    ownerName: shop?.ownerName || '',
    gstNumber: shop?.gstNumber || '',
    upiId:     shop?.upiId     || '',
    address:   shop?.address   || '',
    pincode:   shop?.pincode   || '',
    mapsUrl:   shop?.mapsUrl   || '',
  });

  // QR upload state
  const [qrFile, setQrFile]         = useState(null);
  const [qrPreview, setQrPreview]   = useState('');      // data URL for new file preview
  const [qrUploading, setQrUploading] = useState(false);
  const [qrSaved, setQrSaved]       = useState(false);
  const [qrError, setQrError]       = useState('');

  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

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
          pincode:    form.pincode.trim()   || null,
          maps_url:   form.mapsUrl.trim()   || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shop.id);

      if (err) throw err;
      setShop({
        ...shop,
        ...form,
        pincode: form.pincode.trim() || null,
        mapsUrl: form.mapsUrl.trim() || null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Settings save error:', err);
      setError(err.message || 'Failed to save');
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
      setQrError(err.message || 'Upload failed');
    } finally {
      setQrUploading(false);
    }
  };

  // ── Remove QR ─────────────────────────────────────────────────────────────
  const handleQrRemove = async () => {
    if (!shop?.qrCodeUrl) return;
    if (!confirm('Remove your payment QR code? Bills will show UPI ID text only.')) return;
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

  const handleLangChange = (code) => {
    setLanguage(code);
    i18n.changeLanguage(code);
  };

  const handleLogout = async () => {
    if (!confirm(t('settings.logoutConfirm'))) return;
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
        <div className={`rounded-2xl p-4 flex items-center gap-3 ${shop?.plan === 'paid' ? 'bg-amber-50 border border-amber-200' : 'bg-brand-light border border-brand-mid/20'}`}>
          <Crown className={`w-6 h-6 flex-shrink-0 ${shop?.plan === 'paid' ? 'text-amber-500' : 'text-brand-mid'}`} />
          <div className="flex-1">
            <p className="font-bold text-sm text-brand-dark">
              {shop?.plan === 'paid' ? t('settings.paidPlan') : t('settings.freePlan')}
            </p>
            {shop?.plan !== 'paid' && (
              <p className="text-xs text-gray-500 mt-0.5">
                {shop?.billsThisMonth || 0} / 30 bills used this month
              </p>
            )}
          </div>
          {shop?.plan !== 'paid' && (
            <button
              className="text-xs font-bold text-accent border border-accent rounded-lg px-2 py-1"
              onClick={() => window.open(`https://wa.me/91${shop?.phone || ''}?text=${encodeURIComponent('Hi, I want to upgrade NatBolt Billu to Paid Plan for ₹299/month. Shop: ' + shop?.shopName)}`, '_blank')}
            >
              Upgrade
            </button>
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

          {/* Pincode */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">
              Pincode <span className="text-gray-400">(for regional analytics)</span>
            </label>
            <input
              className="input-field"
              placeholder="e.g. 500032"
              maxLength={10}
              inputMode="numeric"
              value={form.pincode}
              onChange={set('pincode')}
            />
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

        {/* ── Payment QR Code ── */}
        <div className="card space-y-3">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-brand-mid" />
            <p className="section-label mb-0">Payment QR Code</p>
          </div>
          <p className="text-xs text-gray-500 -mt-1">
            Your own verified QR image appears on every bill PDF. Customers scan it to pay.
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
                      {qrUploading ? 'Uploading...' : qrSaved ? 'Saved!' : 'Save QR Code'}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-green-600 font-semibold">✓ QR code set</p>
                    <button
                      className="w-full border border-dashed border-gray-300 rounded-xl py-2 text-xs text-gray-500 font-medium"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Replace QR image
                    </button>
                    <button
                      className="w-full text-xs text-red-400 font-medium py-1"
                      onClick={handleQrRemove}
                    >
                      Remove QR code
                    </button>
                  </>
                )}
              </div>
            </div>
          ) : (
            /* No QR yet */
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-5 flex flex-col items-center gap-2 text-gray-400 active:bg-gray-50"
            >
              <Upload className="w-6 h-6" />
              <span className="text-sm font-medium">Tap to upload QR image</span>
              <span className="text-xs">PNG or JPG — appears on every bill PDF</span>
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
          <p className="text-sm text-gray-500 mb-1">Signed in as</p>
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
    </Layout>
  );
}
