import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import {
  Plus, Store, Crown, RefreshCw, LogOut, ChevronRight, X,
  BarChart2, MapPin, Package, TrendingUp, ChevronDown, ChevronUp,
  ExternalLink, QrCode, Upload, Image, Trash2, RotateCcw, Archive,
} from 'lucide-react';
import { auth } from '../firebase';
import { supabase, mapShop } from '../supabase';
import useStore from '../store/useStore';
import { FREE_BILL_LIMIT } from '../config';
import { UNIQUE_CITIES } from '../data/cities';

const FREE_LIMIT = FREE_BILL_LIMIT;

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
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);

  const [form, setForm] = useState({
    shopName:  existing?.shopName  || '',
    ownerName: existing?.ownerName || '',
    phone:     existing?.phone     || '',
    gstNumber: existing?.gstNumber || '',
    upiId:     existing?.upiId     || '',
    address:   existing?.address   || '',
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
    if (!form.shopName.trim()) { setError('Shop name is required'); return; }
    if (!form.phone.trim())    { setError('Phone number is required'); return; }
    if (form.mapsUrl.trim() && !isSafeUrl(form.mapsUrl.trim())) {
      setError('Google Maps link must be a valid https:// URL');
      return;
    }

    const rawPhone = form.phone.replace(/\D/g, '');
    const e164 = rawPhone.startsWith('91') ? `+${rawPhone}` : `+91${rawPhone}`;

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
            address:        form.address.trim()   || null,
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
        onSave({ ...existing, ...form, phone: e164, qrCodeUrl, shopPhotoUrl });

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
            address:    form.address.trim()   || null,
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

  // Current files to display (new previews take priority over stored URLs)
  const displayQr = qrPreview || existing?.qrCodeUrl || null;
  const displayPhoto = photoPreview || existing?.shopPhotoUrl || null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-brand-dark">
            {existing ? 'Edit Shop' : 'Register New Shop'}
          </h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-3">

          {/* Shop Name */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">Shop Name *</label>
            <input className="input-field" placeholder="e.g. Raju Two-Wheeler Service"
              value={form.shopName} onChange={setField('shopName')} />
          </div>

          {/* Owner Name */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">Owner Name</label>
            <input className="input-field" placeholder="Owner full name"
              value={form.ownerName} onChange={setField('ownerName')} />
          </div>

          {/* Phone */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
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

          {/* UPI ID */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">UPI ID</label>
            <input className="input-field" placeholder="shop@upi"
              value={form.upiId} onChange={setField('upiId')} />
          </div>

          {/* GST Number */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">GST Number</label>
            <input className="input-field" placeholder="36ABCDE1234F1Z5 (optional)"
              value={form.gstNumber} onChange={setField('gstNumber')} />
          </div>

          {/* Address */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">Address</label>
            <textarea className="input-field" rows={2} placeholder="Shop address"
              value={form.address} onChange={setField('address')} />
          </div>

          {/* City */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
              City <span className="text-gray-400 font-normal">(shop code & analytics)</span>
            </label>
            <select
              className="input-field"
              value={form.city}
              onChange={setField('city')}
            >
              <option value="">Select city</option>
              {UNIQUE_CITIES.map((city) => (
                <option key={city.name + city.code} value={city.name}>
                  {city.name} ({city.state})
                </option>
              ))}
            </select>
          </div>

          {/* Pincode */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
              Pincode <span className="text-gray-400 font-normal">(shop code & analytics)</span>
            </label>
            <input className="input-field" placeholder="e.g. 500032"
              maxLength={10} inputMode="numeric"
              value={form.pincode} onChange={setField('pincode')} />
          </div>

          {/* Google Maps URL */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
              Google Maps Link <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input className="input-field" placeholder="Paste Google Maps share link"
              value={form.mapsUrl} onChange={setField('mapsUrl')} />
          </div>

          {/* Shop Photo */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5" />
              Shop Photo <span className="text-gray-400 font-normal">(optional)</span>
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
                    onClick={() => photoInputRef.current?.click()}
                    className="w-full border border-dashed border-gray-300 rounded-xl py-1.5 text-xs text-gray-500"
                  >
                    {photoPreview ? 'Choose different image' : 'Replace photo'}
                  </button>
                  {photoPreview && (
                    <button onClick={clearPhotoPick} className="w-full text-xs text-gray-400 py-1">
                      Clear selection
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => photoInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 flex items-center justify-center gap-2 text-gray-400 text-sm"
              >
                <Upload className="w-4 h-4" />
                Upload shop photo (PNG/JPG)
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

          {/* Payment QR Code */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5" />
              Payment QR Code <span className="text-gray-400 font-normal">(optional)</span>
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
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full border border-dashed border-gray-300 rounded-xl py-1.5 text-xs text-gray-500"
                  >
                    {qrPreview ? 'Choose different image' : 'Replace QR image'}
                  </button>
                  {qrPreview && (
                    <button onClick={clearQrPick} className="w-full text-xs text-gray-400 py-1">
                      Clear selection
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 flex items-center justify-center gap-2 text-gray-400 text-sm"
              >
                <Upload className="w-4 h-4" />
                Upload QR image (PNG/JPG)
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

          {/* Plan toggle */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">Plan</label>
            <div className="flex gap-2">
              {['free', 'paid'].map((p) => (
                <button key={p}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-semibold ${form.plan === p ? 'bg-brand-mid text-white' : 'bg-gray-100 text-gray-600'}`}
                  onClick={() => setForm((f) => ({ ...f, plan: p }))}
                >
                  {p === 'free' ? '🆓 Free (30 bills/mo)' : '⭐ Paid (Unlimited)'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <button
          className="btn-primary w-full mt-5"
          onClick={handleSave}
          disabled={saving}
        >
          {saving
            ? (qrFile || photoFile ? 'Saving files...' : 'Saving...')
            : existing ? 'Save Changes' : 'Register Shop'}
        </button>
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

  const [shops, setShops]     = useState([]);
  const [deactivatedShops, setDeactivatedShops] = useState([]);
  const [showDeactivated, setShowDeactivated]   = useState(false);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(null); // null | 'create' | shop object

  useEffect(() => {
    if (authLoading) return;
    if (!isAdmin) return;
    loadShops();
  }, [authLoading, isAdmin]);

  const loadShops = async () => {
    setLoading(true);
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
    } catch (err) {
      console.error('loadShops error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleShopSaved = (saved) => {
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
    const { error } = await supabase
      .from('shops')
      .update({ plan: newPlan, updated_at: new Date().toISOString() })
      .eq('id', shop.id);

    if (!error) {
      setShops((prev) => prev.map((s) => s.id === shop.id ? { ...s, plan: newPlan } : s));
    }
  };

  const resetBillCount = async (shop) => {
    const { error } = await supabase
      .from('shops')
      .update({ bills_this_month: 0, updated_at: new Date().toISOString() })
      .eq('id', shop.id);

    if (!error) {
      setShops((prev) => prev.map((s) => s.id === shop.id ? { ...s, billsThisMonth: 0 } : s));
    }
  };

  const deactivateShop = async (shop) => {
    // Confirmation dialog
    const shopName = shop.shopName || 'this shop';
    const confirmMsg = `Deactivate ${shopName}?\n\nThis will:\n• Mark the shop as inactive\n• Prevent shop owner from logging in\n• Hide shop from active list\n• Preserve all data for audit/regulatory purposes\n\nData will be retained for compliance and can be reactivated if needed.`;

    if (!confirm(confirmMsg)) return;

    try {
      // Soft delete: mark as inactive with deletion timestamp
      const { error } = await supabase
        .from('shops')
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', shop.id);

      if (error) throw error;

      // Reload to refresh both active and deactivated lists
      loadShops();

      alert(`${shopName} has been deactivated.\n\nAll data is preserved for audit purposes and can be reactivated if needed.`);
    } catch (err) {
      console.error('[AdminPanel] deactivate shop error:', err);
      alert(`Failed to deactivate shop: ${err.message}`);
    }
  };

  const reactivateShop = async (shop) => {
    const shopName = shop.shopName || 'this shop';
    const confirmMsg = `Reactivate ${shopName}?\n\nThis will:\n• Restore shop to active status\n• Allow shop owner to log in again\n• Show shop in active list`;

    if (!confirm(confirmMsg)) return;

    try {
      // Clear deleted_at timestamp to reactivate
      const { error } = await supabase
        .from('shops')
        .update({
          deleted_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', shop.id);

      if (error) throw error;

      // Reload to refresh both active and deactivated lists
      loadShops();

      alert(`${shopName} has been reactivated successfully.`);
    } catch (err) {
      console.error('[AdminPanel] reactivate shop error:', err);
      alert(`Failed to reactivate shop: ${err.message}`);
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
    <div className="min-h-screen flex items-center justify-center bg-brand-light">
      <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Header
          paddingTop includes env(safe-area-inset-top) so the logout button and title clear
          the Dynamic Island / notch on iPhone PWA (black-translucent status bar). */}
      <header
        className="bg-brand-dark text-white px-4 flex items-center justify-between sticky top-0 z-10 shadow-md"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: '12px' }}
      >
        <div>
          <h1 className="text-lg font-bold">NatBolt Admin</h1>
          <p className="text-xs text-brand-light">{user?.phoneNumber}</p>
        </div>
        <button onClick={handleLogout} className="p-2 rounded-xl bg-white/10">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <div className="p-4 space-y-4"
        style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom), 8px) + 32px)' }}>

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
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-brand-dark truncate">{shop.shopName}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0 ${
                          shop.plan === 'paid'
                            ? 'bg-amber-100 text-amber-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {shop.plan === 'paid' ? '⭐ Paid' : '🆓 Free'}
                        </span>
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

                      {shop.plan === 'free' && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Bills this month: {shop.billsThisMonth || 0} / {FREE_LIMIT}
                        </p>
                      )}
                    </div>
                    <button
                      className="ml-2 p-1.5 text-gray-400 flex-shrink-0"
                      onClick={() => setModal(shop)}
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <button
                      className={`flex-1 py-2 rounded-xl text-xs font-bold ${
                        shop.plan === 'paid'
                          ? 'bg-gray-100 text-gray-600'
                          : 'bg-amber-50 text-amber-600 border border-amber-200'
                      }`}
                      onClick={() => togglePlan(shop)}
                    >
                      {shop.plan === 'paid' ? 'Downgrade to Free' : '⭐ Upgrade to Paid'}
                    </button>
                    {shop.plan === 'free' && (
                      <button
                        className="flex-1 py-2 rounded-xl text-xs font-bold bg-blue-50 text-blue-600 border border-blue-200"
                        onClick={() => resetBillCount(shop)}
                      >
                        Reset Bill Count
                      </button>
                    )}
                    <button
                      className="p-2 rounded-xl text-red-500 bg-red-50 border border-red-200 flex-shrink-0"
                      onClick={() => deactivateShop(shop)}
                      title="Deactivate shop"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
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
                          <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold bg-red-100 text-red-600 flex-shrink-0">
                            Deactivated
                          </span>
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
                      onClick={() => reactivateShop(shop)}
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Reactivate Shop
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
    </div>
  );
}
