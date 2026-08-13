import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.shanyuan.shop",
  appName: "善愿",
  webDir: "dist",
  server: {
    url: "https://shanyuan.gaomuxipian.com",
    androidScheme: "https",
    allowNavigation: ["shanyuan.gaomuxipian.com"],
  },
  android: {
    allowMixedContent: false,
    backgroundColor: "#f4ead8",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      backgroundColor: "#f4ead8",
      showSpinner: false,
    },
    SystemBars: {
      insetsHandling: "css",
      style: "DARK",
      hidden: false,
    },
    StatusBar: {
      style: "DARK",
      overlaysWebView: true,
    },
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
