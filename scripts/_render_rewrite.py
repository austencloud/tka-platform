import re, os

SVC = r"src/lib/shared/render/services"

# Files that MOVED from services/implementations/ -> services/ (depth -1).
# Their relative specifiers that go UP need one fewer "../".
moved = [
    "canvas-2d-direct-renderer.ts","canvas-manager.ts","composition-dispatcher.ts",
    "glyph-cache.ts","image-composer.ts","image-format-converter.ts","layer-compositor.ts",
    "pictograph-blob-cache.ts","pictograph-key-hasher.ts","pictograph-memory-cache.ts",
    "pictograph-svg-cache.ts","render-factory.ts","svg-to-canvas-converter.ts",
    "sequence-renderer.ts","svg-asset-loader.ts","text-renderer.ts","web-gl-direct-renderer.ts",
    "worker-render-pool.ts","create-render-canvas.ts","canvas-2d-glyph-renderer.ts",
    "canvas-2d-transform-helper.ts","card-composer.ts","cell-border-renderer.ts","glyph-bitmap-loader.ts",
]

# Sibling import basename -> new kebab (within services/, "./X" -> "./x").
sibling = {
    "ImageComposer":"image-composer","TextRenderer":"text-renderer",
    "PictographBlobCache":"pictograph-blob-cache","PictographMemoryCache":"pictograph-memory-cache",
    "PictographKeyHasher":"pictograph-key-hasher","Canvas2DDirectRenderer":"canvas-2d-direct-renderer",
    "LayerCompositor":"layer-compositor","ImageFormatConverter":"image-format-converter",
    "createRenderCanvas":"create-render-canvas","RenderFactory":"render-factory",
    "SvgAssetLoader":"svg-asset-loader",
    # SvgImageCache intentionally NOT renamed (pinned in implementations/)
}

# domain/models kebab map
domain_models = {
    "SequenceExportOptions":"sequence-export-options","SvgConversion":"svg-conversion","ImageFormat":"image-format",
}

def reanchor_up(spec):
    # turn one leading ../../ -> ../ , ../../../ -> ../../ etc. Only for specifiers that start with ../..
    if spec.startswith("../../"):
        return spec[3:]  # remove one "../"
    return spec

for fn in moved:
    p = os.path.join(SVC, fn)
    with open(p, "r", encoding="utf-8") as fh:
        src = fh.read()
    def repl(m):
        q = m.group(1); spec = m.group(2)
        # sibling "./SvgImageCache" -> "./implementations/SvgImageCache"
        if spec == "./SvgImageCache":
            return f'from {q}./implementations/SvgImageCache{q}'
        # sibling kebab rename "./X"
        if spec.startswith("./"):
            base = spec[2:]
            if base in sibling:
                return f'from {q}./{sibling[base]}{q}'
            return m.group(0)
        # "../something" where something was a services-level sibling reached via "../" from impl
        if spec.startswith("../") and not spec.startswith("../../"):
            # was impl/.. = services/. Now we're IN services, so "../X" must become "./X"
            inner = spec[3:]
            # kebab domain model names if present later; here these are services siblings like layout-calculator, etc.
            return f'from {q}./{inner}{q}'
        # deeper "../../..." re-anchor by removing one ../
        new = reanchor_up(spec)
        return f'from {q}{new}{q}'
    src = re.sub(r'from (["\'])(\.\.?/[^"\']*)\1', repl, src)
    with open(p, "w", encoding="utf-8") as fh:
        fh.write(src)

# Now kebab the domain/models basenames across ALL render module files (moved + non-moved).
for root, _, files in os.walk("src/lib/shared/render"):
    for f in files:
        if not f.endswith(".ts") and not f.endswith(".svelte"):
            continue
        p = os.path.join(root, f)
        with open(p, "r", encoding="utf-8") as fh:
            src = fh.read()
        orig = src
        for old, new in domain_models.items():
            src = src.replace(f"domain/models/{old}", f"domain/models/{new}")
        if src != orig:
            with open(p, "w", encoding="utf-8") as fh:
                fh.write(src)

print("done")
