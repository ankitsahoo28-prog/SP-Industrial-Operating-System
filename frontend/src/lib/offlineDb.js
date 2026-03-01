import Dexie from 'dexie';

// IndexedDB for offline storage
class SPDatabase extends Dexie {
  constructor() {
    super('SPIndustrialDB');
    
    this.version(1).stores({
      tasks: 'id, assigned_to, status, created_at',
      transactions: 'id, transaction_type, date, created_by',
      reports: 'id, type, user_id, timestamp',
      inventory: 'id, item_name, business_type',
      indents: 'id, requested_by, status, created_at',
      syncQueue: '++id, entity_type, action, entity_id, data, timestamp'
    });
  }
}

export const db = new SPDatabase();

// Sync queue management
export const addToSyncQueue = async (entityType, action, entityId, data) => {
  await db.syncQueue.add({
    entity_type: entityType,
    action,
    entity_id: entityId,
    data: JSON.stringify(data),
    timestamp: new Date().toISOString()
  });
};

export const processSyncQueue = async (api) => {
  const queue = await db.syncQueue.toArray();
  
  for (const item of queue) {
    try {
      const data = JSON.parse(item.data);
      
      switch (item.entity_type) {
        case 'task':
          if (item.action === 'update') {
            await api.patch(`/tasks/${item.entity_id}`, data);
          }
          break;
        case 'report':
          if (item.action === 'create') {
            await api.post('/reports', data);
          }
          break;
        case 'location':
          if (item.action === 'create') {
            await api.post('/locations', data);
          }
          break;
        default:
          break;
      }
      
      // Remove from queue after successful sync
      await db.syncQueue.delete(item.id);
    } catch (error) {
      console.error('Sync failed for item:', item, error);
      // Keep in queue for retry
    }
  }
};

// Cache data for offline use
export const cacheData = async (entityType, data) => {
  switch (entityType) {
    case 'tasks':
      await db.tasks.bulkPut(data);
      break;
    case 'transactions':
      await db.transactions.bulkPut(data);
      break;
    case 'reports':
      await db.reports.bulkPut(data);
      break;
    case 'inventory':
      await db.inventory.bulkPut(data);
      break;
    case 'indents':
      await db.indents.bulkPut(data);
      break;
    default:
      break;
  }
};

// Get cached data
export const getCachedData = async (entityType) => {
  switch (entityType) {
    case 'tasks':
      return await db.tasks.toArray();
    case 'transactions':
      return await db.transactions.toArray();
    case 'reports':
      return await db.reports.toArray();
    case 'inventory':
      return await db.inventory.toArray();
    case 'indents':
      return await db.indents.toArray();
    default:
      return [];
  }
};