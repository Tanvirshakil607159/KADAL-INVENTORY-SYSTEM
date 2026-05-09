import { create } from 'zustand';

const useStore = create((set, get) => ({
  // Auth
  user: null,
  isLoggedIn: false,
  setUser: (user) => set({ user, isLoggedIn: !!user }),
  logout: () => set({ user: null, isLoggedIn: false }),

  // Navigation
  currentPage: 'dashboard',
  setPage: (page) => set({ currentPage: page }),

  // Toast notifications
  toasts: [],
  addToast: (type, message) => {
    const id = Date.now();
    set((state) => ({ toasts: [...state.toasts, { id, type, message }] }));
    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter(t => t.id !== id) }));
    }, 4000);
  },

  // Confirm dialog
  confirmDialog: null,
  showConfirm: (config) => new Promise((resolve) => {
    set({ confirmDialog: { ...config, resolve } });
  }),
  closeConfirm: (result) => {
    const dialog = get().confirmDialog;
    if (dialog?.resolve) dialog.resolve(result);
    set({ confirmDialog: null });
  },

  // Loading
  loading: false,
  setLoading: (loading) => set({ loading }),

  // Cache
  categories: [],
  suppliers: [],
  units: [],
  setCategories: (categories) => set({ categories }),
  setSuppliers: (suppliers) => set({ suppliers }),
  setUnits: (units) => set({ units }),

  // Notification dots for sidebar
  notificationDots: {},
  setNotificationDot: (moduleId, show) => set((state) => ({
    notificationDots: { ...state.notificationDots, [moduleId]: show }
  })),
  clearNotificationDot: (moduleId) => set((state) => {
    const dots = { ...state.notificationDots };
    delete dots[moduleId];
    return { notificationDots: dots };
  }),
}));

export default useStore;
