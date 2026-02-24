import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, Phone, FileText, Receipt,
  ChevronRight, Calendar, IndianRupee,
  Plus, X, Car, Bike,
} from 'lucide-react';
import { supabase, mapCustomer, mapBill, mapVehicle } from '../supabase';
import useStore from '../store/useStore';
import { VEHICLE_TYPES, getBrandsForType, getModelsForBrand } from '../data/vehicles';

// ── Vehicle type icon helper ──────────────────────────────────────────────────
const VEHICLE_TYPE_EMOJIS = {
  bike: '🏍️', scooter: '🛵', moped: '🛵', electric: '⚡',
  auto: '🛺', car: '🚗', truck: '🚛', other: '🚘',
};

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color = 'text-brand-dark' }) {
  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm text-center">
      <Icon className={`w-5 h-5 mx-auto mb-1 ${color}`} />
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

// ── Add Vehicle Modal ─────────────────────────────────────────────────────────
function AddVehicleModal({ shopId, customerId, onSave, onClose }) {
  const [form, setForm] = useState({
    vehicle_no:    '',
    vehicle_type:  'scooter',
    vehicle_brand: '',
    vehicle_model: '',
    year:          '',
    color:         '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  const setField = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  // When type changes, reset brand + model
  const handleTypeChange = (e) => {
    setForm((f) => ({ ...f, vehicle_type: e.target.value, vehicle_brand: '', vehicle_model: '' }));
  };

  // When brand changes, reset model
  const handleBrandChange = (e) => {
    setForm((f) => ({ ...f, vehicle_brand: e.target.value, vehicle_model: '' }));
  };

  const brands = getBrandsForType(form.vehicle_type);
  const models = getModelsForBrand(form.vehicle_brand);

  const handleSave = async () => {
    const vehicleNo = form.vehicle_no.trim().toUpperCase();
    if (!vehicleNo) { setError('Vehicle number is required'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = {
        shop_id:       shopId,
        customer_id:   customerId,
        vehicle_no:    vehicleNo,
        vehicle_type:  form.vehicle_type  || null,
        vehicle_brand: form.vehicle_brand.trim() || null,
        vehicle_model: form.vehicle_model.trim() || null,
        year:          form.year ? parseInt(form.year) : null,
        color:         form.color.trim()  || null,
      };

      const { data, error: err } = await supabase
        .from('vehicles')
        .insert(payload)
        .select()
        .single();

      if (err) throw err;
      onSave(mapVehicle(data));
    } catch (err) {
      console.error('AddVehicle error:', err);
      setError(err.message || 'Something went wrong');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-50" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg mx-auto rounded-t-3xl p-6 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-brand-dark">Add Vehicle</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-3">
          {/* Vehicle Number */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
              Registration Number *
            </label>
            <input
              className="input-field uppercase"
              placeholder="TS09AB1234"
              value={form.vehicle_no}
              onChange={setField('vehicle_no')}
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
              Vehicle Type
            </label>
            <select className="input-field" value={form.vehicle_type} onChange={handleTypeChange}>
              {VEHICLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {VEHICLE_TYPE_EMOJIS[t.value]} {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
              Brand
            </label>
            {brands.length > 0 ? (
              <select className="input-field" value={form.vehicle_brand} onChange={handleBrandChange}>
                <option value="">Select brand</option>
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                <option value="__other__">Other (type below)</option>
              </select>
            ) : (
              <input className="input-field" placeholder="Brand (e.g. Honda)"
                value={form.vehicle_brand} onChange={setField('vehicle_brand')} />
            )}
            {/* Free-type fallback when "Other" selected */}
            {form.vehicle_brand === '__other__' && (
              <input className="input-field mt-2" placeholder="Enter brand name"
                onChange={(e) => setForm((f) => ({ ...f, vehicle_brand: e.target.value, vehicle_model: '' }))} />
            )}
          </div>

          {/* Model */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
              Model
            </label>
            {models.length > 0 && form.vehicle_brand !== '__other__' ? (
              <select className="input-field" value={form.vehicle_model} onChange={setField('vehicle_model')}>
                <option value="">Select model</option>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
                <option value="__other__">Other (type below)</option>
              </select>
            ) : (
              <input className="input-field" placeholder="Model (e.g. Activa 6G)"
                value={form.vehicle_model === '__other__' ? '' : form.vehicle_model}
                onChange={setField('vehicle_model')} />
            )}
            {form.vehicle_model === '__other__' && (
              <input className="input-field mt-2" placeholder="Enter model name"
                onChange={(e) => setForm((f) => ({ ...f, vehicle_model: e.target.value }))} />
            )}
          </div>

          {/* Year & Color (row) */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
                Year
              </label>
              <input
                className="input-field"
                type="number"
                inputMode="numeric"
                placeholder="2020"
                min="1990"
                max={new Date().getFullYear()}
                value={form.year}
                onChange={setField('year')}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
                Color
              </label>
              <input
                className="input-field"
                placeholder="Black, Red…"
                value={form.color}
                onChange={setField('color')}
              />
            </div>
          </div>
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <button
          className="btn-primary w-full mt-5"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? 'Saving…' : 'Add Vehicle'}
        </button>
      </div>
    </div>
  );
}

// ── Main CustomerProfile ───────────────────────────────────────────────────────
export default function CustomerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { shop } = useStore();

  const [customer, setCustomer]   = useState(null);
  const [vehicles, setVehicles]   = useState([]);
  const [bills, setBills]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showAddVehicle, setShowAddVehicle] = useState(false);

  useEffect(() => {
    if (!shop) return;
    loadData();
  }, [shop, id]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load customer
      const { data: custData, error: custErr } = await supabase
        .from('customers')
        .select('*')
        .eq('id', id)
        .eq('shop_id', shop.id)
        .single();

      if (custErr || !custData) {
        navigate('/customers', { replace: true });
        return;
      }
      setCustomer(mapCustomer(custData));

      // Load vehicles from books.vehicles (proper table, not old TEXT[])
      const { data: vehicleData } = await supabase
        .from('vehicles')
        .select('*')
        .eq('customer_id', id)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: true });

      setVehicles((vehicleData || []).map(mapVehicle));

      // Load bills
      const { data: billData, error: billErr } = await supabase
        .from('bills')
        .select('*')
        .eq('customer_id', id)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false });

      if (!billErr) {
        setBills((billData || []).map(mapBill));
      }
    } catch (err) {
      console.error('CustomerProfile error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleVehicleSaved = (v) => {
    setVehicles((prev) => [...prev, v]);
    setShowAddVehicle(false);
  };

  const totalSpent = bills
    .filter((b) => b.type === 'bill')
    .reduce((sum, b) => sum + (b.grandTotal || 0), 0);
  const billCount  = bills.filter((b) => b.type === 'bill').length;
  const estCount   = bills.filter((b) => b.type === 'estimate').length;

  const formatDate = (ts) => {
    if (!ts) return '—';
    return new Date(ts).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  const statusColor = (status) => {
    const map = {
      paid:    'bg-green-100 text-green-700',
      advance: 'bg-amber-100 text-amber-700',
      unpaid:  'bg-red-100 text-red-700',
      draft:   'bg-gray-100 text-gray-600',
    };
    return map[status] || 'bg-gray-100 text-gray-600';
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-brand-light">
      <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!customer) return null;

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto pb-6">
      {/* Header */}
      <header className="bg-brand-dark text-white px-4 py-3 flex items-center gap-3 sticky top-0 z-10 shadow-md">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-lg truncate">{customer.name}</h1>
          <p className="text-xs text-brand-light">{t('customerProfile.title')}</p>
        </div>
        {customer.phone && (
          <a href={`tel:${customer.phone}`} className="p-1.5 rounded-xl bg-white/10">
            <Phone className="w-5 h-5" />
          </a>
        )}
      </header>

      <div className="p-4 space-y-4">
        {/* Customer info card */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-brand-mid rounded-2xl flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl font-bold">
                {customer.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div>
              <p className="font-bold text-brand-dark text-lg">{customer.name}</p>
              {customer.phone && (
                <p className="text-sm text-gray-500 font-mono">{customer.phone}</p>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <StatCard icon={Receipt}     label={t('customerProfile.totalBills')} value={billCount} color="text-brand-dark" />
          <StatCard icon={FileText}    label={t('customerProfile.estimates')}  value={estCount}  color="text-blue-600"  />
          <StatCard icon={IndianRupee} label={t('customerProfile.totalSpent')} value={`₹${totalSpent.toLocaleString('en-IN')}`} color="text-green-600" />
        </div>

        {/* Vehicles section */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-brand-mid uppercase tracking-wide">
              {t('customerProfile.vehicles')} ({vehicles.length})
            </p>
            <button
              onClick={() => setShowAddVehicle(true)}
              className="flex items-center gap-1 text-xs font-semibold text-brand-mid bg-brand-light px-2.5 py-1.5 rounded-lg"
            >
              <Plus className="w-3.5 h-3.5" /> Add Vehicle
            </button>
          </div>

          {vehicles.length === 0 ? (
            <div className="text-center py-4">
              <Bike className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No vehicles yet</p>
              <p className="text-xs text-gray-300 mt-0.5">Add one to link it to future bills</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="flex items-center gap-3 bg-brand-light/50 rounded-xl p-3"
                >
                  <span className="text-2xl flex-shrink-0">
                    {VEHICLE_TYPE_EMOJIS[v.vehicleType] || '🚘'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-brand-dark text-sm font-mono">
                      {v.vehicleNo}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {[v.vehicleBrand, v.vehicleModel, v.year].filter(Boolean).join(' · ') || v.vehicleType || '—'}
                    </p>
                  </div>
                  {v.color && (
                    <span className="text-xs text-gray-400 capitalize flex-shrink-0">{v.color}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bills & Estimates history */}
        <div>
          <p className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-2">
            {t('customerProfile.history')}
          </p>

          {bills.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 shadow-sm">
              <Receipt className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>{t('customerProfile.noHistory')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bills.map((bill) => (
                <button
                  key={bill.id}
                  className="w-full bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-left flex items-center justify-between active:bg-gray-50"
                  onClick={() => navigate(
                    bill.type === 'estimate' ? `/estimate/${bill.id}` : `/bill/${bill.id}`
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      bill.type === 'estimate' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                      {bill.type === 'estimate'
                        ? <FileText className="w-5 h-5 text-blue-600" />
                        : <Receipt className="w-5 h-5 text-green-600" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-dark text-sm truncate">
                        {bill.vehicleNo || '—'}
                        <span className="ml-2 text-xs text-gray-400 font-normal">
                          #{bill.type === 'estimate' ? bill.estimateNumber : bill.billNumber}
                        </span>
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-400">{formatDate(bill.createdAt)}</span>
                        {bill.status && (
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${statusColor(bill.status)}`}>
                            {bill.status}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <span className="font-bold text-brand-dark text-sm">
                      ₹{(bill.grandTotal || 0).toLocaleString('en-IN')}
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-300" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Add Vehicle Modal */}
      {showAddVehicle && (
        <AddVehicleModal
          shopId={shop.id}
          customerId={id}
          onSave={handleVehicleSaved}
          onClose={() => setShowAddVehicle(false)}
        />
      )}
    </div>
  );
}
