import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Trash2, X, CheckCircle, Lock, Crown, Camera, ArrowRight } from 'lucide-react';
import { supabase, mapCustomer, mapVehicle } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import StickyActionBar from '../components/StickyActionBar';
import InlineNotice from '../components/InlineNotice';
import { VEHICLE_TYPES, getBrandsForType, getModelsForBrand } from '../data/vehicles';
import { importCustomerIntoShop, searchSharedDirectory } from '../utils/customerDirectory';
import { optimizeJobPhoto } from '../utils/jobPhoto';

// ── Upgrade wall (shown when free user tries to create an estimate) ──────────
function UpgradeWall({ onUpgrade }) {
  const { t } = useTranslation();
  return (
    <Layout title={t('estimate.newTitle')} showNav={false}>
      <div className="flex flex-col items-center justify-center p-6 text-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-brand-dark mb-2">{t('estimate.paidFeatureTitle')}</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-xs">
          {t('estimate.paidFeatureBody')}
        </p>
        <div className="space-y-3 w-full max-w-sm">
          <div className="inline-block bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            {t('estimate.paidFeatureOffer')}
          </div>
          <button className="btn-primary flex items-center gap-2 px-6 py-3 w-full justify-center" onClick={onUpgrade}>
            <Crown className="w-5 h-5" />
            <span>{t('estimate.paidFeatureCta')}</span>
          </button>
        </div>
      </div>
    </Layout>
  );
}

// ── Language-aware part name ───────────────────────────────────────────────────
function getPartName(part, language) {
  if (language === 'hi' && part.name_hi) return part.name_hi;
  if (language === 'te' && part.name_te) return part.name_te;
  return part.name;
}

// ── Vehicle type emoji ─────────────────────────────────────────────────────────
const TYPE_EMOJI = {
  bike: '🏍️', scooter: '🛵', moped: '🛵', electric: '⚡',
  other: '🚘',
};
const NEW_VEHICLE_ID = '__new__';
const DRAFT_STORAGE_VERSION = 1;
const EMPTY_VEHICLE = {
  number: '',
  type: 'scooter',
  brand: '',
  model: '',
};

function dismissKeyboardOnEnter(e) {
  if (e.key === 'Enter') {
    e.preventDefault();
    e.currentTarget.blur();
  }
}

function createEmptyVehicle() {
  return { ...EMPTY_VEHICLE };
}

function getDraftStorageKey(shopId, docMode) {
  return `nb_new_document_draft:${shopId}:${docMode}`;
}

function inferMimeTypeFromDataUrl(dataUrl) {
  const match = dataUrl?.match(/^data:([^;]+);/);
  return match?.[1] || 'image/jpeg';
}

async function dataUrlToFile(dataUrl, name = 'job-photo.jpg', type) {
  if (!dataUrl) return null;
  const response = await fetch(dataUrl);
  const blob = await response.blob();
  return new File([blob], name, { type: type || blob.type || inferMimeTypeFromDataUrl(dataUrl) });
}

function hasDraftProgress({
  customer,
  customerVehicles,
  selectedVehicleId,
  vehicle,
  odoReading,
  jobPhotoPreview,
  parts,
  labour,
  isGST,
  step,
}) {
  return Boolean(
    customer ||
    customerVehicles.length > 0 ||
    selectedVehicleId ||
    vehicle.number ||
    vehicle.brand ||
    vehicle.model ||
    odoReading ||
    jobPhotoPreview ||
    parts.length > 0 ||
    labour ||
    isGST ||
    step > 0
  );
}

// ── Customer search / create modal ────────────────────────────────────────────
// onSelect(customer, vehicle|null) — vehicle is non-null only when a new
// customer is created AND a vehicle number was provided in the form.
function CustomerModal({ onSelect, onClose }) {
  const { t } = useTranslation();
  const { shop } = useStore();

  // Search tab
  const [q, setQ]             = useState('');
  const [results, setResults] = useState([]);
  const [mode, setMode]       = useState('search'); // 'search' | 'create'
  const [loading, setLoading] = useState(false);
  const [importingId, setImportingId] = useState('');
  const [createError, setCreateError] = useState('');

  // Create tab — customer fields
  const [newPhone, setNewPhone] = useState('');
  const [newName,  setNewName]  = useState('');

  // Create tab — vehicle fields (all optional)
  const [vNo,    setVNo]    = useState('');
  const [vType,  setVType]  = useState('scooter');
  const [vBrand, setVBrand] = useState('');
  const [vModel, setVModel] = useState('');

  const handleTypeChange  = (e) => { setVType(e.target.value); setVBrand(''); setVModel(''); };
  const handleBrandChange = (e) => { setVBrand(e.target.value); setVModel(''); };
  const brands = getBrandsForType(vType);
  const models = getModelsForBrand(vBrand);

  const search = async (val) => {
    setQ(val);
    if (val.length < 3) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await searchSharedDirectory({ shopId: shop.id, query: val });
      setResults(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const selectSearchResult = async (entry) => {
    const resultId = `${entry.customer.id}:${entry.vehicle?.id || 'none'}`;
    setImportingId(resultId);
    try {
      if (entry.isLocal) {
        onSelect(entry.customer, entry.vehicle || null);
        return;
      }
      const imported = await importCustomerIntoShop({ shopId: shop.id, entry });
      onSelect(imported.customer, imported.vehicle || null);
    } catch (err) {
      console.error('selectSearchResult error:', err);
      setCreateError(err.message || t('customer.importFailed'));
    } finally {
      setImportingId('');
    }
  };

  const createCustomer = async () => {
    if (!newPhone || !newName) return;
    if (newPhone.length !== 10) { setCreateError(t('customer.invalidPhone')); return; }
    setCreateError('');
    setLoading(true);
    try {
      const vehicleNoClean = vNo.trim().toUpperCase();
      const sharedMatches = await searchSharedDirectory({
        shopId: shop.id,
        query: vehicleNoClean || newPhone,
      });
      const exactMatch = sharedMatches.find((entry) =>
        entry.customer.phone === newPhone ||
        (vehicleNoClean && entry.vehicle?.vehicleNo === vehicleNoClean)
      );
      if (exactMatch) {
        if (exactMatch.isLocal) {
          onSelect(exactMatch.customer, exactMatch.vehicle || null);
          return;
        }
        const imported = await importCustomerIntoShop({ shopId: shop.id, entry: exactMatch });
        onSelect(imported.customer, imported.vehicle || null);
        return;
      }

      // 1. Insert customer
      const { data: cust, error: custErr } = await supabase
        .from('customers')
        .insert({ shop_id: shop.id, name: newName.trim(), phone: newPhone })
        .select()
        .single();
      if (custErr) throw custErr;

      // 2. Insert vehicle if reg. number provided
      let vehicle = null;
      if (vehicleNoClean) {
        const resolvedBrand = vBrand === '__other__' ? '' : vBrand;
        const resolvedModel = vModel === '__other__' ? '' : vModel;
        const { data: veh, error: vehErr } = await supabase
          .from('vehicles')
          .insert({
            shop_id:       shop.id,
            customer_id:   cust.id,
            vehicle_no:    vehicleNoClean,
            vehicle_type:  vType   || null,
            vehicle_brand: resolvedBrand.trim() || null,
            vehicle_model: resolvedModel.trim() || null,
          })
          .select()
          .single();
        if (vehErr) throw vehErr;
        vehicle = mapVehicle(veh);
      }

      // Pass both customer + optional vehicle back to parent
      onSelect(mapCustomer(cust), vehicle);
    } catch (err) {
      console.error('createCustomer error:', err);
      if (err.code === '23505') {
        setCreateError(t('customer.duplicatePhone'));
      } else {
        setCreateError(err.message || t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  };

  // createPortal escapes the Layout <main> overflow stacking context (iOS WebKit).
  // Centred layout avoids all bottom-nav overlap issues entirely.
  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-5 max-h-[80vh] overflow-y-auto"
        style={{ width: 'calc(100vw - 32px)', maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-brand-dark text-lg">{t('customer.search')}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="flex gap-2 mb-4">
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-semibold ${mode === 'search' ? 'bg-brand-mid text-white' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => setMode('search')}
          >
            {t('customer.search')}
          </button>
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-semibold ${mode === 'create' ? 'bg-brand-mid text-white' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => setMode('create')}
          >
            + {t('customer.new')}
          </button>
        </div>

        {/* ── Search tab ─────────────────────────────────────────────────── */}
        {mode === 'search' ? (
          <>
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="input-field pl-9"
                placeholder={t('customer.searchPlaceholder')}
                value={q}
                onChange={(e) => search(e.target.value)}
                autoFocus
              />
            </div>
            {results.map((entry) => {
              const resultId = `${entry.customer.id}:${entry.vehicle?.id || 'none'}`;
              return (
              <button key={resultId} className="w-full card mb-2 text-left flex items-center gap-3"
                onClick={() => selectSearchResult(entry)}
                disabled={importingId === resultId}>
                <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center font-bold text-brand-mid">
                  {entry.customer.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{entry.customer.name}</p>
                    {!entry.isLocal && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                        Shared
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{entry.customer.phone}</p>
                  {entry.vehicle?.vehicleNo && (
                    <p className="text-xs text-brand-mid mt-0.5 truncate">
                      {entry.vehicle.vehicleNo}
                      {[entry.vehicle.vehicleBrand, entry.vehicle.vehicleModel].filter(Boolean).length > 0
                        ? ` • ${[entry.vehicle.vehicleBrand, entry.vehicle.vehicleModel].filter(Boolean).join(' ')}`
                        : ''}
                    </p>
                  )}
                </div>
                {importingId === resultId && (
                  <div className="w-4 h-4 border-2 border-brand-mid border-t-transparent rounded-full animate-spin" />
                )}
              </button>
            );})}
            {createError && <p className="text-red-500 text-sm mt-2">{createError}</p>}
            {q.length >= 3 && results.length === 0 && !loading && (
              <p className="text-center text-gray-400 text-sm py-4">{t('customer.searchEmpty')}</p>
            )}
          </>
        ) : (
          /* ── Create tab ──────────────────────────────────────────────── */
          <div className="space-y-3">
            {/* Customer details */}
            <div>
              <label className="section-label">{t('customer.phone')} *</label>
              <input className="input-field" type="tel" inputMode="numeric"
                placeholder={t('customer.phonePlaceholder')} maxLength={10}
                value={newPhone} onChange={(e) => setNewPhone(e.target.value.replace(/\D/g, ''))} />
            </div>
            <div>
              <label className="section-label">{t('customer.name')} *</label>
              <input className="input-field" placeholder={t('customer.namePlaceholder')}
                value={newName} onChange={(e) => setNewName(e.target.value)} />
            </div>

            {/* Vehicle details */}
            <div className="border-t border-gray-100 pt-3 mt-1">
              <p className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1">
                {t('estimate.vehicleDetails')}
              </p>
              <p className="text-xs text-gray-400 mb-3">
                {t('estimate.vehicleDetailsHint')}
              </p>

              {/* Reg. number */}
              <div className="mb-3">
                <label className="section-label">{t('vehicle.number')}</label>
                <input className="input-field uppercase" placeholder={t('vehicle.numberPlaceholder')}
                  value={vNo} onChange={(e) => setVNo(e.target.value)} />
              </div>

              {/* Type */}
              <div className="mb-3">
                <label className="section-label">{t('vehicle.type')}</label>
                <select className="input-field" value={vType} onChange={handleTypeChange}>
                  {VEHICLE_TYPES.map((vt) => (
                    <option key={vt.value} value={vt.value}>{vt.label}</option>
                  ))}
                </select>
              </div>

              {/* Brand */}
              <div className="mb-3">
                <label className="section-label">{t('vehicle.brand')}</label>
                {brands.length > 0 ? (
                  <>
                    <select className="input-field" value={vBrand} onChange={handleBrandChange}>
                      <option value="">{t('vehicle.selectBrand')}</option>
                      {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                      <option value="__other__">{t('vehicle.otherTypeBelow')}</option>
                    </select>
                    {vBrand === '__other__' && (
                      <input className="input-field mt-2" placeholder={t('vehicle.enterBrand')}
                        onChange={(e) => setVBrand(e.target.value)} />
                    )}
                  </>
                ) : (
                  <input className="input-field" placeholder={t('vehicle.brandPlaceholder')}
                    value={vBrand} onChange={(e) => setVBrand(e.target.value)} />
                )}
              </div>

              {/* Model */}
              <div>
                <label className="section-label">{t('vehicle.model')}</label>
                {models.length > 0 && vBrand !== '__other__' ? (
                  <>
                    <select className="input-field" value={vModel}
                      onChange={(e) => setVModel(e.target.value)}>
                      <option value="">{t('vehicle.selectModel')}</option>
                      {models.map((m) => <option key={m} value={m}>{m}</option>)}
                      <option value="__other__">{t('vehicle.otherTypeBelow')}</option>
                    </select>
                    {vModel === '__other__' && (
                      <input className="input-field mt-2" placeholder={t('vehicle.enterModel')}
                        onChange={(e) => setVModel(e.target.value)} />
                    )}
                  </>
                ) : (
                  <input className="input-field" placeholder={t('vehicle.modelPlaceholder')}
                    value={vModel === '__other__' ? '' : vModel}
                    onChange={(e) => setVModel(e.target.value)} />
                )}
              </div>
            </div>

            {createError && <p className="text-red-500 text-sm">{createError}</p>}

            <button className="btn-primary w-full" onClick={createCustomer} disabled={loading}>
              {loading ? t('common.loading') : t('customer.saveCustomer')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Parts catalogue modal ─────────────────────────────────────────────────────
// Receives shop catalogue (loaded from DB) so prices reflect shop overrides
function PartsModal({ catalogue, onAdd, onClose }) {
  const { t } = useTranslation();
  const { language } = useStore();
  const [search, setSearch] = useState('');
  const [cat, setCat]       = useState('all');
  const [custom, setCustom] = useState({ name: '', qty: '1', price: '' });
  const [mode, setMode]     = useState('catalogue'); // 'catalogue' | 'custom'

  const CATEGORY_LIST = ['all', 'oil', 'engine', 'brakes', 'tyres', 'body', 'electricals', 'custom'];

  const filtered = catalogue.filter((p) => {
    const name = getPartName(p, language).toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const displayCat  = p.category || 'custom';
    const matchCat    = cat === 'all' || displayCat === cat;
    return matchSearch && matchCat;
  });

  const addCustom = () => {
    if (!custom.name || !custom.price) return;
    onAdd({
      id: `custom_${Date.now()}`,
      name: custom.name, name_hi: custom.name, name_te: custom.name,
      qty: parseInt(custom.qty) || 1,
      unitPrice: parseFloat(custom.price) || 0,
      total: (parseInt(custom.qty) || 1) * (parseFloat(custom.price) || 0),
    });
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl p-5 max-h-[80vh] flex flex-col"
        style={{ width: 'calc(100vw - 32px)', maxWidth: '480px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-brand-dark text-lg">{t('parts.addFromCatalogue')}</h3>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-semibold ${mode === 'catalogue' ? 'bg-brand-mid text-white' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => setMode('catalogue')}
          >
            {t('parts.addFromCatalogue')}
          </button>
          <button
            className={`flex-1 py-2 rounded-xl text-sm font-semibold ${mode === 'custom' ? 'bg-brand-mid text-white' : 'bg-gray-100 text-gray-600'}`}
            onClick={() => setMode('custom')}
          >
            {t('parts.addCustom')}
          </button>
        </div>

        {mode === 'catalogue' ? (
          <>
            <div className="relative mb-2">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input-field pl-9 py-2" placeholder={t('parts.search')}
                value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="mb-3">
              <div className="overflow-x-auto overflow-y-hidden scrollbar-hide -mx-1 px-1 pb-3">
                <div className="inline-flex min-w-max gap-2">
                  {CATEGORY_LIST.map((c) => (
                    <button key={c}
                      className={`flex-shrink-0 px-4 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${
                        cat === c ? 'bg-brand-mid text-white' : 'bg-gray-100 text-gray-600'
                      }`}
                      onClick={() => setCat(c)}
                    >
                      {t(`parts.categories.${c}`, { defaultValue: c })}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-b border-gray-200" />
            </div>
            <div className="flex-1 overflow-y-auto pt-1 space-y-1">
              {filtered.map((p) => (
                <button key={p.shop_part_id || p.default_part_id}
                  className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-brand-light active:bg-brand-light text-left"
                  onClick={() => onAdd({
                    id:        p.default_part_id || p.shop_part_id,
                    name:      p.name,
                    name_hi:   p.name_hi,
                    name_te:   p.name_te,
                    qty:       1,
                    unitPrice: Number(p.price),
                    total:     Number(p.price),
                  })}
                >
                  <span className="text-sm font-medium text-gray-800">
                    {getPartName(p, language)}
                  </span>
                  <span className="text-sm font-bold text-brand-mid ml-2 flex-shrink-0">
                    ₹{Number(p.price).toFixed(0)}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="space-y-3 flex-1">
            <div>
              <label className="section-label">{t('parts.name')} *</label>
              <input className="input-field" placeholder={t('parts.namePlaceholder')}
                value={custom.name} onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="section-label">{t('parts.qty')}</label>
                <input className="input-field" type="number" inputMode="numeric" min="1"
                  value={custom.qty} onChange={(e) => setCustom((c) => ({ ...c, qty: e.target.value }))}
                  onKeyDown={dismissKeyboardOnEnter} />
              </div>
              <div className="flex-1">
                <label className="section-label">{t('parts.price')} *</label>
                <input className="input-field" type="number" inputMode="decimal" placeholder={t('estimate.labourPlaceholder')}
                  value={custom.price} onChange={(e) => setCustom((c) => ({ ...c, price: e.target.value }))}
                  onKeyDown={dismissKeyboardOnEnter} />
              </div>
            </div>
            <button className="btn-accent w-full" onClick={addCustom}>{t('common.add')}</button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

function EstimateStepChip({ index, label, active, complete, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex min-w-0 flex-1 items-center gap-2 rounded-2xl border px-3 py-3 text-left transition-colors ${
        active
          ? 'border-brand-mid bg-brand-light text-brand-dark'
          : complete
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-gray-200 bg-white text-gray-500'
      }`}
    >
      <span
        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          active
            ? 'bg-brand-mid text-white'
            : complete
              ? 'bg-emerald-500 text-white'
              : 'bg-gray-100 text-gray-500'
        }`}
      >
        {index + 1}
      </span>
      <span className="truncate text-xs font-semibold">{label}</span>
    </button>
  );
}

// ── Main New Estimate page ────────────────────────────────────────────────────
export default function NewEstimate() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { shop, language } = useStore();

  // Document mode — initialised from ?mode=bill URL param (set by Dashboard "New Bill" button)
  // Toggle inside the form still lets the user switch after opening.
  const [docMode, setDocMode] = useState(
    searchParams.get('mode') === 'bill' ? 'bill' : 'estimate'
  );
  const draftHydratingRef = useRef(false);
  const skipNextDraftSaveNoticeRef = useRef(false);

  // Customer
  const [customer, setCustomer] = useState(null);

  // Customer's existing vehicles (loaded after customer selected)
  const [customerVehicles, setCustomerVehicles]     = useState([]);
  const [vehiclesLoading, setVehiclesLoading]       = useState(false);
  const [selectedVehicleId, setSelectedVehicleId]   = useState(null); // null = new vehicle
  const IS_NEW = selectedVehicleId === NEW_VEHICLE_ID;

  // New vehicle form (used when customer has no vehicles OR "New Vehicle" selected)
  const [vehicle, setVehicle] = useState(createEmptyVehicle);

  // Job photo
  const photoInputRef = useRef(null);
  const [jobPhoto, setJobPhoto] = useState(null);           // File object
  const [jobPhotoPreview, setJobPhotoPreview] = useState(''); // base64 preview
  const [photoPreparing, setPhotoPreparing] = useState(false);
  const [odoReading, setOdoReading] = useState('');

  // Parts & totals
  const [parts, setParts]     = useState([]);
  const [labour, setLabour]   = useState('');
  const [isGST, setIsGST]     = useState(false);

  // Parts catalogue (from DB, shop-aware prices)
  const [catalogue, setCatalogue] = useState([]);

  // UI state
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showPartsModal, setShowPartsModal]       = useState(false);
  const [step, setStep] = useState(0);
  const [draftNotice, setDraftNotice] = useState('');
  const [draftReady, setDraftReady] = useState(false);

  // Computed totals
  const partsSubtotal = parts.reduce((s, p) => s + (p.total || 0), 0);
  const cgst          = isGST ? partsSubtotal * 0.09 : 0;
  const sgst          = isGST ? partsSubtotal * 0.09 : 0;
  const grandTotal    = partsSubtotal + (parseFloat(labour) || 0) + cgst + sgst;
  const steps = [
    t('estimate.stepDetails'),
    t('estimate.stepItems'),
    t('estimate.stepTotals'),
  ];
  const draftKey = shop?.id ? getDraftStorageKey(shop.id, docMode) : '';
  const hasCurrentDraftProgress = hasDraftProgress({
    customer,
    customerVehicles,
    selectedVehicleId,
    vehicle,
    odoReading,
    jobPhotoPreview,
    parts,
    labour,
    isGST,
    step,
  });

  function resetComposerState() {
    setCustomer(null);
    setCustomerVehicles([]);
    setVehiclesLoading(false);
    setSelectedVehicleId(null);
    setVehicle(createEmptyVehicle());
    setJobPhoto(null);
    setJobPhotoPreview('');
    setPhotoPreparing(false);
    setOdoReading('');
    setParts([]);
    setLabour('');
    setIsGST(false);
    setLoading(false);
    setError('');
    setShowCustomerModal(false);
    setShowPartsModal(false);
    setStep(0);
    if (photoInputRef.current) photoInputRef.current.value = '';
  }

  function clearCurrentDraft(resetForm = true) {
    if (draftKey) localStorage.removeItem(draftKey);
    skipNextDraftSaveNoticeRef.current = false;
    setDraftNotice('');
    if (resetForm) resetComposerState();
  }

  // Load parts catalogue on mount
  useEffect(() => {
    if (!shop) return;
    supabase
      .rpc('get_parts_catalogue', { p_shop_id: shop.id })
      .then(({ data, error }) => {
        if (!error && data) setCatalogue(data);
      })
      .catch(console.error);
  }, [shop]);

  useEffect(() => {
    if (!draftKey) return;

    let cancelled = false;

    const restoreDraft = async () => {
      draftHydratingRef.current = true;
      skipNextDraftSaveNoticeRef.current = false;
      setDraftReady(false);
      setDraftNotice('');
      resetComposerState();

      const rawDraft = localStorage.getItem(draftKey);
      if (!rawDraft) {
        if (!cancelled) {
          draftHydratingRef.current = false;
          setDraftReady(true);
        }
        return;
      }

      try {
        const parsedDraft = JSON.parse(rawDraft);
        if (parsedDraft?.version !== DRAFT_STORAGE_VERSION) {
          throw new Error('Draft version mismatch');
        }

        const nextCustomer = parsedDraft.customer || null;
        const nextCustomerVehicles = Array.isArray(parsedDraft.customerVehicles)
          ? parsedDraft.customerVehicles
          : [];
        const nextSelectedVehicleId = parsedDraft.selectedVehicleId || null;
        const nextVehicle = { ...createEmptyVehicle(), ...(parsedDraft.vehicle || {}) };
        const nextParts = Array.isArray(parsedDraft.parts) ? parsedDraft.parts : [];
        const nextStep = Math.min(Math.max(Number(parsedDraft.step) || 0, 0), steps.length - 1);
        const nextPhotoPreview = parsedDraft.jobPhotoDataUrl || '';

        let restoredPhoto = null;
        if (nextPhotoPreview) {
          try {
            restoredPhoto = await dataUrlToFile(
              nextPhotoPreview,
              parsedDraft.jobPhotoName || 'job-photo.jpg',
              parsedDraft.jobPhotoType || inferMimeTypeFromDataUrl(nextPhotoPreview)
            );
          } catch (photoError) {
            console.error('Draft photo restore failed:', photoError);
          }
        }

        if (cancelled) return;

        setCustomer(nextCustomer);
        setCustomerVehicles(nextCustomerVehicles);
        setSelectedVehicleId(nextSelectedVehicleId);
        setVehicle(nextVehicle);
        setOdoReading(parsedDraft.odoReading || '');
        setParts(nextParts);
        setLabour(parsedDraft.labour || '');
        setIsGST(Boolean(parsedDraft.isGST));
        setJobPhotoPreview(nextPhotoPreview);
        setJobPhoto(restoredPhoto);
        setStep(nextStep);

        if (hasDraftProgress({
          customer: nextCustomer,
          customerVehicles: nextCustomerVehicles,
          selectedVehicleId: nextSelectedVehicleId,
          vehicle: nextVehicle,
          odoReading: parsedDraft.odoReading || '',
          jobPhotoPreview: nextPhotoPreview,
          parts: nextParts,
          labour: parsedDraft.labour || '',
          isGST: Boolean(parsedDraft.isGST),
          step: nextStep,
        })) {
          skipNextDraftSaveNoticeRef.current = true;
          setDraftNotice('restored');
        }
      } catch (draftError) {
        console.error('Draft restore failed:', draftError);
        localStorage.removeItem(draftKey);
      } finally {
        if (!cancelled) {
          draftHydratingRef.current = false;
          setDraftReady(true);
        }
      }
    };

    restoreDraft();

    return () => {
      cancelled = true;
      draftHydratingRef.current = false;
    };
  }, [draftKey, steps.length]);

  useEffect(() => {
    if (!draftKey || !draftReady || draftHydratingRef.current) return;

    if (!hasCurrentDraftProgress) {
      localStorage.removeItem(draftKey);
      if (draftNotice === 'saved') setDraftNotice('');
      return;
    }

    const timeoutId = window.setTimeout(() => {
      try {
        const nextDraft = {
          version: DRAFT_STORAGE_VERSION,
          customer,
          customerVehicles,
          selectedVehicleId,
          vehicle,
          odoReading,
          jobPhotoDataUrl: jobPhotoPreview || '',
          jobPhotoName: jobPhoto?.name || 'job-photo.jpg',
          jobPhotoType: jobPhoto?.type || inferMimeTypeFromDataUrl(jobPhotoPreview),
          parts,
          labour,
          isGST,
          step,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem(draftKey, JSON.stringify(nextDraft));
        if (skipNextDraftSaveNoticeRef.current) {
          skipNextDraftSaveNoticeRef.current = false;
        } else {
          setDraftNotice('saved');
        }
      } catch (draftSaveError) {
        console.error('Draft save failed:', draftSaveError);
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [
    customer,
    customerVehicles,
    selectedVehicleId,
    vehicle,
    odoReading,
    jobPhotoPreview,
    jobPhoto,
    parts,
    labour,
    isGST,
    step,
    draftKey,
    draftReady,
    hasCurrentDraftProgress,
    draftNotice,
  ]);

  // Load customer's vehicles whenever customer changes
  const loadCustomerVehicles = async (customerId) => {
    setVehiclesLoading(true);
    setCustomerVehicles([]);
    setSelectedVehicleId(null);
    try {
      const { data } = await supabase
        .from('vehicles')
        .select('*')
        .eq('customer_id', customerId)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: true });

      const mapped = (data || []).map(mapVehicle);
      setCustomerVehicles(mapped);
      // Auto-select first vehicle if any
      if (mapped.length > 0) {
        setSelectedVehicleId(mapped[0].id);
      } else {
        setSelectedVehicleId(NEW_VEHICLE_ID); // no vehicles → go straight to new vehicle form
      }
    } catch (err) {
      console.error('loadCustomerVehicles:', err);
    } finally {
      setVehiclesLoading(false);
    }
  };

  // Called from CustomerModal — `preVehicle` is non-null when a new customer
  // was created AND a vehicle reg. number was supplied in the create form.
  const handleCustomerSelect = (c, preVehicle = null) => {
    setCustomer(c);
    setShowCustomerModal(false);
    setVehicle(createEmptyVehicle());

    if (preVehicle) {
      // Vehicle already created DB-side — skip the loadCustomerVehicles fetch
      // and pre-select it immediately.
      setCustomerVehicles([preVehicle]);
      setSelectedVehicleId(preVehicle.id);
      setVehiclesLoading(false);
    } else {
      loadCustomerVehicles(c.id);
    }
  };

  // Vehicle form helpers
  const handleVehicleTypeChange = (e) => {
    setVehicle((v) => ({ ...v, type: e.target.value, brand: '', model: '' }));
  };
  const handleVehicleBrandChange = (e) => {
    setVehicle((v) => ({ ...v, brand: e.target.value, model: '' }));
  };

  const vehicleBrands = getBrandsForType(vehicle.type);
  const vehicleModels = getModelsForBrand(vehicle.brand);

  // Job photo handlers
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('estimate.photoFileError'));
      return;
    }
    setPhotoPreparing(true);
    try {
      const prepared = await optimizeJobPhoto(file);
      setJobPhoto(prepared);
      setError('');
      const reader = new FileReader();
      reader.onload = (ev) => setJobPhotoPreview(ev.target.result);
      reader.readAsDataURL(prepared);
    } catch (err) {
      console.error('Job photo preparation failed:', err);
      setJobPhoto(file);
      setError('');
      const reader = new FileReader();
      reader.onload = (ev) => setJobPhotoPreview(ev.target.result);
      reader.readAsDataURL(file);
    } finally {
      setPhotoPreparing(false);
    }
  };

  const clearPhoto = () => {
    setJobPhoto(null);
    setJobPhotoPreview('');
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  // Parts helpers
  const addPart = (part) => {
    setParts((prev) => {
      const existing = prev.findIndex((p) => p.id === part.id);
      if (existing >= 0 && !String(part.id).startsWith('custom')) {
        const updated = [...prev];
        updated[existing].qty  += 1;
        updated[existing].total = updated[existing].qty * updated[existing].unitPrice;
        return updated;
      }
      return [...prev, { ...part }];
    });
    setShowPartsModal(false);
  };

  const removePart = (i) => setParts((prev) => prev.filter((_, idx) => idx !== i));

  const updatePartQty = (i, qty) => {
    const n = Math.max(1, parseInt(qty) || 1);
    setParts((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], qty: n, total: n * updated[i].unitPrice };
      return updated;
    });
  };

  const updatePartPrice = (i, price) => {
    const p = parseFloat(price) || 0;
    setParts((prev) => {
      const updated = [...prev];
      updated[i] = { ...updated[i], unitPrice: p, total: updated[i].qty * p };
      return updated;
    });
  };

  // ── Save (estimate OR direct bill) ───────────────────────────────────────
  const handleSave = async () => {
    if (!customer)          { setError(t('estimate.selectCustomerError')); return; }
    if (parts.length === 0) { setError(t('estimate.addItemError')); return; }
    if (IS_NEW && !vehicle.number.trim()) { setError(t('estimate.vehicleRequired')); return; }
    if (!IS_NEW && !customerVehicles.some((v) => v.id === selectedVehicleId)) {
      setError(t('estimate.selectVehicleError'));
      return;
    }

    setError('');
    setLoading(true);
    try {
      let vehicleId    = null;
      let vehicleNo    = '';
      let vehicleType  = '';
      let vehicleBrand = '';
      let vehicleModel = '';

      if (IS_NEW || !selectedVehicleId) {
        // Create new vehicle row in books.vehicles
        const { data: newVehicle, error: vehicleErr } = await supabase
          .from('vehicles')
          .insert({
            shop_id:       shop.id,
            customer_id:   customer.id,
            vehicle_no:    vehicle.number.trim().toUpperCase(),
            vehicle_type:  vehicle.type  || null,
            vehicle_brand: vehicle.brand.trim() || null,
            vehicle_model: vehicle.model.trim() || null,
          })
          .select()
          .single();
        if (vehicleErr) throw vehicleErr;
        vehicleId    = newVehicle.id;
        vehicleNo    = newVehicle.vehicle_no;
        vehicleType  = newVehicle.vehicle_type;
        vehicleBrand = newVehicle.vehicle_brand;
        vehicleModel = newVehicle.vehicle_model;
      } else {
        // Use existing vehicle
        const v = customerVehicles.find((cv) => cv.id === selectedVehicleId);
        if (!v) throw new Error(t('estimate.selectVehicleError'));
        vehicleId    = v.id;
        vehicleNo    = v.vehicleNo;
        vehicleType  = v.vehicleType;
        vehicleBrand = v.vehicleBrand;
        vehicleModel = v.vehicleModel;
      }

      // Get next sequential number — works for both 'estimate' and 'bill' types
      const { data: docNumber, error: rpcErr } = await supabase
        .rpc('next_bill_number', { p_shop_id: shop.id, p_type: docMode });
      if (rpcErr) throw rpcErr;

      // Build insert payload — number field differs by mode
      const payload = {
        shop_id:        shop.id,
        customer_id:    customer.id,
        type:           docMode,
        status:         docMode === 'bill' ? 'unpaid' : 'draft',
        customer_name:  customer.name,
        customer_phone: customer.phone,
        vehicle_no:     vehicleNo,
        vehicle_type:   vehicleType,
        vehicle_brand:  vehicleBrand,
        vehicle_model:  vehicleModel,
        odo_reading:    odoReading.trim() ? Number.parseInt(odoReading.trim(), 10) : null,
        vehicle_id:     vehicleId,
        items:          parts,
        parts_subtotal: partsSubtotal,
        labour_charge:  parseFloat(labour) || 0,
        is_gst:         isGST,
        cgst,
        sgst,
        grand_total:    grandTotal,
        // Number field: estimate_number for estimates, bill_number for bills
        ...(docMode === 'bill'
          ? { bill_number:     docNumber }
          : { estimate_number: docNumber }),
      };

      const { data: newBill, error: insertErr } = await supabase
        .from('bills')
        .insert(payload)
        .select()
        .single();
      if (insertErr) throw insertErr;

      let jobPhotoUrl = null;

      // Upload job photo if provided
      if (jobPhoto && newBill?.id) {
        const ext = jobPhoto.name.split('.').pop().toLowerCase() || 'jpg';
        const path = `${shop.id}/jobs/${newBill.id}.${ext}`;

        const { data: uploadData, error: upErr } = await supabase.storage
          .from('shop-assets')
          .upload(path, jobPhoto, { upsert: true, contentType: jobPhoto.type });

        if (!upErr && uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('shop-assets')
            .getPublicUrl(uploadData.path);

          jobPhotoUrl = publicUrl;

          // Update bill with photo URL
          await supabase
            .from('bills')
            .update({ job_photo_url: jobPhotoUrl })
            .eq('id', newBill.id);
        } else if (upErr) {
          console.warn('[NewEstimate] Job photo upload failed:', upErr.message);
        }
      }

      // Navigate to the right detail page
      clearCurrentDraft(false);
      navigate(docMode === 'bill' ? `/bill/${newBill.id}` : `/estimate/${newBill.id}`);
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message || t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // ── Derived: currently selected vehicle (for display) ─────────────────────
  const activeVehicle = customerVehicles.find((v) => v.id === selectedVehicleId);

  const isBill = docMode === 'bill';

  const validateStep = (targetStep = step) => {
    if (targetStep === 0) {
      if (!customer) {
        setError(t('estimate.selectCustomerError'));
        return false;
      }
      if (!selectedVehicleId && !IS_NEW) {
        setError(t('estimate.selectVehicleError'));
        return false;
      }
      if (!IS_NEW && !customerVehicles.some((v) => v.id === selectedVehicleId)) {
        setError(t('estimate.selectVehicleError'));
        return false;
      }
      if (IS_NEW && !vehicle.number.trim()) {
        setError(t('estimate.vehicleRequired'));
        return false;
      }
      if (!odoReading.trim()) {
        setError(t('estimate.odoReadingRequired'));
        return false;
      }
    }

    if (targetStep === 1 && parts.length === 0) {
      setError(t('estimate.addItemError'));
      return false;
    }

    setError('');
    return true;
  };

  const handleNextStep = () => {
    if (!validateStep()) return;
    setStep((prev) => Math.min(prev + 1, steps.length - 1));
  };

  const handlePrevStep = () => {
    setError('');
    setStep((prev) => Math.max(prev - 1, 0));
  };

  const handleStepSelect = (targetStep) => {
    if (targetStep <= step) {
      setError('');
      setStep(targetStep);
      return;
    }
    if (!validateStep(step)) return;
    setStep(targetStep);
  };

  // ── Gate: show upgrade wall if free user tries to create estimate ─────────
  if (shop?.plan !== 'paid' && docMode === 'estimate') {
    return <UpgradeWall onUpgrade={() => navigate('/settings')} />;
  }

  if (!draftReady) {
    return (
      <Layout title={isBill ? t('estimate.billTitle') : t('estimate.newTitle')} showBack showNav={false}>
        <div className="space-y-5 p-4 pb-36 animate-pulse">
          <div className="flex gap-1.5 rounded-2xl bg-gray-100 p-1.5">
            <div className="h-11 flex-1 rounded-xl bg-white" />
            <div className="h-11 flex-1 rounded-xl bg-gray-200" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="h-12 rounded-2xl bg-white" />
            ))}
          </div>
          <div className="card space-y-4">
            <div className="h-4 w-32 rounded-full bg-gray-100" />
            <div className="h-12 rounded-xl bg-gray-100" />
          </div>
          <div className="card space-y-4">
            <div className="h-4 w-28 rounded-full bg-gray-100" />
            <div className="h-20 rounded-xl bg-gray-100" />
            <div className="h-12 rounded-xl bg-gray-100" />
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title={isBill ? t('estimate.billTitle') : t('estimate.newTitle')} showBack showNav={false}>
      <div className="space-y-5 p-4 pb-36">
        <div className="flex gap-1.5 rounded-2xl bg-gray-100 p-1.5">
          <button
            className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
              !isBill ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-400'
            }`}
            onClick={() => setDocMode('estimate')}
            type="button"
          >
            {t('estimate.docEstimate')}
          </button>
          <button
            className={`flex-1 rounded-xl py-3 text-sm font-bold transition-all ${
              isBill ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-400'
            }`}
            onClick={() => setDocMode('bill')}
            type="button"
          >
            {t('estimate.docBill')}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {steps.map((label, index) => (
            <EstimateStepChip
              key={label}
              index={index}
              label={label}
              active={step === index}
              complete={step > index}
              onClick={() => handleStepSelect(index)}
            />
          ))}
        </div>

        {step > 0 && customer ? (
          <div className="card flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-light font-bold text-brand-mid">
              {customer.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-brand-dark">{customer.name}</p>
              <p className="truncate text-xs text-gray-500">
                {(activeVehicle?.vehicleNo || vehicle.number || t('estimate.vehicle'))}
                {odoReading ? ` • ${odoReading} ${t('vehicle.odoUnit')}` : ''}
              </p>
            </div>
            <button
              className="text-xs font-semibold text-brand-mid"
              onClick={() => setStep(0)}
              type="button"
            >
              {t('common.edit')}
            </button>
          </div>
        ) : null}

        {step === 0 ? (
          <>
            <div className="card">
              <p className="section-label">{t('estimate.customer')}</p>
              {customer ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-light font-bold text-brand-mid">
                    {customer.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{customer.name}</p>
                    <p className="text-sm text-gray-500">{customer.phone}</p>
                  </div>
                  <button className="text-xs font-semibold text-brand-mid" onClick={() => setShowCustomerModal(true)} type="button">
                    {t('common.edit')}
                  </button>
                </div>
              ) : (
                <button
                  className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-light py-4 font-semibold text-brand-mid"
                  onClick={() => setShowCustomerModal(true)}
                  type="button"
                >
                  <Search className="h-4 w-4" />
                  {t('customer.searchPlaceholder')}
                </button>
              )}
            </div>

            {customer ? (
              <div className="card space-y-3">
                <p className="section-label">{t('estimate.vehicle')}</p>

                {vehiclesLoading ? (
                  <div className="flex justify-center py-4">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-mid border-t-transparent" />
                  </div>
                ) : (
                  <>
                    {customerVehicles.length > 0 ? (
                      <div>
                        <p className="mb-2 text-xs text-gray-500">{t('estimate.vehicleSelectHint')}</p>
                        <div className="flex flex-wrap gap-2">
                          {customerVehicles.map((v) => (
                            <button
                              key={v.id}
                              onClick={() => setSelectedVehicleId(v.id)}
                              type="button"
                              className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                                selectedVehicleId === v.id
                                  ? 'border-brand-mid bg-brand-mid text-white'
                                  : 'border-gray-200 bg-white text-gray-700'
                              }`}
                            >
                              <span>{TYPE_EMOJI[v.vehicleType] || '🚘'}</span>
                              <span className="font-mono">{v.vehicleNo}</span>
                              {selectedVehicleId === v.id ? <CheckCircle className="ml-0.5 h-3.5 w-3.5" /> : null}
                            </button>
                          ))}
                          <button
                            onClick={() => setSelectedVehicleId(NEW_VEHICLE_ID)}
                            type="button"
                            className={`flex items-center gap-1.5 rounded-xl border-2 px-3 py-2 text-sm font-semibold transition-colors ${
                              IS_NEW
                                ? 'border-brand-mid bg-brand-mid text-white'
                                : 'border-dashed border-gray-200 bg-white text-gray-700'
                            }`}
                          >
                            <Plus className="h-3.5 w-3.5" /> {t('estimate.newVehicle')}
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {activeVehicle && !IS_NEW ? (
                      <div className="rounded-xl bg-brand-light/60 p-3 text-sm">
                        <p className="font-mono font-semibold text-brand-dark">{activeVehicle.vehicleNo}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {[activeVehicle.vehicleBrand, activeVehicle.vehicleModel].filter(Boolean).join(' ')
                            || activeVehicle.vehicleType || ''}
                        </p>
                      </div>
                    ) : null}

                    {IS_NEW ? (
                      <div className="space-y-3 border-t border-gray-100 pt-3">
                        <div>
                          <label className="mb-1 block text-xs text-gray-500">{t('vehicle.number')} *</label>
                          <input
                            className="input-field uppercase"
                            placeholder={t('vehicle.numberPlaceholder')}
                            value={vehicle.number}
                            onChange={(e) => setVehicle((v) => ({ ...v, number: e.target.value }))}
                            onKeyDown={dismissKeyboardOnEnter}
                          />
                        </div>

                        <div>
                          <label className="mb-1 block text-xs text-gray-500">{t('vehicle.type')}</label>
                          <select className="input-field" value={vehicle.type} onChange={handleVehicleTypeChange}>
                            {VEHICLE_TYPES.map((vt) => (
                              <option key={vt.value} value={vt.value}>
                                {TYPE_EMOJI[vt.value]} {vt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs text-gray-500">{t('vehicle.brand')}</label>
                          {vehicleBrands.length > 0 ? (
                            <>
                              <select className="input-field" value={vehicle.brand} onChange={handleVehicleBrandChange}>
                                <option value="">{t('vehicle.selectBrand')}</option>
                                {vehicleBrands.map((b) => <option key={b} value={b}>{b}</option>)}
                                <option value="__other__">{t('vehicle.other')}</option>
                              </select>
                              {vehicle.brand === '__other__' ? (
                                <input className="input-field mt-2" placeholder={t('vehicle.enterBrand')}
                                  onChange={(e) => setVehicle((v) => ({ ...v, brand: e.target.value, model: '' }))} />
                              ) : null}
                            </>
                          ) : (
                            <input className="input-field" placeholder={t('vehicle.brandPlaceholder')}
                              value={vehicle.brand}
                              onChange={(e) => setVehicle((v) => ({ ...v, brand: e.target.value }))} />
                          )}
                        </div>

                        <div>
                          <label className="mb-1 block text-xs text-gray-500">{t('vehicle.model')}</label>
                          {vehicleModels.length > 0 && vehicle.brand !== '__other__' ? (
                            <>
                              <select className="input-field" value={vehicle.model}
                                onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))}>
                                <option value="">{t('vehicle.selectModel')}</option>
                                {vehicleModels.map((m) => <option key={m} value={m}>{m}</option>)}
                                <option value="__other__">{t('vehicle.other')}</option>
                              </select>
                              {vehicle.model === '__other__' ? (
                                <input className="input-field mt-2" placeholder={t('vehicle.enterModel')}
                                  onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))} />
                              ) : null}
                            </>
                          ) : (
                            <input className="input-field" placeholder={t('vehicle.modelPlaceholder')}
                              value={vehicle.model === '__other__' ? '' : vehicle.model}
                              onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))} />
                          )}
                        </div>
                      </div>
                    ) : null}

                    <div className="border-t border-gray-100 pt-3">
                      <label className="mb-1 block text-xs text-gray-500">{t('vehicle.odoReading')} <span className="text-red-500">*</span></label>
                      <div className="relative">
                        <input
                          className="input-field pr-12"
                          type="tel"
                          inputMode="numeric"
                          enterKeyHint="done"
                          placeholder={t('vehicle.odoPlaceholder')}
                          value={odoReading}
                          onChange={(e) => setOdoReading(e.target.value.replace(/\D/g, ''))}
                          onKeyDown={dismissKeyboardOnEnter}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                          {t('vehicle.odoUnit')}
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : null}

            {customer && (selectedVehicleId || IS_NEW) ? (
              <div className="card space-y-3">
                <p className="section-label">
                  <Camera className="mr-1 inline h-4 w-4" />
                  {t('estimate.jobPhoto')}
                </p>
                <p className="-mt-2 text-xs text-gray-500">
                  {t('estimate.jobPhotoHint')}
                </p>
                {photoPreparing ? (
                  <div className="flex items-center gap-2 text-xs text-brand-mid">
                    <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-mid border-t-transparent" />
                    {t('estimate.photoPreparing')}
                  </div>
                ) : null}

                {jobPhotoPreview ? (
                  <div className="relative">
                    <img
                      src={jobPhotoPreview}
                      alt="Job photo preview"
                      className="h-56 w-full rounded-xl border-2 border-gray-200 object-cover"
                    />
                    <button
                      className="absolute right-3 top-3 rounded-full bg-red-500 p-2 text-white shadow-lg"
                      onClick={clearPhoto}
                      type="button"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-8 text-gray-500 transition-colors hover:border-brand-mid hover:text-brand-mid active:bg-gray-50"
                    onClick={() => photoInputRef.current?.click()}
                    type="button"
                  >
                    <Camera className="h-12 w-12" />
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
                  onChange={handlePhotoSelect}
                />
              </div>
            ) : null}
          </>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="card">
              <div className="mb-3 flex items-center justify-between">
                <p className="section-label mb-0">{t('estimate.parts')}</p>
                <button
                  className="flex items-center gap-1 rounded-lg bg-brand-mid px-3 py-1.5 text-sm font-semibold text-white"
                  onClick={() => setShowPartsModal(true)}
                  type="button"
                >
                  <Plus className="h-4 w-4" />
                  {t('common.add')}
                </button>
              </div>

              {parts.length === 0 ? (
                <p className="py-6 text-center text-sm text-gray-400">{t('estimate.partsEmpty')}</p>
              ) : (
                <div className="space-y-2">
                  {parts.map((part, i) => (
                    <div key={i} className="rounded-2xl border border-gray-100 bg-white p-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="flex-1 text-sm font-medium">
                          {getPartName(part, language) || part.name}
                        </p>
                        <button onClick={() => removePart(i)} className="flex-shrink-0 text-red-400" type="button">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex items-end gap-2">
                        <div className="min-w-0 flex-1">
                          <label className="text-xs text-gray-400">{t('parts.qty')}</label>
                          <div className="flex h-10 items-center justify-between rounded-lg border border-gray-200 bg-white px-1">
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50 text-base font-bold text-gray-600"
                              onClick={() => updatePartQty(i, part.qty - 1)}
                            >
                              −
                            </button>
                            <span className="min-w-0 flex-1 text-center text-sm font-semibold text-brand-dark">{part.qty}</span>
                            <button
                              type="button"
                              className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-50 text-base font-bold text-gray-600"
                              onClick={() => updatePartQty(i, part.qty + 1)}
                            >
                              +
                            </button>
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <label className="text-xs text-gray-400">{t('parts.price')}</label>
                          <input
                            type="tel"
                            inputMode="decimal"
                            enterKeyHint="done"
                            className="h-10 w-full rounded-lg border border-gray-200 px-2 py-1 text-center text-sm"
                            value={part.unitPrice === 0 ? '' : part.unitPrice}
                            onChange={(e) => updatePartPrice(i, e.target.value === '0' ? '' : e.target.value)}
                            onKeyDown={dismissKeyboardOnEnter}
                          />
                        </div>
                        <div className="w-20 flex-shrink-0 text-right">
                          <label className="text-xs text-gray-400">{t('parts.total')}</label>
                          <p className="pt-1 text-sm font-bold text-brand-dark">
                            ₹{part.total.toFixed(0)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card">
              <div className="flex items-center justify-between">
                <p className="section-label mb-0">{t('estimate.subtotal')}</p>
                <p className="text-lg font-bold text-brand-dark">₹{partsSubtotal.toFixed(2)}</p>
              </div>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <div className="card space-y-4">
              <div>
                <label className="section-label">{t('estimate.labour')}</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-gray-500">₹</span>
                  <input
                    type="tel"
                    inputMode="decimal"
                    enterKeyHint="done"
                    className="input-field pl-7"
                    placeholder={t('estimate.labourPlaceholder')}
                    value={labour}
                    onChange={(e) => setLabour(e.target.value)}
                    onKeyDown={dismissKeyboardOnEnter}
                  />
                </div>
              </div>
              <label className="flex cursor-pointer items-center gap-3">
                <div
                  className={`relative h-6 w-12 rounded-full transition-colors ${isGST ? 'bg-brand-mid' : 'bg-gray-200'}`}
                  onClick={() => setIsGST(!isGST)}
                >
                  <div className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform ${isGST ? 'translate-x-7' : 'translate-x-1'}`} />
                </div>
                <span className="text-sm font-medium">{t('estimate.gstToggle')}</span>
              </label>
            </div>

            <div className="card space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('estimate.subtotal')}</span>
                <span className="font-medium">₹{partsSubtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>{t('estimate.labour')}</span>
                <span className="font-medium">₹{(parseFloat(labour) || 0).toFixed(2)}</span>
              </div>
              {isGST ? (
                <>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{t('estimate.cgst')}</span>
                    <span className="font-medium">₹{cgst.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>{t('estimate.sgst')}</span>
                    <span className="font-medium">₹{sgst.toFixed(2)}</span>
                  </div>
                </>
              ) : null}
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="font-bold text-brand-dark">{t('estimate.grandTotal')}</span>
                <span className="text-xl font-bold text-brand-dark">₹{grandTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : null}

        {error ? (
          <InlineNotice tone="danger" compact>
            {error}
          </InlineNotice>
        ) : null}

        {!error && hasCurrentDraftProgress ? (
          <InlineNotice
            tone="info"
            compact
            title={draftNotice === 'restored' ? t('estimate.draftRestoredTitle') : t('estimate.draftSavedTitle')}
            action={(
              <button
                type="button"
                className="text-xs font-bold text-blue-700"
                onClick={() => clearCurrentDraft()}
              >
                {t('estimate.discardDraft')}
              </button>
            )}
          >
            {draftNotice === 'restored' ? t('estimate.draftRestoredBody') : t('estimate.draftSavedBody')}
          </InlineNotice>
        ) : null}
      </div>

      <StickyActionBar anchor="screen">
        <div className="flex gap-3">
          {step > 0 ? (
            <button type="button" className="btn-secondary flex-1 whitespace-nowrap" onClick={handlePrevStep} disabled={loading}>
              {t('common.back')}
            </button>
          ) : null}

          <button
            type="button"
            className={`${step === steps.length - 1
              ? (isBill ? 'bg-accent text-white' : 'btn-primary')
              : 'btn-primary'} flex-1 whitespace-nowrap text-sm font-bold`}
            onClick={step === steps.length - 1 ? handleSave : handleNextStep}
            disabled={loading}
          >
            {loading ? t('estimate.saving') : step === 0 ? (
              <span className="inline-flex items-center gap-2">
                {t('estimate.continueToItems')}
                <ArrowRight className="h-4 w-4" />
              </span>
            ) : step === 1 ? (
              <span className="inline-flex items-center gap-2">
                {t('estimate.continueToTotals')}
                <ArrowRight className="h-4 w-4" />
              </span>
            ) : (
              isBill ? t('estimate.saveBill') : t('estimate.saveEstimate')
            )}
          </button>
        </div>
      </StickyActionBar>

      {showCustomerModal && (
        <CustomerModal
          onSelect={(c, vehicle) => handleCustomerSelect(c, vehicle)}
          onClose={() => setShowCustomerModal(false)}
        />
      )}
      {showPartsModal && (
        <PartsModal
          catalogue={catalogue}
          onAdd={addPart}
          onClose={() => setShowPartsModal(false)}
        />
      )}
    </Layout>
  );
}
