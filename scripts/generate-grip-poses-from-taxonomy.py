"""
Generate GripPose quaternion data from the Yale GRASP Taxonomy.

Maps the 33 Feix grasp types to finger joint rotations using biomechanical
constraints from the published kinematic data. Outputs TypeScript-compatible
JSON arrays for direct paste into staff-grip-poses.ts.

Joint layout matches our FINGER_BONES:
  Thumb1, Thumb2, Thumb3,
  Index1, Index2, Index3,
  Middle1, Middle2, Middle3,
  Ring1, Ring2, Ring3,
  Pinky1, Pinky2, Pinky3

Each joint rotation is [x, y, z, w] quaternion, authored for left hand.
X = flexion (curl), Y = abduction (spread), Z = axial rotation.

Reference: Feix et al. "The GRASP Taxonomy of Human Grasp Types"
IEEE Trans. Human-Machine Systems, 2016.
"""

import json
import math
import sys


def quat_from_euler_xyz(x_deg: float, y_deg: float, z_deg: float) -> list[float]:
    """Convert Euler XYZ angles (degrees) to quaternion [x, y, z, w]."""
    x = math.radians(x_deg) / 2
    y = math.radians(y_deg) / 2
    z = math.radians(z_deg) / 2

    cx, sx = math.cos(x), math.sin(x)
    cy, sy = math.cos(y), math.sin(y)
    cz, sz = math.cos(z), math.sin(z)

    qw = cx * cy * cz + sx * sy * sz
    qx = sx * cy * cz - cx * sy * sz
    qy = cx * sy * cz + sx * cy * sz
    qz = cx * cy * sz - sx * sy * cz

    return [round(qx, 4), round(qy, 4), round(qz, 4), round(qw, 4)]


def make_pose(name: str, grip_type: str, joints: list[dict]) -> dict:
    """
    Build a GripPose from per-joint euler angle specs.

    joints: list of 15 dicts with keys {x, y, z} in degrees.
    Each dict corresponds to one bone in FINGER_BONES order.
    """
    rotations = []
    for j in joints:
        q = quat_from_euler_xyz(j.get("x", 0), j.get("y", 0), j.get("z", 0))
        rotations.append(q)
    return {"name": name, "type": grip_type, "rotations": rotations}


# --- Finger helpers ---
# Each finger has 3 bones: proximal (1), intermediate (2), distal (3)
# Thumb has different axes (Y=abduction, Z=opposition, X=flexion)

def thumb(b1_x=0, b1_y=0, b1_z=0, b2_x=0, b2_y=0, b2_z=0, b3_x=0, b3_y=0, b3_z=0):
    return [
        {"x": b1_x, "y": b1_y, "z": b1_z},
        {"x": b2_x, "y": b2_y, "z": b2_z},
        {"x": b3_x, "y": b3_y, "z": b3_z},
    ]

def finger(b1_x=0, b2_x=0, b3_x=0, b1_y=0, b2_y=0, b3_y=0):
    """Standard finger: x=flexion (curl), y=abduction (spread)."""
    return [
        {"x": b1_x, "y": b1_y},
        {"x": b2_x, "y": b2_y},
        {"x": b3_x, "y": b3_y},
    ]


# ============================================================
# YALE GRASP TAXONOMY — All 33 types as GripPose quaternion data
#
# Joint angles derived from:
# - Feix et al. 2016 kinematic descriptions
# - Santello et al. 1998 postural synergies
# - Ninapro calibrated joint angle ranges
#
# Flexion ranges (approximate):
#   MCP (proximal): 0-90°
#   PIP (intermediate): 0-100°
#   DIP (distal): 0-80°
#   Thumb CMC: -20 to 50° (abduction), -30 to 30° (opposition)
# ============================================================

GRASPS = []

# --- PAD OPPOSITION (thumb vs fingertips) ---

# 1. Prismatic 4 Finger — thick marker hold
GRASPS.append(make_pose("Prismatic 4 Finger", "pad_opposition", [
    *thumb(b1_x=15, b1_y=30, b1_z=20, b2_x=25, b3_x=15),  # thumb opposing 4 fingers
    *finger(b1_x=35, b2_x=40, b3_x=25),   # index
    *finger(b1_x=35, b2_x=40, b3_x=25),   # middle
    *finger(b1_x=35, b2_x=40, b3_x=25),   # ring
    *finger(b1_x=30, b2_x=35, b3_x=20),   # pinky
]))

# 2. Prismatic 3 Finger — pencil hold (TKA PENCIL grip)
GRASPS.append(make_pose("Prismatic 3 Finger", "pad_opposition", [
    *thumb(b1_x=20, b1_y=25, b1_z=15, b2_x=30, b3_x=20),
    *finger(b1_x=40, b2_x=50, b3_x=30),   # index — primary contact
    *finger(b1_x=35, b2_x=45, b3_x=25),   # middle — secondary contact
    *finger(b1_x=15, b2_x=20, b3_x=10),   # ring — relaxed
    *finger(b1_x=18, b2_x=22, b3_x=12),   # pinky — relaxed
]))

# 3. Prismatic 2 Finger — coin pick
GRASPS.append(make_pose("Prismatic 2 Finger", "pad_opposition", [
    *thumb(b1_x=25, b1_y=30, b1_z=10, b2_x=35, b3_x=25),
    *finger(b1_x=45, b2_x=55, b3_x=35),   # index — primary
    *finger(b1_x=10, b2_x=15, b3_x=8),    # middle — relaxed
    *finger(b1_x=12, b2_x=18, b3_x=10),   # ring
    *finger(b1_x=15, b2_x=20, b3_x=12),   # pinky
]))

# 4. Palmar Pinch — thumb pad to index pad
GRASPS.append(make_pose("Palmar Pinch", "pad_opposition", [
    *thumb(b1_x=10, b1_y=35, b1_z=15, b2_x=15, b3_x=5),
    *finger(b1_x=30, b2_x=20, b3_x=10),
    *finger(b1_x=10, b2_x=12, b3_x=8),
    *finger(b1_x=12, b2_x=15, b3_x=10),
    *finger(b1_x=15, b2_x=18, b3_x=12),
]))

# 5. Tip Pinch — fingertip to fingertip
GRASPS.append(make_pose("Tip Pinch", "pad_opposition", [
    *thumb(b1_x=30, b1_y=35, b1_z=20, b2_x=40, b3_x=35),
    *finger(b1_x=50, b2_x=60, b3_x=50),   # index curled to meet thumb tip
    *finger(b1_x=10, b2_x=15, b3_x=8),
    *finger(b1_x=12, b2_x=18, b3_x=10),
    *finger(b1_x=15, b2_x=20, b3_x=12),
]))

# 6. Quadpod — 4-finger writing grip
GRASPS.append(make_pose("Quadpod", "pad_opposition", [
    *thumb(b1_x=20, b1_y=25, b1_z=15, b2_x=25, b3_x=15),
    *finger(b1_x=40, b2_x=50, b3_x=30),
    *finger(b1_x=38, b2_x=48, b3_x=28),
    *finger(b1_x=35, b2_x=45, b3_x=25),
    *finger(b1_x=15, b2_x=20, b3_x=12),
]))

# 7. Writing Tripod — classic pen hold
GRASPS.append(make_pose("Writing Tripod", "pad_opposition", [
    *thumb(b1_x=20, b1_y=20, b1_z=10, b2_x=30, b3_x=20),
    *finger(b1_x=45, b2_x=55, b3_x=35),   # index
    *finger(b1_x=40, b2_x=50, b3_x=30),   # middle — support
    *finger(b1_x=50, b2_x=60, b3_x=40),   # ring — curled away
    *finger(b1_x=55, b2_x=65, b3_x=45),   # pinky — curled away
]))

# 8. Tripod — 3 fingertips on small ball
GRASPS.append(make_pose("Tripod", "pad_opposition", [
    *thumb(b1_x=20, b1_y=30, b1_z=15, b2_x=25, b3_x=15),
    *finger(b1_x=35, b2_x=40, b3_x=25),
    *finger(b1_x=35, b2_x=40, b3_x=25),
    *finger(b1_x=40, b2_x=50, b3_x=35),
    *finger(b1_x=45, b2_x=55, b3_x=40),
]))

# 9. Precision Sphere — fingertips around tennis ball
GRASPS.append(make_pose("Precision Sphere", "pad_opposition", [
    *thumb(b1_x=15, b1_y=35, b1_z=15, b2_x=20, b3_x=10),
    *finger(b1_x=30, b2_x=35, b3_x=20, b1_y=5),
    *finger(b1_x=30, b2_x=35, b3_x=20),
    *finger(b1_x=30, b2_x=35, b3_x=20),
    *finger(b1_x=30, b2_x=35, b3_x=20, b1_y=-5),
]))

# 10. Power Sphere — full hand around baseball
GRASPS.append(make_pose("Power Sphere", "pad_opposition", [
    *thumb(b1_x=20, b1_y=30, b1_z=20, b2_x=30, b3_x=20),
    *finger(b1_x=55, b2_x=65, b3_x=45, b1_y=5),
    *finger(b1_x=55, b2_x=65, b3_x=45),
    *finger(b1_x=55, b2_x=65, b3_x=45),
    *finger(b1_x=55, b2_x=65, b3_x=45, b1_y=-5),
]))

# 11. Precision Disk — jar lid fingertips
GRASPS.append(make_pose("Precision Disk", "pad_opposition", [
    *thumb(b1_x=10, b1_y=40, b1_z=10, b2_x=15, b3_x=5),
    *finger(b1_x=25, b2_x=20, b3_x=10, b1_y=8),
    *finger(b1_x=25, b2_x=20, b3_x=10),
    *finger(b1_x=25, b2_x=20, b3_x=10),
    *finger(b1_x=25, b2_x=20, b3_x=10, b1_y=-8),
]))

# 12. Power Disk — steering wheel
GRASPS.append(make_pose("Power Disk", "pad_opposition", [
    *thumb(b1_x=15, b1_y=25, b1_z=15, b2_x=20, b3_x=10),
    *finger(b1_x=50, b2_x=55, b3_x=35),
    *finger(b1_x=50, b2_x=55, b3_x=35),
    *finger(b1_x=50, b2_x=55, b3_x=35),
    *finger(b1_x=50, b2_x=55, b3_x=35),
]))

# 13. Three Finger Sphere — doorknob
GRASPS.append(make_pose("Three Finger Sphere", "pad_opposition", [
    *thumb(b1_x=15, b1_y=30, b1_z=15, b2_x=20, b3_x=10),
    *finger(b1_x=35, b2_x=40, b3_x=25),
    *finger(b1_x=35, b2_x=40, b3_x=25),
    *finger(b1_x=40, b2_x=50, b3_x=35),
    *finger(b1_x=45, b2_x=55, b3_x=40),
]))

# --- PALM OPPOSITION (fingers wrap to palm) ---

# 14. Large Diameter — soda can (TKA SQUARE grip, thick staff)
GRASPS.append(make_pose("Large Diameter", "palm_opposition", [
    *thumb(b1_x=20, b1_y=15, b1_z=25, b2_x=35, b3_x=25),
    *finger(b1_x=65, b2_x=75, b3_x=50),
    *finger(b1_x=68, b2_x=78, b3_x=52),
    *finger(b1_x=70, b2_x=80, b3_x=55),
    *finger(b1_x=72, b2_x=82, b3_x=58),
]))

# 15. Small Diameter — broomstick (TKA SQUARE grip, thin staff)
GRASPS.append(make_pose("Small Diameter", "palm_opposition", [
    *thumb(b1_x=25, b1_y=20, b1_z=30, b2_x=40, b3_x=30),
    *finger(b1_x=75, b2_x=85, b3_x=60),
    *finger(b1_x=78, b2_x=88, b3_x=62),
    *finger(b1_x=80, b2_x=90, b3_x=65),
    *finger(b1_x=82, b2_x=90, b3_x=68),
]))

# 16. Medium Wrap — hammer handle
GRASPS.append(make_pose("Medium Wrap", "palm_opposition", [
    *thumb(b1_x=22, b1_y=18, b1_z=28, b2_x=38, b3_x=28),
    *finger(b1_x=70, b2_x=80, b3_x=55),
    *finger(b1_x=73, b2_x=83, b3_x=57),
    *finger(b1_x=75, b2_x=85, b3_x=60),
    *finger(b1_x=77, b2_x=87, b3_x=62),
]))

# 17. Ring — cigarette hold
GRASPS.append(make_pose("Ring", "palm_opposition", [
    *thumb(b1_x=5, b1_y=10, b1_z=5, b2_x=10, b3_x=5),
    *finger(b1_x=55, b2_x=30, b3_x=15),   # index — forms ring
    *finger(b1_x=55, b2_x=30, b3_x=15),   # middle — forms ring
    *finger(b1_x=15, b2_x=20, b3_x=10),
    *finger(b1_x=18, b2_x=22, b3_x=12),
]))

# 18. Light Tool — relaxed screwdriver (TKA CRADLE)
GRASPS.append(make_pose("Light Tool", "palm_opposition", [
    *thumb(b1_x=15, b1_y=10, b1_z=15, b2_x=20, b3_x=10),
    *finger(b1_x=45, b2_x=50, b3_x=30),
    *finger(b1_x=48, b2_x=53, b3_x=32),
    *finger(b1_x=50, b2_x=55, b3_x=35),
    *finger(b1_x=52, b2_x=57, b3_x=38),
]))

# 19. Adducted Thumb — wrap with thumb alongside
GRASPS.append(make_pose("Adducted Thumb", "palm_opposition", [
    *thumb(b1_x=5, b1_y=-10, b1_z=5, b2_x=10, b3_x=5),  # thumb adducted
    *finger(b1_x=70, b2_x=80, b3_x=55),
    *finger(b1_x=73, b2_x=83, b3_x=57),
    *finger(b1_x=75, b2_x=85, b3_x=60),
    *finger(b1_x=77, b2_x=87, b3_x=62),
]))

# 20. Fixed Hook — bag handle, no thumb
GRASPS.append(make_pose("Fixed Hook", "palm_opposition", [
    *thumb(b1_x=0, b1_y=0, b1_z=0, b2_x=0, b3_x=0),     # thumb disengaged
    *finger(b1_x=60, b2_x=90, b3_x=70),
    *finger(b1_x=60, b2_x=90, b3_x=70),
    *finger(b1_x=60, b2_x=90, b3_x=70),
    *finger(b1_x=60, b2_x=90, b3_x=70),
]))

# 21. Sphere 4 Finger — 4 fingers + palm
GRASPS.append(make_pose("Sphere 4 Finger", "palm_opposition", [
    *thumb(b1_x=15, b1_y=25, b1_z=15, b2_x=25, b3_x=15),
    *finger(b1_x=50, b2_x=60, b3_x=40),
    *finger(b1_x=50, b2_x=60, b3_x=40),
    *finger(b1_x=50, b2_x=60, b3_x=40),
    *finger(b1_x=50, b2_x=60, b3_x=40),
]))

# 22. Ventral — between straightened fingers
GRASPS.append(make_pose("Ventral", "palm_opposition", [
    *thumb(b1_x=5, b1_y=20, b1_z=5, b2_x=10, b3_x=5),
    *finger(b1_x=20, b2_x=10, b3_x=5),
    *finger(b1_x=20, b2_x=10, b3_x=5),
    *finger(b1_x=20, b2_x=10, b3_x=5),
    *finger(b1_x=20, b2_x=10, b3_x=5),
]))

# 23. Index Finger Extension — spray trigger
GRASPS.append(make_pose("Index Finger Extension", "palm_opposition", [
    *thumb(b1_x=20, b1_y=15, b1_z=20, b2_x=30, b3_x=20),
    *finger(b1_x=5, b2_x=5, b3_x=2),      # index extended
    *finger(b1_x=70, b2_x=80, b3_x=55),
    *finger(b1_x=73, b2_x=83, b3_x=57),
    *finger(b1_x=75, b2_x=85, b3_x=60),
]))

# 24. Extension Type — all fingers extended along object
GRASPS.append(make_pose("Extension Type", "palm_opposition", [
    *thumb(b1_x=10, b1_y=10, b1_z=10, b2_x=15, b3_x=5),
    *finger(b1_x=15, b2_x=10, b3_x=5),
    *finger(b1_x=15, b2_x=10, b3_x=5),
    *finger(b1_x=15, b2_x=10, b3_x=5),
    *finger(b1_x=15, b2_x=10, b3_x=5),
]))

# 25. Parallel Extension — book clamp
GRASPS.append(make_pose("Parallel Extension", "palm_opposition", [
    *thumb(b1_x=5, b1_y=40, b1_z=5, b2_x=5, b3_x=2),
    *finger(b1_x=5, b2_x=5, b3_x=2),
    *finger(b1_x=5, b2_x=5, b3_x=2),
    *finger(b1_x=5, b2_x=5, b3_x=2),
    *finger(b1_x=5, b2_x=5, b3_x=2),
]))

# 26. Distal Type — fingertips only
GRASPS.append(make_pose("Distal Type", "palm_opposition", [
    *thumb(b1_x=25, b1_y=30, b1_z=15, b2_x=35, b3_x=30),
    *finger(b1_x=60, b2_x=70, b3_x=55),
    *finger(b1_x=60, b2_x=70, b3_x=55),
    *finger(b1_x=60, b2_x=70, b3_x=55),
    *finger(b1_x=60, b2_x=70, b3_x=55),
]))

# 27. Platform — flat open palm (TKA OPEN_PALM)
GRASPS.append(make_pose("Platform", "palm_opposition", [
    *thumb(b1_x=0, b1_y=15, b1_z=0, b2_x=0, b3_x=0),
    *finger(b1_x=0, b2_x=0, b3_x=0),
    *finger(b1_x=0, b2_x=0, b3_x=0),
    *finger(b1_x=0, b2_x=0, b3_x=0),
    *finger(b1_x=0, b2_x=0, b3_x=0),
]))

# --- SIDE OPPOSITION (thumb side vs finger side) ---

# 28. Lateral — key grip
GRASPS.append(make_pose("Lateral", "side_opposition", [
    *thumb(b1_x=15, b1_y=-5, b1_z=20, b2_x=20, b3_x=10),  # thumb adducted against index side
    *finger(b1_x=45, b2_x=55, b3_x=35),
    *finger(b1_x=50, b2_x=60, b3_x=40),
    *finger(b1_x=55, b2_x=65, b3_x=45),
    *finger(b1_x=58, b2_x=68, b3_x=48),
]))

# 29. Lateral Tripod — key grip + middle support
GRASPS.append(make_pose("Lateral Tripod", "side_opposition", [
    *thumb(b1_x=15, b1_y=-5, b1_z=15, b2_x=20, b3_x=10),
    *finger(b1_x=40, b2_x=50, b3_x=30),
    *finger(b1_x=40, b2_x=50, b3_x=30),   # middle supports
    *finger(b1_x=50, b2_x=60, b3_x=40),
    *finger(b1_x=55, b2_x=65, b3_x=45),
]))

# 30. Stick — chopstick hold
GRASPS.append(make_pose("Stick", "side_opposition", [
    *thumb(b1_x=15, b1_y=15, b1_z=10, b2_x=25, b3_x=15),
    *finger(b1_x=35, b2_x=45, b3_x=25),
    *finger(b1_x=35, b2_x=45, b3_x=25),
    *finger(b1_x=50, b2_x=60, b3_x=40),
    *finger(b1_x=55, b2_x=65, b3_x=45),
]))

# 31. Palmar — object between palm and straight fingers
GRASPS.append(make_pose("Palmar", "side_opposition", [
    *thumb(b1_x=10, b1_y=10, b1_z=10, b2_x=15, b3_x=5),
    *finger(b1_x=25, b2_x=15, b3_x=5),
    *finger(b1_x=25, b2_x=15, b3_x=5),
    *finger(b1_x=25, b2_x=15, b3_x=5),
    *finger(b1_x=25, b2_x=15, b3_x=5),
]))

# 32. Push — elevator button press
GRASPS.append(make_pose("Push", "side_opposition", [
    *thumb(b1_x=5, b1_y=5, b1_z=0, b2_x=5, b3_x=2),
    *finger(b1_x=5, b2_x=5, b3_x=2),      # index extended to push
    *finger(b1_x=45, b2_x=55, b3_x=35),
    *finger(b1_x=50, b2_x=60, b3_x=40),
    *finger(b1_x=55, b2_x=65, b3_x=45),
]))

# 33. Scissors — pinch between two fingers (no thumb)
GRASPS.append(make_pose("Scissors", "side_opposition", [
    *thumb(b1_x=5, b1_y=0, b1_z=0, b2_x=5, b3_x=2),
    *finger(b1_x=30, b2_x=35, b3_x=20, b1_y=10),   # index — one blade
    *finger(b1_x=30, b2_x=35, b3_x=20, b1_y=-10),  # middle — other blade
    *finger(b1_x=50, b2_x=60, b3_x=40),
    *finger(b1_x=55, b2_x=65, b3_x=45),
]))

# ============================================================
# TKA-specific additions (not in Yale taxonomy)
# ============================================================

# IDLE — relaxed hand, no object
GRASPS.append(make_pose("Relaxed Idle", "tka_specific", [
    *thumb(b1_z=10, b2_z=5),
    *finger(b1_x=10, b2_x=15, b3_x=10),
    *finger(b1_x=12, b2_x=18, b3_x=12),
    *finger(b1_x=15, b2_x=20, b3_x=15),
    *finger(b1_x=18, b2_x=22, b3_x=18),
]))

# RELEASE — all fingers fully extended, staff airborne
GRASPS.append(make_pose("Release", "tka_specific", [
    *thumb(b1_x=-5, b1_y=20, b2_x=-5, b3_x=-2),
    *finger(b1_x=-5, b2_x=-3, b3_x=-2),
    *finger(b1_x=-5, b2_x=-3, b3_x=-2),
    *finger(b1_x=-5, b2_x=-3, b3_x=-2),
    *finger(b1_x=-5, b2_x=-3, b3_x=-2),
]))


# ============================================================
# Output
# ============================================================

def main():
    # Full taxonomy output
    output = {
        "source": "Yale GRASP Taxonomy (Feix et al. 2016) + TKA additions",
        "total_grasps": len(GRASPS),
        "format": "15 quaternions [x,y,z,w] per pose, left hand, FINGER_BONES order",
        "grasps": GRASPS,
    }

    # Write full taxonomy
    with open("src/lib/shared/3d/data/grip-poses/yale-taxonomy-poses.json", "w") as f:
        json.dump(output, f, indent=2)
    print(f"Wrote {len(GRASPS)} grasp poses to yale-taxonomy-poses.json")

    # Also output the TKA-relevant subset as TypeScript-pasteable format
    tka_map = {
        "idle": "Relaxed Idle",
        "square": "Small Diameter",      # Staff = thin cylinder
        "pencil": "Prismatic 3 Finger",  # Pencil grip = thumb+index+middle
        "cradle": "Light Tool",           # Relaxed hold
        "open_palm": "Platform",          # Flat open palm
        "release": "Release",             # Fingers extended
    }

    print("\n=== TKA Grip Type Mapping ===")
    for tka_type, yale_name in tka_map.items():
        pose = next(g for g in GRASPS if g["name"] == yale_name)
        print(f"\n// {tka_type.upper()} <- Yale: {yale_name}")
        print(f"// {pose['type']}")
        print(f"rotations: {json.dumps(pose['rotations'])},")


if __name__ == "__main__":
    main()
