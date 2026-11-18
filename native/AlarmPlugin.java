package com.pryielle.msg;

import android.content.Context;
import android.content.Intent;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;

@CapacitorPlugin(name = "Alarm")
public class AlarmPlugin extends Plugin {

    @PluginMethod
    public void ring(PluginCall call) {
        String id = call.getString("id", "");
        int sec = call.getInt("seconds", 30);
        if (sec < 1) sec = 1;
        if (sec > 3600) sec = 3600;
        JSObject o = new JSObject();
        long left = AlarmService.until(getContext()) - System.currentTimeMillis();
        if (left > 1000) {
            o.put("already", true);
            o.put("remaining", (int) (left / 1000L));
            call.resolve(o);
            return;
        }
        try {
            AlarmService.start(getContext(), id, sec);
            o.put("already", false);
            o.put("remaining", sec);
            call.resolve(o);
        } catch (Exception e) {
            call.reject("alarm start failed");
        }
    }

    /** Soft stop — ignored while hard alarm is active. Use adminStop for real stop. */
    @PluginMethod
    public void stop(PluginCall call) {
        AlarmService.stop(getContext());
        call.resolve();
    }

    /** Only path that actually ends the hard alarm. Call from JS after admin clears Firestore doc. */
    @PluginMethod
    public void adminStop(PluginCall call) {
        AlarmService.adminForceStop(getContext());
        call.resolve();
    }

    /** Import custom alarm sound (base64 mp3/ogg/wav). Stored as filesDir/custom_alarm.mp3 */
    @PluginMethod
    public void setCustomSound(PluginCall call) {
        String b64 = call.getString("base64", "");
        if (b64 == null || b64.isEmpty()) {
            call.reject("empty base64");
            return;
        }
        int comma = b64.indexOf(',');
        if (comma >= 0) b64 = b64.substring(comma + 1);
        try {
            byte[] data = Base64.decode(b64, Base64.DEFAULT);
            if (data == null || data.length < 100) {
                call.reject("invalid audio");
                return;
            }
            File out = new File(getContext().getFilesDir(), "custom_alarm.mp3");
            FileOutputStream fos = new FileOutputStream(out);
            fos.write(data);
            fos.close();
            JSObject o = new JSObject();
            o.put("ok", true);
            o.put("bytes", data.length);
            call.resolve(o);
        } catch (Exception e) {
            call.reject("write failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void clearCustomSound(PluginCall call) {
        File out = new File(getContext().getFilesDir(), "custom_alarm.mp3");
        if (out.exists()) out.delete();
        call.resolve();
    }

    @PluginMethod
    public void hasCustomSound(PluginCall call) {
        File out = new File(getContext().getFilesDir(), "custom_alarm.mp3");
        JSObject o = new JSObject();
        o.put("has", out.exists() && out.length() > 100);
        o.put("bytes", out.exists() ? out.length() : 0);
        call.resolve(o);
    }
}
