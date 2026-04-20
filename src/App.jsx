import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, matchPath } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights, computeRoute } from '@vercel/speed-insights/react';
import { auth } from './firebase';
import { supabase, mapShop } from './supabase';
import './i18n/index';
import useStore from './store/useStore';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Pending = lazy(() => import('./pages/Pending'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewEstimate = lazy(() => import('./pages/NewEstimate'));
const EstimateDetail = lazy(() => import('./pages/EstimateDetail'));
const BillDetail = lazy(() => import('./pages/BillDetail'));
const CustomerList = lazy(() => import('./pages/CustomerList'));
const CustomerProfile = lazy(() => import('./pages/CustomerProfile'));
const PartsCatalogue = lazy(() => import('./pages/PartsCatalogue'));
const IncomeDashboard = lazy(() => import('./pages/IncomeDashboard'));
const Settings = lazy(() => import('./pages/Settings'));

const SPEED_INSIGHTS_ROUTES = [
  '/login',
  '/pending',
  '/admin',
  '/',
  '/estimate/new',
  '/estimate/:id',
  '/bill/:id',
  '/customers',
  '/customers/:id',
  '/parts',
  '/income',
  '/settings',
];

const USER_CONTEXT_CACHE_KEY = 'nb_user_context_v1';

function readCachedUserContext(firebaseUser) {
  if (!firebaseUser?.uid) return null;

  try {
    const raw = localStorage.getItem(USER_CONTEXT_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (parsed?.uid !== firebaseUser.uid) return null;

    return {
      isAdmin: Boolean(parsed.isAdmin),
      shop: parsed.shop || null,
    };
  } catch {
    return null;
  }
}

function writeCachedUserContext(firebaseUser, { isAdmin, shop }) {
  if (!firebaseUser?.uid) return;

  localStorage.setItem(USER_CONTEXT_CACHE_KEY, JSON.stringify({
    uid: firebaseUser.uid,
    isAdmin: Boolean(isAdmin),
    shop: shop || null,
  }));
}

function clearCachedUserContext() {
  localStorage.removeItem(USER_CONTEXT_CACHE_KEY);
}

function SpeedInsightsWithRoute() {
  const location = useLocation();
  const match = SPEED_INSIGHTS_ROUTES
    .map((path) => ({ path, match: matchPath({ path, end: true }, location.pathname) }))
    .find(({ match }) => Boolean(match));

  const route = match?.match
    ? computeRoute(location.pathname, match.match.params)
    : undefined;

  return <SpeedInsights route={route} />;
}

function RouteFallback() {
  return (
    <div
      className="flex items-center justify-center bg-[#F8F3EC]"
      style={{ minHeight: 'var(--app-height, 100dvh)' }}
    >
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-mid border-t-transparent" />
        <p className="text-sm font-medium text-gray-500">Loading…</p>
      </div>
    </div>
  );
}

export default function App() {
  const { setUser, setShop, setIsAdmin, setAuthLoading } = useStore();

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (!isMounted) return;
        setUser(firebaseUser);
        setShop(null);
        setIsAdmin(false);

        const cachedContext = readCachedUserContext(firebaseUser);
        if (cachedContext) {
          setIsAdmin(cachedContext.isAdmin);
          setShop(cachedContext.shop);
          setAuthLoading(false);
        }

        try {
          // ── Single RPC resolves admin + shop in one round trip ───────────────
          const { data: ctx, error: ctxErr } = await supabase.rpc('get_user_context');

          if (!isMounted) return;

          if (ctxErr) {
            console.error('get_user_context error:', ctxErr.message);
          } else if (ctx?.is_admin) {
            setIsAdmin(true);
            setShop(null);
            writeCachedUserContext(firebaseUser, { isAdmin: true, shop: null });
          } else {
            setIsAdmin(false);
            if (ctx?.shop) {
              const mappedShop = mapShop(ctx.shop);
              // Check if shop is deactivated (soft deleted)
              if (mappedShop.deletedAt) {
                // Shop is deactivated - treat as no shop (will redirect to Pending)
                setShop(null);
                console.warn('[App] Shop is deactivated:', mappedShop.shopName);
                writeCachedUserContext(firebaseUser, { isAdmin: false, shop: null });
              } else {
                setShop(mappedShop);
                writeCachedUserContext(firebaseUser, { isAdmin: false, shop: mappedShop });
              }
            } else {
              setShop(null);
              writeCachedUserContext(firebaseUser, { isAdmin: false, shop: null });
            }
          }
        } catch (err) {
          if (isMounted) {
            console.error('Auth init error:', err);
          }
        }
        if (isMounted && !cachedContext) {
          setAuthLoading(false);
        }
      } else {
        // Signed out
        if (!isMounted) return;
        setUser(null);
        setShop(null);
        setIsAdmin(false);
        clearCachedUserContext();
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{ duration: 2500, style: { borderRadius: '12px', fontWeight: '600' } }}
      />
      <Analytics />
      <SpeedInsightsWithRoute />
      <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public */}
          <Route path="/login"   element={<Login />} />
          <Route path="/pending" element={<ProtectedRoute><Pending /></ProtectedRoute>} />
          <Route path="/admin"   element={<ProtectedRoute requireAdmin><AdminPanel /></ProtectedRoute>} />

          {/* Shop-protected routes */}
          <Route path="/" element={
            <ProtectedRoute requireShop><Dashboard /></ProtectedRoute>
          } />
          <Route path="/estimate/new" element={
            <ProtectedRoute requireShop><NewEstimate /></ProtectedRoute>
          } />
          <Route path="/estimate/:id" element={
            <ProtectedRoute requireShop><EstimateDetail /></ProtectedRoute>
          } />
          <Route path="/bill/:id" element={
            <ProtectedRoute requireShop><BillDetail /></ProtectedRoute>
          } />

          {/* Customers */}
          <Route path="/customers" element={
            <ProtectedRoute requireShop><CustomerList /></ProtectedRoute>
          } />
          <Route path="/customers/:id" element={
            <ProtectedRoute requireShop><CustomerProfile /></ProtectedRoute>
          } />

          {/* Parts catalogue */}
          <Route path="/parts" element={
            <ProtectedRoute requireShop><PartsCatalogue /></ProtectedRoute>
          } />

          {/* Income dashboard (paid feature — gate is inside the component) */}
          <Route path="/income" element={
            <ProtectedRoute requireShop><IncomeDashboard /></ProtectedRoute>
          } />

          {/* Settings */}
          <Route path="/settings" element={
            <ProtectedRoute requireShop><Settings /></ProtectedRoute>
          } />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
