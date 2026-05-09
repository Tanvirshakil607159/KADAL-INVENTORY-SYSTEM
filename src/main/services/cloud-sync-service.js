const { getSupabase, isCloudEnabled } = require('../database/connection');

let subscriptions = [];

const CloudSyncService = {
  init(mainWindow) {
    if (!isCloudEnabled()) return;
    if (!mainWindow) return;

    const supabase = getSupabase();
    console.log('[CloudSync] Setting up real-time listeners...');

    // Listen to changes in core tables
    const tables = ['items', 'stock_transactions', 'challans', 'approvals', 'gate_passes'];

    tables.forEach(tableName => {
      const sub = supabase
        .channel(`public:${tableName}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: tableName }, (payload) => {
          console.log(`[CloudSync] Change detected in ${tableName}:`, payload.eventType);
          
          // Notify the renderer
          if (!mainWindow.isDestroyed()) {
            mainWindow.webContents.send('cloud:data-changed', {
              table: tableName,
              event: payload.eventType,
              new: payload.new,
              old: payload.old
            });
          }
        })
        .subscribe();
      
      subscriptions.push(sub);
    });

    console.log('[CloudSync] Real-time sync active for:', tables.join(', '));
  },

  destroy() {
    subscriptions.forEach(sub => sub.unsubscribe());
    subscriptions = [];
  }
};

module.exports = CloudSyncService;
