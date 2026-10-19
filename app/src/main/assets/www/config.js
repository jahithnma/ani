// ============================================================
//  App settings - change these before giving the APK to users
// ============================================================
window.APP_CONFIG = {
  country: "Sri Lanka",
  currencySymbol: "Rs.",
  locale: "en-LK",

  // Payment: "lankaqr" (Sri Lanka - LankaQR / bank transfer / eZ Cash)
  //          "upi"     (India - GPay / PhonePe / Paytm)
  paymentMode: "lankaqr",

  // ---- Sri Lanka payment details (customer pays to these) ----
  // Put your LankaQR image as  app/src/main/assets/www/lankaqr.png
  // (download it from your bank / LankaPay merchant app)
  lankaQrImage: "lankaqr.png",
  bank: {
    name: "Your Bank (eg: Commercial Bank)",
    accountName: "Jahith Cash Delivery",
    accountNo: "0000000000",
    branch: "Colombo"
  },
  ezCash: "0770000000",          // eZ Cash / mCash number, "" to hide

  // ---- India UPI (used only when paymentMode is "upi") ----
  upiId: "yourupiid@bank",
  payeeName: "Jahith Cash Delivery",

  // Allowed cash amount per order (Rs.) and quick-pick buttons
  minAmount: 1000,
  maxAmount: 50000,
  amountStep: 500,
  quickAmounts: [1000, 2000, 5000, 10000, 20000],

  // Delivery charge = baseFee + feePercent% of the amount
  baseFee: 200,
  feePercent: 1,

  // Customer mobile number check (Sri Lanka: 07XXXXXXXX)
  phonePattern: "^07[0-9]{8}$",
  phonePlaceholder: "07XXXXXXXX",

  // Map centre used before the customer's location is known (Colombo)
  defaultCenter: [6.9271, 79.8612],

  // Your delivery riders. Put real names and mobile numbers here.
  // (Their positions on the map are simulated in this version -
  //  live GPS tracking needs a backend server, see README.)
  riders: [
    { name: "Kumaran S",       phone: "0770000001", vehicle: "WP BAB-1234", rating: 4.8 },
    { name: "Rizwan Mohamed",  phone: "0770000002", vehicle: "WP BCD-5678", rating: 4.9 },
    { name: "Nuwan Perera",    phone: "0710000003", vehicle: "WP BEF-9012", rating: 4.7 },
    { name: "Sivakumar R",     phone: "0750000004", vehicle: "CP BGH-3456", rating: 4.6 },
    { name: "Fazil Ahamed",    phone: "0760000005", vehicle: "EP BJK-7890", rating: 4.8 },
    { name: "Tharindu Silva",  phone: "0720000006", vehicle: "WP BLM-2468", rating: 4.5 }
  ]
};
