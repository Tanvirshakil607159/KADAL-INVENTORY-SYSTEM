import { create } from 'zustand';

const savedUser = sessionStorage.getItem('kadal_user');
const initialUser = savedUser ? JSON.parse(savedUser) : null;

const useStore = create((set, get) => ({
  // Auth
  user: initialUser,
  isLoggedIn: !!initialUser,
  setUser: (user) => {
    if (user) sessionStorage.setItem('kadal_user', JSON.stringify(user));
    else sessionStorage.removeItem('kadal_user');
    set({ user, isLoggedIn: !!user });
  },
  logout: () => {
    sessionStorage.removeItem('kadal_user');
    set({ user: null, isLoggedIn: false });
  },

  // Navigation & Landing
  showLanding: true,
  setShowLanding: (showLanding) => set({ showLanding }),
  goHome: () => set({ showLanding: true }),
  openApp: () => set({ showLanding: false }),
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
  roles: [],
  warehouses: [],
  setCategories: (categories) => set({ categories }),
  setSuppliers: (suppliers) => set({ suppliers }),
  setUnits: (units) => set({ units }),
  setRoles: (roles) => set({ roles }),
  setWarehouses: (warehouses) => set({ warehouses }),

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

  // Global Modals
  modal: null, // { type: string, data: any, isMinimized: boolean }
  openModal: (type, data = {}) => set({ modal: { type, data, isMinimized: false } }),
  closeModal: () => set({ modal: null }),
  setModalMinimized: (isMinimized) => set((state) => ({
    modal: state.modal ? { ...state.modal, isMinimized } : null
  })),

  // Challan Creation State (Persistent across modules)
  challanForm: { receiverId: '', receiverName: '', receiverContact: '', receiverAddress: '', notes: '' },
  challanItems: [],
  setChallanForm: (form) => set({ challanForm: form }),
  setChallanItems: (items) => set({ challanItems: items }),
  clearChallan: () => set({ challanForm: { receiverId: '', receiverName: '', receiverContact: '', receiverAddress: '', notes: '' }, challanItems: [] }),

  // Issue Module State
  issueForm: { 
    issueType: 'FACTORY', recipientId: '', recipientName: '', 
    issueDate: new Date().toISOString().split('T')[0], expectedReturnDate: '', 
    remarks: '', attachmentPath: '' 
  },
  issueItems: [],
  setIssueForm: (form) => set({ issueForm: form }),
  setIssueItems: (items) => set({ issueItems: items }),
  clearIssue: () => set({ 
    issueForm: { 
      issueType: 'FACTORY', recipientId: '', recipientName: '', 
      issueDate: new Date().toISOString().split('T')[0], expectedReturnDate: '', 
      remarks: '', attachmentPath: '' 
    }, 
    issueItems: [] 
  }),
}));

export default useStore;
