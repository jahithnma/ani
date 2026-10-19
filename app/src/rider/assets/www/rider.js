// Rider app: log in, go online (shares GPS), accept paid orders, deliver cash, verify OTP.
// Needs Firebase (APP_CONFIG.firebase) - orders and positions are exchanged through it.
(function () {
  "use strict";

  var $ = U.$, rupees = U.money, toast = U.toast, km = U.km, native = U.native;
  var B = window.Backend;
  var STORE_SESSION = "cd_rider";
  var SEND_EVERY_MS = 4000;  // minimum gap between position uploads

  var me = null;            // logged-in rider account
  var state = {
    online: false,
    pos: null,              // [lat, lng] of this phone
    lastSent: 0,
    job: null,              // order this rider is delivering
    open: {},               // paid orders waiting for a rider
    unsubOpen: null,
    browserWatch: null
  };

  function show(id, on) { $(id).classList.toggle("hidden", !on); }

  // ---------------------------------------------------------------- map

  var map = null, layer = null;

  function ensureMap() {
    if (!map) {
      map = U.makeMap("r-map", U.CFG.defaultCenter);
      layer = L.layerGroup().addTo(map);
    }
    setTimeout(function () { map.invalidateSize(); }, 50);
  }

  function drawMap(fit) {
    if (!map) return;
    layer.clearLayers();
    var pts = [];
    if (state.pos) {
      L.marker(state.pos, { icon: U.icon("🛵", "bike assigned", 34) }).addTo(layer);
      pts.push(state.pos);
    }
    if (state.job) {
      L.marker(state.job.location, { icon: U.homeIcon }).addTo(layer).bindPopup(state.job.name);
      pts.push(state.job.location);
      if (state.pos) L.polyline([state.pos, state.job.location], { color: "#0B6E4F", weight: 4, dashArray: "6 8" }).addTo(layer);
    } else {
      Object.keys(state.open).forEach(function (id) {
        var o = state.open[id];
        L.marker(o.location, { icon: U.icon("💵", "bike", 30) }).addTo(layer).bindPopup(rupees(o.amount));
        pts.push(o.location);
      });
    }
    if (fit && pts.length > 1) map.fitBounds(L.latLngBounds(pts).pad(0.3));
    else if (fit && pts.length === 1) map.setView(pts[0], 14);
  }

  // ---------------------------------------------------------------- location

  window.onNativeLocation = function (lat, lng) {
    var first = !state.pos;
    state.pos = [lat, lng];
    var now = Date.now();
    if (me && (state.online || state.job) && now - state.lastSent >= SEND_EVERY_MS) {
      state.lastSent = now;
      B.updateRider(me.id, { lat: lat, lng: lng, updatedAt: B.TS });
    }
    drawMap(first);
    renderJob();
    renderOpen();
  };
  window.onNativeLocationError = function (msg) { toast(msg); };

  function sharing() { return state.online || !!state.job; }

  // Keep GPS running while online or on a delivery
  function updateGps() {
    if (sharing()) {
      if (native) {
        native.watchLocation();
        native.keepScreenOn(true);
      } else if (navigator.geolocation && state.browserWatch === null) {
        state.browserWatch = navigator.geolocation.watchPosition(
          function (p) { window.onNativeLocation(p.coords.latitude, p.coords.longitude); },
          function (e) { window.onNativeLocationError(e.message); },
          { enableHighAccuracy: true }
        );
      }
    } else if (native) {
      native.stopLocation();
      native.keepScreenOn(false);
    } else if (state.browserWatch !== null) {
      navigator.geolocation.clearWatch(state.browserWatch);
      state.browserWatch = null;
    }
  }

  // ---------------------------------------------------------------- online / offline

  function setOnline(on) {
    state.online = on;
    B.updateRider(me.id, { online: on, updatedAt: B.TS });
    if (on) {
      B.riderOfflineOnDisconnect(me.id);
      state.lastSent = 0;
      if (state.pos) window.onNativeLocation(state.pos[0], state.pos[1]);
    }
    updateGps();
    watchOpen();
    renderStatus();
  }

  $("btn-online").addEventListener("click", function () { setOnline(!state.online); });

  function renderStatus() {
    $("r-status").classList.toggle("on", state.online);
    $("r-status-text").textContent = state.online ? T("r_online") : T("r_offline");
    $("btn-online").textContent = state.online ? T("r_go_offline") : T("r_go_online");
  }

  // ---------------------------------------------------------------- open orders

  function watchOpen() {
    var want = state.online && !state.job;
    if (want && !state.unsubOpen) {
      state.unsubOpen = B.watchOrdersByStatus("paid", function (val) {
        var before = Object.keys(state.open).length;
        state.open = val || {};
        renderOpen();
        drawMap(Object.keys(state.open).length !== before); // re-fit when orders appear/disappear
      });
    } else if (!want && state.unsubOpen) {
      state.unsubOpen();
      state.unsubOpen = null;
      state.open = {};
    }
    renderOpen();
  }

  function renderOpen() {
    show("open", !state.job);
    var box = $("open-list");
    box.innerHTML = "";
    var msg = null;
    var list = Object.keys(state.open).map(function (id) { return state.open[id]; })
      .filter(function (o) { return o && o.location && !o.riderId; });
    if (!state.online) msg = T("r_offline_hint");
    else if (!list.length) msg = T("r_no_orders");
    if (msg) {
      var empty = document.createElement("div");
      empty.className = "empty";
      empty.textContent = msg;
      box.appendChild(empty);
      return;
    }
    if (state.pos) {
      list.sort(function (a, b) { return km(state.pos, a.location) - km(state.pos, b.location); });
    }
    list.forEach(function (o) {
      var card = document.createElement("div");
      card.className = "job";
      var amt = document.createElement("div");
      amt.className = "j-amt";
      amt.textContent = rupees(o.amount);
      var meta = document.createElement("div");
      meta.className = "j-meta";
      meta.textContent = (state.pos ? T("r_away", { km: km(state.pos, o.location).toFixed(1) }) + " · " : "") +
        o.address + " · " + T("r_paid_ref") + ": " + (o.payRef || "-");
      var btn = document.createElement("button");
      btn.className = "btn primary";
      btn.textContent = T("r_accept");
      btn.addEventListener("click", function () {
        btn.disabled = true;
        B.acceptOrder(o.id, me).then(function (ok) {
          if (!ok) { toast(T("r_taken")); btn.disabled = false; }
        }).catch(function () { toast(T("net_error")); btn.disabled = false; });
      });
      card.appendChild(amt);
      card.appendChild(meta);
      card.appendChild(btn);
      box.appendChild(card);
    });
  }

  // ---------------------------------------------------------------- current delivery

  // All orders of this rider; the unfinished one is the current job
  function watchMyOrders() {
    B.watchOrdersOfRider(me.id, function (val) {
      var mine = val || {};
      var job = null;
      Object.keys(mine).forEach(function (id) {
        var o = mine[id];
        if (o && o.status !== "delivered") job = o;
      });
      var changed = (job && job.id) !== (state.job && state.job.id);
      if (!job && state.job) toast(T("r_done"));
      state.job = job;
      watchOpen();
      updateGps();
      renderJob();
      drawMap(changed);
    });
  }

  function renderJob() {
    var j = state.job;
    show("job", !!j);
    if (!j) return;
    $("j-status").textContent = T("st_" + j.status);
    $("j-amount").textContent = rupees(j.amount);
    $("j-id").textContent = j.id;
    $("j-name").textContent = j.name;
    $("j-phone").textContent = j.phone;
    $("j-address").textContent = j.address;
    $("j-ref").textContent = j.payRef || "-";
    $("j-dist").textContent = state.pos ? T("r_away", { km: km(state.pos, j.location).toFixed(1) }) : "";
    show("btn-start", j.status === "assigned");
    show("btn-arrived", j.status === "on_the_way");
    show("otp-box", j.status === "arrived");
  }

  function setJobStatus(status, extra) {
    var fields = extra || {};
    fields.status = status;
    B.updateOrder(state.job.id, fields).catch(function () { toast(T("net_error")); });
  }

  $("btn-jcall").addEventListener("click", function () { if (state.job) U.dial(state.job.phone); });
  $("btn-nav").addEventListener("click", function () {
    if (!state.job) return;
    U.openUrl("https://www.google.com/maps/dir/?api=1&travelmode=two-wheeler&destination=" +
      state.job.location[0] + "," + state.job.location[1]);
  });
  $("btn-start").addEventListener("click", function () { setJobStatus("on_the_way", { startedAt: Date.now() }); });
  $("btn-arrived").addEventListener("click", function () { setJobStatus("arrived", { arrivedAt: Date.now() }); });
  $("btn-verify").addEventListener("click", function () {
    var j = state.job;
    if (!j || otpHash($("j-otp").value.trim(), j.id) !== j.otpHash) { toast(T("r_wrong_otp")); return; }
    $("j-otp").value = "";
    setJobStatus("delivered", { deliveredAt: Date.now(), confirmedBy: "rider" });
  });

  // ---------------------------------------------------------------- login

  function startSession(account) {
    me = account;
    U.save(STORE_SESSION, { id: me.id });
    $("r-who").textContent = me.name + " · " + me.vehicle;
    show("login", false);
    show("home", true);
    ensureMap();
    B.updateRider(me.id, { name: me.name, phone: me.phone, vehicle: me.vehicle, rating: me.rating, online: false });
    if (native) native.requestLocation();
    else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(function (p) {
        window.onNativeLocation(p.coords.latitude, p.coords.longitude);
      });
    }
    renderStatus();
    watchMyOrders();
    watchOpen();
  }

  $("btn-login").addEventListener("click", function () {
    var phone = $("l-phone").value.trim().replace(/[\s-]/g, "");
    var pin = $("l-pin").value.trim();
    var acc = (window.RIDER_ACCOUNTS || []).filter(function (a) { return a.phone === phone && a.pin === pin; })[0];
    if (!acc) { toast(T("r_login_fail")); return; }
    startSession(acc);
  });

  $("btn-logout").addEventListener("click", function () {
    if (state.online) setOnline(false);
    U.save(STORE_SESSION, null);
    window.location.reload();
  });

  window.onBack = function () { return false; };

  // ---------------------------------------------------------------- start

  function applyTexts() {
    I18N.apply();
    if (me) { renderStatus(); renderOpen(); renderJob(); }
  }
  I18N.onChange(applyTexts);
  $("l-phone").placeholder = U.CFG.phonePlaceholder;
  applyTexts();

  if (!B) {
    show("no-backend", true);
    return;
  }
  var session = U.load(STORE_SESSION, null);
  var saved = session && (window.RIDER_ACCOUNTS || []).filter(function (a) { return a.id === session.id; })[0];
  if (saved) startSession(saved);
  else show("login", true);
})();
