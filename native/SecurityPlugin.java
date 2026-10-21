package com.pryielle.msg;

import android.content.Context;
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
}
