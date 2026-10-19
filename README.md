# Cash Delivery (ATM Cash Door Delivery) – Android APK · Sri Lanka 🇱🇰

ATM-க்கு போக கஷ்டப்படுபவர்களுக்கு: app-ல் **LankaQR / Bank transfer / eZ Cash மூலம் பணம் செலுத்தினால், Rider பணத்தை வீட்டுக்கே கொண்டு வருவார்.**

## Features
1. **பணம் / Amount** – Rs. 1,000 முதல் Rs. 50,000 வரை (quick chips: 1000, 2000, 5000, 10000, 20000)
2. **விவரம்** – பெயர், மொபைல் (07XXXXXXXX), முகவரி + map-ல் GPS location (tap / drag to adjust)
3. **Online payment** – LankaQR scan / bank transfer / eZ Cash; customer payment reference no. உள்ளிடுவார். Total = cash + delivery fee
   (India-க்கு `paymentMode: "upi"` வைத்தால் GPay / PhonePe UPI வேலை செய்யும்)
4. **Map-ல் Riders** – payment ஆனவுடன் அருகிலுள்ள riders map-ல் தெரியும், nearest rider assign ஆகும்
5. **Rider விவரம்** – பெயர், வண்டி எண், **மொபைல் நம்பர்**, Call button
6. **Live tracking** – rider நகர்வது, தூரம், ETA, status steps
7. **OTP** – rider-இடம் OTP சொல்லி பணம் வாங்குதல்; "Cash received" confirm
8. **Order history**

## இரண்டு Apps
| APK | யாருக்கு |
|---|---|
| `app-customer-debug.apk` – **Cash Delivery** | Customers: order, payment, rider tracking |
| `app-rider-debug.apk` – **Cash Delivery Rider** | Riders: login, Online, order ஏற்பது, GPS பகிர்வு, OTP சரிபார்ப்பு |

மொழி: **தமிழ் / සිංහල / English** – மேலே உள்ள த · සි · EN button-ல் மாற்றலாம்.

## APK download
Every push builds the APK on GitHub Actions:
**GitHub → Actions → "Build APK" → latest run → Artifacts → `CashDelivery-apk`** (zip-ல் `customer/` மற்றும் `rider/` APK-கள்).
Phone-ல் copy செய்து install செய்யவும் ("Install unknown apps" allow செய்ய வேண்டும்).

## Settings – `app/src/main/assets/www/config.js`
| Setting | என்ன |
|---|---|
| `bank` | **உங்கள் bank account விவரம்** – கட்டாயம் மாற்றவும் (இப்போது placeholder) |
| `ezCash` | eZ Cash / mCash எண் (`""` வைத்தால் மறையும்) |
| `lankaQrImage` | உங்கள் LankaQR படத்தை `app/src/main/assets/www/lankaqr.png` ஆக வைக்கவும் |
| `paymentMode` | `"lankaqr"` (Sri Lanka) அல்லது `"upi"` (India, `upiId` தேவை) |
| `phonePattern` | மொபைல் எண் check (Sri Lanka: `07XXXXXXXX`) |
| `defaultCenter` | GPS கிடைக்கும் முன் map centre (Colombo) |
| `minAmount` / `maxAmount` | ஒரு order-க்கு அனுமதிக்கப்பட்ட தொகை |
| `baseFee` / `feePercent` | Delivery charge = baseFee + feePercent% |
| `riders` | உங்கள் riders-ன் பெயர், மொபைல், வண்டி எண் |

## Firebase setup (Live mode – riders-ன் உண்மையான GPS, orders Rider app-க்கு போக)
Firebase அமைக்காவிட்டால் customer app **Demo mode**-ல் (simulated riders) வேலை செய்யும்; Rider app-க்கு Firebase கட்டாயம்.
1. https://console.firebase.google.com → **Add project** (இலவச Spark plan போதும்)
2. **Build → Realtime Database → Create database** → location: Singapore (asia-southeast1)
3. **Rules** tab-ல் இந்த repo-வின் `database.rules.json` உள்ளடக்கத்தை paste செய்து **Publish**
4. **Project settings → Your apps → Web app (</>)** சேர்த்து, காட்டும் `apiKey, authDomain, databaseURL, projectId, appId` மதிப்புகளை `config.js`-ல் `firebase: {...}`-ல் போடவும்
5. Riders-ன் login (மொபைல் + PIN): `app/src/rider/assets/www/rider-config.js`
6. Push → இரண்டு APK-களும் புதிதாக build ஆகும். App தலைப்பில் **Live** என்று தெரியும்.

## Project structure
```
app/src/main/java/.../MainActivity.java   WebView + native bridge (UPI, GPS, phone dial)
app/src/main/assets/www/                  Customer app UI + shared code
  config.js  i18n.js (த/සි/EN)  backend.js (Firebase)  common.js  app.js
app/src/rider/assets/www/                 Rider app (rider.html, rider.js, rider-config.js)
database.rules.json                       Firebase Realtime Database rules
.github/workflows/android-apk.yml         APK build
```
Local build: Android SDK install செய்து `./gradlew assembleDebug`.
Browser preview: `app/src/main/assets/www/index.html` open செய்யலாம் (payment demo mode).

## Prototype limits – production-க்கு முன் செய்ய வேண்டியவை
- **Security**: Login PIN-கள் Rider APK-க்குள் உள்ளன; database rules எல்லோருக்கும் read/write அனுமதிக்கின்றன (customer phone/address உட்பட). Public-ஆக வெளியிடும் முன் Firebase Authentication + கடுமையான rules அவசியம்.
- **Rider GPS**: Rider app திறந்திருக்கும் போது மட்டும் location அனுப்பும் (screen on ஆக வைக்கப்படும்); background tracking-க்கு foreground service தேவை.
- **Admin panel இல்லை**: Orders/payment-ஐ Firebase console-ல் பார்க்கலாம்.
- **சிங்களம்**: மொழிபெயர்ப்பை ஒரு Sinhala பேசுபவர் சரிபார்ப்பது நல்லது.
- **Payment verification**: இப்போது customer உள்ளிடும் reference no.-ஐ மட்டும் நம்புகிறது – rider அனுப்பும் முன் உங்கள் bank/eZ Cash-ல் பணம் வந்ததா என்று சரிபார்க்கவும். Production-க்கு **PayHere** போன்ற Sri Lanka payment gateway (card, eZ Cash, mCash, Genie, FriMi) + server-side verification பயன்படுத்தவும்.
- Play Store-க்கு signed release build மற்றும் privacy policy தேவை; cash handling-க்கான Central Bank of Sri Lanka சட்ட விதிமுறைகளையும் சரிபார்க்கவும்.
