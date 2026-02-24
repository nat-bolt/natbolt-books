import { create } from 'zustand';

const useStore = create((set) => ({
  // ── Auth & Shop ──────────────────────────────────────────────
  user: null,
  shop: null,
  isAdmin: false,
  authLoading: true,
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
