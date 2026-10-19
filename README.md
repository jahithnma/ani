# Cash Delivery (ATM Cash Door Delivery) – Android APK

ATM-க்கு போக கஷ்டப்படுபவர்களுக்கு: app-ல் **UPI மூலம் பணம் செலுத்தினால், Rider பணத்தை வீட்டுக்கே கொண்டு வருவார்.**

## Features
1. **பணம் / Amount** – ₹500 முதல் ₹10,000 வரை (quick chips: 500, 1000, 2000, 5000, 10000)
2. **விவரம்** – பெயர், மொபைல், முகவரி + map-ல் GPS location (tap / drag to adjust)
3. **Online payment** – UPI intent (GPay / PhonePe / Paytm / BHIM). Total = cash + delivery fee
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
| `upiId` | **உங்கள் UPI ID** – கட்டாயம் மாற்றவும் (இப்போது placeholder) |
| `payeeName` | Payment app-ல் தெரியும் பெயர் |
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
- **Payment verification**: UPI app திருப்பி அனுப்பும் status-ஐ மட்டும் நம்பக்கூடாது. பணம் கையாளும் business என்பதால் Razorpay/Cashfree போன்ற payment gateway + server-side verification பயன்படுத்தவும்.
- Play Store-க்கு signed release build மற்றும் privacy policy தேவை; cash handling-க்கான சட்ட/RBI விதிமுறைகளையும் சரிபார்க்கவும்.
