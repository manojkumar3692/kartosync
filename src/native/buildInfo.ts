import { NativeModules } from 'react-native';

type BuildInfo = {
  packageName: string;
  versionName: string;
  versionCode: number;
  buildType: string;
};

const M = (NativeModules as any).KSBuildInfo as { get: () => Promise<BuildInfo> } | undefined;

let cached: BuildInfo | null = null;

export async function getBuildInfo(): Promise<BuildInfo> {
  if (cached) return cached;
  if (!M?.get) {
    // safe fallback if native module isn't available
    return {
      packageName: 'com.kartsync',
      versionName: '0.0.0',
      versionCode: 0,
      buildType: __DEV__ ? 'debug' : 'release',
    };
  }
  cached = await M.get();
  return cached!;
}