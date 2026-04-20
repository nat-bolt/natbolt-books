import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Search, ChevronRight, User, Plus, X, Lock, Crown, Phone, CalendarClock } from 'lucide-react';
import { supabase, mapBill, mapCustomer, mapVehicle } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import { VEHICLE_TYPES, getBrandsForType, getModelsForBrand } from '../data/vehicles';
import { importCustomerIntoShop, searchSharedDirectory } from '../utils/customerDirectory';

// ── Upgrade wall (shown when free user tries to access customer list) ────────
function UpgradeWall({ onUpgrade }) {
  const { t } = useTranslation();
  return (
    <Layout title={t('customer.title')}>
      <div className="flex flex-col items-center justify-center p-6 text-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-brand-dark mb-2">{t('customer.paidFeatureTitle')}</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-xs">
          {t('customer.paidFeatureBody')}
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
        <p className="text-xs text-gray-400 mt-6">
          {t('customer.paidFeatureNote')}
        </p>
      </div>
    </Layout>
  );
}

// ── Add Customer Modal ────────────────────────────────────────────────────────
// Collects: name, phone (required) + optional first vehicle details
function AddCustomerModal({ shop, onSaved, onClose }) {
  const { t } = useTranslation();
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
  const typeLabel = (value) => t(`vehicle.types.${value}`, { defaultValue: value });

  const handleSave = async () => {
    if (!name.trim())  { setError(t('customer.nameRequired')); return; }
    if (!phone.trim()) { setError(t('common.required')); return; }
    if (phone.length !== 10) { setError(t('customer.invalidPhone')); return; }

    setSaving(true);
    setError('');
    try {
      const vehicleNoClean = vNo.trim().toUpperCase();
      const sharedMatches = await searchSharedDirectory({
        shopId: shop.id,
        query: vehicleNoClean || phone.trim(),
      });
      const exactMatch = sharedMatches.find((entry) =>
        entry.customer.phone === phone.trim() ||
        (vehicleNoClean && entry.vehicle?.vehicleNo === vehicleNoClean)
      );
      if (exactMatch) {
        if (exactMatch.isLocal) {
          onSaved(exactMatch.customer, exactMatch.vehicle || null);
          return;
        }
        const imported = await importCustomerIntoShop({ shopId: shop.id, entry: exactMatch });
        onSaved(imported.customer, imported.vehicle || null);
        return;
      }

      // 1. Create customer
      const { data: cust, error: custErr } = await supabase
        .from('customers')
        .insert({ shop_id: shop.id, name: name.trim(), phone: phone.trim() })
        .select()
        .single();
      if (custErr) throw custErr;

      // 2. Create vehicle if at least a vehicle number is provided
      let vehicle = null;
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
        setError(t('customer.duplicatePhone'));
      } else {
        setError(err.message || t('common.error'));
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-end z-[80]" onClick={onClose}>
      <div
        className="bg-white w-full max-w-lg mx-auto rounded-t-3xl px-5 pt-5 max-h-[92vh] overflow-y-auto shadow-2xl"
        style={{
          maxHeight: 'calc(var(--app-height) - var(--safe-top) - 24px)',
          paddingBottom: 'calc(var(--safe-bottom) + 32px)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 -mx-5 mb-5 flex items-center justify-between bg-white px-5 pb-3 pt-1">
          <h2 className="text-lg font-bold text-brand-dark">{t('customer.addCustomer')}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        {/* ── Customer details ───────────────────────────────────────────── */}
        <p className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-3">
          {t('customer.detailsSection')}
        </p>
        <div className="space-y-3">
          <div>
            <label className="section-label">{t('customer.phone')} *</label>
            <input
              className="input-field"
              type="tel"
              inputMode="numeric"
              placeholder={t('customer.phonePlaceholder')}
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
            />
          </div>
          <div>
            <label className="section-label">{t('customer.name')} *</label>
            <input
              className="input-field"
              placeholder={t('customer.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        {/* ── Vehicle details ────────────────────────────────────────────── */}
        <div className="mt-5 pt-4 border-t border-gray-100">

          <div className="space-y-3">
            {/* Vehicle Number */}
            <div>
              <label className="section-label">{t('vehicle.number')}</label>
              <input
                className="input-field uppercase"
                placeholder={t('vehicle.numberPlaceholder')}
                value={vNo}
                onChange={(e) => setVNo(e.target.value)}
              />
            </div>

            {/* Type */}
            <div>
              <label className="section-label">{t('vehicle.type')}</label>
              <select className="input-field" value={vType} onChange={handleTypeChange}>
                {VEHICLE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{typeLabel(t.value)}</option>
                ))}
              </select>
            </div>

            {/* Brand */}
            <div>
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
        </div>

        {error && <p className="text-red-500 text-sm mt-3">{error}</p>}

        <button
          className="btn-primary w-full mt-5"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? t('settings.saving') : t('customer.saveCustomer')}
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
  const [search, setSearch]         = useState('');
  const [filter, setFilter]         = useState('all');
  const [loading, setLoading]       = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    if (!shop) return;
    loadCustomers();
  }, [shop]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const q = search.trim().toLowerCase();

    return customers
      .filter((customer) => {
        const matchesSearch = !q || customer.name?.toLowerCase().includes(q) || customer.phone?.includes(q) || customer.primaryVehicleNo?.toLowerCase().includes(q);
        if (!matchesSearch) return false;

        if (filter === 'pending') return customer.pendingAmount > 0;
        if (filter === 'recent') {
          return customer.lastVisitAt && (now - new Date(customer.lastVisitAt).getTime()) <= 30 * 24 * 60 * 60 * 1000;
        }
        return true;
      })
      .sort((a, b) => {
        if (filter === 'pending' && a.pendingAmount !== b.pendingAmount) {
          return b.pendingAmount - a.pendingAmount;
        }
        const aTime = a.lastVisitAt ? new Date(a.lastVisitAt).getTime() : 0;
        const bTime = b.lastVisitAt ? new Date(b.lastVisitAt).getTime() : 0;
        if (aTime !== bTime) return bTime - aTime;
        return (a.name || '').localeCompare(b.name || '');
      });
  }, [customers, filter, search]);

  const formatVisitDate = (value) => {
    if (!value) return t('common.na');
    return new Date(value).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const loadCustomers = async () => {
    try {
      const [customersResult, vehiclesResult, billsResult] = await Promise.all([
        supabase
          .from('customers')
          .select('*')
          .eq('shop_id', shop.id)
          .order('name'),
        supabase
          .from('vehicles')
          .select('*')
          .eq('shop_id', shop.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('bills')
          .select('id, customer_id, type, status, grand_total, balance_due, vehicle_no, vehicle_brand, vehicle_model, created_at')
          .eq('shop_id', shop.id)
          .order('created_at', { ascending: false }),
      ]);

      if (customersResult.error) throw customersResult.error;
      if (vehiclesResult.error) throw vehiclesResult.error;
      if (billsResult.error) throw billsResult.error;

      const vehicleRows = (vehiclesResult.data || []).map(mapVehicle);
      const billRows = (billsResult.data || []).map(mapBill);

      const vehiclesByCustomer = new Map();
      vehicleRows.forEach((vehicle) => {
        const list = vehiclesByCustomer.get(vehicle.customerId) || [];
        list.push(vehicle);
        vehiclesByCustomer.set(vehicle.customerId, list);
      });

      const billsByCustomer = new Map();
      billRows.forEach((bill) => {
        const list = billsByCustomer.get(bill.customerId) || [];
        list.push(bill);
        billsByCustomer.set(bill.customerId, list);
      });

      const enrichedCustomers = (customersResult.data || []).map((row) => {
        const customer = mapCustomer(row);
        const customerVehicles = vehiclesByCustomer.get(customer.id) || [];
        const customerBills = billsByCustomer.get(customer.id) || [];
        const latestBill = customerBills[0] || null;
        const primaryVehicle = latestBill
          ? {
              vehicleNo: latestBill.vehicleNo,
              vehicleBrand: latestBill.vehicleBrand,
              vehicleModel: latestBill.vehicleModel,
            }
          : (customerVehicles[0] || null);

        const pendingAmount = customerBills.reduce((sum, bill) => {
          if (bill.status === 'unpaid') return sum + Number(bill.grandTotal || 0);
          if (bill.status === 'advance') return sum + Number(bill.balanceDue || 0);
          return sum;
        }, 0);

        return {
          ...customer,
          lastVisitAt: latestBill?.createdAt || null,
          pendingAmount,
          primaryVehicleNo: primaryVehicle?.vehicleNo || '',
          primaryVehicleLabel: [primaryVehicle?.vehicleBrand, primaryVehicle?.vehicleModel].filter(Boolean).join(' '),
        };
      });

      setCustomers(enrichedCustomers);
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
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input-field pl-9"
              placeholder={t('customer.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <button
            type="button"
            className="flex h-12 items-center justify-center gap-1.5 rounded-xl bg-brand-mid px-4 text-sm font-semibold text-white shadow-sm"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="h-4 w-4" />
            {t('common.add')}
          </button>
        </div>

        {!loading ? (
          <>
            <div className="-mx-1 overflow-x-auto overflow-y-hidden px-1 pb-1">
              <div className="inline-flex min-w-max gap-2">
                {[
                  { key: 'all', label: t('customer.filterAll') },
                  { key: 'recent', label: t('customer.filterRecent') },
                  { key: 'pending', label: t('customer.filterPending') },
                ].map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFilter(option.key)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap ${
                      filter === option.key ? 'bg-brand-mid text-white' : 'bg-white text-gray-600 border border-gray-200'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{t('customer.directoryCount', { count: filtered.length, total: customers.length })}</span>
              {filter === 'pending' ? (
                <span className="font-semibold text-red-500">
                  {t('customer.pendingSummary', { count: filtered.length })}
                </span>
              ) : null}
            </div>
          </>
        ) : null}

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="card text-center py-12">
            <User className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {search ? t('customer.noCustomersFound') : t('customer.noCustomersYet')}
            </p>
            {!search && (
              <button
                className="mt-4 btn-primary text-sm px-5 py-2"
                onClick={() => setShowAddModal(true)}
              >
                + {t('customer.addFirstCustomer')}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((c) => (
              <button
                key={c.id}
                className="card w-full text-left active:bg-gray-50"
                onClick={() => navigate(`/customers/${c.id}`)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl bg-brand-light flex items-center justify-center font-bold text-brand-mid text-lg flex-shrink-0">
                    {c.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-brand-dark">{c.name}</p>
                        <div className="mt-1 flex items-center gap-1.5 text-sm text-gray-500">
                          <Phone className="h-3.5 w-3.5" />
                          <span>{c.phone}</span>
                        </div>
                      </div>
                      {c.pendingAmount > 0 ? (
                        <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-semibold text-red-500">
                          ₹{Math.round(c.pendingAmount)}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 text-xs text-gray-500">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-700">
                          {c.primaryVehicleNo || t('common.na')}
                        </p>
                        <p className="truncate">{c.primaryVehicleLabel || t('customer.vehiclePending')}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="flex items-center justify-end gap-1 text-gray-400">
                          <CalendarClock className="h-3.5 w-3.5" />
                          <span>{t('customer.lastVisit')}</span>
                        </div>
                        <p className="mt-0.5 font-medium text-gray-700">{formatVisitDate(c.lastVisitAt)}</p>
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="mt-2 w-4 h-4 text-gray-400 flex-shrink-0" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

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
