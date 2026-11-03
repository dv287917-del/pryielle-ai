import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.pryielle.ai",
  appName: "Pryielle AI",
  webDir: "dist",
  backgroundColor: "#141414",
  plugins: {
    FirebaseAuthentication: { skipNativeAuth: true, providers: ["google.com"] },
    SplashScreen: { launchShowDuration: 0, backgroundColor: "#141414" },
  },
};

export default config;
