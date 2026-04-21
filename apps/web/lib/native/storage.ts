/**
 * 플랫폼 독립 key-value 저장소.
 * - 네이티브: @capacitor/preferences (iOS Keychain / Android SharedPreferences)
 * - 웹: localStorage
 */

async function useNative(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  try {
    const { Capacitor } = await import('@capacitor/core');
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export const nativeStorage = {
  async get(key: string): Promise<string | null> {
    if (await useNative()) {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key });
      return value ?? null;
    }
    if (typeof localStorage === 'undefined') return null;
    return localStorage.getItem(key);
  },

  async set(key: string, value: string): Promise<void> {
    if (await useNative()) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
      return;
    }
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(key, value);
  },

  async remove(key: string): Promise<void> {
    if (await useNative()) {
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.remove({ key });
      return;
    }
    if (typeof localStorage === 'undefined') return;
    localStorage.removeItem(key);
  },
};
