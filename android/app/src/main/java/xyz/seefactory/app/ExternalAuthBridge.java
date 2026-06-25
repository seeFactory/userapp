package xyz.seefactory.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.webkit.JavascriptInterface;
import android.widget.Toast;

public class ExternalAuthBridge {
    private final Activity activity;

    public ExternalAuthBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void open(String url) {
        if (url == null || url.trim().isEmpty()) {
            showToast("授权地址无效");
            return;
        }

        activity.runOnUiThread(() -> openOnUiThread(url));
    }

    private void openOnUiThread(String url) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            activity.startActivity(intent);
        } catch (ActivityNotFoundException error) {
            showToast("未找到可打开授权页的浏览器");
        } catch (Exception error) {
            showToast("授权页打开失败");
        }
    }

    private void showToast(String message) {
        activity.runOnUiThread(() -> Toast.makeText(activity, message, Toast.LENGTH_SHORT).show());
    }
}
