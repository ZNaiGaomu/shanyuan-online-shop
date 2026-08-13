import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { api } from "./api";

export function isNativeApp() {
  return Capacitor.isNativePlatform();
}

export async function initNativeShell() {
  if (!Capacitor.isNativePlatform()) return;
  document.documentElement.classList.add("native");
  const [{ App }, { SplashScreen }] = await Promise.all([
    import("@capacitor/app"),
    import("@capacitor/splash-screen"),
  ]);
  try {
    await SystemBars.show();
    await SystemBars.setStyle({ style: SystemBarsStyle.Dark });
  } catch {
    /* webview may ignore */
  }
  window.setTimeout(() => {
    const root = document.documentElement;
    if (!root.style.getPropertyValue("--safe-area-inset-top")) {
      root.style.setProperty("--safe-area-inset-top", "32px");
    }
    if (!root.style.getPropertyValue("--safe-area-inset-bottom")) {
      root.style.setProperty("--safe-area-inset-bottom", "48px");
    }
  }, 700);
  try {
    await SplashScreen.hide();
  } catch {
    /* ignore */
  }
  await App.addListener("backButton", ({ canGoBack }) => {
    const path = window.location.pathname;
    if (path === "/" || path === "/shop") {
      void App.exitApp();
      return;
    }
    if (canGoBack || window.history.length > 1) window.history.back();
    else void App.exitApp();
  });
}

export async function syncNativeChrome(dark: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await SystemBars.setStyle({
      style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light,
    });
  } catch {
    /* ignore */
  }
}

export async function syncPush(isCustomer: boolean) {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    if (!isCustomer) {
      const token = sessionStorage.getItem("sy_push");
      if (token) {
        await api.delPushToken(token);
        sessionStorage.removeItem("sy_push");
      }
      return;
    }
    let perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return;

    await PushNotifications.removeAllListeners();
    await PushNotifications.addListener("registration", (token) => {
      sessionStorage.setItem("sy_push", token.value);
      void api.savePushToken(token.value);
    });
    await PushNotifications.addListener("registrationError", () => {
      /* ignore */
    });
    await PushNotifications.addListener("pushNotificationActionPerformed", (event) => {
      const productId = event.notification.data?.productId;
      const url = event.notification.data?.url;
      if (productId) window.location.href = `/shop/p/${productId}`;
      else if (url) window.location.href = url;
    });
    await PushNotifications.register();
  } catch {
    /* plugin missing until Firebase is wired */
  }
}
