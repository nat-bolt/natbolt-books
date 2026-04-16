import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight,
  Image,
  MapPin,
  QrCode,
  Store,
  Upload,
} from 'lucide-react';
import { supabase, mapShop } from '../supabase';
import useStore from '../store/useStore';
import { UNIQUE_CITIES } from '../data/cities';
import AuthShell from '../components/AuthShell';
import { ADDRESS_LINE_LIMIT, joinAddressLines, splitAddressForForm } from '../utils/shopAddress';

function isSafeUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

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

function AssetPicker({
  icon: Icon,
  label,
  hint,
  uploadLabel,
  replaceLabel,
  removeLabel,
  preview,
  fileName,
  onOpen,
  onClear,
  alt,
  fit = 'cover',
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white px-4 py-4 shadow-sm">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-brand-light text-brand-mid">
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className="section-label mb-0">{label}</p>
          <p className="text-xs text-gray-500">{hint}</p>
        </div>
      </div>

      {preview ? (
        <div className="mt-4 flex items-center gap-4">
          <img
            src={preview}
            alt={alt}
            className="h-24 w-24 rounded-2xl border border-gray-200 bg-white"
            style={{ objectFit: fit }}
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-brand-dark">{fileName}</p>
            <div className="mt-3 flex flex-col gap-2">
              <button type="button" className="btn-secondary !px-4 !py-2 text-sm" onClick={onOpen}>
                {replaceLabel}
              </button>
              <button type="button" className="text-left text-sm font-medium text-red-500" onClick={onClear}>
                {removeLabel}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-gray-300 px-4 py-4 text-sm font-medium text-gray-500 transition-colors active:bg-gray-50"
        >
          <Upload className="h-4 w-4" />
          {uploadLabel}
        </button>
      )}
    </div>
  );
}

export default function ShopSetup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user, setShop } = useStore();
  const qrInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const [initialAddressLine1, initialAddressLine2] = splitAddressForForm('');

  const [step, setStep] = useState(0);
  const [form, setForm] = useState({
    shopName: '',
    ownerName: '',
    gstNumber: '',
    upiId: '',
    addressLine1: initialAddressLine1,
    addressLine2: initialAddressLine2,
    city: '',
    pincode: '',
    mapsUrl: '',
  });
  const [qrFile, setQrFile] = useState(null);
  const [qrPreview, setQrPreview] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formattedPhone = (user?.phoneNumber || '').startsWith('+91')
    ? `+91 ${user.phoneNumber.slice(3, 8)} ${user.phoneNumber.slice(8)}`
    : user?.phoneNumber || '';

  const steps = [
    t('setup.stepBusiness'),
    t('setup.stepContact'),
    t('setup.stepPayments'),
    t('setup.stepAssets'),
  ];

  const setField = (key) => (e) => {
    setForm((prev) => ({ ...prev, [key]: e.target.value }));
  };

  const validateStep = (currentStep = step) => {
    if (currentStep === 0 && !form.shopName.trim()) {
      setError(t('setup.shopNameRequired'));
      return false;
    }

    if (currentStep === 2 && !form.upiId.trim()) {
      setError(t('setup.upiRequired'));
      return false;
    }

    if (currentStep === 3 && form.mapsUrl.trim() && !isSafeUrl(form.mapsUrl.trim())) {
      setError('Google Maps link must be a valid https:// URL');
      return false;
    }

    setError('');
    return true;
  };

  const readPreview = (file, onDone) => {
    const reader = new FileReader();
    reader.onload = (event) => onDone(event.target?.result || '');
    reader.readAsDataURL(file);
  };

  const handleQrPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError(t('setup.qrImageError'));
      return;
    }

    setQrFile(file);
    readPreview(file, setQrPreview);
    setError('');
  };

  const handlePhotoPick = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError(t('setup.photoImageError'));
      return;
    }

    setPhotoFile(file);
    readPreview(file, setPhotoPreview);
    setError('');
  };

  const clearQr = () => {
    setQrFile(null);
    setQrPreview('');
    if (qrInputRef.current) qrInputRef.current.value = '';
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview('');
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handleNext = () => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handleBack = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = async () => {
    if (!validateStep(0) || !validateStep(1) || !validateStep(2) || !validateStep(3)) return;

    setLoading(true);

    try {
      const phone = user?.phoneNumber || '';
      const address = joinAddressLines(form.addressLine1, form.addressLine2);

      const { data: shopRow, error: insertErr } = await supabase
        .from('shops')
        .insert({
          phone,
          shop_name: form.shopName.trim(),
          owner_name: form.ownerName.trim() || null,
          gst_number: form.gstNumber.trim() || null,
          upi_id: form.upiId.trim() || null,
          address: address || null,
          city: form.city.trim() || null,
          pincode: form.pincode.trim() || null,
          maps_url: form.mapsUrl.trim() || null,
          plan: 'free',
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      let finalQrUrl = null;
      let finalPhotoUrl = null;

      if (qrFile && shopRow?.id) {
        const ext = qrFile.name.split('.').pop().toLowerCase() || 'png';
        const path = `${shopRow.id}/qr.${ext}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('shop-assets')
          .upload(path, qrFile, { upsert: true, contentType: qrFile.type });

        if (!uploadErr && uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('shop-assets')
            .getPublicUrl(uploadData.path);

          finalQrUrl = publicUrl;
        } else if (uploadErr) {
          console.warn('[ShopSetup] QR upload failed:', uploadErr.message);
        }
      }

      if (photoFile && shopRow?.id) {
        const ext = photoFile.name.split('.').pop().toLowerCase() || 'png';
        const path = `${shopRow.id}/photo.${ext}`;

        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('shop-assets')
          .upload(path, photoFile, { upsert: true, contentType: photoFile.type });

        if (!uploadErr && uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('shop-assets')
            .getPublicUrl(uploadData.path);

          finalPhotoUrl = publicUrl;
        } else if (uploadErr) {
          console.warn('[ShopSetup] Photo upload failed:', uploadErr.message);
        }
      }

      if (finalQrUrl || finalPhotoUrl) {
        await supabase
          .from('shops')
          .update({
            qr_code_url: finalQrUrl,
            shop_photo_url: finalPhotoUrl,
          })
          .eq('id', shopRow.id);
      }

      try {
        const welcomeMessage = `🎉 Welcome to NatBolt Billu!

Hi ${form.ownerName || 'there'}! 👋

Your shop "${form.shopName}" has been successfully registered!

You can now:
✅ Create unlimited bills (30/month on free plan)
✅ Manage customers & vehicles
✅ Generate professional PDFs
✅ Track income & analytics

Need help? Reply to this message!

Happy billing! 🚀`;

        const whatsappUrl = `https://wa.me/${phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(welcomeMessage)}`;

        if (typeof window !== 'undefined') {
          window.open(whatsappUrl, '_blank');
        }
      } catch (whatsappErr) {
        console.warn('[ShopSetup] WhatsApp message failed:', whatsappErr);
      }

      const mappedShop = mapShop({
        ...shopRow,
        qr_code_url: finalQrUrl,
        shop_photo_url: finalPhotoUrl,
      });

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
    <AuthShell
      hero={(
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-xl">
            <Store className="h-10 w-10 text-brand-mid" />
          </div>
          <h1
            className="text-[2rem] font-bold tracking-wide text-white"
            style={{ fontFamily: 'Dagger Square, sans-serif' }}
          >
            {t('setup.title')}
          </h1>
          <p className="mt-2 text-sm text-brand-light/90">{t('setup.subtitle')}</p>
        </div>
      )}
    >
      <div className="rounded-2xl bg-brand-light/50 px-4 py-4">
        <p className="text-xs font-bold uppercase tracking-wide text-brand-mid">{t('settings.signedInAs')}</p>
        <p className="mt-1 text-lg font-bold text-brand-dark">{formattedPhone || t('common.na')}</p>
        <p className="mt-2 text-xs leading-5 text-gray-500">{t('setup.linkHint')}</p>
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {steps.map((label, index) => (
          <SetupStepChip
            key={label}
            label={label}
            active={index === step}
            complete={index < step}
          />
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {step === 0 ? (
          <>
            <div>
              <label className="section-label">{t('setup.shopName')} *</label>
              <input
                className="input-field"
                placeholder={t('setup.shopNamePlaceholder')}
                value={form.shopName}
                onChange={setField('shopName')}
              />
            </div>

            <div>
              <label className="section-label">{t('setup.ownerName')}</label>
              <input
                className="input-field"
                placeholder={t('setup.ownerNamePlaceholder')}
                value={form.ownerName}
                onChange={setField('ownerName')}
              />
            </div>

            <div>
              <label className="section-label">{t('setup.gstNumber')}</label>
              <input
                className="input-field"
                placeholder={t('setup.gstPlaceholder')}
                value={form.gstNumber}
                onChange={setField('gstNumber')}
              />
            </div>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <div>
              <label className="section-label">{t('setup.phone')}</label>
              <input
                className="input-field bg-gray-50 text-gray-500"
                value={formattedPhone}
                readOnly
              />
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
              <p className="mt-1 text-xs text-gray-500">
                {form.addressLine1.length}/{ADDRESS_LINE_LIMIT}
              </p>
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
              <p className="mt-1 text-xs text-gray-500">
                {form.addressLine2.length}/{ADDRESS_LINE_LIMIT}
              </p>
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
              <p className="mt-1 text-xs text-gray-500">{t('setup.cityHint')}</p>
            </div>

            <div>
              <label className="section-label">{t('setup.pincode')}</label>
              <input
                className="input-field"
                placeholder={t('setup.pincodePlaceholder')}
                maxLength={10}
                inputMode="numeric"
                value={form.pincode}
                onChange={setField('pincode')}
              />
              <p className="mt-1 text-xs text-gray-500">{t('setup.pincodeHint')}</p>
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div>
              <label className="section-label">{t('setup.upiId')} *</label>
              <input
                className="input-field"
                placeholder={t('setup.upiPlaceholder')}
                value={form.upiId}
                onChange={setField('upiId')}
              />
              <p className="mt-1 text-xs text-gray-500">{t('setup.upiRequired')}</p>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <div>
              <label className="section-label flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-brand-mid" />
                {t('setup.mapsLink')}
              </label>
              <input
                className="input-field"
                placeholder={t('setup.mapsPlaceholder')}
                value={form.mapsUrl}
                onChange={setField('mapsUrl')}
              />
              <p className="mt-1 text-xs text-gray-500">{t('setup.mapsHint')}</p>
            </div>

            <AssetPicker
              icon={Image}
              label={t('setup.shopPhoto')}
              hint={t('setup.shopPhotoHint')}
              uploadLabel={t('setup.shopPhotoUpload')}
              replaceLabel={t('setup.replacePhoto')}
              removeLabel={t('setup.removePhoto')}
              preview={photoPreview}
              fileName={photoFile?.name}
              onOpen={() => photoInputRef.current?.click()}
              onClear={clearPhoto}
              alt={t('setup.shopPhoto')}
            />

            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handlePhotoPick}
            />
          </>
        ) : null}

        {step === 2 ? (
          <>
            <AssetPicker
              icon={QrCode}
              label={t('setup.paymentQr')}
              hint={t('setup.paymentQrHint')}
              uploadLabel={t('setup.paymentQrUpload')}
              replaceLabel={t('setup.replaceQr')}
              removeLabel={t('setup.removeQr')}
              preview={qrPreview}
              fileName={qrFile?.name}
              onOpen={() => qrInputRef.current?.click()}
              onClear={clearQr}
              alt={t('setup.paymentQr')}
              fit="contain"
            />

            <input
              ref={qrInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              className="hidden"
              onChange={handleQrPick}
            />
          </>
        ) : null}
      </div>

      {error ? <p className="mt-4 text-sm text-red-500">{error}</p> : null}

      <div className="mt-6 flex gap-3">
        {step > 0 ? (
          <button type="button" className="btn-secondary flex-1" onClick={handleBack} disabled={loading}>
            {t('common.back')}
          </button>
        ) : null}

        <button
          type="button"
          className="btn-primary flex-1"
          onClick={step === steps.length - 1 ? handleSave : handleNext}
          disabled={loading}
        >
          {loading
            ? t('setup.saving')
            : step === steps.length - 1
              ? t('setup.save')
              : (
                <span className="inline-flex items-center gap-2">
                  {t('setup.next')}
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
        </button>
      </div>
    </AuthShell>
  );
}
