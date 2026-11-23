import webpush from 'web-push';
import { env } from '../config/env.js';

// In-memory store keyed by branchId -> Map<endpoint, subscription>
const branchSubscriptions = new Map();

let pushConfigured = false;
if (env.ENABLE_WEB_PUSH && env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    pushConfigured = true;
    console.log('🔔 Web Push VAPID configured');
  } catch (err) {
    console.warn('⚠️ Web Push VAPID configuration failed:', err.message);
  }
}

export const getVapidPublicKey = () => ({
  enabled: pushConfigured,
  publicKey: pushConfigured ? env.VAPID_PUBLIC_KEY : null,
});

export const saveBranchPushSubscription = (branchId, subscription) => {
  if (!branchId || !subscription?.endpoint) return;
  const key = String(branchId);
  if (!branchSubscriptions.has(key)) {
    branchSubscriptions.set(key, new Map());
  }
  branchSubscriptions.get(key).set(subscription.endpoint, subscription);
};

export const sendPushToBranch = async (branchId, payload) => {
  if (!pushConfigured || !branchId) return;
  const subsMap = branchSubscriptions.get(String(branchId));
  if (!subsMap || subsMap.size === 0) return;

  const notificationPayload = JSON.stringify({
    title: payload.title || 'Aapka Waiter Alert',
    body: payload.body || '',
    url: payload.url || '/dashboard/waiter',
  });

  for (const [endpoint, sub] of subsMap.entries()) {
    try {
      await webpush.sendNotification(sub, notificationPayload);
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        subsMap.delete(endpoint);
      }
    }
  }
};
