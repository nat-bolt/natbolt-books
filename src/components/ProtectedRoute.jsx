import { Navigate } from 'react-router-dom';
import useStore from '../store/useStore';

// requireAdmin = true  →  only admins (books.admins table) can access
// requireShop  = true  →  shop owner must have a registered shop; admins are
//                          redirected to /admin instead of /pending
export default function ProtectedRoute({ children, requireShop = false, requireAdmin = false }) {
  const { user, shop, isAdmin, authLoading } = useStore();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-light">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-brand-mid border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-brand-dark font-medium">NatBolt Billu</p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Admin-only route: non-admins go to dashboard (or pending if no shop)
  if (requireAdmin && !isAdmin) return <Navigate to="/" replace />;

  // Shop-required route: admins go to admin panel, shop-less users go to pending
  if (requireShop && !shop) {
    if (isAdmin) return <Navigate to="/admin" replace />;
    return <Navigate to="/pending" replace />;
  }

  return children;
}
