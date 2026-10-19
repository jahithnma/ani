// Customer app: order cash, pay, then track the rider until the cash is delivered.
// With Firebase configured (backend.js) orders go to the Rider app and riders'
// real GPS positions are shown; without it, riders are simulated on the device.
(function () {
  "use strict";

  var CFG = U.CFG, $ = U.$, rupees = U.money, toast = U.toast, km = U.km, native = U.native;
  var B = window.Backend;
  var STORE_ORDERS = "cd_orders";
  var STORE_PROFILE = "cd_profile";
  var RIDER_SPEED_KMH = 25;   // used for the ETA shown to the customer
  var SIM_TICK_MS = 1000;     // simulation step
  var SIM_TRIP_TICKS = 60;    // simulated trip takes about one minute

  var state = {
    screen: "home",
    location: null,       // [lat, lng] chosen by customer
    pendingOrder: null,   // order waiting for the payment result
    activeId: null,       // order currently tracked
    timer: null,
    unsub: []             // live listeners of the tracked order
  };

  // ---------------------------------------------------------------- orders (local copy)

  function fee(amount) {
    return Math.round(CFG.baseFee + amount * CFG.feePercent / 100);
  }

  function orders() { return U.load(STORE_ORDERS, []); }
  function saveOrder(o) {
    var list = orders().filter(function (x) { return x.id !== o.id; });
    list.unshift(o);
    U.save(STORE_ORDERS, list.slice(0, 50));
  }
  function getOrder(id) { return orders().filter(function (x) { return x.id === id; })[0] || null; }

  // ---------------------------------------------------------------- maps

  var pickMap = U.makeMap("pick-map", CFG.defaultCenter);
  var pickMarker = null;
  var nearbyLayer = L.layerGroup().addTo(pickMap);
  var onlineRiders = {};    // live riders from the backend, by id

  pickMap.on("click", function (e) { setLocation([e.latlng.lat, e.latlng.lng], false); });

  function setLocation(latlng, recenter) {
    state.location = latlng;
    if (!pickMarker) {
      pickMarker = L.marker(latlng, { icon: U.homeIcon, draggable: true }).addTo(pickMap);
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

  function riderMarkers(layer, center) {
    var list = [];
    if (B) {
      Object.keys(onlineRiders).forEach(function (id) {
        var r = onlineRiders[id];
        if (typeof r.lat === "number") list.push({ name: r.name, pos: [r.lat, r.lng] });
      });
    } else if (center) {
      CFG.riders.forEach(function (r) { list.push({ name: r.name, pos: U.around(center, 0.5, 3) }); });
    }
    list.forEach(function (r) {
      L.marker(r.pos, { icon: U.icon("🛵", "bike", 30) }).bindPopup(r.name).addTo(layer);
    });
    return list.length;
  }

  // Riders shown around the customer on the home map
  function showNearbyRiders() {
    nearbyLayer.clearLayers();
    if (!B && !state.location) return;
    var n = riderMarkers(nearbyLayer, state.location);
    $("riders-near").textContent = T("riders_near", { n: n });
  }

  if (B) {
    B.watchOnlineRiders(function (val) {
      onlineRiders = val || {};
      showNearbyRiders();
      var o = state.activeId && getOrder(state.activeId);
      if (o && o.status === "paid" && state.screen === "track") drawTrack(o);
    });
  }

  // ---------------------------------------------------------------- location

  window.onNativeLocation = function (lat, lng) {
    $("btn-locate").disabled = false;
    setLocation([lat, lng], true);
  };
  window.onNativeLocationError = function (msg) {
    $("btn-locate").disabled = false;
    toast(T("loc_fail", { msg: msg }));
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

  CFG.quickAmounts.forEach(function (v) {
    var b = document.createElement("button");
    b.className = "chip";
    b.textContent = rupees(v);
    b.addEventListener("click", function () { $("amount").value = v; updateSummary(); });
    $("chips").appendChild(b);
  });

  function amountValue() { return Math.floor(Number($("amount").value) || 0); }
  function phoneValue() { return $("phone").value.trim().replace(/[\s-]/g, ""); }

  function updateSummary() {
    var a = amountValue();
    var f = a > 0 ? fee(a) : 0;
    $("s-amount").textContent = rupees(a);
    $("s-fee").textContent = rupees(f);
    $("s-total").textContent = rupees(a + f);
    $("btn-pay").textContent = a > 0 ? T("pay_amount", { amt: rupees(a + f) }) : T("pay");
    U.each(".chip", function (c) { c.classList.toggle("on", c.textContent === rupees(a)); });
    var hint = $("amount-hint");
    hint.className = "hint";
    hint.textContent = T("min_max", { min: rupees(CFG.minAmount), max: rupees(CFG.maxAmount) });
  }
  $("amount").addEventListener("input", updateSummary);

  function validate() {
    var a = amountValue();
    if (a < CFG.minAmount || a > CFG.maxAmount) {
      $("amount-hint").className = "hint err";
      return T("err_amount", { min: rupees(CFG.minAmount), max: rupees(CFG.maxAmount) });
    }
    if (a % CFG.amountStep !== 0) return T("err_step", { step: rupees(CFG.amountStep) });
    if ($("name").value.trim().length < 2) return T("err_name");
    if (!new RegExp(CFG.phonePattern).test(phoneValue())) return T("err_phone", { ph: CFG.phonePlaceholder });
    if ($("address").value.trim().length < 5) return T("err_address");
    if (!state.location) return T("err_location");
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
      phone: phoneValue(),
      address: $("address").value.trim(),
      location: state.location,
      createdAt: Date.now(),
      status: "pending_payment",
      live: !!B
    };
    U.save(STORE_PROFILE, { name: order.name, phone: order.phone, address: order.address });
    state.pendingOrder = order;

    if (CFG.paymentMode !== "upi") { openPaySheet(order); return; }

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

  // ---- Sri Lanka: LankaQR / bank transfer / eZ Cash, customer enters the reference

  function bankLine(label, value) {
    var row = document.createElement("div");
    row.className = "line";
    var l = document.createElement("span");
    l.textContent = label;
    var v = document.createElement("b");
    v.textContent = value;
    row.appendChild(l);
    row.appendChild(v);
    return row;
  }

  function openPaySheet(order) {
    $("p-total").textContent = rupees(order.total);
    $("p-ref").value = "";
    var qr = $("p-qr");
    qr.onerror = function () { qr.classList.add("hidden"); $("p-qr-hint").classList.add("hidden"); };
    qr.classList.remove("hidden");
    $("p-qr-hint").classList.remove("hidden");
    qr.src = CFG.lankaQrImage;

    var bank = $("p-bank");
    bank.innerHTML = "";
    bank.appendChild(bankLine("Bank", CFG.bank.name));
    bank.appendChild(bankLine("Account name", CFG.bank.accountName));
    bank.appendChild(bankLine("Account no.", CFG.bank.accountNo));
    bank.appendChild(bankLine("Branch", CFG.bank.branch));
    if (CFG.ezCash) bank.appendChild(bankLine("eZ Cash / mCash", CFG.ezCash));
    bank.appendChild(bankLine("Remark / Reference", order.id));
    $("paysheet").classList.remove("hidden");
  }

  function closePaySheet() { $("paysheet").classList.add("hidden"); }

  $("btn-paid").addEventListener("click", function () {
    var ref = $("p-ref").value.trim();
    if (ref.length < 4) { toast(T("ref_required")); return; }
    closePaySheet();
    window.onUpiResult("SUCCESS", ref);
  });

  $("btn-paycancel").addEventListener("click", function () {
    closePaySheet();
    window.onUpiResult("CANCELLED", "");
  });

  // Called by MainActivity when the UPI app returns (and by the pay sheet above)
  window.onUpiResult = function (status, raw) {
    var order = state.pendingOrder;
    state.pendingOrder = null;
    if (!order) return;

    if (status === "SUCCESS" || status === "SUBMITTED") {
      order.status = "paid";
      order.paidAt = Date.now();
      order.payRef = raw;
      order.otp = String(Math.floor(1000 + Math.random() * 9000));
      order.otpHash = otpHash(order.otp, order.id);
      saveOrder(order);
      if (B) {
        // The OTP itself stays on this phone; the rider app only gets its hash
        var shared = {};
        Object.keys(order).forEach(function (k) { if (k !== "otp" && k !== "live") shared[k] = order[k]; });
        B.saveOrder(shared).catch(function () { toast(T("net_error")); });
      }
      toast(T("paid_ok"));
      startTracking(order.id);
    } else if (status === "NO_APP") {
      toast(T("no_upi"));
    } else if (status === "FAILURE") {
      toast(T("pay_fail"));
    } else {
      toast(T("pay_cancel"));
    }
  };

  // ---------------------------------------------------------------- tracking

  var trackMap = null;
  var trackLayer = null;
  var riderMarker = null;
  var riderPath = null;

  function ensureTrackMap(center) {
    if (!trackMap) {
      trackMap = U.makeMap("track-map", center);
      trackLayer = L.layerGroup().addTo(trackMap);
    }
    setTimeout(function () { trackMap.invalidateSize(); }, 50);
  }

  function stopListening() {
    clearInterval(state.timer);
    state.unsub.forEach(function (fn) { fn(); });
    state.unsub = [];
  }

  function startTracking(id) {
    stopListening();
    state.activeId = id;
    go("track");
    var o = getOrder(id);
    if (o.live && B) liveTrack(o);
    else if (o.status === "paid") searchRider(o);
    else runTrip(o);
  }

  // Draw customer, rider (if assigned) or nearby riders (while searching)
  function drawTrack(o, fit) {
    ensureTrackMap(o.location);
    trackLayer.clearLayers();
    riderMarker = riderPath = null;
    L.marker(o.location, { icon: U.homeIcon }).addTo(trackLayer).bindPopup(T("you"));
    if (o.riderPos) {
      riderMarker = L.marker(o.riderPos, { icon: U.icon("🛵", "bike assigned", 34) })
        .addTo(trackLayer).bindPopup(o.rider ? o.rider.name : "");
      riderPath = L.polyline([o.riderPos, o.location], { color: "#0B6E4F", weight: 4, dashArray: "6 8" }).addTo(trackLayer);
      if (fit) trackMap.fitBounds(L.latLngBounds([o.riderPos, o.location]).pad(0.35));
    } else if (o.status === "paid" && B) {
      riderMarkers(trackLayer, o.location);
      if (fit) trackMap.setView(o.location, 14);
    } else if (fit) {
      trackMap.setView(o.location, 14);
    }
    renderTrack(o);
  }

  function moveRider(o) {
    if (!riderMarker) { drawTrack(o, true); return; }
    riderMarker.setLatLng(o.riderPos);
    riderPath.setLatLngs([o.riderPos, o.location]);
  }

  // ---- live mode: follow the order and the rider in Firebase

  function liveTrack(o) {
    drawTrack(o, true);
    var riderId = null;
    state.unsub.push(B.watchOrder(o.id, function (remote) {
      if (!remote || state.activeId !== o.id) return;
      var local = getOrder(o.id) || o;
      var before = local.status;
      ["status", "riderId", "rider", "assignedAt", "deliveredAt"].forEach(function (k) {
        if (remote[k] !== undefined) local[k] = remote[k];
      });
      saveOrder(local);
      if (local.status === "arrived" && before !== "arrived") toast(T("rider_arrived_toast"));
      if (local.riderId && local.riderId !== riderId) {
        riderId = local.riderId;
        state.unsub.push(B.watchRider(riderId, function (r) {
          if (!r || typeof r.lat !== "number" || state.activeId !== o.id) return;
          var cur = getOrder(o.id);
          cur.riderPos = [r.lat, r.lng];
          saveOrder(cur);
          moveRider(cur);
          renderTrack(cur);
        }));
        // the rider listener may have fired at once from cache and stored riderPos
        local = getOrder(o.id);
      }
      if (before !== local.status) drawTrack(local, true);
      else renderTrack(local);
      if (local.status === "delivered") stopListening();
    }));
  }

  // ---- demo mode: simulated riders on this device

  // Show all riders around the customer, then assign the nearest one
  function searchRider(o) {
    ensureTrackMap(o.location);
    trackLayer.clearLayers();
    trackMap.setView(o.location, 14);
    L.marker(o.location, { icon: U.homeIcon }).addTo(trackLayer).bindPopup(T("you"));

    var candidates = CFG.riders.map(function (r) {
      var pos = U.around(o.location, 1, 4);
      L.marker(pos, { icon: U.icon("🛵", "bike", 30) }).addTo(trackLayer).bindPopup(r.name);
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
    drawTrack(o, true);
    if (!o.rider || o.status === "delivered" || o.status === "arrived") return;

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
        toast(T("rider_arrived_toast"));
      }
      moveRider(o);
      saveOrder(o);
      renderTrack(o);
    }, SIM_TICK_MS);
  }

  var STEPS = ["paid", "assigned", "on_the_way", "arrived", "delivered"];

  function renderTrack(o) {
    if (!o) {
      $("t-status").textContent = T("no_active");
      $("t-eta").textContent = T("no_active_hint");
      $("t-rider").classList.add("hidden");
      $("t-otp-box").classList.add("hidden");
      $("btn-received").classList.add("hidden");
      $("t-steps").classList.add("hidden");
      $("t-id").textContent = "-";
      $("t-amount").textContent = "-";
      return;
    }
    $("t-steps").classList.remove("hidden");
    $("t-status").textContent = T("st_" + o.status);
    $("t-id").textContent = o.id;
    $("t-amount").textContent = rupees(o.amount);

    var idx = STEPS.indexOf(o.status);
    U.each("#t-steps li", function (li) {
      var i = STEPS.indexOf(li.getAttribute("data-s"));
      li.classList.toggle("done", i <= idx);
      li.classList.toggle("current", i === idx);
    });

    if (o.rider) {
      $("t-rider").classList.remove("hidden");
      $("t-rname").textContent = o.rider.name + (o.rider.rating ? "  ⭐ " + o.rider.rating : "");
      $("t-rmeta").textContent = "🏍 " + (o.rider.vehicle || "");
      $("t-rphone").textContent = o.rider.phone;
      $("t-otp-box").classList.toggle("hidden", o.status === "delivered");
      $("t-otp").textContent = o.otp;
    } else {
      $("t-rider").classList.add("hidden");
      $("t-otp-box").classList.add("hidden");
    }

    if ((o.status === "on_the_way" || o.status === "assigned") && o.riderPos) {
      var d = km(o.riderPos, o.location);
      var mins = Math.max(1, Math.round(d / RIDER_SPEED_KMH * 60));
      $("t-eta").textContent = T("eta", { km: d.toFixed(1), min: mins });
    } else if (o.status === "arrived") {
      $("t-eta").textContent = T("arrived_hint");
    } else if (o.status === "delivered") {
      $("t-eta").textContent = T("delivered_hint");
    } else if (o.status === "paid" && o.live) {
      $("t-eta").textContent = T("waiting_rider");
    } else {
      $("t-eta").textContent = T("eta_wait");
    }

    $("btn-received").classList.toggle("hidden", o.status !== "arrived");
  }

  $("btn-call").addEventListener("click", function () {
    var o = getOrder(state.activeId);
    if (o && o.rider) U.dial(o.rider.phone);
  });

  $("btn-received").addEventListener("click", function () {
    var o = getOrder(state.activeId);
    if (!o) return;
    o.status = "delivered";
    o.deliveredAt = Date.now();
    saveOrder(o);
    if (o.live && B) B.updateOrder(o.id, { status: "delivered", deliveredAt: o.deliveredAt, confirmedBy: "customer" });
    stopListening();
    renderTrack(o);
    toast(T("thanks"));
  });

  // ---------------------------------------------------------------- orders list

  function renderOrders() {
    var list = orders().filter(function (o) { return o.status !== "pending_payment"; });
    var box = $("orders-list");
    box.innerHTML = "";
    if (!list.length) {
      var empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = T("no_orders");
      box.appendChild(empty);
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
      meta.textContent = new Date(o.createdAt).toLocaleString(CFG.locale) +
        (o.rider ? " · " + o.rider.name + " (" + o.rider.phone + ")" : "");
      left.appendChild(amt);
      left.appendChild(meta);
      var badge = document.createElement("span");
      var live = o.status !== "delivered";
      badge.className = "badge" + (live ? " live" : "");
      badge.textContent = live ? T("badge_track") : T("badge_delivered");
      row.appendChild(left);
      row.appendChild(badge);
      if (live) row.addEventListener("click", function () { startTracking(o.id); });
      box.appendChild(row);
    });
  }

  // ---------------------------------------------------------------- navigation

  function go(name) {
    state.screen = name;
    U.each(".screen", function (s) { s.classList.toggle("active", s.id === "screen-" + name); });
    U.each(".bottomnav button", function (b) { b.classList.toggle("active", b.getAttribute("data-go") === name); });
    window.scrollTo(0, 0);
    if (name === "home") setTimeout(function () { pickMap.invalidateSize(); }, 50);
    if (name === "orders") renderOrders();
    if (name === "track") {
      var o = state.activeId ? getOrder(state.activeId) : null;
      ensureTrackMap(o ? o.location : CFG.defaultCenter);
      renderTrack(o);
    }
  }

  U.each(".bottomnav button", function (b) {
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
    if (!$("paysheet").classList.contains("hidden")) { $("btn-paycancel").click(); return true; }
    if (state.screen !== "home") { go("home"); return true; }
    return false;
  };

  // ---------------------------------------------------------------- start

  function applyTexts() {
    I18N.apply();
    updateSummary();
    showNearbyRiders();
    $("pay-methods").textContent = CFG.paymentMode === "upi"
      ? "GPay · PhonePe · Paytm · BHIM"
      : "LankaQR · Bank transfer · eZ Cash · Genie";
    $("mode-tag").textContent = CFG.country + (B ? " · Live" : " · Demo");
    if (state.screen === "track") renderTrack(state.activeId ? getOrder(state.activeId) : null);
    if (state.screen === "orders") renderOrders();
  }
  I18N.onChange(applyTexts);

  var profile = U.load(STORE_PROFILE, null);
  if (profile) {
    $("name").value = profile.name || "";
    $("phone").value = profile.phone || "";
    $("address").value = profile.address || "";
  }
  $("cur-sym").textContent = CFG.currencySymbol;
  $("phone").placeholder = CFG.phonePlaceholder;
  applyTexts();
  locate();

  if (CFG.paymentMode === "upi" && /yourupiid/.test(CFG.upiId)) {
    console.warn("APP_CONFIG.upiId is still the placeholder - set your real UPI ID in config.js");
  }
})();
