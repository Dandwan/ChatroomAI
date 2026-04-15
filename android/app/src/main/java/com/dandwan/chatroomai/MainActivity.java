package com.dandwan.chatroomai;

import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.os.Build;
import android.os.Bundle;
import android.view.Window;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String CLEAR_DRAFTS_SCRIPT =
        "try { localStorage.removeItem('chatroom.drafts.v1'); } catch (e) {}";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        applySystemBarStyle();
    }

    @Override
    public void onResume() {
        super.onResume();
        applySystemBarStyle();
    }

    private void applySystemBarStyle() {
        Window window = getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false);
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.parseColor("#020617"));
        window.setBackgroundDrawable(new ColorDrawable(Color.parseColor("#020617")));

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false);
        }

        WindowInsetsControllerCompat controller =
            WindowCompat.getInsetsController(window, window.getDecorView());
        if (controller != null) {
            controller.setAppearanceLightStatusBars(false);
            controller.setAppearanceLightNavigationBars(false);
        }

        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setBackgroundColor(Color.TRANSPARENT);
        }
    }

    @Override
    public void onDestroy() {
        if (isFinishing() && !isChangingConfigurations() && bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().evaluateJavascript(CLEAR_DRAFTS_SCRIPT, null);
        }
        super.onDestroy();
    }
}
