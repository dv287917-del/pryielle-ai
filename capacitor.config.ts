import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pryielle.msg",
  appName: "IronRoses MSG",
  webDir: "dist",
  backgroundColor: "#07060d",
  plugins: {
    FirebaseAuthentication: { skipNativeAuth: true, providers: ["google.com"] },
    SplashScreen: { launchShowDuration: 0, backgroundColor: "#051a96" },
    PushNotifications: { presentationOptions: ["badge", "sound", "alert"] },
  },
};

export default config;
