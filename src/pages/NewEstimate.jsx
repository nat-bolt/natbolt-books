import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, Plus, Trash2, X, CheckCircle } from 'lucide-react';
import { supabase, mapCustomer, mapVehicle } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import { VEHICLE_TYPES, getBrandsForType, getModelsForBrand } from '../data/vehicles';

// ── Language-aware part name ───────────────────────────────────────────────────
function getPartName(part, language) {
  if (language === 'hi' && part.name_hi) return part.name_hi;
  if (language === 'te' && part.name_te) return part.name_te;
  return part.name;
}

// ── Vehicle type emoji ─────────────────────────────────────────────────────────
const TYPE_EMOJI = {
  bike: '🏍️', scooter: '🛵', moped: '🛵', electric: '⚡',
  auto: '🛺', car: '🚗', truck: '🚛', other: '🚘',
};

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
      // Sanitize before interpolating into the PostgREST filter string.
      // Strips characters that have special meaning in PostgREST filter syntax
      // (parentheses = grouping, comma = condition separator, backslash = escape).
      const safe = val.replace(/[(),\\]/g, '');
      const { data } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shop.id)
        .or(`name.ilike.%${safe}%,phone.ilike.%${safe}%`);
      setResults((data || []).map(mapCustomer));
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  const createCustomer = async () => {
    if (!newPhone || !newName) return;
    if (newPhone.length !== 10) { setCreateError('Enter a valid 10-digit number'); return; }
    setCreateError('');
    setLoading(true);
    try {
      // 1. Insert customer
      const { data: cust, error: custErr } = await supabase
        .from('customers')
        .insert({ shop_id: shop.id, name: newName.trim(), phone: newPhone })
        .select()
        .single();
      if (custErr) throw custErr;

      // 2. Insert vehicle if reg. number provided
      let vehicle = null;
      const vehicleNoClean = vNo.trim().toUpperCase();
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
        setCreateError('A customer with this number already exists');
      } else {
        setCreateError(err.message || 'Something went wrong');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
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
            {results.map((c) => (
              <button key={c.id} className="w-full card mb-2 text-left flex items-center gap-3"
                onClick={() => onSelect(c, null)}>
                <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center font-bold text-brand-mid">
                  {c.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div>
                  <p className="font-semibold text-sm">{c.name}</p>
                  <p className="text-xs text-gray-500">{c.phone}</p>
                </div>
              </button>
            ))}
            {q.length >= 3 && results.length === 0 && !loading && (
              <p className="text-center text-gray-400 text-sm py-4">No customers found</p>
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
                Vehicle Details
              </p>
              <p className="text-xs text-gray-400 mb-3">
                Optional — skip if you don't have the details handy
              </p>

              {/* Reg. number */}
              <div className="mb-3">
                <label className="section-label">Registration Number</label>
                <input className="input-field uppercase" placeholder="TS09AB1234"
                  value={vNo} onChange={(e) => setVNo(e.target.value)} />
              </div>

              {/* Type */}
              <div className="mb-3">
                <label className="section-label">Vehicle Type</label>
                <select className="input-field" value={vType} onChange={handleTypeChange}>
                  {VEHICLE_TYPES.map((vt) => (
                    <option key={vt.value} value={vt.value}>{vt.label}</option>
                  ))}
                </select>
              </div>

              {/* Brand */}
              <div className="mb-3">
                <label className="section-label">Brand</label>
                {brands.length > 0 ? (
                  <>
                    <select className="input-field" value={vBrand} onChange={handleBrandChange}>
                      <option value="">Select brand</option>
                      {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                      <option value="__other__">Other (type below)</option>
                    </select>
                    {vBrand === '__other__' && (
                      <input className="input-field mt-2" placeholder="Enter brand name"
                        onChange={(e) => setVBrand(e.target.value)} />
                    )}
                  </>
                ) : (
                  <input className="input-field" placeholder="Brand (e.g. Honda)"
                    value={vBrand} onChange={(e) => setVBrand(e.target.value)} />
                )}
              </div>

              {/* Model */}
              <div>
                <label className="section-label">Model</label>
                {models.length > 0 && vBrand !== '__other__' ? (
                  <>
                    <select className="input-field" value={vModel}
                      onChange={(e) => setVModel(e.target.value)}>
                      <option value="">Select model</option>
                      {models.map((m) => <option key={m} value={m}>{m}</option>)}
                      <option value="__other__">Other (type below)</option>
                    </select>
                    {vModel === '__other__' && (
                      <input className="input-field mt-2" placeholder="Enter model name"
                        onChange={(e) => setVModel(e.target.value)} />
                    )}
                  </>
                ) : (
                  <input className="input-field" placeholder="Model (e.g. Activa 6G)"
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
    </div>
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

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-5 h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}>
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
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 scrollbar-hide">
              {CATEGORY_LIST.map((c) => (
                <button key={c}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold ${cat === c ? 'bg-brand-mid text-white' : 'bg-gray-100 text-gray-600'}`}
                  onClick={() => setCat(c)}
                >
                  {c === 'all' ? 'All' : t(`parts.categories.${c}`, { defaultValue: c })}
                </button>
              ))}
            </div>
            <div className="flex-1 overflow-y-auto space-y-1">
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
              <input className="input-field" placeholder="Part name"
                value={custom.name} onChange={(e) => setCustom((c) => ({ ...c, name: e.target.value }))} />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="section-label">{t('parts.qty')}</label>
                <input className="input-field" type="number" inputMode="numeric" min="1"
                  value={custom.qty} onChange={(e) => setCustom((c) => ({ ...c, qty: e.target.value }))} />
              </div>
              <div className="flex-1">
                <label className="section-label">{t('parts.price')} *</label>
                <input className="input-field" type="number" inputMode="decimal" placeholder="0"
                  value={custom.price} onChange={(e) => setCustom((c) => ({ ...c, price: e.target.value }))} />
              </div>
            </div>
            <button className="btn-accent w-full" onClick={addCustom}>{t('common.add')}</button>
          </div>
        )}
      </div>
    </div>
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

  // Customer
  const [customer, setCustomer] = useState(null);

  // Customer's existing vehicles (loaded after customer selected)
  const [customerVehicles, setCustomerVehicles]     = useState([]);
  const [vehiclesLoading, setVehiclesLoading]       = useState(false);
  const [selectedVehicleId, setSelectedVehicleId]   = useState(null); // null = new vehicle
  const IS_NEW = selectedVehicleId === '__new__';

  // New vehicle form (used when customer has no vehicles OR "New Vehicle" selected)
  const [vehicle, setVehicle] = useState({
    number: '', type: 'scooter', brand: '', model: '',
  });

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

  // Computed totals
  const partsSubtotal = parts.reduce((s, p) => s + (p.total || 0), 0);
  const cgst          = isGST ? partsSubtotal * 0.09 : 0;
  const sgst          = isGST ? partsSubtotal * 0.09 : 0;
  const grandTotal    = partsSubtotal + (parseFloat(labour) || 0) + cgst + sgst;

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
        setSelectedVehicleId('__new__'); // no vehicles → go straight to new vehicle form
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
    setVehicle({ number: '', type: 'scooter', brand: '', model: '' });

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
    if (!customer)          { setError('Please select a customer'); return; }
    if (parts.length === 0) { setError('Add at least one part or service'); return; }
    if (IS_NEW && !vehicle.number.trim()) { setError('Vehicle number is required'); return; }

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

      // Navigate to the right detail page
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

  return (
    <Layout title={isBill ? 'New Bill' : t('estimate.newTitle')} showBack>
      <div className="p-4 space-y-4 pb-32">

        {/* ── Document type toggle ──────────────────────────────────────────── */}
        <div className="flex gap-1.5 bg-gray-100 p-1.5 rounded-2xl">
          <button
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              !isBill ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-400'
            }`}
            onClick={() => setDocMode('estimate')}
          >
            📋 Estimate
          </button>
          <button
            className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all ${
              isBill ? 'bg-white text-brand-dark shadow-sm' : 'text-gray-400'
            }`}
            onClick={() => setDocMode('bill')}
          >
            🧾 Direct Bill
          </button>
        </div>

        {/* ── Customer section ─────────────────────────────────────────────── */}
        <div className="card">
          <p className="section-label">{t('estimate.customer')}</p>
          {customer ? (
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center font-bold text-brand-mid">
                {customer.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{customer.name}</p>
                <p className="text-sm text-gray-500">{customer.phone}</p>
              </div>
              <button className="text-xs text-brand-mid font-semibold" onClick={() => setShowCustomerModal(true)}>
                Change
              </button>
            </div>
          ) : (
            <button
              className="w-full border-2 border-dashed border-brand-light rounded-xl py-4 flex items-center justify-center gap-2 text-brand-mid font-semibold"
              onClick={() => setShowCustomerModal(true)}
            >
              <Search className="w-4 h-4" />
              {t('customer.searchPlaceholder')}
            </button>
          )}
        </div>

        {/* ── Vehicle section ───────────────────────────────────────────────── */}
        {customer && (
          <div className="card space-y-3">
            <p className="section-label">{t('estimate.vehicle')}</p>

            {vehiclesLoading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-brand-mid border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <>
                {/* Existing vehicles + New Vehicle chip */}
                {customerVehicles.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Select vehicle or add new</p>
                    <div className="flex flex-wrap gap-2">
                      {customerVehicles.map((v) => (
                        <button
                          key={v.id}
                          onClick={() => setSelectedVehicleId(v.id)}
                          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${
                            selectedVehicleId === v.id
                              ? 'bg-brand-mid text-white border-brand-mid'
                              : 'bg-white text-gray-700 border-gray-200'
                          }`}
                        >
                          <span>{TYPE_EMOJI[v.vehicleType] || '🚘'}</span>
                          <span className="font-mono">{v.vehicleNo}</span>
                          {selectedVehicleId === v.id && (
                            <CheckCircle className="w-3.5 h-3.5 ml-0.5" />
                          )}
                        </button>
                      ))}
                      <button
                        onClick={() => setSelectedVehicleId('__new__')}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition-colors ${
                          IS_NEW
                            ? 'bg-brand-mid text-white border-brand-mid'
                            : 'bg-white text-gray-700 border-dashed border-gray-200'
                        }`}
                      >
                        <Plus className="w-3.5 h-3.5" /> New Vehicle
                      </button>
                    </div>
                  </div>
                )}

                {/* Show selected vehicle details (read-only) */}
                {activeVehicle && !IS_NEW && (
                  <div className="bg-brand-light/60 rounded-xl p-3 text-sm">
                    <p className="font-semibold text-brand-dark font-mono">{activeVehicle.vehicleNo}</p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {[activeVehicle.vehicleBrand, activeVehicle.vehicleModel].filter(Boolean).join(' ')
                        || activeVehicle.vehicleType || ''}
                    </p>
                  </div>
                )}

                {/* New vehicle form */}
                {IS_NEW && (
                  <div className="space-y-3 border-t border-gray-100 pt-3">
                    {/* Number */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('vehicle.number')} *</label>
                      <input
                        className="input-field uppercase"
                        placeholder={t('vehicle.numberPlaceholder')}
                        value={vehicle.number}
                        onChange={(e) => setVehicle((v) => ({ ...v, number: e.target.value }))}
                      />
                    </div>

                    {/* Type */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('vehicle.type')}</label>
                      <select className="input-field" value={vehicle.type} onChange={handleVehicleTypeChange}>
                        {VEHICLE_TYPES.map((vt) => (
                          <option key={vt.value} value={vt.value}>
                            {TYPE_EMOJI[vt.value]} {vt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Brand */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('vehicle.brand')}</label>
                      {vehicleBrands.length > 0 ? (
                        <>
                          <select className="input-field" value={vehicle.brand} onChange={handleVehicleBrandChange}>
                            <option value="">Select brand</option>
                            {vehicleBrands.map((b) => <option key={b} value={b}>{b}</option>)}
                            <option value="__other__">Other</option>
                          </select>
                          {vehicle.brand === '__other__' && (
                            <input className="input-field mt-2" placeholder="Enter brand name"
                              onChange={(e) => setVehicle((v) => ({ ...v, brand: e.target.value, model: '' }))} />
                          )}
                        </>
                      ) : (
                        <input className="input-field" placeholder={t('vehicle.brandPlaceholder')}
                          value={vehicle.brand}
                          onChange={(e) => setVehicle((v) => ({ ...v, brand: e.target.value }))} />
                      )}
                    </div>

                    {/* Model */}
                    <div>
                      <label className="text-xs text-gray-500 mb-1 block">{t('vehicle.model')}</label>
                      {vehicleModels.length > 0 && vehicle.brand !== '__other__' ? (
                        <>
                          <select className="input-field" value={vehicle.model}
                            onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))}>
                            <option value="">Select model</option>
                            {vehicleModels.map((m) => <option key={m} value={m}>{m}</option>)}
                            <option value="__other__">Other</option>
                          </select>
                          {vehicle.model === '__other__' && (
                            <input className="input-field mt-2" placeholder="Enter model name"
                              onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))} />
                          )}
                        </>
                      ) : (
                        <input className="input-field" placeholder={t('vehicle.modelPlaceholder')}
                          value={vehicle.model === '__other__' ? '' : vehicle.model}
                          onChange={(e) => setVehicle((v) => ({ ...v, model: e.target.value }))} />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── Parts section ─────────────────────────────────────────────────── */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="section-label mb-0">{t('estimate.parts')}</p>
            <button
              className="flex items-center gap-1 bg-brand-mid text-white px-3 py-1.5 rounded-lg text-sm font-semibold"
              onClick={() => setShowPartsModal(true)}
            >
              <Plus className="w-4 h-4" />
              {t('common.add')}
            </button>
          </div>

          {parts.length === 0 ? (
            <p className="text-center text-gray-400 text-sm py-4">{t('estimate.partsEmpty')}</p>
          ) : (
            <div className="space-y-2">
              {parts.map((part, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-sm flex-1">
                      {getPartName(part, language) || part.name}
                    </p>
                    <button onClick={() => removePart(i)} className="text-red-400 flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-400">{t('parts.qty')}</label>
                      <input
                        type="number" inputMode="numeric" min="1"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
                        value={part.qty}
                        onChange={(e) => updatePartQty(i, e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400">{t('parts.price')}</label>
                      <input
                        type="number" inputMode="decimal"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm text-center"
                        value={part.unitPrice}
                        onChange={(e) => updatePartPrice(i, e.target.value)}
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-400">{t('parts.total')}</label>
                      <p className="font-bold text-sm text-brand-dark pt-1 text-center">
                        ₹{part.total.toFixed(0)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Labour & GST ──────────────────────────────────────────────────── */}
        <div className="card space-y-4">
          <div>
            <label className="section-label">{t('estimate.labour')}</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">₹</span>
              <input
                type="number" inputMode="decimal"
                className="input-field pl-7"
                placeholder={t('estimate.labourPlaceholder')}
                value={labour}
                onChange={(e) => setLabour(e.target.value)}
              />
            </div>
          </div>
          <label className="flex items-center gap-3 cursor-pointer">
            <div
              className={`w-12 h-6 rounded-full transition-colors relative ${isGST ? 'bg-brand-mid' : 'bg-gray-200'}`}
              onClick={() => setIsGST(!isGST)}
            >
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${isGST ? 'translate-x-7' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium">{t('estimate.gstToggle')}</span>
          </label>
        </div>

        {/* ── Totals ────────────────────────────────────────────────────────── */}
        <div className="card space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>{t('estimate.subtotal')}</span>
            <span className="font-medium">₹{partsSubtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Labour</span>
            <span className="font-medium">₹{(parseFloat(labour) || 0).toFixed(2)}</span>
          </div>
          {isGST && (
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
          )}
          <div className="border-t border-gray-200 pt-2 flex justify-between">
            <span className="font-bold text-brand-dark">{t('estimate.grandTotal')}</span>
            <span className="font-bold text-xl text-brand-dark">₹{grandTotal.toFixed(2)}</span>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm">{error}</p>}

        <button
          className={`w-full py-4 text-lg font-bold rounded-2xl transition-all active:scale-95 ${
            isBill
              ? 'bg-accent text-white'
              : 'btn-primary'
          }`}
          onClick={handleSave}
          disabled={loading}
        >
          {loading
            ? t('estimate.saving')
            : isBill ? '🧾 Save Bill' : t('estimate.saveEstimate')}
        </button>
      </div>

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
