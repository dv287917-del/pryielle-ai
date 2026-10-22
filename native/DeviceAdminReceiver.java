package com.pryielle.msg;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;
import android.widget.Toast;

/**
 * Uninstall protection. While active, system blocks uninstall until this admin is deactivated.
 * Deactivation from Settings still possible, but we show a strong warning and the in-app path requires password 1711.
 */
public class PryDeviceAdminReceiver extends DeviceAdminReceiver {

    public static final String PASSWORD = "1711";

    @Override
    public void onEnabled(Context context, Intent intent) {
        Toast.makeText(context, "Uninstall protection ON", Toast.LENGTH_SHORT).show();
    }

    @Override
    public CharSequence onDisableRequested(Context context, Intent intent) {
        // Shown by system when user tries to deactivate from Settings.
        // Real password gate is enforced inside the app before calling removeActiveAdmin.
        return "⚠ Password chahiye (1711). App se Settings → Uninstall protection OFF karo pehle. Galat tarike se hatane par data risk.";
    }

    @Override
    public void onDisabled(Context context, Intent intent) {
        Toast.makeText(context, "Uninstall protection OFF", Toast.LENGTH_SHORT).show();
    }
}
