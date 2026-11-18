package com.pryielle.msg;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(FloatingWindowPlugin.class);
        registerPlugin(SecurityPlugin.class);
        registerPlugin(UpdaterPlugin.class);
        registerPlugin(AlarmPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
