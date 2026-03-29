import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { Toaster } from 'react-hot-toast';
import { auth } from './firebase';
import { supabase, mapShop } from './supabase';
import './i18n/index';
import useStore from './store/useStore';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login            from './pages/Login';
import Pending          from './pages/Pending';
import AdminPanel       from './pages/AdminPanel';
import Dashboard        from './pages/Dashboard';
import NewEstimate      from './pages/NewEstimate';
import EstimateDetail   from './pages/EstimateDetail';
import BillDetail       from './pages/BillDetail';
import CustomerList     from './pages/CustomerList';
import CustomerProfile  from './pages/CustomerProfile';
import PartsCatalogue   from './pages/PartsCatalogue';
import IncomeDashboard  from './pages/IncomeDashboard';
import Settings         from './pages/Settings';

export default function App() {
  const { setUser, setShop, setIsAdmin, setAuthLoading } = useStore();

  useEffect(() => {
    let isMounted = true; // Track mount status to prevent state updates after unmount

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        if (!isMounted) return; // Component unmounted, abort
        setUser(firebaseUser);

        try {
          // ── Single RPC resolves admin + shop in one round trip ───────────────
          // Replaces the previous two sequential calls (is_admin → shop SELECT).
          // Returns: { is_admin: bool, shop: { ...all columns } | null }
          const { data: ctx, error: ctxErr } = await supabase.rpc('get_user_context');

          if (!isMounted) return; // Component unmounted during async call, abort

          if (ctxErr) {
            console.error('get_user_context error:', ctxErr.message);
          } else if (ctx?.is_admin) {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
            if (ctx?.shop) {
              setShop(mapShop(ctx.shop));
            }
            // ctx.shop === null → no shop yet → ProtectedRoute sends to /setup or /pending
          }
        } catch (err) {
          if (isMounted) {
            console.error('Auth init error:', err);
          }
        }
      } else {
        // Signed out — reset everything
        if (!isMounted) return;
        setUser(null);
        setShop(null);
        setIsAdmin(false);
      }
      if (isMounted) {
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false; // Mark as unmounted
      unsubscribe();
    };
  }, []);

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        toastOptions={{ duration: 2500, style: { borderRadius: '12px', fontWeight: '600' } }}
      />
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
    </BrowserRouter>
  );
}
