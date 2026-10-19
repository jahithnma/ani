// Firebase Realtime Database connection shared by the customer and rider apps.
// window.Backend is null when APP_CONFIG.firebase is not filled in; the
// customer app then falls back to simulated riders.
//
// Data layout:
//   riders/{riderId}  { name, phone, vehicle, rating, online, lat, lng, updatedAt }
//   orders/{orderId}  { amount, fee, total, name, phone, address, location:[lat,lng],
//                       payRef, otpHash, status, riderId, rider:{...}, createdAt, ... }
(function () {
  "use strict";

  // Simple non-cryptographic hash so the OTP itself is not stored in the database
  window.otpHash = function (otp, orderId) {
    var s = String(otp) + "|" + orderId, h = 2166136261;
    for (var i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16);
  };

  var fb = (window.APP_CONFIG || {}).firebase;
  window.Backend = null;
  if (!fb || !fb.apiKey || !fb.databaseURL || /YOUR_/.test(fb.apiKey + fb.databaseURL) || !window.firebase) {
    return;
  }

  firebase.initializeApp(fb);
  var db = firebase.database();
  var TS = firebase.database.ServerValue.TIMESTAMP;

  function listen(ref, cb) {
    var fn = ref.on("value", function (snap) { cb(snap.val()); });
    return function () { ref.off("value", fn); };
  }

  window.Backend = {
    db: db,
    TS: TS,

    saveOrder: function (o) {
      return db.ref("orders/" + o.id).set(o);
    },
    updateOrder: function (id, fields) {
      return db.ref("orders/" + id).update(fields);
    },
    watchOrder: function (id, cb) {
      return listen(db.ref("orders/" + id), cb);
    },
    watchOrdersByStatus: function (status, cb) {
      return listen(db.ref("orders").orderByChild("status").equalTo(status), cb);
    },
    watchOrdersOfRider: function (riderId, cb) {
      return listen(db.ref("orders").orderByChild("riderId").equalTo(riderId), cb);
    },
    // Atomically take a paid order; resolves true if this rider got it
    acceptOrder: function (id, rider) {
      return db.ref("orders/" + id).transaction(function (o) {
        if (!o) return o; // not loaded yet: Firebase retries with the real value
        if (o.status !== "paid" || o.riderId) return; // abort
        o.status = "assigned";
        o.riderId = rider.id;
        o.rider = { name: rider.name, phone: rider.phone, vehicle: rider.vehicle, rating: rider.rating };
        o.assignedAt = Date.now();
        return o;
      }).then(function (res) { return res.committed; });
    },

    watchOnlineRiders: function (cb) {
      return listen(db.ref("riders").orderByChild("online").equalTo(true), cb);
    },
    watchRider: function (id, cb) {
      return listen(db.ref("riders/" + id), cb);
    },
    updateRider: function (id, fields) {
      return db.ref("riders/" + id).update(fields);
    },
    // Mark rider offline automatically if the app loses connection
    riderOfflineOnDisconnect: function (id) {
      return db.ref("riders/" + id).onDisconnect().update({ online: false });
    }
  };
})();
