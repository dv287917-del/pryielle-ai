package com.pryielle.msg;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
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

/** Emergency alarm: foreground service, loud looping alarm-stream sound for N seconds. Runs even if the app UI is closed. */
public class AlarmService extends Service {
    static final String CH = "pry_alarm";
    private MediaPlayer mp;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private PowerManager.WakeLock wl;
    private int oldVol = -1;

    public static void start(Context c, String id, int seconds) {
        Intent i = new Intent(c, AlarmService.class);
        i.putExtra("id", id == null ? "" : id);
        i.putExtra("sec", seconds);
        if (Build.VERSION.SDK_INT >= 26) c.startForegroundService(i); else c.startService(i);
    }

    public static void stop(Context c) { c.stopService(new Intent(c, AlarmService.class)); }

    static SharedPreferences prefs(Context c) { return c.getSharedPreferences("pry_alarm", Context.MODE_PRIVATE); }
    static String lastId(Context c) { return prefs(c).getString("last", ""); }
    static long until(Context c) { return prefs(c).getLong("until", 0L); }

    @Override public IBinder onBind(Intent intent) { return null; }

    @Override
    public int onStartCommand(Intent in, int flags, int startId) {
        if (in != null && "STOP".equals(in.getAction())) { stopSelf(); return START_NOT_STICKY; }
        String id = in == null ? "" : in.getStringExtra("id");
        int sec = in == null ? 30 : in.getIntExtra("sec", 30);
        if (sec < 1) sec = 1;
        if (sec > 3600) sec = 3600;
        prefs(this).edit().putString("last", id == null ? "" : id).putLong("until", System.currentTimeMillis() + sec * 1000L).apply();

        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel ch = new NotificationChannel(CH, "Emergency alarm", NotificationManager.IMPORTANCE_HIGH);
            ch.setSound(null, null);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.createNotificationChannel(ch);
        }
        Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
        PendingIntent openP = PendingIntent.getActivity(this, 2, open, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
        Notification n = new NotificationCompat.Builder(this, CH)
                .setSmallIcon(android.R.drawable.ic_lock_idle_alarm)
                .setContentTitle("ALARM")
                .setContentText("Admin ne alarm bheja hai")
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_ALARM)
                .setOngoing(true)
                .setContentIntent(openP)
                .build();
        if (Build.VERSION.SDK_INT >= 29) startForeground(77, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        else startForeground(77, n);

        ring(sec);
        return START_NOT_STICKY;
    }

    private void ring(int sec) {
        release();
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) { wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "pry:alarm"); wl.acquire(sec * 1000L + 3000L); }
        } catch (Exception ignored) { }
        try {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (am != null) {
                oldVol = am.getStreamVolume(AudioManager.STREAM_ALARM);
                am.setStreamVolume(AudioManager.STREAM_ALARM, am.getStreamMaxVolume(AudioManager.STREAM_ALARM), 0);
            }
        } catch (Exception ignored) { }
        try {
            mp = new MediaPlayer();
            mp.setAudioAttributes(new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            int rid = getResources().getIdentifier("hosh_alarm", "raw", getPackageName());
            if (rid != 0) {
                AssetFileDescriptor fd = getResources().openRawResourceFd(rid);
                mp.setDataSource(fd.getFileDescriptor(), fd.getStartOffset(), fd.getLength());
                fd.close();
            } else {
                Uri u = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM);
                mp.setDataSource(this, u);
            }
            mp.setLooping(true);
            mp.prepare();
            mp.start();
        } catch (Exception e) { /* sound fail: vibration still goes */ }
        try {
            Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            long[] pat = new long[]{0, 700, 300};
            if (v != null) {
                if (Build.VERSION.SDK_INT >= 26) v.vibrate(VibrationEffect.createWaveform(pat, 0)); else v.vibrate(pat, 0);
            }
        } catch (Exception ignored) { }
        handler.postDelayed(() -> stopSelf(), sec * 1000L);
    }

    private void release() {
        try { if (mp != null) { mp.stop(); mp.release(); } } catch (Exception ignored) { }
        mp = null;
        try { Vibrator v = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE); if (v != null) v.cancel(); } catch (Exception ignored) { }
        try { if (wl != null && wl.isHeld()) wl.release(); } catch (Exception ignored) { }
        wl = null;
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        release();
        try {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (am != null && oldVol >= 0) am.setStreamVolume(AudioManager.STREAM_ALARM, oldVol, 0);
        } catch (Exception ignored) { }
        prefs(this).edit().putLong("until", 0L).apply();
        super.onDestroy();
    }
}
