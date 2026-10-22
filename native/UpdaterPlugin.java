package com.pryielle.msg;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.provider.Settings;
import android.util.Base64;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.RandomAccessFile;
import java.net.HttpURLConnection;
import java.net.URL;

/** In-app updater: gets the APK (chunks from Firestore or a direct link) into cache and opens the installer. */
@CapacitorPlugin(name = "Updater")
public class UpdaterPlugin extends Plugin {

    private File apk() {
        File dir = new File(getContext().getCacheDir(), "updates");
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, "update.apk");
    }

    private long codeOf(PackageInfo p) {
        return Build.VERSION.SDK_INT >= 28 ? p.getLongVersionCode() : p.versionCode;
    }

    /** the version that is really installed right now (not what the JS bundle thinks) */
    @PluginMethod
    public void info(PluginCall call) {
        try {
            Context ctx = getContext();
            PackageInfo p = ctx.getPackageManager().getPackageInfo(ctx.getPackageName(), 0);
            JSObject r = new JSObject();
            r.put("versionName", p.versionName == null ? "0" : p.versionName);
            r.put("versionCode", codeOf(p));
            r.put("lastUpdate", p.lastUpdateTime);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("info failed: " + e.getMessage());
        }
    }

    /** reads the version written inside the downloaded APK itself, before the installer opens */
    @PluginMethod
    public void inspect(PluginCall call) {
        try {
            Context ctx = getContext();
            File f = apk();
            if (!f.exists() || f.length() < 100 * 1024) {
                call.reject("APK file nahi mili, dobara download karo");
                return;
            }
            PackageInfo a = ctx.getPackageManager().getPackageArchiveInfo(f.getAbsolutePath(), 0);
            if (a == null) {
                call.reject("APK kharab hai ya adhoori download hui. Dobara try karo.");
                return;
            }
            if (!ctx.getPackageName().equals(a.packageName)) {
                call.reject("Ye APK kisi aur app ki hai (" + a.packageName + ")");
                return;
            }
            JSObject r = new JSObject();
            r.put("versionName", a.versionName == null ? "0" : a.versionName);
            r.put("versionCode", codeOf(a));
            call.resolve(r);
        } catch (Exception e) {
            call.reject("inspect failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void writeChunk(PluginCall call) {
        final int index = call.getInt("index", 0);
        final String data = call.getString("data", "");
        new Thread(() -> {
            try {
                byte[] bytes = Base64.decode(data, Base64.DEFAULT);
                File f = apk();
                if (index == 0 && f.exists()) f.delete();
                try (FileOutputStream out = new FileOutputStream(f, true)) {
                    out.write(bytes);
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("write failed: " + e.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void download(PluginCall call) {
        final String link = call.getString("url", "");
        new Thread(() -> {
            HttpURLConnection c = null;
            try {
                c = (HttpURLConnection) new URL(link).openConnection();
                c.setInstanceFollowRedirects(true);
                c.setConnectTimeout(15000);
                c.setReadTimeout(30000);
                c.connect();
                if (c.getResponseCode() / 100 != 2) throw new Exception("HTTP " + c.getResponseCode());
                final long total = c.getContentLength();
                File f = apk();
                if (f.exists()) f.delete();
                long done = 0;
                long lastEmit = 0;
                try (InputStream in = c.getInputStream(); FileOutputStream out = new FileOutputStream(f)) {
                    byte[] buf = new byte[64 * 1024];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        out.write(buf, 0, n);
                        done += n;
                        long now = System.currentTimeMillis();
                        if (now - lastEmit > 150) {
                            lastEmit = now;
                            JSObject p = new JSObject();
                            p.put("done", done);
                            p.put("total", total);
                            notifyListeners("progress", p);
                        }
                    }
                }
                if (done < 100 * 1024) {
                    f.delete();
                    throw new Exception("file bahut chhoti hai, link direct APK ka nahi lagta");
                }
                JSObject r = new JSObject();
                r.put("bytes", done);
                call.resolve(r);
            } catch (Exception e) {
                call.reject(e.getMessage() == null ? "download failed" : e.getMessage());
            } finally {
                if (c != null) c.disconnect();
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= 26 && !ctx.getPackageManager().canRequestPackageInstalls()) {
            Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + ctx.getPackageName()));
            s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(s);
            call.reject("permission");
            return;
        }
        File f = apk();
        if (!f.exists() || f.length() < 100 * 1024) {
            call.reject("APK file nahi mili, dobara download karo");
            return;
        }
        try {
            Uri uri = FileProvider.getUriForFile(ctx, ctx.getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject("install open nahi hua: " + e.getMessage());
        }
    }
}
