package com.tkaflowarts.composer;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Must precede super.onCreate: the bridge registers plugins during it.
        registerPlugin(TkaSharingShortcutsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
