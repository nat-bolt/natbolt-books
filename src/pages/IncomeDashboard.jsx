import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowLeft, TrendingUp, Receipt, IndianRupee,
  Banknote, AlertCircle, Crown, Lock, Package
} from 'lucide-react';
import { supabase, mapBill } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';

// ── Tiny bar chart ─────────────────────────────────────────────────────────────
function MiniBarChart({ data }) {
  if (!data.length) return null;
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-0.5 h-24">
      {data.map((d, i) => {
        const pct = max > 0 ? (d.value / max) * 100 : 0;
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div
              className="w-full bg-brand-mid rounded-t-sm transition-all"
              style={{ height: `${pct}%`, minHeight: d.value > 0 ? '4px' : '0' }}
            />
            <span className="text-[9px] text-gray-400 truncate w-full text-center">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color = 'text-brand-dark', bg = 'bg-white' }) {
  return (
    <div className={`${bg} rounded-2xl p-4 shadow-sm`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Upgrade wall ───────────────────────────────────────────────────────────────
function UpgradeWall({ onUpgrade }) {
  const { t } = useTranslation();
  return (
    <Layout title={t('income.title')}>
      <div className="flex flex-col items-center justify-center p-6 text-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
        <div className="w-20 h-20 bg-amber-100 rounded-3xl flex items-center justify-center mx-auto mb-6">
          <Lock className="w-10 h-10 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-brand-dark mb-2">{t('income.paidFeature')}</h2>
        <p className="text-gray-500 text-sm mb-8 max-w-xs">{t('income.upgradePrompt')}</p>
        <div className="space-y-3 w-full max-w-sm">
          <div className="inline-block bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            Save 38% • Limited Time Offer
          </div>
          <button className="btn-primary flex items-center gap-2 px-6 py-3 w-full justify-center" onClick={onUpgrade}>
            <Crown className="w-5 h-5" />
            <span>Unlock unlimited billing — <span className="line-through opacity-60">₹799</span> ₹499/month</span>
          </button>
        </div>
      </div>
    </Layout>
  );
}

// ── Period helpers ─────────────────────────────────────────────────────────────
const PERIODS = ['today', 'thisWeek', 'thisMonth'];
const PERIOD_LABELS = { today: 'Today', thisWeek: 'This Week', thisMonth: 'This Month' };

function getPeriodRange(period) {
  const now = new Date();
  if (period === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end   = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  if (period === 'thisWeek') {
    const day   = now.getDay();
    const diff  = now.getDate() - day + (day === 0 ? -6 : 1); // Monday start
    const start = new Date(now.getFullYear(), now.getMonth(), diff);
    return { start: start.toISOString(), end: now.toISOString() };
  }
  // thisMonth
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return { start: start.toISOString(), end: now.toISOString() };
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function IncomeDashboard() {
  const navigate     = useNavigate();
  const { t }        = useTranslation();
  const { shop }     = useStore();
  const [searchParams] = useSearchParams();

  // Read initial period from URL params (e.g., /income?period=today)
  const initialPeriod = searchParams.get('period') || 'thisMonth';
  const validPeriod = PERIODS.includes(initialPeriod) ? initialPeriod : 'thisMonth';

  const [period, setPeriod]   = useState(validPeriod);
  const [bills, setBills]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // Gate: paid plan only
  if (shop && shop.plan !== 'paid') {
    return <UpgradeWall onUpgrade={() => navigate('/settings')} />;
  }

  useEffect(() => {
    if (!shop) return;
    loadBills();
  }, [shop, period]);

  const loadBills = async () => {
    setLoading(true);
    setError('');
    try {
      const { start, end } = getPeriodRange(period);

      const { data, error: err } = await supabase
        .from('bills')
        .select('*')
        .eq('shop_id', shop.id)
        .eq('type', 'bill')
        .neq('status', 'void')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: true });

      if (err) throw err;
      setBills((data || []).map(mapBill));
    } catch (err) {
      console.error('IncomeDashboard loadBills:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ── Derived stats ──────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const totalRevenue = bills.reduce((s, b) => s + (b.grandTotal || 0), 0);
    const collected    = bills.reduce((s, b) => {
      if (b.status === 'paid')    return s + (b.grandTotal || 0);
      if (b.status === 'advance') return s + (b.paidAmount || 0);
      return s;
    }, 0);
    const outstanding = totalRevenue - collected;
    const avgValue    = bills.length > 0 ? Math.round(totalRevenue / bills.length) : 0;

    const byMode = { cash: 0, upi: 0, advance: 0, unpaid: 0 };
    bills.forEach((b) => {
      if (b.status === 'paid') {
        if ((b.paymentMode || '').toLowerCase() === 'upi') byMode.upi  += b.grandTotal || 0;
        else                                               byMode.cash += b.grandTotal || 0;
      } else if (b.status === 'advance') {
        byMode.advance += b.paidAmount || 0;
      } else {
        byMode.unpaid += b.grandTotal || 0;
      }
    });

    return { totalRevenue, collected, outstanding, avgValue, byMode };
  }, [bills]);

  // ── Top parts / services frequency ────────────────────────────────────────
  const topParts = useMemo(() => {
    const map = {};
    bills.forEach((bill) => {
      (bill.items || []).forEach((item) => {
        const name = item.name || 'Unknown';
        if (!map[name]) map[name] = { name, count: 0, revenue: 0 };
        map[name].count   += item.qty || 1;
        map[name].revenue += item.total || 0;
      });
    });
    return Object.values(map)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [bills]);

  // ── Daily chart data (thisMonth only) ─────────────────────────────────────
  const dailyData = useMemo(() => {
    if (period !== 'thisMonth') return [];
    const now         = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const map = {};
    for (let d = 1; d <= daysInMonth; d++) map[d] = 0;

    bills.forEach((b) => {
      const day = new Date(b.createdAt).getDate();
      map[day] = (map[day] || 0) + (b.grandTotal || 0);
    });

    return Object.entries(map).map(([day, value]) => ({ label: day, value }));
  }, [bills, period]);

  const modeColours = {
    cash:    'bg-green-100 text-green-700',
    upi:     'bg-blue-100 text-blue-700',
    advance: 'bg-amber-100 text-amber-700',
    unpaid:  'bg-red-100 text-red-700',
    paid:    'bg-green-100 text-green-700',
    void:    'bg-gray-100 text-gray-500',
  };

  return (
    <div className="min-h-screen bg-gray-50 max-w-lg mx-auto"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}>
      {/* Header
          paddingTop includes env(safe-area-inset-top) so content clears the Dynamic Island
          and notch on all iPhone models when installed as a PWA (black-translucent status bar). */}
      <header
        className="bg-brand-dark text-white px-4 flex items-center gap-3 sticky top-0 z-10 shadow-md"
        style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)', paddingBottom: '12px' }}
      >
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-xl bg-white/10">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="font-bold text-lg">{t('income.title')}</h1>
          <p className="text-xs text-brand-light flex items-center gap-1">
            <Crown className="w-3 h-3" /> {t('income.paidFeature')}
          </p>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {/* Period toggle */}
        <div className="flex bg-white rounded-2xl p-1 shadow-sm gap-1">
          {PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-colors ${
                period === p ? 'bg-brand-mid text-white' : 'text-gray-500'
              }`}
            >
              {t(`income.${p}`, { defaultValue: PERIOD_LABELS[p] })}
            </button>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-10 h-10 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
          </div>
        ) : bills.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center text-gray-400 shadow-sm">
            <TrendingUp className="w-10 h-10 mx-auto mb-2 text-gray-300" />
            <p className="font-medium">No bills found</p>
            <p className="text-xs mt-1">No completed bills for {PERIOD_LABELS[period].toLowerCase()}</p>
          </div>
        ) : (
          <>
            {/* ── Key stats ── */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                icon={IndianRupee}
                label="Total Revenue"
                value={`₹${stats.totalRevenue.toLocaleString('en-IN')}`}
                color="text-brand-dark"
              />
              <StatCard
                icon={Receipt}
                label="Total Bills"
                value={bills.length}
                sub={`avg ₹${stats.avgValue.toLocaleString('en-IN')}`}
                color="text-brand-mid"
              />
              <StatCard
                icon={Banknote}
                label="Collected"
                value={`₹${stats.collected.toLocaleString('en-IN')}`}
                color="text-green-600"
                bg="bg-green-50"
              />
              <StatCard
                icon={AlertCircle}
                label="Outstanding"
                value={`₹${stats.outstanding.toLocaleString('en-IN')}`}
                color={stats.outstanding > 0 ? 'text-red-500' : 'text-gray-400'}
                bg={stats.outstanding > 0 ? 'bg-red-50' : 'bg-white'}
              />
            </div>

            {/* ── Payment breakdown ── */}
            {Object.values(stats.byMode).some((v) => v > 0) && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-3">
                  Payment Breakdown
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(stats.byMode).map(([mode, amount]) =>
                    amount > 0 ? (
                      <div
                        key={mode}
                        className={`flex items-center justify-between px-3 py-2 rounded-xl ${modeColours[mode]}`}
                      >
                        <span className="text-xs font-semibold capitalize">{mode}</span>
                        <span className="text-xs font-bold">₹{amount.toLocaleString('en-IN')}</span>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* ── Daily chart (thisMonth) ── */}
            {period === 'thisMonth' && dailyData.some((d) => d.value > 0) && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-3">
                  Daily Revenue
                </p>
                <MiniBarChart data={dailyData} />
              </div>
            )}

            {/* ── Top Parts & Services ── */}
            {topParts.length > 0 && (
              <div className="bg-white rounded-2xl p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-3">
                  <Package className="w-4 h-4 text-brand-mid" />
                  <p className="text-xs font-bold text-brand-mid uppercase tracking-wide">
                    Top Parts &amp; Services
                  </p>
                </div>
                <div className="space-y-2.5">
                  {topParts.map((part, i) => {
                    const barPct = topParts[0].count > 0
                      ? (part.count / topParts[0].count) * 100
                      : 0;
                    return (
                      <div key={part.name}>
                        <div className="flex items-center justify-between text-xs mb-0.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-gray-400 font-bold w-4 shrink-0">#{i + 1}</span>
                            <span className="font-medium text-gray-800 truncate">{part.name}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0 ml-2">
                            <span className="text-gray-500">{part.count}×</span>
                            <span className="font-bold text-brand-dark">
                              ₹{part.revenue.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-brand-mid rounded-full"
                            style={{ width: `${barPct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Recent bills ── */}
            <div>
              <p className="text-xs font-bold text-brand-mid uppercase tracking-wide mb-2">
                Recent Bills
              </p>
              <div className="space-y-2">
                {[...bills].reverse().slice(0, 15).map((bill) => (
                  <button
                    key={bill.id}
                    className="w-full bg-white rounded-2xl px-4 py-3 shadow-sm border border-gray-100 text-left flex items-center justify-between active:bg-gray-50"
                    onClick={() => navigate(`/bill/${bill.id}`)}
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-dark text-sm truncate">
                        {bill.customerName || bill.vehicleNo || '—'}
                      </p>
                      <p className="text-xs text-gray-400">
                        #{bill.billNumber} · {bill.vehicleNo}
                      </p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="font-bold text-brand-dark text-sm">
                        ₹{(bill.grandTotal || 0).toLocaleString('en-IN')}
                      </p>
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${
                        modeColours[bill.status] || modeColours.unpaid
                      }`}>
                        {bill.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
