// ============================================================
//  App settings - change these before giving the APK to users
// ============================================================
window.APP_CONFIG = {
  // Your UPI ID. Customer's money goes to this account.
  // !! Replace with your real UPI ID (eg: jahith@okaxis) !!
  upiId: "yourupiid@bank",
  payeeName: "Jahith Cash Delivery",

  // Allowed cash amount per order (Rs)
  minAmount: 500,
  maxAmount: 10000,

  // Delivery charge = baseFee + feePercent% of the amount
  baseFee: 30,
  feePercent: 1,

  // Map centre used before the customer's location is known (Chennai)
  defaultCenter: [13.0827, 80.2707],

  // Your delivery riders. Put real names and mobile numbers here.
  // (Their positions on the map are simulated in this version -
  //  live GPS tracking needs a backend server, see README.)
  riders: [
    { name: "Arun Kumar",   phone: "9000000001", vehicle: "TN 01 AB 1234", rating: 4.8 },
    { name: "Mohamed Ali",  phone: "9000000002", vehicle: "TN 02 CD 5678", rating: 4.9 },
    { name: "Karthik S",    phone: "9000000003", vehicle: "TN 05 EF 9012", rating: 4.7 },
    { name: "Suresh Babu",  phone: "9000000004", vehicle: "TN 07 GH 3456", rating: 4.6 },
    { name: "Imran Khan",   phone: "9000000005", vehicle: "TN 09 JK 7890", rating: 4.8 },
    { name: "Vignesh R",    phone: "9000000006", vehicle: "TN 10 LM 2468", rating: 4.5 }
  ]
};
