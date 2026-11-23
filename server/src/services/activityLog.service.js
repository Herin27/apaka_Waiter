import { ActivityLog } from '../models/index.js';

export const logActivity = async ({
  branchId,
  userId = null,
  actorRole = 'SYSTEM',
  action,
  entityType,
  entityId = '',
  details = {},
}) => {
  try {
    if (!branchId) return null;

    return await ActivityLog.create({
      branchId,
      userId,
      actorRole,
      action,
      entityType,
      entityId: String(entityId || ''),
      details,
    });
  } catch (error) {
    console.error('⚠️ Failed to write ActivityLog:', error.message);
    return null;
  }
};
