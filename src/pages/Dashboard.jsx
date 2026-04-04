import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PlusCircle, Receipt, FileText, TrendingUp,
  AlertCircle, Download, Users, Lock, Crown, X
} from 'lucide-react';
import { supabase, mapBill } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import { exportBillsCSV } from '../utils/exportCsv';
import { FREE_BILL_LIMIT } from '../config';

const FREE_LIMIT = FREE_BILL_LIMIT;

// ── Upgrade modal (shown when free user taps a paid feature) ──────────────────
function UpgradeModal({ feature, onClose, onUpgrade }) {
  // Rendered via createPortal so it escapes the Layout <main> overflow/stacking
  // context — fixes modals appearing behind the bottom nav on iOS WebKit PWA.
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div
        className="relative bg-white w-full max-w-lg mx-auto rounded-t-3xl p-6 text-center max-h-[85vh] overflow-y-auto"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 24px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="absolute top-4 right-4 text-gray-400 p-1" onClick={onClose}>
          <X className="w-5 h-5" />
        </button>
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Lock className="w-8 h-8 text-amber-600" />
        </div>
        <h2 className="text-lg font-bold text-brand-dark mb-1">{t('dashboard.upgradeFeatureTitle')}</h2>
        <p className="text-sm text-gray-500 mb-2">
          <span className="font-semibold text-brand-mid">{feature}</span> is available on the Paid plan.
        </p>
        <p className="text-xs text-gray-400 mb-6">
          {t('dashboard.upgradeFeatureBody')}
        </p>
        <button
          className="btn-accent w-full flex items-center justify-center gap-2 py-3"
          onClick={onUpgrade}
        >
          <Crown className="w-4 h-4" />
          {t('dashboard.upgradeFeatureCta')}
        </button>
        <button className="mt-3 text-sm text-gray-400 w-full py-2" onClick={onClose}>
          {t('dashboard.maybeLater')}
        </button>
      </div>
    </div>,
    document.body
  );
}

export default function Dashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { shop } = useStore();

  const [bills, setBills]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [stats, setStats]         = useState({ today: 0, month: 0, revenue: 0 });
  const [upgradeModal, setUpgradeModal] = useState(''); // '' | feature name string

  useEffect(() => {
    if (!shop) return;
    loadData();
  }, [shop]);

  const loadData = async () => {
    setLoading(true);
    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

      // ── Two parallel queries ──────────────────────────────────────────────────
      // 1. Recent 30 bills for the visible list (display only)
      // 2. All bills from start of month for accurate stats
      //    (only fetches the fields needed — avoids downloading full rows)
      const [listResult, statsResult] = await Promise.all([
        supabase
          .from('bills')
          .select('*')
          .eq('shop_id', shop.id)
          .order('created_at', { ascending: false })
          .limit(30),
        supabase
          .from('bills')
          .select('id, type, status, grand_total, created_at')
          .eq('shop_id', shop.id)
          .gte('created_at', startOfMonth.toISOString()),
      ]);

      if (listResult.error) throw listResult.error;
      if (statsResult.error) throw statsResult.error;

      setBills((listResult.data || []).map(mapBill));

      // Compute accurate stats from the full month dataset
      let todayCount = 0, monthCount = 0, revenue = 0;
      (statsResult.data || []).forEach((b) => {
        const createdAt = new Date(b.created_at);
        monthCount++;
        if (createdAt >= startOfToday) todayCount++;
        if (b.type === 'bill' && b.status !== 'void') {
          revenue += Number(b.grand_total || 0);
        }
      });
      setStats({ today: todayCount, month: monthCount, revenue });
    } catch (err) {
      console.error('Dashboard loadData error:', err);
    } finally {
      setLoading(false);
    }
  };

  const used        = shop?.billsThisMonth || 0;
  const isNearLimit = shop?.plan === 'free' && used >= FREE_LIMIT - 5;
  const isAtLimit   = shop?.plan === 'free' && used >= FREE_LIMIT;

  const fmtCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const fmtDate = (ts) => {
    const d = new Date(ts || Date.now());
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const statusBadge = (b) => {
    if (b.type === 'estimate') return <span className="badge-estimate">EST</span>;
    if (b.status === 'paid')   return <span className="badge-paid">PAID</span>;
    if (b.status === 'advance') return <span className="badge-partial">ADV</span>;
    if (b.status === 'void')   return <span className="badge-void">VOID</span>;
    return <span className="badge-bill">BILL</span>;
  };

  return (
    <Layout title={shop?.shopName || t('appName')}>
      <div className="p-4 space-y-4">

        {/* Free plan banner */}
        {isAtLimit ? (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-red-700 font-medium text-sm">{t('dashboard.limitReached')}</p>
              <button
                className="mt-2 text-xs font-bold text-white bg-accent px-3 py-1.5 rounded-lg"
                onClick={() => navigate('/settings')}
              >
                {t('dashboard.upgradeNow')}
              </button>
            </div>
          </div>
        ) : isNearLimit ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3 flex items-center gap-3">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-amber-700 text-sm flex-1">
              {t('dashboard.freePlanBanner', { used })}
            </p>
            <button
              className="text-xs font-bold text-accent"
              onClick={() => navigate('/settings')}
            >
              {t('dashboard.upgradeNow')}
            </button>
          </div>
        ) : null}

        {/* Stats cards */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-brand-dark">{stats.today}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.today')}</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-brand-dark">{stats.month}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.thisMonth')}</p>
          </div>
          <div className="card text-center">
            <p className="text-lg font-bold text-green-600">{fmtCurrency(stats.revenue)}</p>
            <p className="text-xs text-gray-500 mt-0.5">{t('dashboard.monthRevenue')}</p>
          </div>
        </div>

        {/* New Bill (primary) + New Estimate (paid / secondary for free users) */}
        <div className="flex gap-3">
          {/* New Bill — primary CTA, always accessible on free plan */}
          <button
            className="flex-1 btn-accent flex items-center justify-center gap-2 py-4 rounded-2xl shadow-md text-sm font-bold"
            onClick={() => navigate('/estimate/new?mode=bill')}
            disabled={isAtLimit}
          >
            <Receipt className="w-5 h-5" />
            {t('dashboard.newBill')}
          </button>

          {/* New Estimate — full accent for paid; outlined/secondary for free to signal locked */}
          {shop?.plan === 'paid' ? (
            <button
              className="flex-1 btn-accent flex items-center justify-center gap-2 py-4 rounded-2xl shadow-md text-sm font-bold"
              onClick={() => navigate('/estimate/new')}
              disabled={isAtLimit}
            >
              <FileText className="w-5 h-5" />
              {t('dashboard.newEstimate')}
            </button>
          ) : (
            <button
              className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold
                         border-2 border-dashed border-brand-mid text-brand-mid bg-brand-light relative"
              onClick={() => setUpgradeModal(t('dashboard.newEstimate'))}
            >
              <Lock className="w-3.5 h-3.5 absolute top-2 right-2 opacity-60" />
              <FileText className="w-5 h-5" />
              {t('dashboard.newEstimate')}
            </button>
          )}
        </div>

        {/* Quick action row */}
        <div className="grid grid-cols-3 gap-3">
          <button
            className="card flex flex-col items-center gap-1.5 py-3 active:bg-brand-light"
            onClick={() => navigate('/customers')}
          >
            <Users className="w-5 h-5 text-brand-mid" />
            <span className="text-xs font-semibold text-brand-dark">{t('dashboard.customers')}</span>
          </button>
          <button
            className="card flex flex-col items-center gap-1.5 py-3 active:bg-brand-light"
            onClick={() => navigate('/income')}
          >
            <TrendingUp className={`w-5 h-5 ${shop?.plan === 'paid' ? 'text-green-600' : 'text-gray-400'}`} />
            <span className="text-xs font-semibold text-brand-dark">{t('dashboard.income')}</span>
          </button>
          <button
            className="card flex flex-col items-center gap-1.5 py-3 active:bg-brand-light relative"
            onClick={() => {
              if (shop?.plan !== 'paid') { setUpgradeModal(t('dashboard.exportCsv')); return; }
              exportBillsCSV(bills, shop);
            }}
          >
            {shop?.plan !== 'paid' && <Lock className="w-3 h-3 absolute top-2 right-2 text-gray-400" />}
            <Download className={`w-5 h-5 ${shop?.plan === 'paid' ? 'text-brand-mid' : 'text-gray-400'}`} />
            <span className="text-xs font-semibold text-brand-dark">{t('dashboard.exportCsv')}</span>
          </button>
        </div>

        {/* Recent bills */}
        <div>
          <p className="section-label">{t('dashboard.recentActivity')}</p>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
            </div>
          ) : bills.length === 0 ? (
            <div className="card text-center py-10">
              <Receipt className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{t('dashboard.noBills')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {bills.map((bill) => (
                <button
                  key={bill.id}
                  className="card w-full text-left flex items-center gap-3 active:bg-gray-50"
                  onClick={() =>
                    navigate(bill.type === 'estimate' ? `/estimate/${bill.id}` : `/bill/${bill.id}`)
                  }
                >
                  <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center flex-shrink-0">
                    {bill.type === 'estimate'
                      ? <FileText className="w-5 h-5 text-brand-mid" />
                      : <Receipt className="w-5 h-5 text-brand-mid" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">
                        {bill.billNumber || bill.estimateNumber}
                      </p>
                      {statusBadge(bill)}
                    </div>
                    <p className="text-xs text-gray-500 truncate">
                      {bill.vehicleNo} • {bill.customerName}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm text-brand-dark">
                      ₹{Number(bill.grandTotal || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-400">{fmtDate(bill.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upgrade modal — shown when free user taps a paid feature */}
      {upgradeModal && (
        <UpgradeModal
          feature={upgradeModal}
          onClose={() => setUpgradeModal('')}
          onUpgrade={() => { setUpgradeModal(''); navigate('/settings'); }}
        />
      )}
    </Layout>
  );
}
