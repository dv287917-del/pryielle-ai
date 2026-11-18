package com.pryielle.msg;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

/** Normal push -> Capacitor handles. Data push type=alarm -> AlarmService rings, even with the app closed. */
public class AlarmMessagingService extends MessagingService {
    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> d = message.getData();
        if (d != null && "alarm".equals(d.get("type"))) {
            long sent = message.getSentTime();
            if (sent > 0 && System.currentTimeMillis() - sent > 10 * 60 * 1000L) return; // purana alarm, skip
            int sec = 30;
            try { sec = Integer.parseInt(d.get("seconds")); } catch (Exception ignored) { }
            String id = d.get("id");
            if (id == null) id = "";
            if (id.equals(AlarmService.lastId(this))) return;
            try { AlarmService.start(this, id, sec); } catch (Exception ignored) { }
            return;
        }
        super.onMessageReceived(message);
    }
}
