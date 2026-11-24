import { create } from 'zustand';
import { applyTheme, readTheme } from '../theme';
import { applyMotion, readMotion } from '../motion';

const savedUser = sessionStorage.getItem('kadal_user');
const initialUser = savedUser ? JSON.parse(savedUser) : null;

const createTabId = () => `tab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

function readInitialTabState() {
  const fallbackPage = sessionStorage.getItem('kadal_currentPage') || 'dashboard';
  try {
    const rawTabs = sessionStorage.getItem('kadal_tabs');
    const savedActiveId = sessionStorage.getItem('kadal_activeTabId');
    const parsedTabs = rawTabs ? JSON.parse(rawTabs) : null;
    if (Array.isArray(parsedTabs) && parsedTabs.length > 0) {
      const cleaned = parsedTabs
        .filter((t) => t && t.id && t.moduleId)
        .map((t) => ({ id: String(t.id), moduleId: String(t.moduleId), refreshKey: 0 }));
      if (cleaned.length > 0) {
        const active = cleaned.find((t) => t.id === savedActiveId) || cleaned[0];
        return { tabs: cleaned, activeTabId: active.id, currentPage: active.moduleId };
      }
    }
  } catch (e) {}
  const initialTab = { id: 'tab-1', moduleId: fallbackPage, refreshKey: 0 };
  return { tabs: [initialTab], activeTabId: initialTab.id, currentPage: initialTab.moduleId };
}

function persistTabs(tabs, activeTabId, currentPage) {
  try {
    sessionStorage.setItem('kadal_tabs', JSON.stringify(tabs.map(({ id, moduleId }) => ({ id, moduleId }))));
    sessionStorage.setItem('kadal_activeTabId', activeTabId);
    sessionStorage.setItem('kadal_currentPage', currentPage);
  } catch (e) {}
}

const initialTabState = readInitialTabState();

const useStore = create((set, get) => ({
  // Appearance is a preference on this device, independent of company settings.
  theme: applyTheme(readTheme(), false),
  setTheme: (theme, persist = true) => set({ theme: applyTheme(theme, persist) }),
  motionEnabled: applyMotion(readMotion(), false),
  setMotionEnabled: (enabled, persist = true) => set({ motionEnabled: applyMotion(enabled, persist) }),

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
    sessionStorage.removeItem('kadal_tabs');
    sessionStorage.removeItem('kadal_activeTabId');
    sessionStorage.removeItem('kadal_currentPage');
    const resetTab = { id: 'tab-1', moduleId: 'dashboard', refreshKey: 0 };
    set({
      user: null,
      isLoggedIn: false,
      sidebarOpen: false,
      tabs: [resetTab],
      activeTabId: resetTab.id,
      currentPage: resetTab.moduleId,
    });
  },

  // Navigation & Landing
  showLanding: sessionStorage.getItem('kadal_showLanding') !== null ? JSON.parse(sessionStorage.getItem('kadal_showLanding')) : true,
  setShowLanding: (showLanding) => {
    sessionStorage.setItem('kadal_showLanding', JSON.stringify(showLanding));
    set({ showLanding, sidebarOpen: false });
  },
  goHome: () => {
    sessionStorage.setItem('kadal_showLanding', 'true');
    set({ showLanding: true, sidebarOpen: false });
  },
  openApp: () => {
    sessionStorage.setItem('kadal_showLanding', 'false');
    set({ showLanding: false, sidebarOpen: false });
  },

  // Browser-style tabs
  tabs: initialTabState.tabs,
  activeTabId: initialTabState.activeTabId,
  currentPage: initialTabState.currentPage,

  setPage: (page) => {
    const { tabs, activeTabId } = get();
    const nextTabs = tabs.map((t) => (t.id === activeTabId ? { ...t, moduleId: page } : t));
    persistTabs(nextTabs, activeTabId, page);
    set({ tabs: nextTabs, currentPage: page, sidebarOpen: false });
  },

  openTab: (moduleId = 'new-tab', { activate = true } = {}) => {
    const { tabs, activeTabId, currentPage } = get();
    const newTab = { id: createTabId(), moduleId: moduleId || 'new-tab', refreshKey: 0 };
    const nextTabs = [...tabs, newTab];
    const nextActiveId = activate ? newTab.id : activeTabId;
    const nextPage = activate ? newTab.moduleId : currentPage;
    persistTabs(nextTabs, nextActiveId, nextPage);
    set({ tabs: nextTabs, activeTabId: nextActiveId, currentPage: nextPage, sidebarOpen: false });
    return newTab.id;
  },

  switchTab: (tabId) => {
    const { tabs } = get();
    const target = tabs.find((t) => t.id === tabId);
    if (!target) return;
    persistTabs(tabs, target.id, target.moduleId);
    set({ activeTabId: target.id, currentPage: target.moduleId, sidebarOpen: false });
  },

  closeTab: (tabId) => {
    const { tabs, activeTabId } = get();
    if (tabs.length <= 1) {
      const reset = [{ id: tabs[0]?.id || 'tab-1', moduleId: 'dashboard', refreshKey: 0 }];
      persistTabs(reset, reset[0].id, reset[0].moduleId);
      set({ tabs: reset, activeTabId: reset[0].id, currentPage: reset[0].moduleId });
      return;
    }

    const idx = tabs.findIndex((t) => t.id === tabId);
    if (idx === -1) return;
    const nextTabs = tabs.filter((t) => t.id !== tabId);

    let nextActiveId = activeTabId;
    if (activeTabId === tabId) {
      const fallback = nextTabs[Math.min(idx, nextTabs.length - 1)] || nextTabs[0];
      nextActiveId = fallback.id;
    }
    const activeTab = nextTabs.find((t) => t.id === nextActiveId) || nextTabs[0];
    persistTabs(nextTabs, activeTab.id, activeTab.moduleId);
    set({ tabs: nextTabs, activeTabId: activeTab.id, currentPage: activeTab.moduleId, sidebarOpen: false });
  },

  refreshTab: (tabId = null) => {
    const { tabs, activeTabId } = get();
    const targetId = tabId || activeTabId;
    const nextTabs = tabs.map((t) => (t.id === targetId ? { ...t, refreshKey: (t.refreshKey || 0) + 1 } : t));
    set({ tabs: nextTabs });
  },

  sidebarOpen: false,
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

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
