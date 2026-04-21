import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Phone, FileText, Receipt,
  ChevronRight, Calendar, IndianRupee,
  Plus, X, Bike, Lock, Crown, Clock3,
} from 'lucide-react';
import { supabase, mapCustomer, mapBill, mapVehicle } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import StatusBadge from '../components/StatusBadge';
import { VEHICLE_TYPES, getBrandsForType, getModelsForBrand } from '../data/vehicles';

// ── Upgrade wall (shown when free user tries to access customer profile) ─────
function UpgradeWall({ onUpgrade }) {
  const { t } = useTranslation();
  return (
    <Layout title={t('customerProfile.title')} showBack showNav={false} showLanguage={false}>
      <div className="flex flex-col items-center justify-center p-6 text-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-brand-dark mb-2">{t('customerProfile.paidFeatureTitle')}</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-xs">
          {t('customerProfile.paidFeatureBody')}
        </p>
        <div className="space-y-3 w-full max-w-sm">
          <div className="inline-block bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            {t('estimate.paidFeatureOffer')}
          </div>
          <button className="btn-primary flex items-center gap-2 px-6 py-3 w-full justify-center" onClick={onUpgrade}>
            <Crown className="w-5 h-5" />
            <span>{t('dashboard.upgradeFeatureCta')}</span>
          </button>
        </div>
      </div>
    </Layout>
  );
}

// ── Vehicle type icon helper ──────────────────────────────────────────────────
const VEHICLE_TYPE_EMOJIS = {
  bike: '🏍️', scooter: '🛵', moped: '🛵', electric: '⚡',
  other: '🚘',
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
  const { t } = useTranslation();
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
  const typeLabel = (value) => t(`vehicle.types.${value}`, { defaultValue: value });

  const handleSave = async () => {
    const vehicleNo = form.vehicle_no.trim().toUpperCase();
    if (!vehicleNo) { setError(t('estimate.vehicleRequired')); return; }

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
      setError(err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-[80]" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg mx-auto rounded-t-3xl px-6 pt-6 max-h-[90vh] overflow-y-auto shadow-2xl"
        style={{
          maxHeight: 'calc(var(--app-height) - var(--safe-top) - 16px)',
          paddingBottom: 'calc(var(--safe-bottom) + 20px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 -mx-6 mb-5 flex items-center justify-between bg-white px-6 pb-3 pt-1">
          <h2 className="text-lg font-bold text-brand-dark">{t('customerProfile.addVehicle')}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="space-y-3">
          {/* Vehicle Number */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
              {t('vehicle.number')} *
            </label>
            <input
              className="input-field uppercase"
              placeholder={t('vehicle.numberPlaceholder')}
              value={form.vehicle_no}
              onChange={setField('vehicle_no')}
            />
          </div>

          {/* Type */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
              {t('vehicle.type')}
            </label>
            <select className="input-field" value={form.vehicle_type} onChange={handleTypeChange}>
              {VEHICLE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {VEHICLE_TYPE_EMOJIS[t.value]} {typeLabel(t.value)}
                </option>
              ))}
            </select>
          </div>

          {/* Brand */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
              {t('vehicle.brand')}
            </label>
            {brands.length > 0 ? (
              <select className="input-field" value={form.vehicle_brand} onChange={handleBrandChange}>
                <option value="">{t('vehicle.selectBrand')}</option>
                {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                <option value="__other__">{t('vehicle.otherTypeBelow')}</option>
              </select>
            ) : (
              <input className="input-field" placeholder={t('vehicle.brandPlaceholder')}
                value={form.vehicle_brand} onChange={setField('vehicle_brand')} />
            )}
            {/* Free-type fallback when "Other" selected */}
            {form.vehicle_brand === '__other__' && (
              <input className="input-field mt-2" placeholder={t('vehicle.enterBrand')}
                onChange={(e) => setForm((f) => ({ ...f, vehicle_brand: e.target.value, vehicle_model: '' }))} />
            )}
          </div>

          {/* Model */}
          <div>
            <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
              {t('vehicle.model')}
            </label>
            {models.length > 0 && form.vehicle_brand !== '__other__' ? (
              <select className="input-field" value={form.vehicle_model} onChange={setField('vehicle_model')}>
                <option value="">{t('vehicle.selectModel')}</option>
                {models.map((m) => <option key={m} value={m}>{m}</option>)}
                <option value="__other__">{t('vehicle.otherTypeBelow')}</option>
              </select>
            ) : (
              <input className="input-field" placeholder={t('vehicle.modelPlaceholder')}
                value={form.vehicle_model === '__other__' ? '' : form.vehicle_model}
                onChange={setField('vehicle_model')} />
            )}
            {form.vehicle_model === '__other__' && (
              <input className="input-field mt-2" placeholder={t('vehicle.enterModel')}
                onChange={(e) => setForm((f) => ({ ...f, vehicle_model: e.target.value }))} />
            )}
          </div>

          {/* Year & Color (row) */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-1 block">
                {t('vehicle.year')}
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
                {t('vehicle.color')}
              </label>
              <input
                className="input-field"
                placeholder={t('vehicle.colorPlaceholder')}
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
          {saving ? t('settings.saving') : t('customerProfile.addVehicle')}
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
  const [historyFilter, setHistoryFilter] = useState('all');

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
  const lastVisitAt = bills[0]?.createdAt || null;
  const outstanding = bills.reduce((sum, b) => {
    if (b.status === 'unpaid') return sum + Number(b.grandTotal || 0);
    if (b.status === 'advance') return sum + Number(b.balanceDue || 0);
    return sum;
  }, 0);
  const filteredHistory = useMemo(() => {
    if (historyFilter === 'bills') return bills.filter((b) => b.type === 'bill');
    if (historyFilter === 'estimates') return bills.filter((b) => b.type === 'estimate');
    return bills;
  }, [bills, historyFilter]);

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

  // ── Gate: show upgrade wall for free users ────────────────────────────────
  if (shop?.plan !== 'paid') {
    return <UpgradeWall onUpgrade={() => navigate('/settings')} />;
  }

  if (loading) return (
    <Layout title={t('customerProfile.title')} showBack showNav={false} showLanguage={false}>
      <div className="flex justify-center py-16">
        <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
      </div>
    </Layout>
  );
  if (!customer) return null;

  return (
    <Layout
      showBack
      showNav={false}
      showLanguage={false}
      titleNode={(
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold">{customer.name}</h1>
          <p className="text-xs text-brand-light">{t('customerProfile.title')}</p>
        </div>
      )}
      headerRight={customer.phone ? (
        <a href={`tel:${customer.phone}`} className="rounded-xl border border-brand-mid/10 bg-white p-2 text-brand-mid shadow-sm">
          <Phone className="w-5 h-5" />
        </a>
      ) : (
        <div className="w-[34px]" />
      )}
    >
      <div className="p-4 space-y-4">
        <div className="card">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-brand-mid rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
              <span className="text-white text-xl font-bold">
                {customer.name?.charAt(0)?.toUpperCase() || '?'}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-lg font-bold text-brand-dark">{customer.name}</p>
                  {customer.phone ? (
                    <p className="mt-1 text-sm text-gray-500 font-mono">{customer.phone}</p>
                  ) : null}
                </div>
                {outstanding > 0 ? (
                  <StatusBadge variant="danger" size="md">₹{Math.round(outstanding)}</StatusBadge>
                ) : null}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500">
                <div className="rounded-xl bg-brand-light/60 px-3 py-2">
                  <p className="font-semibold text-gray-700">{t('customerProfile.lastVisit')}</p>
                  <p className="mt-1 text-sm font-medium text-brand-dark">{formatDate(lastVisitAt)}</p>
                </div>
                <div className="rounded-xl bg-brand-light/60 px-3 py-2">
                  <p className="font-semibold text-gray-700">{t('customerProfile.customerSince')}</p>
                  <p className="mt-1 text-sm font-medium text-brand-dark">{formatDate(customer.createdAt)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Receipt}     label={t('customerProfile.totalBills')} value={billCount} color="text-brand-dark" />
          <StatCard icon={FileText}    label={t('customerProfile.estimates')}  value={estCount}  color="text-blue-600"  />
          <StatCard icon={Bike}        label={t('customerProfile.vehicles')}   value={vehicles.length} color="text-brand-mid" />
          <StatCard icon={IndianRupee} label={t('customerProfile.totalSpent')} value={`₹${totalSpent.toLocaleString('en-IN')}`} color="text-green-600" />
        </div>

        {/* Vehicles section */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-brand-mid uppercase tracking-wide">
              {t('customerProfile.vehicles')} ({vehicles.length})
            </p>
            <button
              onClick={() => setShowAddVehicle(true)}
              className="flex items-center gap-1 rounded-lg bg-brand-light px-2.5 py-1.5 text-xs font-semibold text-brand-mid"
            >
              <Plus className="w-3.5 h-3.5" /> {t('customerProfile.addVehicle')}
            </button>
          </div>

          {vehicles.length === 0 ? (
            <div className="text-center py-4">
              <Bike className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">{t('customerProfile.noVehicles')}</p>
              <p className="mt-0.5 text-xs text-gray-300">{t('customerProfile.noVehiclesHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {vehicles.map((v) => (
                <div
                  key={v.id}
                  className="rounded-xl border border-brand-light bg-brand-light/50 p-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0">
                      {VEHICLE_TYPE_EMOJIS[v.vehicleType] || '🚘'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate font-bold text-brand-dark text-sm font-mono">
                          {v.vehicleNo}
                        </p>
                        <StatusBadge variant="estimate" className="capitalize normal-case tracking-normal">
                          {v.vehicleType || 'vehicle'}
                        </StatusBadge>
                      </div>
                      <p className="mt-1 truncate text-xs text-gray-500">
                        {[v.vehicleBrand, v.vehicleModel, v.year].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                  </div>
                  {v.color ? (
                    <p className="mt-2 text-right text-xs text-gray-400 capitalize">{v.color}</p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-2">
            {t('customerProfile.history')}
          </p>

          <div className="-mx-1 mb-3 overflow-x-auto overflow-y-hidden px-1">
            <div className="inline-flex min-w-max gap-2">
              {[
                { key: 'all', label: t('customerProfile.filterAll') },
                { key: 'bills', label: t('customerProfile.filterBills') },
                { key: 'estimates', label: t('customerProfile.filterEstimates') },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setHistoryFilter(option.key)}
                  className={`rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap ${
                    historyFilter === option.key ? 'bg-brand-mid text-white' : 'bg-white text-gray-600 border border-gray-200'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="card p-8 text-center text-gray-400">
              <Receipt className="w-10 h-10 mx-auto mb-2 text-gray-300" />
              <p>{t('customerProfile.noHistory')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredHistory.map((bill) => (
                <button
                  key={bill.id}
                  className="card w-full text-left active:bg-gray-50"
                  onClick={() => navigate(
                    bill.type === 'estimate' ? `/estimate/${bill.id}` : `/bill/${bill.id}`
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                      bill.type === 'estimate' ? 'bg-blue-100' : 'bg-green-100'
                    }`}>
                        {bill.type === 'estimate'
                          ? <FileText className="w-5 h-5 text-blue-600" />
                          : <Receipt className="w-5 h-5 text-green-600" />
                        }
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate font-semibold text-brand-dark text-sm">
                            {bill.vehicleNo || '—'}
                          </p>
                          <StatusBadge variant={bill.type === 'estimate' ? 'estimate' : 'bill'}>
                            {bill.type === 'estimate' ? 'JOB' : 'BILL'}
                          </StatusBadge>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-gray-400">
                          #{bill.type === 'estimate' ? bill.estimateNumber : bill.billNumber}
                        </p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                          <Calendar className="w-3 h-3" />
                          <span>{formatDate(bill.createdAt)}</span>
                          {bill.status ? (
                            <StatusBadge
                              variant={
                                bill.status === 'paid' ? 'paid'
                                  : bill.status === 'advance' ? 'advance'
                                  : bill.status === 'void' ? 'void'
                                  : bill.status === 'unpaid' ? 'danger'
                                  : 'neutral'
                              }
                              className="normal-case tracking-normal"
                            >
                              {bill.status}
                            </StatusBadge>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="ml-2 flex shrink-0 items-center gap-2">
                      <div className="text-right">
                        <p className="font-bold text-brand-dark text-sm">
                          ₹{(bill.grandTotal || 0).toLocaleString('en-IN')}
                        </p>
                        {bill.status === 'advance' && bill.balanceDue > 0 ? (
                          <p className="mt-1 text-[11px] font-medium text-red-500">
                            Due ₹{bill.balanceDue.toLocaleString('en-IN')}
                          </p>
                        ) : null}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
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
    </Layout>
  );
}
