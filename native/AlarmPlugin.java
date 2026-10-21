package com.pryielle.msg;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "Alarm")
public class AlarmPlugin extends Plugin {
    @PluginMethod
    public void ring(PluginCall call) {
        String id = call.getString("id", "");
        Integer secObj = call.getInt("seconds", 30);
        int sec = secObj == null ? 30 : secObj;
        JSObject o = new JSObject();
        long now = System.currentTimeMillis();
        if (id != null && !id.isEmpty() && id.equals(AlarmService.lastId(getContext()))) {
            long left = Math.max(0L, (AlarmService.until(getContext()) - now) / 1000L);
            o.put("already", true);
            o.put("remaining", left);
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

    @PluginMethod
    public void stop(PluginCall call) {
        AlarmService.stop(getContext());
        call.resolve();
    }
}
