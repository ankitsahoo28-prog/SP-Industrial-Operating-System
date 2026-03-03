import Dexie from 'dexie';

class SPDatabase extends Dexie {
  constructor() {
    super('SPIndustrialDB');

    this.version(2).stores({
      tasks: 'id, assigned_to, status, created_at',
      transactions: 'id, transaction_type, date, created_by',
      reports: 'id, type, user_id, timestamp',
      inventory: 'id, item_name, business_type',
      indents: 'id, requested_by, status, created_at',
      companies: 'id, name, status',
      notifications: 'id, user_id, read, created_at',
      syncQueue: '++id, entity_type, action, entity_id, data, timestamp',
      meta: 'key'
    });
  }
}

export const db = new SPDatabase();

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
  const results = { success: 0, failed: 0 };

  for (const item of queue) {
    try {
      const data = JSON.parse(item.data);
      switch (item.entity_type) {
        case 'task':
          if (item.action === 'update') await api.patch(`/tasks/${item.entity_id}`, data);
          break;
        case 'report':
          if (item.action === 'create') await api.post('/reports', data);
          break;
        case 'location':
          if (item.action === 'create') await api.post('/locations', data);
          break;
        default:
          break;
      }
      await db.syncQueue.delete(item.id);
      results.success++;
    } catch (error) {
      console.error('Sync failed for item:', item.id, error);
      results.failed++;
    }
  }
  return results;
};

export const cacheData = async (entityType, data) => {
  if (!data || !Array.isArray(data)) return;
  try {
    const table = db[entityType];
    if (table) {
      await table.clear();
      await table.bulkPut(data);
      await db.meta.put({ key: `${entityType}_lastSync`, value: new Date().toISOString() });
    }
  } catch (error) {
    console.error(`Cache failed for ${entityType}:`, error);
  }
};

export const getCachedData = async (entityType) => {
  try {
    const table = db[entityType];
    if (table) return await table.toArray();
  } catch (error) {
    console.error(`Cache read failed for ${entityType}:`, error);
  }
  return [];
};

export const getLastSyncTime = async (entityType) => {
  try {
    const meta = await db.meta.get(`${entityType}_lastSync`);
    return meta?.value || null;
  } catch {
    return null;
  }
};

export const getSyncQueueCount = async () => {
  return await db.syncQueue.count();
};
