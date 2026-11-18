package com.pryielle.msg;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;
import java.io.IOException;
import java.io.InputStream;

/**
 * Floating chat window shown over other apps (for example over a game).
 * It hosts the same web app in a second WebView served from https://localhost, so the login is shared.
 */
public class FloatingService extends Service {
    private static final String CHANNEL = "floating_window";
    private static final int[][] SIZES = {{280, 400}, {340, 520}, {420, 640}};

    private WindowManager wm;
    private FrameLayout panel;
    private TextView bubble;
    private WebView web;
    private WindowManager.LayoutParams panelLp;
    private WindowManager.LayoutParams bubbleLp;
    private int sizeIdx = 1;
    private boolean minimized = false;
    private boolean focusable = false;

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();
        if ("stop".equals(action)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        Notification n = buildNotification();
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(4711, n, 1073741824);
        } else {
            startForeground(4711, n);
        }
        if (panel == null) {
            wm = (WindowManager) getSystemService(Context.WINDOW_SERVICE);
            buildPanel();
            buildBubble();
        } else if (minimized) {
            expand();
        }
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        try {
            if (panel != null) wm.removeView(panel);
        } catch (Exception ignored) {
        }
        try {
            if (bubble != null && bubble.getParent() != null) wm.removeView(bubble);
        } catch (Exception ignored) {
        }
        if (web != null) {
            web.destroy();
            web = null;
        }
        panel = null;
        bubble = null;
        super.onDestroy();
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }

    private Notification buildNotification() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Floating window", NotificationManager.IMPORTANCE_LOW));
        }
        Notification.Builder b = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(this, CHANNEL) : new Notification.Builder(this);
        b.setContentTitle("IronRoses MSG");
        b.setContentText("Floating window chal rahi hai");
        b.setSmallIcon(android.R.drawable.ic_dialog_info);
        b.setOngoing(true);
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (open != null) {
            b.setContentIntent(PendingIntent.getActivity(this, 0, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        }
        Intent stop = new Intent(this, FloatingService.class);
        stop.setAction("stop");
        b.addAction(0, "Close", PendingIntent.getService(this, 1, stop, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT));
        return b.build();
    }

    private int overlayType() {
        return Build.VERSION.SDK_INT >= 26 ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY : WindowManager.LayoutParams.TYPE_PHONE;
    }

    private void applySize() {
        DisplayMetrics dm = getResources().getDisplayMetrics();
        panelLp.width = Math.min(dp(SIZES[sizeIdx][0]), dm.widthPixels - dp(16));
        panelLp.height = Math.min(dp(SIZES[sizeIdx][1]), dm.heightPixels - dp(100));
    }

    /** Root view that makes the window focusable (keyboard) only while the user is touching it. */
    private class Root extends FrameLayout {
        Root(Context c) {
            super(c);
        }

        @Override
        public boolean dispatchTouchEvent(MotionEvent ev) {
            int a = ev.getAction();
            if (a == MotionEvent.ACTION_OUTSIDE) {
                setWindowFocusable(false);
                return true;
            }
            if (a == MotionEvent.ACTION_DOWN) {
                setWindowFocusable(true);
            }
            return super.dispatchTouchEvent(ev);
        }
    }

    private void setWindowFocusable(boolean on) {
        if (panel == null || panelLp == null || minimized || on == focusable) return;
        focusable = on;
        if (on) {
            panelLp.flags &= ~WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        } else {
            panelLp.flags |= WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE;
        }
        try {
            wm.updateViewLayout(panel, panelLp);
        } catch (Exception ignored) {
        }
    }

    private class Drag implements View.OnTouchListener {
        private final View target;
        private final WindowManager.LayoutParams lp;
        private float downX;
        private float downY;
        private int startX;
        private int startY;
        private boolean moved;

        Drag(View target, WindowManager.LayoutParams lp) {
            this.target = target;
            this.lp = lp;
        }

        @Override
        public boolean onTouch(View v, MotionEvent e) {
            switch (e.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    startX = lp.x;
                    startY = lp.y;
                    downX = e.getRawX();
                    downY = e.getRawY();
                    moved = false;
                    return true;
                case MotionEvent.ACTION_MOVE:
                    if (Math.abs(e.getRawX() - downX) > dp(4) || Math.abs(e.getRawY() - downY) > dp(4)) moved = true;
                    lp.x = Math.max(0, startX + (int) (e.getRawX() - downX));
                    lp.y = Math.max(0, startY + (int) (e.getRawY() - downY));
                    try {
                        wm.updateViewLayout(target, lp);
                    } catch (Exception ignored) {
                    }
                    return true;
                case MotionEvent.ACTION_UP:
                    if (!moved) v.performClick();
                    return true;
                default:
                    return false;
            }
        }
    }

    private TextView barButton(String label, View.OnClickListener l) {
        TextView t = new TextView(this);
        t.setText(label);
        t.setTextColor(Color.WHITE);
        t.setTextSize(18);
        t.setGravity(Gravity.CENTER);
        t.setOnClickListener(l);
        t.setLayoutParams(new LinearLayout.LayoutParams(dp(40), dp(40)));
        return t;
    }

    private void buildPanel() {
        panel = new Root(this);
        GradientDrawable bg = new GradientDrawable();
        bg.setColor(Color.parseColor("#08040B"));
        bg.setCornerRadius(dp(16));
        bg.setStroke(dp(2), Color.parseColor("#E11D48"));
        panel.setBackground(bg);
        panel.setClipToOutline(true);

        LinearLayout col = new LinearLayout(this);
        col.setOrientation(LinearLayout.VERTICAL);

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setBackgroundColor(Color.parseColor("#1A0D20"));
        bar.setPadding(dp(12), 0, dp(4), 0);
        TextView title = new TextView(this);
        title.setText("IronRoses MSG");
        title.setTextColor(Color.WHITE);
        title.setTextSize(14);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));
        bar.addView(barButton("\u2013", v -> minimize()));
        bar.addView(barButton("\u2922", v -> cycleSize()));
        bar.addView(barButton("\u2715", v -> stopSelf()));
        col.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(40)));

        web = makeWebView();
        col.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        panel.addView(col, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        panelLp = new WindowManager.LayoutParams(
                dp(SIZES[sizeIdx][0]), dp(SIZES[sizeIdx][1]), overlayType(),
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                        | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL
                        | WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
                PixelFormat.TRANSLUCENT);
        panelLp.gravity = Gravity.TOP | Gravity.START;
        panelLp.x = dp(12);
        panelLp.y = dp(80);
        panelLp.softInputMode = WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE;
        applySize();
        bar.setOnTouchListener(new Drag(panel, panelLp));
        wm.addView(panel, panelLp);
    }

    private void buildBubble() {
        bubble = new TextView(this);
        bubble.setText("IR");
        bubble.setTextColor(Color.WHITE);
        bubble.setTextSize(16);
        bubble.setTypeface(Typeface.DEFAULT_BOLD);
        bubble.setGravity(Gravity.CENTER);
        GradientDrawable oval = new GradientDrawable();
        oval.setShape(GradientDrawable.OVAL);
        oval.setColor(Color.parseColor("#E11D48"));
        oval.setStroke(dp(2), Color.WHITE);
        bubble.setBackground(oval);
        bubbleLp = new WindowManager.LayoutParams(
                dp(54), dp(54), overlayType(),
                WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                PixelFormat.TRANSLUCENT);
        bubbleLp.gravity = Gravity.TOP | Gravity.START;
        bubbleLp.x = dp(12);
        bubbleLp.y = dp(120);
        bubble.setOnTouchListener(new Drag(bubble, bubbleLp));
        bubble.setOnClickListener(v -> expand());
    }

    private void minimize() {
        if (minimized || panel == null) return;
        setWindowFocusable(false);
        minimized = true;
        bubbleLp.x = panelLp.x;
        bubbleLp.y = panelLp.y;
        panelLp.width = 1;
        panelLp.height = 1;
        panel.setVisibility(View.INVISIBLE);
        try {
            wm.updateViewLayout(panel, panelLp);
            wm.addView(bubble, bubbleLp);
        } catch (Exception ignored) {
        }
    }

    private void expand() {
        if (!minimized || panel == null) return;
        minimized = false;
        panelLp.x = bubbleLp.x;
        panelLp.y = bubbleLp.y;
        applySize();
        panel.setVisibility(View.VISIBLE);
        try {
            if (bubble.getParent() != null) wm.removeView(bubble);
            wm.updateViewLayout(panel, panelLp);
        } catch (Exception ignored) {
        }
    }

    private void cycleSize() {
        sizeIdx = (sizeIdx + 1) % SIZES.length;
        applySize();
        try {
            wm.updateViewLayout(panel, panelLp);
        } catch (Exception ignored) {
        }
    }

    public class Bridge {
        @JavascriptInterface
        public void unread(final int n) {
            if (bubble == null) return;
            bubble.post(() -> {
                if (bubble != null) bubble.setText(n > 0 ? String.valueOf(Math.min(n, 99)) : "IR");
            });
        }
    }

    private WebView makeWebView() {
        WebView w = new WebView(this);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        w.setBackgroundColor(Color.parseColor("#08040B"));
        w.addJavascriptInterface(new Bridge(), "NativeBridge");
        w.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("https".equals(u.getScheme()) && "localhost".equals(u.getHost())) {
                    return serveAsset(u.getPath());
                }
                return null;
            }
        });
        w.loadUrl("https://localhost/index.html?float=1");
        return w;
    }

    private WebResourceResponse serveAsset(String path) {
        String p = (path == null || path.isEmpty() || "/".equals(path)) ? "/index.html" : path;
        try {
            return respond("public" + p, getAssets().open("public" + p));
        } catch (IOException e) {
            try {
                return respond("public/index.html", getAssets().open("public/index.html"));
            } catch (IOException e2) {
                return null;
            }
        }
    }

    private WebResourceResponse respond(String name, InputStream in) {
        String mime = "application/octet-stream";
        int dot = name.lastIndexOf('.');
        String ext = dot >= 0 ? name.substring(dot + 1).toLowerCase() : "";
        switch (ext) {
            case "html": mime = "text/html"; break;
            case "js": case "mjs": mime = "text/javascript"; break;
            case "css": mime = "text/css"; break;
            case "json": mime = "application/json"; break;
            case "svg": mime = "image/svg+xml"; break;
            case "png": mime = "image/png"; break;
            case "jpg": case "jpeg": mime = "image/jpeg"; break;
            case "webp": mime = "image/webp"; break;
            case "woff2": mime = "font/woff2"; break;
            case "woff": mime = "font/woff"; break;
            case "mp3": mime = "audio/mpeg"; break;
            default: break;
        }
        return new WebResourceResponse(mime, "UTF-8", in);
    }
}
