import 'react-native-url-polyfill/auto';

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn(
    'VorldX: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY are missing. Copy .env.example to .env.',
  );
}

const CHUNK_SIZE = 1800;
const META_SUFFIX = '.meta';
const CHUNK_SUFFIX = '.chunk.';

const webStorage = {
  async getItem(key: string) {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(key);
  },
  async setItem(key: string, value: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(key, value);
  },
  async removeItem(key: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
  },
};

/**
 * Supabase sessions are usually larger than SecureStore's safe value size.
 * Store the session in chunks, with a small manifest under `<key>.meta`.
 */
const secureStorage = {
  async getItem(key: string): Promise<string | null> {
    if (Platform.OS === 'web') return webStorage.getItem(key);

    const meta = await SecureStore.getItemAsync(`${key}${META_SUFFIX}`);
    if (!meta) return SecureStore.getItemAsync(key);

    const count = Number(meta);
    if (!Number.isFinite(count) || count < 1) return null;

    const chunks: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const chunk = await SecureStore.getItemAsync(`${key}${CHUNK_SUFFIX}${index}`);
      if (chunk == null) return null;
      chunks.push(chunk);
    }
    return chunks.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') return webStorage.setItem(key, value);

    await secureStorage.removeItem(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const chunks = Math.ceil(value.length / CHUNK_SIZE);
    await SecureStore.setItemAsync(`${key}${META_SUFFIX}`, String(chunks));
    for (let index = 0; index < chunks; index += 1) {
      await SecureStore.setItemAsync(
        `${key}${CHUNK_SUFFIX}${index}`,
        value.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
      );
    }
  },

  async removeItem(key: string): Promise<void> {
    if (Platform.OS === 'web') return webStorage.removeItem(key);

    const meta = await SecureStore.getItemAsync(`${key}${META_SUFFIX}`);
    if (meta) {
      const count = Number(meta);
      if (Number.isFinite(count)) {
        for (let index = 0; index < count; index += 1) {
          await SecureStore.deleteItemAsync(`${key}${CHUNK_SUFFIX}${index}`);
        }
      }
      await SecureStore.deleteItemAsync(`${key}${META_SUFFIX}`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: secureStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    headers: { 'X-Client-Info': 'vorldx-mobile/1.0.0' },
  },
});

export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
