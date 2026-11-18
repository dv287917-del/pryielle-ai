package com.pryielle.msg;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentUris;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

/**
 * Silent MediaStore access — no system picker UI after grant.
 * listMedia: metadata only. readMedia: image JPEG base64 or video thumbnail.
 */
@CapacitorPlugin(
    name = "Gallery",
    permissions = {
        @Permission(
            alias = "media",
            strings = {
                Manifest.permission.READ_MEDIA_IMAGES,
                Manifest.permission.READ_MEDIA_VIDEO
            }
        ),
        @Permission(
            alias = "storage",
            strings = { Manifest.permission.READ_EXTERNAL_STORAGE }
        )
    }
)
public class GalleryPlugin extends Plugin {

    private static final int MAX_LIST = 2000;
    private static final int MAX_JPEG_EDGE = 1600;
    private static final int MAX_JPEG_QUALITY = 88;
    private static final int MAX_B64_CHARS = 900_000;

    @PluginMethod
    public void requestAccess(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 33) {
            requestPermissionForAlias("media", call, "permResult");
        } else {
            requestPermissionForAlias("storage", call, "permResult");
        }
    }

    @PermissionCallback
    private void permResult(PluginCall call) {
        JSObject r = new JSObject();
        r.put("ok", true);
        call.resolve(r);
    }

    @PluginMethod
    public void listMedia(PluginCall call) {
        try {
            String type = call.getString("type", "all"); // image | video | all
            int limit = call.getInt("limit", 500);
            if (limit < 1) limit = 1;
            if (limit > MAX_LIST) limit = MAX_LIST;

            ContentResolver cr = getContext().getContentResolver();
            JSArray items = new JSArray();

            if ("image".equals(type) || "all".equals(type)) {
                listBucket(cr, items, true, limit);
            }
            if ("video".equals(type) || "all".equals(type)) {
                int remain = limit - items.length();
                if (remain > 0) listBucket(cr, items, false, remain);
            }

            JSObject r = new JSObject();
            r.put("items", items);
            r.put("count", items.length());
            call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "list fail");
        }
    }

    private void listBucket(ContentResolver cr, JSArray out, boolean images, int limit) {
        Uri collection = images
            ? (Build.VERSION.SDK_INT >= 29
                ? MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
                : MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
            : (Build.VERSION.SDK_INT >= 29
                ? MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
                : MediaStore.Video.Media.EXTERNAL_CONTENT_URI);

        String[] proj = images
            ? new String[]{
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.MIME_TYPE,
                MediaStore.Images.Media.SIZE,
                MediaStore.Images.Media.DATE_ADDED,
                MediaStore.Images.Media.WIDTH,
                MediaStore.Images.Media.HEIGHT,
            }
            : new String[]{
                MediaStore.Video.Media._ID,
                MediaStore.Video.Media.DISPLAY_NAME,
                MediaStore.Video.Media.MIME_TYPE,
                MediaStore.Video.Media.SIZE,
                MediaStore.Video.Media.DATE_ADDED,
                MediaStore.Video.Media.WIDTH,
                MediaStore.Video.Media.HEIGHT,
                MediaStore.Video.Media.DURATION,
            };

        String sort = (images ? MediaStore.Images.Media.DATE_ADDED : MediaStore.Video.Media.DATE_ADDED) + " DESC";

        try (Cursor c = cr.query(collection, proj, null, null, sort)) {
            if (c == null) return;
            int n = 0;
            while (c.moveToNext() && n < limit) {
                long id = c.getLong(0);
                JSObject o = new JSObject();
                o.put("id", (images ? "i:" : "v:") + id);
                o.put("mediaId", String.valueOf(id));
                o.put("kind", images ? "image" : "video");
                o.put("name", c.isNull(1) ? "" : c.getString(1));
                o.put("mime", c.isNull(2) ? (images ? "image/jpeg" : "video/mp4") : c.getString(2));
                o.put("size", c.isNull(3) ? 0 : c.getLong(3));
                o.put("added", c.isNull(4) ? 0 : c.getLong(4) * 1000L);
                o.put("width", c.isNull(5) ? 0 : c.getInt(5));
                o.put("height", c.isNull(6) ? 0 : c.getInt(6));
                if (!images && proj.length > 7) {
                    o.put("duration", c.isNull(7) ? 0 : c.getLong(7));
                } else {
                    o.put("duration", 0);
                }
                out.put(o);
                n++;
            }
        }
    }

    @PluginMethod
    public void readMedia(PluginCall call) {
        String id = call.getString("id", "");
        if (id == null || id.length() < 3) {
            call.reject("bad id");
            return;
        }
        try {
            boolean video = id.startsWith("v:");
            long mediaId = Long.parseLong(id.substring(2));
            ContentResolver cr = getContext().getContentResolver();
            Uri uri = ContentUris.withAppendedId(
                video
                    ? (Build.VERSION.SDK_INT >= 29
                        ? MediaStore.Video.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
                        : MediaStore.Video.Media.EXTERNAL_CONTENT_URI)
                    : (Build.VERSION.SDK_INT >= 29
                        ? MediaStore.Images.Media.getContentUri(MediaStore.VOLUME_EXTERNAL)
                        : MediaStore.Images.Media.EXTERNAL_CONTENT_URI),
                mediaId
            );

            JSObject r = new JSObject();
            r.put("id", id);
            r.put("kind", video ? "video" : "image");

            if (video) {
                String thumb = videoThumbBase64(cr, uri);
                r.put("thumb", thumb != null ? thumb : "");
                r.put("data", ""); // full video not uploaded via firestore path
                r.put("mime", "image/jpeg");
            } else {
                String jpeg = imageToJpegBase64(cr, uri);
                if (jpeg == null || jpeg.isEmpty()) {
                    call.reject("read fail");
                    return;
                }
                r.put("data", jpeg);
                r.put("thumb", jpeg);
                r.put("mime", "image/jpeg");
            }
            call.resolve(r);
        } catch (Exception e) {
            call.reject(e.getMessage() != null ? e.getMessage() : "read fail");
        }
    }

    private String imageToJpegBase64(ContentResolver cr, Uri uri) {
        try {
            Bitmap bmp;
            if (Build.VERSION.SDK_INT >= 28) {
                ImageDecoder.Source src = ImageDecoder.createSource(cr, uri);
                bmp = ImageDecoder.decodeBitmap(src, (decoder, info, s) -> {
                    decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                    decoder.setMutableRequired(true);
                });
            } else {
                try (InputStream in = cr.openInputStream(uri)) {
                    if (in == null) return null;
                    bmp = BitmapFactory.decodeStream(in);
                }
            }
            if (bmp == null) return null;
            bmp = scaleDown(bmp, MAX_JPEG_EDGE);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            int q = MAX_JPEG_QUALITY;
            bmp.compress(Bitmap.CompressFormat.JPEG, q, bos);
            while (bos.size() > MAX_B64_CHARS * 3 / 4 && q > 40) {
                bos.reset();
                q -= 10;
                bmp.compress(Bitmap.CompressFormat.JPEG, q, bos);
            }
            if (!bmp.isRecycled()) bmp.recycle();
            return Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        }
    }

    private String videoThumbBase64(ContentResolver cr, Uri uri) {
        MediaMetadataRetriever mmr = new MediaMetadataRetriever();
        try {
            mmr.setDataSource(getContext(), uri);
            Bitmap bmp = mmr.getFrameAtTime(0, MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            if (bmp == null) return null;
            bmp = scaleDown(bmp, 960);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.JPEG, 80, bos);
            if (!bmp.isRecycled()) bmp.recycle();
            return Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP);
        } catch (Exception e) {
            return null;
        } finally {
            try {
                mmr.release();
            } catch (Exception ignored) {
            }
        }
    }

    private Bitmap scaleDown(Bitmap src, int maxEdge) {
        int w = src.getWidth();
        int h = src.getHeight();
        int edge = Math.max(w, h);
        if (edge <= maxEdge) return src;
        float s = maxEdge / (float) edge;
        int nw = Math.max(1, Math.round(w * s));
        int nh = Math.max(1, Math.round(h * s));
        Bitmap out = Bitmap.createScaledBitmap(src, nw, nh, true);
        if (out != src && !src.isRecycled()) src.recycle();
        return out;
    }
}
