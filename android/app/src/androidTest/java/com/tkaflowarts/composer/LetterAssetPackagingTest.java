package com.tkaflowarts.composer;

import static org.junit.Assert.assertNotNull;
import static org.junit.Assert.assertTrue;

import android.content.res.AssetManager;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import org.junit.Test;
import org.junit.runner.RunWith;

@RunWith(AndroidJUnit4.class)
public final class LetterAssetPackagingTest {
    private static final String TYPE6_ASSET_DIR =
            "public/images/letters_trimmed/Type6";
    private static final List<String> GREEK_GLYPH_ASSETS =
            Arrays.asList(
                    "public/images/letters_trimmed/Type2/Σ.svg",
                    "public/images/letters_trimmed/Type3/Δ-.svg",
                    "public/images/letters_trimmed/Type4/Φ.svg",
                    "public/images/letters_trimmed/Type5/Ψ-.svg",
                    TYPE6_ASSET_DIR + "/γ.svg",
                    TYPE6_ASSET_DIR + "/⊕.svg");

    @Test
    public void packagedGreekLetterAssetsKeepCanonicalNamesAndRemainReadable()
            throws Exception {
        AssetManager assets =
                InstrumentationRegistry.getInstrumentation()
                        .getTargetContext()
                        .getAssets();
        String[] names = assets.list(TYPE6_ASSET_DIR);

        assertNotNull(names);
        String diagnostic =
                String.format(
                        "gamma_readable=%s names=%s",
                        canRead(assets, TYPE6_ASSET_DIR + "/γ.svg"),
                        Arrays.toString(names));
        System.out.println("TKA_ASSET_DIAGNOSTIC " + diagnostic);

        assertTrue(
                "Expected the canonical gamma asset; " + diagnostic,
                Arrays.asList(names).contains("γ.svg"));
        assertTrue(
                "Expected the canonical terra asset; " + diagnostic,
                Arrays.asList(names).contains("⊕.svg"));

        for (String assetPath : GREEK_GLYPH_ASSETS) {
            try (InputStream input = assets.open(assetPath)) {
                byte[] prefix = input.readNBytes(512);
                assertTrue(
                        assetPath + " must contain SVG markup",
                        new String(prefix, StandardCharsets.US_ASCII)
                                .contains("<svg"));
            }
        }
    }

    private static boolean canRead(AssetManager assets, String path) {
        try (InputStream ignored = assets.open(path)) {
            return true;
        } catch (IOException error) {
            return false;
        }
    }
}
