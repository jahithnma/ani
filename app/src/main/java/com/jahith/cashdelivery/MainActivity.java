package com.jahith.cashdelivery;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.location.Location;
import android.location.LocationListener;
import android.location.LocationManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Looper;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONObject;

/**
 * Hosts the web UI (assets/www) in a WebView and exposes a small native bridge
 * ("AndroidBridge") for things the web page cannot do on its own:
 * UPI payment, device location and phone dialing.
 */
public class MainActivity extends Activity {

    private static final int REQ_UPI = 1001;
    private static final int REQ_LOCATION = 1002;

    private WebView web;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        web = new WebView(this);
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);

        web.setWebChromeClient(new WebChromeClient());
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("file".equals(uri.getScheme())) {
                    return false;
                }
                // tel:, upi:, http(s) links etc. open in the matching external app
                openExternal(uri);
                return true;
            }
        });

        web.addJavascriptInterface(new Bridge(), "AndroidBridge");
        web.loadUrl("file:///android_asset/www/index.html");
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "No app found to open this link", Toast.LENGTH_SHORT).show();
        }
    }

    /** Calls a global JS function with already-encoded JSON/JS literal arguments. */
    private void js(final String code) {
        runOnUiThread(() -> web.evaluateJavascript(code, null));
    }

    private static String quote(String value) {
        return JSONObject.quote(value == null ? "" : value);
    }

    // ---------------------------------------------------------------- location

    private void startLocation() {
        if (Build.VERSION.SDK_INT >= 23
                && checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION}, REQ_LOCATION);
            return;
        }
        fetchLocation();
    }

    @SuppressLint("MissingPermission")
    @SuppressWarnings("deprecation")
    private void fetchLocation() {
        LocationManager lm = (LocationManager) getSystemService(LOCATION_SERVICE);
        if (lm == null) {
            js("window.onNativeLocationError('Location service unavailable')");
            return;
        }

        Location best = null;
        for (String provider : lm.getProviders(true)) {
            Location l = lm.getLastKnownLocation(provider);
            if (l != null && (best == null || l.getTime() > best.getTime())) {
                best = l;
            }
        }
        if (best != null) {
            sendLocation(best);
        }

        String provider = lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
                ? LocationManager.GPS_PROVIDER
                : lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ? LocationManager.NETWORK_PROVIDER : null;
        if (provider == null) {
            if (best == null) {
                js("window.onNativeLocationError('Please turn on Location / GPS')");
            }
            return;
        }
        lm.requestSingleUpdate(provider, new LocationListener() {
            @Override
            public void onLocationChanged(Location location) {
                sendLocation(location);
            }

            @Override
            public void onStatusChanged(String p, int status, Bundle extras) {
            }

            @Override
            public void onProviderEnabled(String p) {
            }

            @Override
            public void onProviderDisabled(String p) {
            }
        }, Looper.getMainLooper());
    }

    private void sendLocation(Location l) {
        js("window.onNativeLocation(" + l.getLatitude() + "," + l.getLongitude() + ")");
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_LOCATION) return;
        boolean granted = false;
        for (int r : grantResults) {
            if (r == PackageManager.PERMISSION_GRANTED) granted = true;
        }
        if (granted) {
            fetchLocation();
        } else {
            js("window.onNativeLocationError('Location permission denied')");
        }
    }

    // ---------------------------------------------------------------- UPI payment

    private void startUpi(String upiUri) {
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(upiUri));
        Intent chooser = Intent.createChooser(intent, getString(R.string.pay_with));
        try {
            startActivityForResult(chooser, REQ_UPI);
        } catch (ActivityNotFoundException e) {
            js("window.onUpiResult('NO_APP','')");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_UPI) return;

        // UPI apps return e.g. "txnId=..&responseCode=00&Status=SUCCESS&txnRef=.."
        String response = data == null ? null : data.getStringExtra("response");
        String status = "CANCELLED";
        if (response != null) {
            String lower = response.toLowerCase();
            if (lower.contains("status=success")) {
                status = "SUCCESS";
            } else if (lower.contains("status=submitted")) {
                status = "SUBMITTED";
            } else if (lower.contains("status=failure") || lower.contains("status=failed")) {
                status = "FAILURE";
            }
        }
        js("window.onUpiResult(" + quote(status) + "," + quote(response) + ")");
    }

    // ---------------------------------------------------------------- back button

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // Let the web UI go back a screen; it returns false when already on home.
        web.evaluateJavascript("window.onBack ? window.onBack() : false", value -> {
            if (!"true".equals(value)) {
                MainActivity.super.onBackPressed();
            }
        });
    }

    // ---------------------------------------------------------------- JS bridge

    private class Bridge {
        @JavascriptInterface
        public void payUpi(final String upiUri) {
            runOnUiThread(() -> startUpi(upiUri));
        }

        @JavascriptInterface
        public void requestLocation() {
            runOnUiThread(MainActivity.this::startLocation);
        }

        @JavascriptInterface
        public void callPhone(final String number) {
            runOnUiThread(() -> {
                try {
                    startActivity(new Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + number)));
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, number, Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void toast(final String msg) {
            runOnUiThread(() -> Toast.makeText(MainActivity.this, msg, Toast.LENGTH_SHORT).show());
        }
    }
}
