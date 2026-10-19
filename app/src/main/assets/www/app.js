(function () {
  "use strict";

  var CFG = window.APP_CONFIG;
  var native = window.AndroidBridge || null; // present only inside the APK
  var STORE_ORDERS = "cd_orders";
  var STORE_PROFILE = "cd_profile";
  var RIDER_SPEED_KMH = 25;   // used for the ETA shown to the customer
  var SIM_TICK_MS = 1000;     // simulation step
  var SIM_TRIP_TICKS = 60;    // simulated trip takes about one minute

  var $ = function (id) { return document.getElementById(id); };
  var state = {
    screen: "home",
    location: null,       // [lat, lng] chosen by customer
    pendingOrder: null,   // order waiting for UPI result
    activeId: null,       // order currently tracked
    timer: null
  };

  // ---------------------------------------------------------------- helpers

  function rupees(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }

  function fee(amount) {
    return Math.round(CFG.baseFee + amount * CFG.feePercent / 100);
  }

  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
  }

  function orders() { return load(STORE_ORDERS, []); }
  function saveOrder(o) {
    var list = orders().filter(function (x) { return x.id !== o.id; });
    list.unshift(o);
    save(STORE_ORDERS, list.slice(0, 50));
  }
  function getOrder(id) { return orders().filter(function (x) { return x.id === id; })[0] || null; }

  // Distance in km between two [lat, lng] points
  function km(a, b) {
    var R = 6371, rad = Math.PI / 180;
    var dLat = (b[0] - a[0]) * rad, dLng = (b[1] - a[1]) * rad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  // Random point `minKm`..`maxKm` away from centre
  function around(center, minKm, maxKm) {
    var r = minKm + Math.random() * (maxKm - minKm);
    var t = Math.random() * Math.PI * 2;
    return [
      center[0] + (r * Math.cos(t)) / 111,
      center[1] + (r * Math.sin(t)) / (111 * Math.cos(center[0] * Math.PI / 180))
    ];
  }

  // ---------------------------------------------------------------- maps

  var TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  var TILE_OPTS = {
    maxZoom: 19,
    subdomains: "abcd",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  };

  function icon(html, cls, size) {
    return L.divIcon({ html: html, className: cls, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }
  var homeIcon = L.divIcon({ html: "📍", className: "pin", iconSize: [30, 30], iconAnchor: [15, 28] });

  function makeMap(id, center) {
    var m = L.map(id, { zoomControl: false, attributionControl: true }).setView(center, 14);
    L.tileLayer(TILE_URL, TILE_OPTS).addTo(m);
    return m;
  }

  var pickMap = makeMap("pick-map", CFG.defaultCenter);
  var pickMarker = null;
  var nearbyLayer = L.layerGroup().addTo(pickMap);

  pickMap.on("click", function (e) { setLocation([e.latlng.lat, e.latlng.lng], false); });

  function setLocation(latlng, recenter) {
    state.location = latlng;
    if (!pickMarker) {
      pickMarker = L.marker(latlng, { icon: homeIcon, draggable: true }).addTo(pickMap);
      pickMarker.on("dragend", function () {
        var p = pickMarker.getLatLng();
        state.location = [p.lat, p.lng];
        showNearbyRiders();
      });
    } else {
      pickMarker.setLatLng(latlng);
    }
    if (recenter) pickMap.setView(latlng, 14);
    showNearbyRiders();
  }

  // Idle riders shown around the customer on the home map
  function showNearbyRiders() {
    nearbyLayer.clearLayers();
    if (!state.location) return;
    CFG.riders.forEach(function (r) {
      L.marker(around(state.location, 0.5, 3), { icon: icon("🛵", "bike", 30) })
        .bindPopup(r.name)
        .addTo(nearbyLayer);
    });
    $("riders-near").textContent = CFG.riders.length + " riders அருகில் · nearby";
  }

  // ---------------------------------------------------------------- location

  window.onNativeLocation = function (lat, lng) {
    $("btn-locate").disabled = false;
    setLocation([lat, lng], true);
  };
  window.onNativeLocationError = function (msg) {
    $("btn-locate").disabled = false;
    toast(msg + " — map-ல் தொட்டு இடத்தை தேர்ந்தெடுங்கள்");
  };

  function locate() {
    $("btn-locate").disabled = true;
    if (native) {
      native.requestLocation();
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        function (p) { window.onNativeLocation(p.coords.latitude, p.coords.longitude); },
        function (e) { window.onNativeLocationError(e.message || "Location unavailable"); },
        { enableHighAccuracy: true, timeout: 15000 }
      );
    } else {
      window.onNativeLocationError("Location unavailable");
    }
  }
  $("btn-locate").addEventListener("click", locate);

  // ---------------------------------------------------------------- order form

  [500, 1000, 2000, 5000, 10000].forEach(function (v) {
    var b = document.createElement("button");
    b.className = "chip";
    b.textContent = rupees(v);
    b.addEventListener("click", function () { $("amount").value = v; updateSummary(); });
    $("chips").appendChild(b);
  });

  function amountValue() { return Math.floor(Number($("amount").value) || 0); }

  function updateSummary() {
    var a = amountValue();
    var f = a > 0 ? fee(a) : 0;
    $("s-amount").textContent = rupees(a);
    $("s-fee").textContent = rupees(f);
    $("s-total").textContent = rupees(a + f);
    $("btn-pay").textContent = a > 0 ? rupees(a + f) + " UPI மூலம் செலுத்து" : "UPI மூலம் பணம் செலுத்து";
    Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (c) {
      c.classList.toggle("on", c.textContent === rupees(a));
    });
    var hint = $("amount-hint");
    hint.className = "hint";
    hint.textContent = "குறைந்தது " + rupees(CFG.minAmount) + " · அதிகபட்சம் " + rupees(CFG.maxAmount);
  }
  $("amount").addEventListener("input", updateSummary);

  function validate() {
    var a = amountValue();
    if (a < CFG.minAmount || a > CFG.maxAmount) {
      $("amount-hint").className = "hint err";
      return "தொகை " + rupees(CFG.minAmount) + " - " + rupees(CFG.maxAmount) + " இடையில் இருக்க வேண்டும்";
    }
    if (a % 100 !== 0) return "தொகை ₹100-ன் மடங்காக இருக்க வேண்டும் (eg: 1500)";
    if ($("name").value.trim().length < 2) return "பெயரை உள்ளிடவும் / Enter your name";
    if (!/^[6-9]\d{9}$/.test($("phone").value.trim())) return "சரியான 10 இலக்க மொபைல் எண் / Valid mobile number";
    if ($("address").value.trim().length < 5) return "முகவரியை உள்ளிடவும் / Enter address";
    if (!state.location) return "Map-ல் உங்கள் இடத்தை தேர்ந்தெடுங்கள் / Choose location";
    return null;
  }

  // ---------------------------------------------------------------- payment

  function newId() {
    return "CD" + Date.now().toString().slice(-8) + Math.floor(Math.random() * 90 + 10);
  }

  $("btn-pay").addEventListener("click", function () {
    var err = validate();
    if (err) { toast(err); return; }

    var a = amountValue();
    var order = {
      id: newId(),
      amount: a,
      fee: fee(a),
      total: a + fee(a),
      name: $("name").value.trim(),
      phone: $("phone").value.trim(),
      address: $("address").value.trim(),
      location: state.location,
      createdAt: Date.now(),
      status: "pending_payment"
    };
    save(STORE_PROFILE, { name: order.name, phone: order.phone, address: order.address });
    state.pendingOrder = order;

    var upi = "upi://pay?" + [
      "pa=" + encodeURIComponent(CFG.upiId),
      "pn=" + encodeURIComponent(CFG.payeeName),
      "tr=" + encodeURIComponent(order.id),
      "tn=" + encodeURIComponent("Cash delivery " + order.id),
      "am=" + order.total.toFixed(2),
      "cu=INR"
    ].join("&");

    if (native) {
      native.payUpi(upi);
    } else {
      // Browser preview: no UPI apps available, simulate the payment
      var ok = window.confirm("DEMO MODE (browser)\n\nPay " + rupees(order.total) + " to " + CFG.upiId + "?");
      window.onUpiResult(ok ? "SUCCESS" : "CANCELLED", "demo");
    }
  });

  // Called by MainActivity when the UPI app returns
  window.onUpiResult = function (status, raw) {
    var order = state.pendingOrder;
    state.pendingOrder = null;
    if (!order) return;

    if (status === "SUCCESS" || status === "SUBMITTED") {
      order.status = "paid";
      order.paidAt = Date.now();
      order.upiResponse = raw;
      order.otp = String(Math.floor(1000 + Math.random() * 9000));
      saveOrder(order);
      toast("பணம் செலுத்தப்பட்டது ✔ Payment successful");
      startTracking(order.id);
    } else if (status === "NO_APP") {
      toast("UPI app இல்லை. GPay / PhonePe / Paytm install செய்யவும்");
    } else if (status === "FAILURE") {
      toast("Payment தோல்வி அடைந்தது. மீண்டும் முயற்சிக்கவும்");
    } else {
      toast("Payment முடிக்கப்படவில்லை / Payment cancelled");
    }
  };

  // ---------------------------------------------------------------- tracking

  var trackMap = null;
  var trackLayer = null;

  function ensureTrackMap(center) {
    if (!trackMap) {
      trackMap = makeMap("track-map", center);
      trackLayer = L.layerGroup().addTo(trackMap);
    }
    setTimeout(function () { trackMap.invalidateSize(); }, 50);
  }

  function startTracking(id) {
    state.activeId = id;
    go("track");
    var o = getOrder(id);
    if (o.status === "paid") searchRider(o);
    else runTrip(o);
  }

  // Show all riders around the customer, then assign the nearest one
  function searchRider(o) {
    ensureTrackMap(o.location);
    trackLayer.clearLayers();
    trackMap.setView(o.location, 14);
    L.marker(o.location, { icon: homeIcon }).addTo(trackLayer).bindPopup("நீங்கள் / You");

    var candidates = CFG.riders.map(function (r) {
      var pos = around(o.location, 1, 4);
      L.marker(pos, { icon: icon("🛵", "bike", 30) }).addTo(trackLayer).bindPopup(r.name);
      return { rider: r, pos: pos, dist: km(pos, o.location) };
    });
    candidates.sort(function (a, b) { return a.dist - b.dist; });
    renderTrack(o);

    setTimeout(function () {
      if (state.activeId !== o.id) return;
      var best = candidates[0];
      o.rider = best.rider;
      o.riderStart = best.pos;
      o.riderPos = best.pos;
      o.progress = 0;
      o.status = "assigned";
      saveOrder(o);
      runTrip(o);
    }, 3000);
  }

  function runTrip(o) {
    ensureTrackMap(o.location);
    clearInterval(state.timer);
    trackLayer.clearLayers();
    L.marker(o.location, { icon: homeIcon }).addTo(trackLayer).bindPopup("நீங்கள் / You");

    if (!o.rider) { renderTrack(o); return; }

    var riderMarker = L.marker(o.riderPos, { icon: icon("🛵", "bike assigned", 34) })
      .addTo(trackLayer).bindPopup(o.rider.name);
    var path = L.polyline([o.riderPos, o.location], { color: "#0B6E4F", weight: 4, dashArray: "6 8" }).addTo(trackLayer);
    trackMap.fitBounds(L.latLngBounds([o.riderPos, o.location]).pad(0.35));
    renderTrack(o);

    if (o.status === "delivered" || o.status === "arrived") return;

    state.timer = setInterval(function () {
      if (state.activeId !== o.id) { clearInterval(state.timer); return; }
      o.progress = Math.min(1, (o.progress || 0) + 1 / SIM_TRIP_TICKS);
      if (o.status === "assigned" && o.progress > 0.08) o.status = "on_the_way";
      var p = o.progress;
      o.riderPos = [
        o.riderStart[0] + (o.location[0] - o.riderStart[0]) * p,
        o.riderStart[1] + (o.location[1] - o.riderStart[1]) * p
      ];
      if (p >= 1) {
        o.status = "arrived";
        clearInterval(state.timer);
        toast("Rider வந்துவிட்டார்! OTP சொல்லி பணத்தை பெறுங்கள்");
      }
      riderMarker.setLatLng(o.riderPos);
      path.setLatLngs([o.riderPos, o.location]);
      saveOrder(o);
      renderTrack(o);
    }, SIM_TICK_MS);
  }

  var STEPS = ["paid", "assigned", "on_the_way", "arrived", "delivered"];
  var STATUS_TEXT = {
    paid: "அருகிலுள்ள Rider-ஐ தேடுகிறோம்... · Finding rider",
    assigned: "Rider ஒதுக்கப்பட்டார் · Rider assigned",
    on_the_way: "Rider பணத்துடன் வருகிறார் · On the way",
    arrived: "Rider உங்கள் இடத்தில் · Rider arrived",
    delivered: "பணம் வழங்கப்பட்டது ✔ · Delivered"
  };

  function renderTrack(o) {
    if (!o) {
      $("t-status").textContent = "Active order இல்லை · No active order";
      $("t-eta").textContent = "Home-ல் புதிய order செய்யுங்கள்";
      $("t-rider").classList.add("hidden");
      $("t-otp-box").classList.add("hidden");
      $("btn-received").classList.add("hidden");
      $("t-steps").classList.add("hidden");
      $("t-id").textContent = "-";
      $("t-amount").textContent = "-";
      return;
    }
    $("t-steps").classList.remove("hidden");
    $("t-status").textContent = STATUS_TEXT[o.status] || o.status;
    $("t-id").textContent = o.id;
    $("t-amount").textContent = rupees(o.amount);

    var idx = STEPS.indexOf(o.status);
    Array.prototype.forEach.call(document.querySelectorAll("#t-steps li"), function (li) {
      var i = STEPS.indexOf(li.getAttribute("data-s"));
      li.classList.toggle("done", i <= idx);
      li.classList.toggle("current", i === idx);
    });

    if (o.rider) {
      $("t-rider").classList.remove("hidden");
      $("t-rname").textContent = o.rider.name + "  ⭐ " + o.rider.rating;
      $("t-rmeta").textContent = "🏍 " + o.rider.vehicle;
      $("t-rphone").textContent = o.rider.phone;
      $("t-otp-box").classList.toggle("hidden", o.status === "delivered");
      $("t-otp").textContent = o.otp;
    } else {
      $("t-rider").classList.add("hidden");
      $("t-otp-box").classList.add("hidden");
    }

    if (o.status === "on_the_way" || o.status === "assigned") {
      var d = km(o.riderPos, o.location);
      var mins = Math.max(1, Math.round(d / RIDER_SPEED_KMH * 60));
      $("t-eta").textContent = d.toFixed(1) + " km தூரம் · சுமார் " + mins + " நிமிடம் (ETA " + mins + " min)";
    } else if (o.status === "arrived") {
      $("t-eta").textContent = "OTP-ஐ சொல்லி பணத்தை எண்ணி வாங்குங்கள்";
    } else if (o.status === "delivered") {
      $("t-eta").textContent = "நன்றி! Thank you for using Cash Delivery";
    } else {
      $("t-eta").textContent = "சில வினாடிகள் காத்திருக்கவும்...";
    }

    $("btn-received").classList.toggle("hidden", o.status !== "arrived");
  }

  $("btn-call").addEventListener("click", function () {
    var o = getOrder(state.activeId);
    if (!o || !o.rider) return;
    if (native) native.callPhone(o.rider.phone);
    else window.location.href = "tel:" + o.rider.phone;
  });

  $("btn-received").addEventListener("click", function () {
    var o = getOrder(state.activeId);
    if (!o) return;
    o.status = "delivered";
    o.deliveredAt = Date.now();
    saveOrder(o);
    renderTrack(o);
    toast("நன்றி! Order முடிந்தது");
  });

  // ---------------------------------------------------------------- orders list

  function renderOrders() {
    var list = orders().filter(function (o) { return o.status !== "pending_payment"; });
    var box = $("orders-list");
    box.innerHTML = "";
    if (!list.length) {
      box.innerHTML = '<div class="empty">இதுவரை order இல்லை · No orders yet</div>';
      return;
    }
    list.forEach(function (o) {
      var row = document.createElement("div");
      row.className = "order";
      var left = document.createElement("div");
      var amt = document.createElement("div");
      amt.className = "o-amt";
      amt.textContent = rupees(o.amount) + " · " + o.id;
      var meta = document.createElement("div");
      meta.className = "o-meta";
      meta.textContent = new Date(o.createdAt).toLocaleString("en-IN") +
        (o.rider ? " · " + o.rider.name + " (" + o.rider.phone + ")" : "");
      left.appendChild(amt);
      left.appendChild(meta);
      var badge = document.createElement("span");
      var live = o.status !== "delivered";
      badge.className = "badge" + (live ? " live" : "");
      badge.textContent = live ? "Track ›" : "Delivered";
      row.appendChild(left);
      row.appendChild(badge);
      if (live) row.addEventListener("click", function () { startTracking(o.id); });
      box.appendChild(row);
    });
  }

  // ---------------------------------------------------------------- navigation

  function go(name) {
    state.screen = name;
    Array.prototype.forEach.call(document.querySelectorAll(".screen"), function (s) {
      s.classList.toggle("active", s.id === "screen-" + name);
    });
    Array.prototype.forEach.call(document.querySelectorAll(".bottomnav button"), function (b) {
      b.classList.toggle("active", b.getAttribute("data-go") === name);
    });
    window.scrollTo(0, 0);
    if (name === "home") setTimeout(function () { pickMap.invalidateSize(); }, 50);
    if (name === "orders") renderOrders();
    if (name === "track") {
      var o = state.activeId ? getOrder(state.activeId) : null;
      ensureTrackMap(o ? o.location : CFG.defaultCenter);
      renderTrack(o);
    }
  }

  Array.prototype.forEach.call(document.querySelectorAll(".bottomnav button"), function (b) {
    b.addEventListener("click", function () {
      var target = b.getAttribute("data-go");
      if (target === "track" && !state.activeId) {
        var live = orders().filter(function (o) { return o.status !== "delivered" && o.status !== "pending_payment"; })[0];
        if (live) { startTracking(live.id); return; }
      }
      go(target);
    });
  });

  // Android back button: return true if handled
  window.onBack = function () {
    if (state.screen !== "home") { go("home"); return true; }
    return false;
  };

  // ---------------------------------------------------------------- start

  var profile = load(STORE_PROFILE, null);
  if (profile) {
    $("name").value = profile.name || "";
    $("phone").value = profile.phone || "";
    $("address").value = profile.address || "";
  }
  updateSummary();
  locate();

  if (/yourupiid/.test(CFG.upiId)) {
    console.warn("APP_CONFIG.upiId is still the placeholder - set your real UPI ID in config.js");
  }
})();
