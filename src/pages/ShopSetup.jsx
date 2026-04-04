import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Store, QrCode, MapPin, Upload, X, Image } from 'lucide-react';
import { supabase, mapShop } from '../supabase';
import useStore from '../store/useStore';
import { UNIQUE_CITIES } from '../data/cities';

export default function ShopSetup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setShop } = useStore();
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);

  const [form, setForm] = useState({
    shopName:  '',
    ownerName: '',
    gstNumber: '',
    upiId:     '',
    address:   '',
    city:      '',
    pincode:   '',
    mapsUrl:   '',
  });
  const [qrFile, setQrFile]       = useState(null);   // File object selected by user
  const [qrPreview, setQrPreview] = useState('');     // Data URL for preview
  const [photoFile, setPhotoFile]       = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  // ── QR file picker ────────────────────────────────────────────────────────
  const handleQrPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only allow images
    if (!file.type.startsWith('image/')) {
      setError('QR code must be an image file (PNG/JPG)');
      return;
    }
    setQrFile(file);

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setQrPreview(ev.target.result);
    reader.readAsDataURL(file);
    setError('');
  };

  const clearQr = () => {
    setQrFile(null);
    setQrPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Shop photo file picker ────────────────────────────────────────────────
  const handlePhotoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Only allow images
    if (!file.type.startsWith('image/')) {
      setError('Shop photo must be an image file (PNG/JPG)');
      return;
    }
    setPhotoFile(file);

    // Show preview
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
    setError('');
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.shopName.trim()) { setError(t('common.required') + ': Shop Name'); return; }
    if (!form.upiId.trim())    { setError('UPI ID is required for payment QR on bills'); return; }
    setError('');
    setLoading(true);

    try {
      const phone = user?.phoneNumber || '';

      // 1. Insert shop into Supabase
      const { data: shopRow, error: insertErr } = await supabase
        .from('shops')
        .insert({
          phone,
          shop_name:  form.shopName.trim(),
          owner_name: form.ownerName.trim()  || null,
          gst_number: form.gstNumber.trim()  || null,
          upi_id:     form.upiId.trim()      || null,
          address:    form.address.trim()    || null,
          city:       form.city.trim()       || null,
          pincode:    form.pincode.trim()    || null,
          maps_url:   form.mapsUrl.trim()    || null,
          plan:       'free',
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      let finalQrUrl = null;
      let finalPhotoUrl = null;

      // 2. Upload QR image if provided
      if (qrFile && shopRow?.id) {
        const ext = qrFile.name.split('.').pop().toLowerCase() || 'png';
        const path = `${shopRow.id}/qr.${ext}`;

        const { data: uploadData, error: upErr } = await supabase.storage
          .from('shop-assets')
          .upload(path, qrFile, { upsert: true, contentType: qrFile.type });

        if (!upErr && uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('shop-assets')
            .getPublicUrl(uploadData.path);

          finalQrUrl = publicUrl;
        } else if (upErr) {
          // QR upload failed — shop is still created; just warn
          console.warn('[ShopSetup] QR upload failed:', upErr.message);
        }
      }

      // 3. Upload shop photo if provided
      if (photoFile && shopRow?.id) {
        const ext = photoFile.name.split('.').pop().toLowerCase() || 'png';
        const path = `${shopRow.id}/photo.${ext}`;

        const { data: uploadData, error: upErr } = await supabase.storage
          .from('shop-assets')
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type });

        if (!upErr && uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('shop-assets')
            .getPublicUrl(uploadData.path);

          finalPhotoUrl = publicUrl;
        } else if (upErr) {
          // Photo upload failed — shop is still created; just warn
          console.warn('[ShopSetup] Photo upload failed:', upErr.message);
        }
      }

      // 4. Update shop row with file URLs if any were uploaded
      if (finalQrUrl || finalPhotoUrl) {
        await supabase
          .from('shops')
          .update({
            qr_code_url: finalQrUrl,
            shop_photo_url: finalPhotoUrl,
          })
          .eq('id', shopRow.id);
      }

      // 5. Set in store and navigate
      const mappedShop = mapShop({ ...shopRow, qr_code_url: finalQrUrl, shop_photo_url: finalPhotoUrl });
      setShop(mappedShop);
      navigate('/', { replace: true });

    } catch (err) {
      console.error('[ShopSetup] save error:', err);
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-brand-dark to-brand-mid flex flex-col items-center justify-start p-6"
      style={{ paddingTop: 'calc(env(safe-area-inset-top) + 24px)' }}
    >
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg">
            <Store className="w-8 h-8 text-brand-mid" />
          </div>
          <h1 className="text-2xl font-bold text-white">{t('setup.title')}</h1>
          <p className="text-brand-light text-sm mt-1">{t('setup.subtitle')}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-6 space-y-4">

          {/* Shop Name */}
          <div>
            <label className="section-label">{t('setup.shopName')} *</label>
            <input className="input-field" placeholder={t('setup.shopNamePlaceholder')}
              value={form.shopName} onChange={set('shopName')} />
          </div>

          {/* Owner Name */}
          <div>
            <label className="section-label">{t('setup.ownerName')}</label>
            <input className="input-field" placeholder={t('setup.ownerNamePlaceholder')}
              value={form.ownerName} onChange={set('ownerName')} />
          </div>

          {/* UPI ID */}
          <div>
            <label className="section-label">{t('setup.upiId')} *</label>
            <input className="input-field" placeholder={t('setup.upiPlaceholder')}
              value={form.upiId} onChange={set('upiId')} />
            <p className="text-xs text-gray-400 mt-1">Required for auto-generated UPI QR on bills</p>
          </div>

          {/* GST Number */}
          <div>
            <label className="section-label">{t('setup.gstNumber')}</label>
            <input className="input-field" placeholder={t('setup.gstPlaceholder')}
              value={form.gstNumber} onChange={set('gstNumber')} />
          </div>

          {/* Address */}
          <div>
            <label className="section-label">{t('setup.address')}</label>
            <textarea className="input-field" rows={2} placeholder={t('setup.addressPlaceholder')}
              value={form.address} onChange={set('address')} />
          </div>

          {/* City */}
          <div>
            <label className="section-label flex items-center gap-1.5">
              City
              <span className="text-gray-400 font-normal text-xs">(for shop code & analytics)</span>
            </label>
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
          </div>

          {/* Pincode */}
          <div>
            <label className="section-label flex items-center gap-1.5">
              Pincode
              <span className="text-gray-400 font-normal text-xs">(for shop code & analytics)</span>
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

          {/* Google Maps Share URL */}
          <div>
            <label className="section-label flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-brand-mid" />
              Google Maps Link
              <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <input
              className="input-field"
              placeholder="Paste share link from Google Maps app"
              value={form.mapsUrl}
              onChange={set('mapsUrl')}
            />
            <p className="text-xs text-gray-400 mt-1">
              Open Google Maps → tap your shop → Share → Copy link → paste here
            </p>
          </div>

          {/* Shop Photo Upload */}
          <div>
            <label className="section-label flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5 text-brand-mid" />
              Shop Photo
              <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>

            {photoPreview ? (
              /* Preview + clear */
              <div className="relative w-32 h-32 mx-auto">
                <img
                  src={photoPreview}
                  alt="Shop preview"
                  className="w-32 h-32 object-cover rounded-xl border border-gray-200"
                />
                <button
                  onClick={clearPhoto}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <p className="text-center text-xs text-gray-500 mt-1">{photoFile?.name}</p>
              </div>
            ) : (
              /* Upload button */
              <button
                onClick={() => photoInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-5 flex flex-col items-center gap-2 text-gray-400 active:bg-gray-50"
              >
                <Upload className="w-6 h-6" />
                <span className="text-sm font-medium">Tap to upload shop photo</span>
                <span className="text-xs">PNG or JPG — appears on bill PDFs</span>
              </button>
            )}

            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handlePhotoPick}
            />
          </div>

          {/* QR Code Upload */}
          <div>
            <label className="section-label flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-brand-mid" />
              Payment QR Code
              <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>

            {qrPreview ? (
              /* Preview + clear */
              <div className="relative w-32 h-32 mx-auto">
                <img
                  src={qrPreview}
                  alt="QR preview"
                  className="w-32 h-32 object-contain rounded-xl border border-gray-200"
                />
                <button
                  onClick={clearQr}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <p className="text-center text-xs text-gray-500 mt-1">{qrFile?.name}</p>
              </div>
            ) : (
              /* Upload button */
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-2xl py-5 flex flex-col items-center gap-2 text-gray-400 active:bg-gray-50"
              >
                <Upload className="w-6 h-6" />
                <span className="text-sm font-medium">Tap to upload QR image</span>
                <span className="text-xs">PNG or JPG — appears on every bill PDF</span>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleQrPick}
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            className="btn-primary w-full mt-2"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? t('setup.saving') : t('setup.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
