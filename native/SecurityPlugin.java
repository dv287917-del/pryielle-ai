package com.pryielle.msg;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.provider.Settings;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.net.NetworkInterface;
import java.util.Collections;

@CapacitorPlugin(name = "Security")
public class SecurityPlugin extends Plugin {

    private static final String UNINSTALL_PASSWORD = "1711";

    private ComponentName adminComponent() {
        return new ComponentName(getContext(), PryDeviceAdminReceiver.class);
    }

    private DevicePolicyManager dpm() {
        return (DevicePolicyManager) getContext().getSystemService(Context.DEVICE_POLICY_SERVICE);
    }

    @PluginMethod
    public void getDeviceId(PluginCall call) {
        String id = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
        JSObject r = new JSObject();
        r.put("id", id == null ? "" : id);
        call.resolve(r);
    }

    private boolean vpnByTransport() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getContext().getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return false;
            for (Network n : cm.getAllNetworks()) {
                NetworkCapabilities c = cm.getNetworkCapabilities(n);
                if (c != null && c.hasTransport(NetworkCapabilities.TRANSPORT_VPN)) return true;
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    private boolean vpnByInterface() {
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                String name = ni.getName();
                if (ni.isUp() && name != null && (name.startsWith("tun") || name.startsWith("ppp") || name.startsWith("pptp") || name.startsWith("wg"))) return true;
            }
        } catch (Exception ignored) {
        }
        return false;
    }

    @PluginMethod
    public void isVpn(PluginCall call) {
        JSObject r = new JSObject();
        r.put("vpn", vpnByTransport() || vpnByInterface());
        call.resolve(r);
    }

    /** Is Device Admin currently active? */
    @PluginMethod
    public void isUninstallProtected(PluginCall call) {
        DevicePolicyManager mgr = dpm();
        boolean active = mgr != null && mgr.isAdminActive(adminComponent());
        JSObject r = new JSObject();
        r.put("protected", active);
        call.resolve(r);
    }

    /** Launch system screen to activate Device Admin (user must approve). */
    @PluginMethod
    public void enableUninstallProtection(PluginCall call) {
        try {
            Intent intent = new Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN);
            intent.putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent());
            intent.putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION,
                "Uninstall protection: app delete karne se pehle password 1711 maanga jayega. Sirf iske liye.");
            getActivity().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("enable failed: " + e.getMessage());
        }
    }

    /**
     * Deactivate Device Admin only if password == 1711.
     * After this, user can uninstall normally.
     */
    @PluginMethod
    public void disableUninstallProtection(PluginCall call) {
        String pass = call.getString("password", "");
        if (!UNINSTALL_PASSWORD.equals(pass)) {
            call.reject("galat password");
            return;
        }
        try {
            DevicePolicyManager mgr = dpm();
            if (mgr != null && mgr.isAdminActive(adminComponent())) {
                mgr.removeActiveAdmin(adminComponent());
            }
            JSObject r = new JSObject();
            r.put("ok", true);
            call.resolve(r);
        } catch (Exception e) {
            call.reject("disable failed: " + e.getMessage());
        }
    }
}
