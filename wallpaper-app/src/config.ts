// App-wide configuration. Values prefixed with EXPO_PUBLIC_ are read from
// `.env` at build time (see .env.example) so keys never live in source control.

// Where the exclusive wallpapers in /wallpapers are hosted. Defaults to the
// GitHub repo's main branch; point it at a CDN / storage bucket for production.
export const ASSET_BASE_URL =
  process.env.EXPO_PUBLIC_ASSET_BASE_URL ??
  'https://raw.githubusercontent.com/jahithnma/ani/main/wallpapers';

// Free Pexels API key (https://www.pexels.com/api/). Optional: when missing,
// the app falls back to AI-generated feeds only.
export const PEXELS_API_KEY = process.env.EXPO_PUBLIC_PEXELS_API_KEY ?? '';

// Pollinations.ai powers the AI feeds and the AI Studio. Registering the app
// at https://auth.pollinations.ai gives a referrer/token with higher limits.
export const POLLINATIONS_REFERRER = process.env.EXPO_PUBLIC_POLLINATIONS_REFERRER ?? 'wallpaper8k-app';
export const POLLINATIONS_TOKEN = process.env.EXPO_PUBLIC_POLLINATIONS_TOKEN ?? '';

// RevenueCat public SDK keys (https://app.revenuecat.com). Payments are made
// through Google Play / App Store billing and paid out to the bank account set
// in Play Console and App Store Connect.
export const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? '';
export const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? '';
export const PREMIUM_ENTITLEMENT = 'premium';
// Store product id of the one-time "Lifetime Premium" purchase (USD 4.99).
export const LIFETIME_PRODUCT_ID = 'lifetime_premium';
export const LIFETIME_PRICE_FALLBACK = '$4.99';

// AI Studio generations per day for free users. Premium is unlimited.
export const FREE_DAILY_GENERATIONS = 3;
