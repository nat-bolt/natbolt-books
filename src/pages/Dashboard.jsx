import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Receipt, FileText, TrendingUp,
  AlertCircle, Download, Users, Lock, Crown, X, LockOpen
} from 'lucide-react';
import { supabase, mapBill } from '../supabase';
import useStore from '../store/useStore';
import Layout from '../components/Layout';
import InlineNotice from '../components/InlineNotice';
import StatusBadge from '../components/StatusBadge';
import { exportBillsCSV } from '../utils/exportCsv';
import { FREE_BILL_LIMIT } from '../config';

const FREE_LIMIT = FREE_BILL_LIMIT;

// ── Upgrade modal (shown when free user taps a paid feature) ──────────────────
function UpgradeModal({ feature, onClose, onUpgrade }) {
  const { t } = useTranslation();
  // Rendered via createPortal so it escapes the Layout <main> overflow/stacking
  // context — fixes modals appearing behind the bottom nav on iOS WebKit PWA.
  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="relative bg-white rounded-3xl p-6 text-center max-h-[85vh] overflow-y-auto"
        style={{ width: 'calc(100vw - 32px)', maxWidth: '480px' }}
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
        <div className="flex justify-center mb-4">
          <div className="inline-block bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
            Save 38% • Limited Time Offer
          </div>
        </div>
        <button
          className="btn-accent w-full flex items-center justify-center gap-2 py-3"
          onClick={onUpgrade}
        >
          <Crown className="w-4 h-4" />
          <span>{t('dashboard.upgradeFeatureCta')}</span>
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
  const [activityFilter, setActivityFilter] = useState('all');

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
  const isPaid      = shop?.plan === 'paid';
  const isNearLimit = shop?.plan === 'free' && used >= FREE_LIMIT - 5;
  const isAtLimit   = shop?.plan === 'free' && used >= FREE_LIMIT;

  const fmtCurrency = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
  const fmtDate = (ts) => {
    const d = new Date(ts || Date.now());
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
  };

  const statusBadge = (b) => {
    if (b.type === 'estimate') return <StatusBadge variant="estimate" size="md">EST</StatusBadge>;
    if (b.status === 'paid')   return <StatusBadge variant="paid" size="md">PAID</StatusBadge>;
    if (b.status === 'advance') return <StatusBadge variant="advance" size="md">ADV</StatusBadge>;
    if (b.status === 'void')   return <StatusBadge variant="void" size="md">VOID</StatusBadge>;
    return <StatusBadge variant="bill" size="md">BILL</StatusBadge>;
  };

  const activityTabs = [
    { key: 'all', label: t('dashboard.allActivity') },
    { key: 'bills', label: t('dashboard.bills') },
    { key: 'estimates', label: t('dashboard.estimates') },
  ];

  const visibleBills = useMemo(() => {
    if (activityFilter === 'bills') return bills.filter((bill) => bill.type === 'bill');
    if (activityFilter === 'estimates') return bills.filter((bill) => bill.type === 'estimate');
    return bills;
  }, [activityFilter, bills]);

  return (
    <Layout title={shop?.shopName || t('appName')}>
      <div className="space-y-5 p-4">
        <section className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">
            {t('dashboard.today')}
          </p>
          <h2 className="truncate text-2xl font-bold text-brand-dark">
            {shop?.shopName || t('appName')}
          </h2>
        </section>

        {isAtLimit ? (
          <InlineNotice
            tone="danger"
            icon={AlertCircle}
            title={t('dashboard.limitReached')}
            action={(
              <button
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-bold text-white"
                onClick={() => navigate('/settings')}
              >
                {t('dashboard.upgradeNow')}
              </button>
            )}
          />
        ) : isNearLimit ? (
          <InlineNotice
            compact
            tone="warning"
            icon={AlertCircle}
            action={(
              <button
                className="text-xs font-bold text-accent"
                onClick={() => navigate('/settings')}
              >
                {t('dashboard.upgradeNow')}
              </button>
            )}
          >
            {t('dashboard.freePlanBanner', { used })}
          </InlineNotice>
        ) : null}

        {!isPaid ? (
          <div className="rounded-[28px] border border-brand-mid/15 bg-gradient-to-r from-white to-brand-light px-4 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StatusBadge variant="warning" size="md">
                    FREE
                  </StatusBadge>
                  <p className="truncate text-sm font-semibold text-brand-dark">
                    {t('settings.freePlan')}
                  </p>
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  {t('settings.billsUsedThisMonth', { used })}
                </p>
              </div>
              <button
                className="rounded-xl bg-accent px-3 py-2 text-xs font-bold text-white shadow-sm"
                onClick={() => navigate('/settings')}
              >
                {t('dashboard.upgradeNow')}
              </button>
            </div>
          </div>
        ) : null}

        <section className="space-y-3">
          <p className="section-label">{t('dashboard.startBilling')}</p>

          <button
            className="btn-accent flex w-full items-center justify-center gap-2 rounded-[24px] py-4 text-sm font-bold shadow-md disabled:opacity-50"
            onClick={() => navigate('/estimate/new?mode=bill')}
            disabled={isAtLimit}
          >
            <Receipt className="h-5 w-5" />
            {t('dashboard.newBill')}
          </button>

          <div className="grid grid-cols-2 gap-3">
            {isPaid ? (
              <button
                className="card relative flex items-center justify-center gap-2 px-4 pr-10 py-4 text-sm font-bold text-brand-dark active:bg-brand-light"
                onClick={() => navigate('/estimate/new')}
                disabled={isAtLimit}
              >
                <LockOpen className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-green-500" />
                <FileText className="h-5 w-5 text-brand-mid" />
                <span className="whitespace-nowrap">{t('dashboard.newEstimate')}</span>
              </button>
            ) : (
              <button
                className="relative flex items-center justify-center gap-2 rounded-[24px] border-2 border-dashed border-brand-mid bg-brand-light px-4 pr-10 py-4 text-sm font-bold text-brand-mid"
                onClick={() => setUpgradeModal(t('dashboard.newEstimate'))}
              >
                <Lock className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 opacity-60" />
                <FileText className="h-5 w-5" />
                <span className="whitespace-nowrap">{t('dashboard.newEstimate')}</span>
              </button>
            )}

            <button
              className={`card relative flex items-center justify-center gap-2 py-4 text-sm font-bold ${
                isPaid ? 'text-brand-dark active:bg-brand-light' : 'text-gray-500'
              }`}
              onClick={() => {
                if (!isPaid) { setUpgradeModal(t('dashboard.customers')); return; }
                navigate('/customers');
              }}
            >
              {!isPaid ? (
                <Lock className="absolute right-3 top-3 h-3.5 w-3.5 text-gray-400" />
              ) : null}
              <Users className={`h-5 w-5 ${isPaid ? 'text-brand-mid' : 'text-gray-400'}`} />
              {t('dashboard.customers')}
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <p className="section-label">{t('dashboard.overview')}</p>
          <div className="grid grid-cols-3 gap-3">
            <button
              className="card relative text-center transition-colors active:bg-brand-light"
              onClick={() => {
                if (!isPaid) { setUpgradeModal(t('dashboard.income')); return; }
                navigate('/income?period=today');
              }}
            >
              {!isPaid ? <Lock className="absolute right-3 top-3 h-3 w-3 text-gray-400" /> : null}
              <p className="text-2xl font-bold text-brand-dark">{stats.today}</p>
              <p className="mt-0.5 text-xs text-gray-500">{t('dashboard.today')}</p>
            </button>
            <button
              className="card relative text-center transition-colors active:bg-brand-light"
              onClick={() => {
                if (!isPaid) { setUpgradeModal(t('dashboard.income')); return; }
                navigate('/income?period=thisMonth');
              }}
            >
              {!isPaid ? <Lock className="absolute right-3 top-3 h-3 w-3 text-gray-400" /> : null}
              <p className="text-2xl font-bold text-brand-dark">{stats.month}</p>
              <p className="mt-0.5 text-xs text-gray-500">{t('dashboard.thisMonth')}</p>
            </button>
            <button
              className="card relative text-center transition-colors active:bg-brand-light"
              onClick={() => {
                if (!isPaid) { setUpgradeModal(t('dashboard.income')); return; }
                navigate('/income?period=thisMonth');
              }}
            >
              {!isPaid ? <Lock className="absolute right-3 top-3 h-3 w-3 text-gray-400" /> : null}
              <p className="text-lg font-bold text-green-600">{fmtCurrency(stats.revenue)}</p>
              <p className="mt-0.5 text-xs text-gray-500">{t('dashboard.monthRevenue')}</p>
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <p className="section-label">{t('dashboard.quickTools')}</p>
          <div className="grid grid-cols-2 gap-3">
            <button
              className="card relative flex items-center gap-3 px-4 py-4 text-left active:bg-brand-light"
              onClick={() => {
                if (!isPaid) { setUpgradeModal(t('dashboard.income')); return; }
                navigate('/income');
              }}
            >
              {!isPaid ? <Lock className="absolute right-3 top-3 h-3 w-3 text-gray-400" /> : <LockOpen className="absolute right-3 top-3 h-3 w-3 text-green-500" />}
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isPaid ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                <TrendingUp className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="whitespace-nowrap text-sm font-semibold text-brand-dark">{t('dashboard.income')}</p>
              </div>
            </button>

            <button
              className="card relative flex items-center gap-3 px-4 py-4 text-left active:bg-brand-light"
              onClick={() => {
                if (!isPaid) { setUpgradeModal(t('dashboard.exportCsv')); return; }
                exportBillsCSV(bills, shop);
              }}
            >
              {!isPaid ? <Lock className="absolute right-3 top-3 h-3 w-3 text-gray-400" /> : <LockOpen className="absolute right-3 top-3 h-3 w-3 text-green-500" />}
              <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${isPaid ? 'bg-brand-light text-brand-mid' : 'bg-gray-100 text-gray-400'}`}>
                <Download className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="whitespace-nowrap text-sm font-semibold text-brand-dark">{t('dashboard.exportCsv')}</p>
              </div>
            </button>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="section-label">{t('dashboard.recentActivity')}</p>
            <div className="flex gap-2">
              {activityTabs.map((tab) => (
                <button
                  key={tab.key}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    activityFilter === tab.key
                      ? 'bg-brand-mid text-white'
                      : 'bg-white text-gray-500 shadow-sm'
                  }`}
                  onClick={() => setActivityFilter(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-4 border-brand-mid border-t-transparent rounded-full animate-spin" />
            </div>
          ) : visibleBills.length === 0 ? (
            <div className="card py-10 text-center">
              <Receipt className="mx-auto mb-3 h-12 w-12 text-gray-300" />
              <p className="text-sm text-gray-500">{t('dashboard.noBills')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleBills.map((bill) => (
                <button
                  key={bill.id}
                  className="card flex w-full items-center gap-3 text-left active:bg-gray-50"
                  onClick={() =>
                    navigate(bill.type === 'estimate' ? `/estimate/${bill.id}` : `/bill/${bill.id}`)
                  }
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl bg-brand-light">
                    {bill.type === 'estimate'
                      ? <FileText className="h-5 w-5 text-brand-mid" />
                      : <Receipt className="h-5 w-5 text-brand-mid" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {bill.billNumber || bill.estimateNumber}
                      </p>
                      {statusBadge(bill)}
                    </div>
                    <p className="truncate text-xs text-gray-500">
                      {bill.vehicleNo} • {bill.customerName}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-bold text-brand-dark">
                      ₹{Number(bill.grandTotal || 0).toLocaleString('en-IN')}
                    </p>
                    <p className="text-xs text-gray-400">{fmtDate(bill.createdAt)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        {!isPaid ? (
          <div className="rounded-[28px] border border-brand-mid/15 bg-gradient-to-r from-white to-amber-50 px-4 py-4 shadow-sm">
            <div className="flex items-start gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-600">
                <Crown className="h-6 w-6" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand-dark">{t('dashboard.upgradeFeatureTitle')}</p>
                <p className="mt-1 text-xs leading-5 text-gray-500">{t('dashboard.upgradeSummary')}</p>
              </div>
            </div>
            <button
              className="btn-accent mt-4 w-full py-3 text-sm font-bold"
              onClick={() => navigate('/settings')}
            >
              {t('dashboard.upgradeFeatureCta')}
            </button>
          </div>
        ) : null}
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
