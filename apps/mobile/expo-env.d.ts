/// <reference types="expo/types" />
/// <reference types="nativewind/types" />

// Custom env vars. All public env vars in Expo must be prefixed EXPO_PUBLIC_.
declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_API_URL?: string;
  }
}
