import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Alert } from 'react-native';

function normalize(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

/**
 * Returns the web app origin used for password setup and recovery.
 * Set EXPO_PUBLIC_WEB_URL for a deployed build. In local development we can
 * usually infer the Vite host from the Expo dev-server LAN address.
 */
export function getWebUrl(): string {
  const configured = process.env.EXPO_PUBLIC_WEB_URL;
  if (configured?.trim()) return normalize(configured);

  if (__DEV__) {
    const hostUri = Constants.expoConfig?.hostUri;
    const host = hostUri?.split(':')[0];
    if (host) return `http://${host}:5173`;
  }

  return 'http://localhost:5173';
}

export async function openWebPath(path = '/'): Promise<void> {
  const url = `${getWebUrl()}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open the browser', url);
    }
  }
}

export function openForgotPassword(): Promise<void> {
  return openWebPath('/forgot-password');
}

export function openWebLogin(): Promise<void> {
  return openWebPath('/login');
}
