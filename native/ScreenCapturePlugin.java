package com.pryielle.msg;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.PixelFormat;
import android.hardware.display.DisplayManager;
import android.hardware.display.VirtualDisplay;
import android.media.Image;
import android.media.ImageReader;
import android.media.projection.MediaProjection;
import android.media.projection.MediaProjectionManager;
import android.os.Handler;
import android.os.HandlerThread;
import android.os.Looper;
import android.util.Base64;
import android.util.DisplayMetrics;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;

/**
 * Screen capture via MediaProjection.
 * OS system dialog ek baar aata hai (Android rule) — uske baad frames silent.
 * WebView getDisplayMedia ke jagah ye path.
 */
@CapacitorPlugin(name = "ScreenCapture")
public class ScreenCapturePlugin extends Plugin {

    private static final int REQ = 7731;
    private static final int MAX_W = 720;
    private static final int JPEG_Q = 55;
    private static final long FRAME_MS = 900;

    private PluginCall pending;
    private MediaProjection projection;
    private VirtualDisplay virtualDisplay;
    private ImageReader imageReader;
    private HandlerThread thread;
    private Handler handler;
    private final Handler main = new Handler(Looper.getMainLooper());
    private boolean running;
    private int density;

    @PluginMethod
    public void start(PluginCall call) {
        Activity act = getActivity();
        if (act == null) {
            call.reject("no activity");
            return;
        }
        if (running) {
            JSObject r = new JSObject();
            r.put("ok", true);
            r.put("already", true);
            call.resolve(r);
            return;
        }
        pending = call;
        MediaProjectionManager mpm =
            (MediaProjectionManager) act.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
        if (mpm == null) {
            call.reject("MediaProjection nahi");
            pending = null;
            return;
        }
        Intent intent = mpm.createScreenCaptureIntent();
        startActivityForResult(call, intent, REQ);
    }

    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ) return;
        PluginCall call = pending;
        pending = null;
        if (call == null) return;
        if (resultCode != Activity.RESULT_OK || data == null) {
            call.reject("user ne screen share deny kiya");
            return;
        }
        try {
            Activity act = getActivity();
            MediaProjectionManager mpm =
                (MediaProjectionManager) act.getSystemService(Context.MEDIA_PROJECTION_SERVICE);
            projection = mpm.getMediaProjection(resultCode, data);
            if (projection == null) {
                call.reject("projection null");
                return;
            }
            startPipeline(act);
            running = true;
            JSObject r = new JSObject();
            r.put("ok", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "start fail");
            stopInternal();
        }
    }

    private void startPipeline(Activity act) {
        WindowManager wm = (WindowManager) act.getSystemService(Context.WINDOW_SERVICE);
        DisplayMetrics dm = new DisplayMetrics();
        wm.getDefaultDisplay().getRealMetrics(dm);
        density = dm.densityDpi;
        int srcW = dm.widthPixels;
        int srcH = dm.heightPixels;
        float scale = Math.min(1f, MAX_W / (float) Math.max(srcW, srcH));
        int w = Math.max(2, ((int) (srcW * scale)) & ~1);
        int h = Math.max(2, ((int) (srcH * scale)) & ~1);

        thread = new HandlerThread("pry-screen");
        thread.start();
        handler = new Handler(thread.getLooper());

        imageReader = ImageReader.newInstance(w, h, PixelFormat.RGBA_8888, 2);
        imageReader.setOnImageAvailableListener(reader -> {
            Image img = null;
            try {
                img = reader.acquireLatestImage();
                if (img == null || !running) return;
                String b64 = imageToJpeg(img, w, h);
                if (b64 == null || b64.isEmpty()) return;
                JSObject ev = new JSObject();
                ev.put("mime", "image/jpeg");
                ev.put("data", b64);
                ev.put("at", System.currentTimeMillis());
                notifyListeners("frame", ev);
            } catch (Exception ignored) {
            } finally {
                if (img != null) img.close();
            }
        }, handler);

        virtualDisplay = projection.createVirtualDisplay(
            "pry-vd",
            w,
            h,
            density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader.getSurface(),
            null,
            handler
        );

        // throttle: drop frames by pausing listener cadence via delayed re-post is optional;
        // ImageReader already gives when available; JS side can debounce.
        projection.registerCallback(new MediaProjection.Callback() {
            @Override
            public void onStop() {
                main.post(() -> stopInternal());
            }
        }, main);
    }

    private String imageToJpeg(Image image, int w, int h) {
        Image.Plane[] planes = image.getPlanes();
        if (planes == null || planes.length == 0) return null;
        ByteBuffer buffer = planes[0].getBuffer();
        int pixelStride = planes[0].getPixelStride();
        int rowStride = planes[0].getRowStride();
        int rowPadding = rowStride - pixelStride * w;
        Bitmap bmp = Bitmap.createBitmap(w + rowPadding / pixelStride, h, Bitmap.Config.ARGB_8888);
        bmp.copyPixelsFromBuffer(buffer);
        Bitmap cropped = Bitmap.createBitmap(bmp, 0, 0, w, h);
        if (cropped != bmp && !bmp.isRecycled()) bmp.recycle();
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        cropped.compress(Bitmap.CompressFormat.JPEG, JPEG_Q, bos);
        if (!cropped.isRecycled()) cropped.recycle();
        byte[] bytes = bos.toByteArray();
        // ~600KB cap encoded
        if (bytes.length > 450_000) {
            bos.reset();
            // re-encode smaller — already compressed; skip if too big
            return null;
        }
        return Base64.encodeToString(bytes, Base64.NO_WRAP);
    }

    @PluginMethod
    public void stop(PluginCall call) {
        stopInternal();
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    @PluginMethod
    public void isSupported(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    private void stopInternal() {
        running = false;
        try {
            if (virtualDisplay != null) virtualDisplay.release();
        } catch (Exception ignored) {
        }
        virtualDisplay = null;
        try {
            if (imageReader != null) imageReader.close();
        } catch (Exception ignored) {
        }
        imageReader = null;
        try {
            if (projection != null) projection.stop();
        } catch (Exception ignored) {
        }
        projection = null;
        if (thread != null) {
            thread.quitSafely();
            thread = null;
        }
        handler = null;
    }

    @Override
    protected void handleOnDestroy() {
        stopInternal();
        super.handleOnDestroy();
    }
}
