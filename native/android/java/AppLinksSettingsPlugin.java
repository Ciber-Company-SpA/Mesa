package com.mesa.meseros;

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Plugin que dispara la pantalla nativa "Abrir de forma predeterminada" para
 * esta app. En Android 12+ usa ACTION_APP_OPEN_BY_DEFAULT_SETTINGS (cae justo
 * en el toggle de App Links). En versiones anteriores hace fallback al detalle
 * estándar de la app (ACTION_APPLICATION_DETAILS_SETTINGS), que es lo mejor que
 * se puede en esos casos.
 *
 * Devuelve { opened: true, openedTarget: "app-open-by-default" | "app-details" }
 * o un reject si falló.
 */
@CapacitorPlugin(name = "AppLinksSettings")
public class AppLinksSettingsPlugin extends Plugin {

    @PluginMethod
    public void openAppOpenByDefaultSettings(PluginCall call) {
        String packageName = getContext().getPackageName();
        Uri appUri = Uri.fromParts("package", packageName, null);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            Intent intent = new Intent(Settings.ACTION_APP_OPEN_BY_DEFAULT_SETTINGS, appUri);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            try {
                getContext().startActivity(intent);
                JSObject ret = new JSObject();
                ret.put("opened", true);
                ret.put("openedTarget", "app-open-by-default");
                call.resolve(ret);
                return;
            } catch (Exception ignored) {
                // Algunos OEMs (Xiaomi/HyperOS) pueden bloquear este intent.
                // Caemos al detalle estándar.
            }
        }

        Intent fallback = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, appUri);
        fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(fallback);
            JSObject ret = new JSObject();
            ret.put("opened", true);
            ret.put("openedTarget", "app-details");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("No se pudo abrir la pantalla de ajustes", e);
        }
    }
}
