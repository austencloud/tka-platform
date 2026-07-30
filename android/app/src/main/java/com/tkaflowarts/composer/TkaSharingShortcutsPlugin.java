package com.tkaflowarts.composer;

import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;

import androidx.core.app.Person;
import androidx.core.content.pm.ShortcutInfoCompat;
import androidx.core.content.pm.ShortcutManagerCompat;
import androidx.core.graphics.drawable.IconCompat;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Publishes Android Sharing Shortcuts so specific conversations appear as
 * Direct Share targets in the system share sheet.
 *
 * Deliberately NOT part of @capgo/capacitor-share-target. That plugin owns the
 * shared payload and its event is {title, texts, files} - it never reads
 * EXTRA_SHORTCUT_ID, so it cannot say WHO was tapped. Forking it to add one
 * getStringExtra would mean maintaining a fork of a dependency forever. Both
 * plugins read the same intent, read-only and order-independent, so they cannot
 * conflict.
 */
@CapacitorPlugin(name = "TkaSharingShortcuts")
public class TkaSharingShortcutsPlugin extends Plugin {

    /**
     * Must be byte-identical to the <category> in res/xml/shortcuts.xml and to
     * SHARE_TARGET_CATEGORY in sharing-shortcuts-publisher.ts. A mismatch in any
     * one of the three means targets silently never appear, with no error
     * anywhere. A contract test pins all three (Task 3).
     */
    private static final String TAG = "TkaSharingShortcuts";

    private static final String CATEGORY = "com.tkaflowarts.composer.category.SHARE_TARGET";

    /** The share sheet displays about four. Pushing more is wasted work. */
    private static final int MAX_TARGETS = 4;

    @PluginMethod
    public void publish(PluginCall call) {
        JSArray targets = call.getArray("targets");
        if (targets == null) {
            call.reject("targets is required");
            return;
        }

        Context context = getContext();
        List<ShortcutInfoCompat> shortcuts = new ArrayList<>();

        try {
            List<JSONObject> raw = toJsonObjectList(targets);
            for (int i = 0; i < raw.size() && i < MAX_TARGETS; i++) {
                JSONObject entry = raw.get(i);
                String id = entry.optString("id", "");
                String name = entry.optString("name", "");
                if (id.isEmpty() || name.isEmpty()) continue;

                IconCompat icon = decodeIcon(entry.optString("iconBase64", ""));

                Person.Builder person = new Person.Builder().setName(name).setKey(id);
                if (icon != null) person.setIcon(icon);

                // A ShortcutInfoCompat REQUIRES an intent even though the share
                // sheet supplies its own ACTION_SEND on tap. This one is what
                // runs if the shortcut is launched from a launcher long-press.
                Intent launch = new Intent(Intent.ACTION_MAIN);
                launch.setClass(context, MainActivity.class);
                launch.putExtra(Intent.EXTRA_SHORTCUT_ID, id);

                ShortcutInfoCompat.Builder builder = new ShortcutInfoCompat.Builder(context, id)
                    .setShortLabel(name)
                    .setLongLabel(name)
                    // Keeps the shortcut cached by system services after removal,
                    // so the sheet keeps showing a face across republishes.
                    .setLongLived(true)
                    .setCategories(Collections.singleton(CATEGORY))
                    .setPerson(person.build())
                    // Rank hint. The Sharesheet ranks Direct Share targets with a
                    // prediction service and gives NO guarantee any target is
                    // shown; rank is one of the few signals we can actually feed
                    // it, alongside history and recency. Lower is more important,
                    // and the list already arrives newest-first.
                    .setRank(i)
                    .setIntent(launch);

                if (icon != null) builder.setIcon(icon);
                shortcuts.add(builder.build());
            }
        } catch (Exception caught) {
            call.reject("could not build shortcuts: " + caught.getMessage(), caught);
            return;
        }

        try {
            ShortcutManagerCompat.removeAllDynamicShortcuts(context);
            for (ShortcutInfoCompat shortcut : shortcuts) {
                // Returns false when rate limited (the system throttles pushes
                // while the app is backgrounded). That is normal, not an error -
                // rejecting here would throw into the inbox subscription.
                ShortcutManagerCompat.pushDynamicShortcut(context, shortcut);
            }
        } catch (Exception caught) {
            call.reject("could not publish shortcuts: " + caught.getMessage(), caught);
            return;
        }

        JSObject result = new JSObject();
        result.put("published", shortcuts.size());
        call.resolve(result);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        ShortcutManagerCompat.removeAllDynamicShortcuts(getContext());
        call.resolve();
    }

    /**
     * Read EXTRA_SHORTCUT_ID off the launch intent, ONCE.
     *
     * Consume-once is load-bearing. BridgeActivity calls onNewIntent(getIntent())
     * right after load(), and the activity keeps the launch intent for its whole
     * lifetime. Without removing the extra and calling setIntent, a warm resume
     * or a second share would re-read a stale id and silently send someone's
     * photo to the wrong person.
     */
    @PluginMethod
    public void consumeLaunchShortcutId(PluginCall call) {
        JSObject result = new JSObject();
        Intent intent = getActivity() == null ? null : getActivity().getIntent();
        String id = intent == null ? null : intent.getStringExtra(Intent.EXTRA_SHORTCUT_ID);

        // Diagnostic, deliberately kept: whether the Sharesheet actually sets
        // EXTRA_SHORTCUT_ID on a Direct Share tap is the one assumption in the
        // design that no unit test can check and that adb cannot reproduce
        // (am start cannot delegate a MediaStore read grant, so a simulated
        // image share dies in the capgo plugin before this is ever called).
        // When a target tap lands in the picker instead of a conversation,
        // this line says immediately whether the id was missing or whether it
        // arrived and something downstream dropped it.
        Log.i(TAG, "consumeLaunchShortcutId: action=" + (intent == null ? "no-intent" : intent.getAction())
            + " shortcutId=" + id
            + " extras=" + (intent == null || intent.getExtras() == null
                ? "none" : intent.getExtras().keySet()));

        if (id != null && intent != null) {
            intent.removeExtra(Intent.EXTRA_SHORTCUT_ID);
            getActivity().setIntent(intent);
        }

        result.put("shortcutId", id);
        call.resolve(result);
    }

    /**
     * JSArray in this Capacitor version does not expose a toList() that yields
     * JSONObject entries directly - it is backed by org.json.JSONArray. Read
     * through the JSONArray accessor instead of assuming a typed toList().
     */
    private List<JSONObject> toJsonObjectList(JSArray array) throws Exception {
        List<JSONObject> result = new ArrayList<>();
        for (int i = 0; i < array.length(); i++) {
            result.add(array.getJSONObject(i));
        }
        return result;
    }

    /** Person icons are round in the sheet, so adaptive is the correct form. */
    private IconCompat decodeIcon(String base64) {
        if (base64 == null || base64.isEmpty()) return null;
        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
            if (bitmap == null) return null;
            return IconCompat.createWithAdaptiveBitmap(bitmap);
        } catch (Exception caught) {
            // A missing face is better than a missing person: publish without.
            return null;
        }
    }
}
