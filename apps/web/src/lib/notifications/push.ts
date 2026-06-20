import { getPushPublicKey, subscribePush } from '@/lib/api/notifications';
import { getServiceWorkerRegistration } from '@/lib/pwa/service-worker';

function urlBase64ToUint8Array(base64String: string): BufferSource {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerWebPush(requestPermission = true): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }
  if (
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return false;
  }

  if (requestPermission) {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }
  } else if (Notification.permission !== 'granted') {
    return false;
  }

  const { publicKey, enabled } = await getPushPublicKey();
  if (!enabled || !publicKey) {
    return false;
  }

  const registration = await getServiceWorkerRegistration();
  if (!registration) {
    return false;
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    return false;
  }

  await subscribePush({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
  });

  return true;
}
