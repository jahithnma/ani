// Helpers shared by the customer app (app.js) and the rider app (rider.js)
(function () {
  "use strict";

  var CFG = window.APP_CONFIG;

  function $(id) { return document.getElementById(id); }

  function money(n) { return CFG.currencySymbol + " " + Number(n || 0).toLocaleString(CFG.locale); }

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

  var TILE_URL = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
  var TILE_OPTS = {
    maxZoom: 19,
    subdomains: "abcd",
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
  };

  function makeMap(id, center) {
    var m = L.map(id, { zoomControl: false, attributionControl: true }).setView(center, 14);
    L.tileLayer(TILE_URL, TILE_OPTS).addTo(m);
    return m;
  }

  function icon(html, cls, size) {
    return L.divIcon({ html: html, className: cls, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });
  }

  function dial(phone) {
    if (window.AndroidBridge) window.AndroidBridge.callPhone(phone);
    else window.location.href = "tel:" + phone;
  }

  function openUrl(url) {
    if (window.AndroidBridge) window.AndroidBridge.openUrl(url);
    else window.open(url, "_blank");
  }

  window.U = {
    CFG: CFG,
    native: window.AndroidBridge || null, // present only inside the APK
    $: $,
    money: money,
    toast: toast,
    load: load,
    save: save,
    km: km,
    around: around,
    makeMap: makeMap,
    icon: icon,
    homeIcon: L.divIcon({ html: "📍", className: "pin", iconSize: [30, 30], iconAnchor: [15, 28] }),
    dial: dial,
    openUrl: openUrl,
    each: function (sel, fn) { Array.prototype.forEach.call(document.querySelectorAll(sel), fn); }
  };
})();
