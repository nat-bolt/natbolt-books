import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, ChevronRight, User, Plus, X, Lock, Crown } from 'lucide-react';
import { supabase, mapCustomer, mapVehicle } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import { VEHICLE_TYPES, getBrandsForType, getModelsForBrand } from '../data/vehicles';

// ── Upgrade wall (shown when free user tries to access customer list) ────────
function UpgradeWall({ onUpgrade }) {
  const { t } = useTranslation();
  return (
    <Layout title={t('customer.title')}>
      <div className="flex flex-col items-center justify-center p-6 text-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-brand-dark mb-2">Customer Management is a Paid Feature</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-xs">
          Upgrade to access your full customer directory, manage customer details, and unlock unlimited billing.
        </p>
        <div className="space-y-3 w-full max-w-sm">
          <div className="inline-block bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            Save 38% • Limited Time Offer
          </div>
          <button className="btn-primary flex items-center gap-2 px-6 py-3 w-full justify-center" onClick={onUpgrade}>
            <Crown className="w-5 h-5" />
            <span>Unlock unlimited billing — <span className="line-through opacity-60">₹799</span> ₹499/month</span>
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-6">
          Note: You can still search and add customers when creating bills.
        </p>
      </div>
    </Layout>
  );
}

// ── Add Customer Modal ────────────────────────────────────────────────────────
// Collects: name, phone (required) + optional first vehicle details
function AddCustomerModal({ shop, onSaved, onClose }) {
  const [name,  setName]  = useState('');
  const [phone, setPhone] = useState('');

  // Vehicle fields (all optional)
  const [vNo,    setVNo]    = useState('');
  const [vType,  setVType]  = useState('scooter');
  const [vBrand, setVBrand] = useState('');
  const [vModel, setVModel] = useState('');

  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  // Reset brand + model when type changes
  const handleTypeChange = (e) => {
    setVType(e.target.value);
    setVBrand('');
    setVModel('');
  };

  // Reset model when brand changes
  const handleBrandChange = (e) => {
    setVBrand(e.target.value);
    setVModel('');
  };

  const brands = getBrandsForType(vType);
  const models = getModelsForBrand(vBrand);

  // Normalise a "brand" value that might be '__other__'
  const resolvedBrand = vBrand === '__other__' ? '' : vBrand;

  const handleSave = async () => {
    if (!name.trim())  { setError('Customer name is required');         return; }
    if (!phone.trim()) { setError('Mobile number is required');         return; }
    if (phone.length !== 10) { setError('Enter a valid 10-digit number'); return; }

    setSaving(true);
    setError('');
    try {
      // 1. Create customer
      const { data: cust, error: custErr } = await supabase
        .from('customers')
        .insert({ shop_id: shop.id, name: name.trim(), phone: phone.trim() })
        .select()
        .single();
      if (custErr) throw custErr;

      // 2. Create vehicle if at least a vehicle number is provided
      let vehicle = null;
      const vehicleNoClean = vNo.trim().toUpperCase();
      if (vehicleNoClean) {
        const { data: veh, error: vehErr } = await supabase
          .from('vehicles')
          .insert({
            shop_id:       shop.id,
            customer_id:   cust.id,
            vehicle_no:    vehicleNoClean,
            vehicle_type:  vType  || null,
            vehicle_brand: resolvedBrand || null,
            vehicle_model: (vModel === '__other__' ? '' : vModel.trim()) || null,
          })
          .select()
          .single();
        if (vehErr) throw vehErr;
        vehicle = mapVehicle(veh);
      }

      onSaved(mapCustomer(cust), vehicle);
    } catch (err) {
      console.error('AddCustomer error:', err);
      // Duplicate phone: Supabase will throw a unique-violation
      if (err.code === '23505') {
        setError('A customer with this phone number already exists');
      } else {
        setError(err.message || 'Something went wrong');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-5 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-brand-dark">Add Customer</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* ── Customer details ───────────────────────────────────────────── */}
        <p className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-3">
          Customer Details
        </p>
        <div className="space-y-3">
          <div>
            <label className="section-label">Mobile Number *</label>
            <input
              className="input-field"
              type="tel"
              inputMode="numeric"
              placeholder="9876543210"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <label className="section-label">Full Name *</label>
            <input
              className="input-field"
              placeholder="Customer name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        {/* ── Vehicle details ────────────────────────────────────────────── */}
        <div className="mt-5 pt-4 border-t border-gray-100">
          <p className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1">
            Vehicle Details
          </p>
          <p className="text-xs text-gray-400 mb-3">
            Optional — add their vehicle now or from the customer profile later
          </p>

          <div className="space-y-3">
            {/* Vehicle Number */}
            <div>
              <label className="section-label">Registration Number</label>
              <input
                className="input-field uppercase"
                placeholder="TS09AB1234"
                value={vNo}
                onChange={(e) => setVNo(e.target.value)}
              />
            </div>

            {/* Type */}
            <div>
              <label className="section-label">Vehicle Type</label>
              <select className="input-field" value={vType} onChange={handleTypeChange}>
                {VEHICLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Brand */}
            <div>
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
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <button
          className="btn-primary w-full mt-5"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Save Customer'}
        </button>
      </div>
    </div>
  );
}

// ── CustomerList ──────────────────────────────────────────────────────────────
export default function CustomerList() {
  const { t }    = useTranslation();
  const navigate = useNavigate();
  const { shop } = useStore();

  const [customers, setCustomers]   = useState([]);
  const [filtered, setFiltered]     = useState([]);
  const [search, setSearch]         = useState('');
  const [loading, setLoading]       = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!shop) return;
    loadCustomers();
  }, [shop]);

  useEffect(() => {
    if (!search.trim()) { setFiltered(customers); return; }
    const q = search.toLowerCase();
    setFiltered(customers.filter((c) =>
      c.name?.toLowerCase().includes(q) || c.phone?.includes(q)
    ));
  }, [search, customers]);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('shop_id', shop.id)
        .order('name');

      if (error) throw error;
      setCustomers((data || []).map(mapCustomer));
    } catch (err) {
      console.error('CustomerList error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCustomerSaved = (customer) => {
    // Navigate directly to the new customer's profile
    navigate(`/customers/${customer.id}`);
  };

  // ── Gate: show upgrade wall for free users ────────────────────────────────
  if (shop?.plan !== 'paid') {
    return <UpgradeWall onUpgrade={() => navigate('/settings')} />;
  }

  return (
    <Layout title={t('customer.title')}>
      <div className="p-4 space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input-field pl-9"
            placeholder={t('customer.searchPlaceholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Count */}
        {!loading && customers.length > 0 && (
          <p className="text-xs text-gray-400">
            {filtered.length} of {customers.length} customers
          </p>
        )}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {search ? 'No customers found' : 'No customers yet'}
            </p>
            {!search && (
              <button
                className="mt-4 btn-primary text-sm px-5 py-2"
                onClick={() => setShowAddModal(true)}
              >
                + Add First Customer
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <button
                key={c.id}
                className="card w-full text-left flex items-center gap-3 active:bg-gray-50"
                onClick={() => navigate(`/customers/${c.id}`)}
              >
                <div className="w-11 h-11 rounded-xl bg-brand-light flex items-center justify-center font-bold text-brand-mid text-lg flex-shrink-0">
                  {c.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{c.name}</p>
                  <p className="text-sm text-gray-500">{c.phone}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* FAB — Add Customer (sits above bottom nav) */}
      <button
        className="fixed bottom-20 right-4 max-w-[calc(512px-1rem)] w-14 h-14 bg-brand-mid text-white rounded-full shadow-lg flex items-center justify-center z-10 active:scale-95 transition-transform"
        style={{ right: 'max(1rem, calc(50% - 256px + 1rem))' }}
        onClick={() => setShowAddModal(true)}
        aria-label="Add customer"
      >
        <Plus className="w-6 h-6" />
      </button>

      {showAddModal && (
        <AddCustomerModal
          shop={shop}
          onSaved={handleCustomerSaved}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </Layout>
  );
}
