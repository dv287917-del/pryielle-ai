package com.pryielle.msg;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.content.res.AssetFileDescriptor;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.core.app.NotificationCompat;
import java.io.File;

/**
 * Hard emergency alarm.
 * - Foreground + sticky
 * - Max volume forced on STREAM_ALARM continuously
 * - Volume-change receiver snaps volume back to max
 * - Self-restarts if killed while until > now (unless adminForceStop flag)
 * - Custom sound from filesDir/custom_alarm.mp3 if present
 * - Only admin-forced stop (via prefs flag) or natural timeout ends it
 */
public class AlarmService extends Service {
    static final String CH = "pry_alarm";
    static final String PREFS = "pry_alarm";
    private MediaPlayer mp;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wl;
    private int oldVol = -1;
    private BroadcastReceiver volRx;
    private Runnable volLock;
    private boolean adminStop = false;

    public static void start(Context c, String id, int seconds) {
        Intent i = new Intent(c, AlarmService.class);
        i.putExtra("id", id == null ? "" : id);
        i.putExtra("sec", seconds);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }

    /** Normal stop is ignored while alarm is active. Only adminForceStop clears it. */
    public static void stop(Context c) {
        SharedPreferences p = prefs(c);
        if (p.getLong("until", 0L) > System.currentTimeMillis() && !p.getBoolean("adminForceStop", false)) {
            // hard mode: ignore casual stop, re-ensure service
            start(c, p.getString("last", ""), (int) Math.max(1, (p.getLong("until", 0L) - System.currentTimeMillis()) / 1000L));
            return;
        }
        c.stopService(new Intent(c, AlarmService.class));
    }

    /** Called from JS only after admin clears the alarm doc. */
    public static void adminForceStop(Context c) {
        prefs(c).edit().putBoolean("adminForceStop", true).putLong("until", 0L).apply();
        c.stopService(new Intent(c, AlarmService.class));
    }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }
    static String lastId(Context c) { return prefs(c).getString("last", ""); }
    static long until(Context c) { return prefs(c).getLong("until", 0L); }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent in, int flags, int startId) {
        if (in != null && "ADMIN_STOP".equals(in.getAction())) {
            adminStop = true;
            prefs(this).edit().putBoolean("adminForceStop", true).putLong("until", 0L).apply();
            stopSelf();
            return START_NOT_STICKY;
        }

        adminStop = prefs(this).getBoolean("adminForceStop", false);
        if (adminStop) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String id = in == null ? lastId(this) : in.getStringExtra("id");
        int sec = in == null ? 30 : in.getIntExtra("sec", 30);
        if (sec < 1) sec = 1;
        if (sec > 3600) sec = 3600;

        long now = System.currentTimeMillis();
        long existingUntil = until(this);
        if (existingUntil > now + 1000) {
            // already running, keep remaining
            sec = (int) Math.max(1, (existingUntil - now) / 1000L);
        } else {
            prefs(this).edit()
                .putString("last", id == null ? "" : id)
                .putLong("until", now + sec * 1000L)
                .putBoolean("adminForceStop", false)
                .apply();
        }

        ensureChannel();
        startFg();
        ring(sec);
        return START_STICKY; // hard: system restarts us if killed
    }

    private void ensureChannel() {
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CH, "Emergency alarm", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(null, null);
            ch.setBypassDnd(true);
            ch.enableVibration(true);
            ch.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(ch);
        }
    }

    private void startFg() {
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent openP = PendingIntent.getActivity(this, 2, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(this, CH)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("ALARM")
                .setContentText("Admin ne alarm bheja hai — band nahi hoga")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setOngoing(true)
                .setAutoCancel(false)
                .setContentIntent(openP)
                .build();
        if (Build.VERSION.SDK_INT >= 29) {
            startForeground(77, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(77, n);
        }
    }

    private void ring(int sec) {
        releaseMediaOnly();
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pry:alarm");
                wl.acquire(sec * 1000L + 5000L);
            }
        } catch (Exception ignored) { }

        forceMaxVolume();
        startVolumeLock();

        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ALARM)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .build());
            boolean set = false;
            // 1) custom imported sound
            File custom = new File(getFilesDir(), "custom_alarm.mp3");
            if (custom.exists() && custom.length() > 100) {
                try {
                    mp.setDataSource(custom.getAbsolutePath());
                    set = true;
                } catch (Exception ignored) { }
            }
            // 2) bundled raw
            if (!set) {
                int rid = getResources().getIdentifier("hosh_alarm", "raw", getPackageName());
                if (rid != 0) {
                    AssetFileDescriptor fd = getResources().openRawResourceFd(rid);
                    mp.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
                    fd.close();
                    set = true;
                }
            }
            // 3) system default alarm
            if (!set) {
                Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                mp.setDataSource(this, u);
            }
            mp.setLooping(true);
            mp.setVolume(1f, 1f);
            mp.prepare();
            mp.start();
        } catch (Exception e) { /* vibration still runs */ }

        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            long[] pat = new long[]{0, 800, 200};
            if (v != null) {
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pat, 0));
                else v.vibrate(pat, 0);
            }
        } catch (Exception ignored) { }

        handler.removeCallbacksAndMessages(null);
        handler.postDelayed(() -> {
            // natural end
            prefs(this).edit().putLong("until", 0L).apply();
            stopSelf();
        }, sec * 1000L);
    }

    private void forceMaxVolume() {
        try {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                if (oldVol < 0) oldVol = am.getStreamVolume(AudioManager.STREAM_ALARM);
                int max = am.getStreamMaxVolume(AudioManager.STREAM_ALARM);
                am.setStreamVolume(AudioManager.STREAM_ALARM, max, 0);
                // also try music stream in case some devices route differently
                try {
                    int maxM = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
                    am.setStreamVolume(AudioManager.STREAM_MUSIC, maxM, 0);
                } catch (Exception ignored) { }
            }
        } catch (Exception ignored) { }
    }

    private void startVolumeLock() {
        stopVolumeLock();
        volLock = new Runnable() {
            @Override public void run() {
                if (adminStop || until(AlarmService.this) <= System.currentTimeMillis()) return;
                forceMaxVolume();
                handler.postDelayed(this, 800);
            }
        };
        handler.post(volLock);

        if (volRx == null) {
            volRx = new BroadcastReceiver() {
                @Override public void onReceive(Context context, Intent intent) {
                    if (adminStop) return;
                    forceMaxVolume();
                }
            };
            IntentFilter f = new IntentFilter();
            f.addAction("android.media.VOLUME_CHANGED_ACTION");
            try {
                if (Build.VERSION.SDK_INT >= 33) {
                    registerReceiver(volRx, f, Context.RECEIVER_NOT_EXPORTED);
                } else {
                    registerReceiver(volRx, f);
                }
            } catch (Exception ignored) { }
        }
    }

    private void stopVolumeLock() {
        if (volLock != null) {
            handler.removeCallbacks(volLock);
            volLock = null;
        }
        if (volRx != null) {
            try { unregisterReceiver(volRx); } catch (Exception ignored) { }
            volRx = null;
        }
    }

    private void releaseMediaOnly() {
        try { if (mp != null) { mp.stop(); mp.release(); } } catch (Exception ignored) { }
        mp = null;
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) v.cancel();
        } catch (Exception ignored) { }
    }

    private void releaseAll() {
        stopVolumeLock();
        releaseMediaOnly();
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        wl = null;
        try {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (am != null && oldVol >= 0) am.setStreamVolume(AudioManager.STREAM_ALARM, oldVol, 0);
        } catch (Exception ignored) { }
        oldVol = -1;
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // user swiped app away — if alarm still active, restart
        long u = until(this);
        if (u > System.currentTimeMillis() && !prefs(this).getBoolean("adminForceStop", false)) {
            Intent i = new Intent(this, AlarmService.class);
            i.putExtra("id", lastId(this));
            i.putExtra("sec", (int) Math.max(1, (u - System.currentTimeMillis()) / 1000L));
            if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
        }
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        boolean force = prefs(this).getBoolean("adminForceStop", false) || adminStop;
        long u = until(this);
        releaseAll();
        if (!force && u > System.currentTimeMillis()) {
            // system killed us early — sticky should restart, but also explicit
            try {
                Intent i = new Intent(this, AlarmService.class);
                i.putExtra("id", lastId(this));
                i.putExtra("sec", (int) Math.max(1, (u - System.currentTimeMillis()) / 1000L));
                if (Build.VERSION.SDK_INT >= 26) startForegroundService(i); else startService(i);
            } catch (Exception ignored) { }
        } else {
            prefs(this).edit().putLong("until", 0L).putBoolean("adminForceStop", false).apply();
        }
        super.onDestroy();
    }
}
