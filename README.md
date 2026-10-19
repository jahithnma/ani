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

## APK download
Every push builds the APK on GitHub Actions:
**GitHub → Actions → "Build APK" → latest run → Artifacts → `CashDelivery-apk`** (zip-ல் `app-debug.apk`).
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

## Project structure
```
app/src/main/java/.../MainActivity.java   WebView + native bridge (UPI, GPS, phone dial)
app/src/main/assets/www/                  App UI (HTML/CSS/JS, Leaflet map)
.github/workflows/android-apk.yml         APK build
```
Local build: Android SDK install செய்து `./gradlew assembleDebug`.
Browser preview: `app/src/main/assets/www/index.html` open செய்யலாம் (payment demo mode).

## Prototype limits – production-க்கு முன் செய்ய வேண்டியவை
- **Rider location simulated**: riders-ன் map position இப்போது demo. உண்மையான live tracking-க்கு backend (eg: Firebase) + தனி Rider app (GPS upload) தேவை.
- **Orders phone-லேயே மட்டும்** save ஆகும் – admin/rider-க்கு order போக backend தேவை.
- **Payment verification**: இப்போது customer உள்ளிடும் reference no.-ஐ மட்டும் நம்புகிறது – rider அனுப்பும் முன் உங்கள் bank/eZ Cash-ல் பணம் வந்ததா என்று சரிபார்க்கவும். Production-க்கு **PayHere** போன்ற Sri Lanka payment gateway (card, eZ Cash, mCash, Genie, FriMi) + server-side verification பயன்படுத்தவும்.
- Play Store-க்கு signed release build மற்றும் privacy policy தேவை; cash handling-க்கான Central Bank of Sri Lanka சட்ட விதிமுறைகளையும் சரிபார்க்கவும்.
