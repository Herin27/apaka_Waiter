import { get, set } from 'idb-keyval';
import api from '../api/axios';

const QUEUE_KEY = 'aapka_waiter_staff_offline_queue_v1';

export const getOfflineQueue = async () => {
  return (await get(QUEUE_KEY)) || [];
};

export const enqueueOfflineAction = async ({ idempotencyKey, method = 'PATCH', url, body = {} }) => {
  const queue = await getOfflineQueue();
  if (queue.some((item) => item.idempotencyKey === idempotencyKey)) {
    return queue.length;
  }
  const next = [
    ...queue,
    {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      idempotencyKey,
      method,
      url,
      body,
      queuedAt: new Date().toISOString(),
    },
  ];
  await set(QUEUE_KEY, next);
  window.dispatchEvent(new CustomEvent('aw:offline-queue-changed', { detail: { count: next.length } }));
  return next.length;
};

export const replayOfflineQueue = async () => {
  const queue = await getOfflineQueue();
  if (!queue.length) return { replayed: 0, remaining: 0 };

  const remaining = [];
  let replayed = 0;

  for (const action of queue) {
    try {
      await api({
        method: action.method,
        url: action.url,
        data: action.body,
        headers: {
          'x-idempotency-key': action.idempotencyKey,
        },
      });
      replayed++;
    } catch (err) {
      // Keep in queue only if network error; drop if 4xx business conflict
      if (!err.response) {
        remaining.push(action);
      }
    }
  }

  await set(QUEUE_KEY, remaining);
  window.dispatchEvent(
    new CustomEvent('aw:offline-queue-changed', { detail: { count: remaining.length } })
  );
  return { replayed, remaining: remaining.length };
};
