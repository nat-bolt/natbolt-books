import { create } from 'zustand';

export const USER_CONTEXT_CACHE_KEY = 'nb_user_context_v1';

export function readCachedUserContextSnapshot() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = window.localStorage.getItem(USER_CONTEXT_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.uid) return null;

    return parsed;
  } catch {
    return null;
  }
}

const cachedUserContext = readCachedUserContextSnapshot();

const useStore = create((set) => ({
  // ── Auth & Shop ──────────────────────────────────────────────
  user: cachedUserContext
    ? {
        uid: cachedUserContext.uid,
        phoneNumber: cachedUserContext.phoneNumber || null,
        __cached: true,
      }
    : null,
  shop: cachedUserContext?.shop || null,
  isAdmin: Boolean(cachedUserContext?.isAdmin),
  authLoading: !cachedUserContext,
  setUser:        (user)  => set({ user }),
  setShop:        (shop)  => set({ shop }),
  setIsAdmin:     (val)   => set({ isAdmin: val }),
  setAuthLoading: (val)   => set({ authLoading: val }),

  // ── Language ─────────────────────────────────────────────────
  language: localStorage.getItem('nb_lang') || 'en',
  setLanguage: (lang) => {
    set({ language: lang });
    localStorage.setItem('nb_lang', lang);
  },

  // ── Current bill being viewed / edited ───────────────────────
  currentBill: null,
  setCurrentBill: (bill) => set({ currentBill: bill }),

  // ── Utility ──────────────────────────────────────────────────
  toast: null,
  setToast: (toast) => set({ toast }),
}));

export default useStore;
