# Spectrum Commons

The Rainbow environment is a lakeside flow pavilion with seven woven spectrum
sails, two blackened steel bows, a timber gathering deck, curved seating and a
12 metre basalt performance court.

The authored source is `blender/rainbow/spectrum-commons.blend`. Its review
figures, cameras and lighting remain in the Blender file. The runtime export
contains only the venue. The shared Three.js world owns illumination, fabric
motion and the reflected lake; the production viewer owns performers.

To rebuild from the repository root:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.0/blender.exe' --background --factory-startup --threads 8 --python scripts/blender-export-rainbow.py
node scripts/optimize-rainbow-glb.mjs
```

The export bakes the procedural meadow, wood and stone colors into three 256px
textures and joins geometry by semantic role and material. Meshopt packing
preserves floating-point positions because fabric motion uses authored metre
coordinates. The manifest records geometry counts and final file size.

The court's native top is 0.45m. The runtime translates it to the existing
Rainbow surface contract (0.4m), then applies the canonical performer offset.
Cast growth scales the court, seating and supports together horizontally.
Reduced motion freezes the fabric and water clock.

Review the venue at `/test/rainbow-scene`, the production performer renderer at
`/test/rainbow-scene?performers`, and the worker path at
`/test/rainbow-scene?performers&worker`. Camera and cast controls are isolated
from saved viewer preferences.
