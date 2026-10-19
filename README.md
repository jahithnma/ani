# Wallpaper 8K — AI wallpaper app (Android + iOS)

A React Native (Expo) wallpaper app with a single codebase for **Android and iOS**:

- **Exclusive 8K collection** (4320×7680): original wallpapers rendered by `tools/generate_wallpapers.py`. These are **premium only** and never appear in the free section.
- **Free 4K originals** (2160×3840) plus **AI wallpaper feeds** for 17 categories (Nature, Space, Abstract, Anime, Cars, Cyberpunk, AMOLED, Minimal, Animals, Ocean, Mountains, Flowers, Gaming, Fantasy, Architecture, Fractal, Geometric).
- **Search**: any search term gets AI-generated results, matching exclusives and, if you add a Pexels key, real HD photos.
- **AI Studio**: type a prompt and the app generates a wallpaper. Free users get 3 a day. Premium users get unlimited 2K generations.
- **Lifetime Premium for $4.99**: a one-time in-app purchase through Google Play Billing or Apple In-App Purchase, managed with RevenueCat.
- Full-resolution download to the gallery, favorites, and a lock-screen preview with a clock.

```
wallpaper-app/        Expo app (expo-router, TypeScript)
  src/app/            screens: Home, Search, AI Studio, Premium, Saved, viewer, category
  src/lib/            wallpaper sources, premium (RevenueCat), downloads, favorites
  src/data/           categories + generated.json (catalog of exclusive images)
wallpapers/           the uploaded images: premium/ (8K), free/ (4K), thumbs/
tools/                generate_wallpapers.py, make_icons.py
```

---

## 1. Run it

```bash
cd wallpaper-app
npm install
cp .env.example .env        # fill in the keys (see below)
npx expo start              # scan the QR with a development build
```

In-app purchases need a native build, so they do not work in Expo Go. Build a dev client with `npx eas-cli@latest build --profile development`.

## 2. Hosting the images

The app loads exclusives from `EXPO_PUBLIC_ASSET_BASE_URL`, which defaults to
`https://raw.githubusercontent.com/jahithnma/ani/main/wallpapers`.

- Merge this branch into `main`, and keep the repo **public**. Otherwise the images will not load.
- For production, upload `wallpapers/` to a CDN or storage bucket (Cloudflare R2, Firebase Storage, S3) and set `EXPO_PUBLIC_ASSET_BASE_URL`. On a private bucket with signed URLs, people cannot download the premium files directly from GitHub.

To add more wallpapers, add entries to `SPECS` in `tools/generate_wallpapers.py` and run
`python3 tools/generate_wallpapers.py`. This updates both `wallpapers/` and `generated.json`.

## 3. Premium payments ($4.99 lifetime) → your bank account

Apple and Google **do not allow** an app to take money for digital content directly into a bank account. You have to use their in-app purchase systems. They collect the payment, keep their commission (15% for small developers), and pay the rest **every month into the bank account you add in their console**.

1. **Google Play Console** ($25 one-time): https://play.google.com/console
   - Set up a payments profile under *Setup → Payments profile*, and add your HNB bank account under *Payment methods*: account holder name, bank name, branch, account number, and the SWIFT code (HNB: `HBLILKLX`; check it with your branch).
   - *Monetize → Products → In-app products*: create the product `lifetime_premium`. Make it a one-time product, priced at $4.99.
2. **Apple Developer Program** ($99/year): https://developer.apple.com/programs/
   - In App Store Connect, go to *Business* and accept the Paid Apps agreement. Add the bank account and tax forms there.
   - *Your app → In-App Purchases*: create the product `lifetime_premium` as a **Non-Consumable**, priced at $4.99.
3. **RevenueCat** (free up to $2.5k/month in revenue): https://app.revenuecat.com
   - Add both store apps, then create an entitlement named `premium` and attach `lifetime_premium` to it.
   - Create the default Offering with a **Lifetime** package.
   - Put the public SDK keys in `.env` (`EXPO_PUBLIC_REVENUECAT_ANDROID_KEY`, `EXPO_PUBLIC_REVENUECAT_IOS_KEY`).

> Do not commit your bank details to this repository. Enter them only in Play Console and App Store Connect.

## 4. Build the APK / AAB / IPA and publish

You don't need Android Studio or Xcode for this. EAS builds in the cloud.

```bash
cd wallpaper-app
npx eas-cli@latest login            # free Expo account
npx eas-cli@latest init             # links the project
npm run build:apk                   # installable test APK (Android)
npm run build:android               # .aab for Google Play
npm run build:ios                   # .ipa for the App Store (needs Apple account)
npm run submit:android              # uploads to Play Console (internal track)
npm run submit:ios                  # uploads to App Store Connect / TestFlight
```

Store checklist: a privacy policy URL, screenshots (take them from the app), a content rating questionnaire, and the "Data safety" form on Google. The app collects no personal data; RevenueCat handles purchase receipts.

Bundle ids are `com.jahith.wallpaper8k`. You can change them in `wallpaper-app/app.json` before your first upload.

## 5. Optional keys

| Key | Why |
| --- | --- |
| `EXPO_PUBLIC_PEXELS_API_KEY` | Free at pexels.com/api. Adds real high-resolution photos to categories and search (shown in the free section only; the Pexels licence does not allow selling them). |
| `EXPO_PUBLIC_POLLINATIONS_TOKEN` | Higher rate limits for the AI feeds and AI Studio (https://auth.pollinations.ai). |

---

### தமிழ் சுருக்கம்

- இந்த ஒரே code-ல இருந்து **Android, iOS** ரெண்டு app-உம் build ஆகும் (Expo).
- **Premium 8K wallpapers** (22) free section-ல வராது. Lifetime **$4.99** குடுத்து வாங்கினா மட்டும்தான் unlock ஆகும்.
- Free section-ல 4K originals, AI wallpapers, எல்லா categories, search, AI Studio (ஒரு நாளைக்கு 3) இருக்கு.
- **பணம்**: Play Store / App Store rules படி payment அவங்க in-app purchase மூலமாதான் வரணும். உங்க **HNB account-ஐ Play Console & App Store Connect-ல** குடுத்தா, மாசா மாசம் அதுக்கு பணம் வரும். Bank details-ஐ code-ல போடக் கூடாது.
- Store-ல upload பண்ண உங்க பெயர்ல developer account வேணும் (Google $25, Apple $99/வருடம்). அதுக்கப்புறம் `npm run build:android` / `npm run submit:android` run பண்ணுங்க.
