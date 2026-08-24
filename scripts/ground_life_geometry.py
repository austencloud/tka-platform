"""Shared authored geometry for rooted meadow grass.

Forest and Blossom both use these ribbons so the runtime wind shader sees the
same root-to-tip UV contract. Scene builders still own habitat placement,
palette, height, and density.
"""

import math


def append_meadow_blade(
    vertices,
    faces,
    vertex_uvs,
    root_x,
    root_y,
    root_z,
    yaw,
    width,
    height,
    lean_angle,
    lean,
):
    """Append one curved, tapered ribbon with a single pointed tip."""
    right_x = math.cos(yaw)
    right_y = math.sin(yaw)
    lean_x = math.cos(lean_angle)
    lean_y = math.sin(lean_angle)
    start = len(vertices)
    sections = (
        (0.0, 1.0, 0.0),
        (0.42, 0.72, 0.20),
        (0.76, 0.36, 0.62),
    )
    for height_fraction, width_fraction, lean_fraction in sections:
        center_x = root_x + lean_x * lean * lean_fraction
        center_y = root_y + lean_y * lean * lean_fraction
        section_z = root_z + height * height_fraction
        half_width = width * width_fraction
        vertices.extend(
            (
                (
                    center_x - right_x * half_width,
                    center_y - right_y * half_width,
                    section_z,
                ),
                (
                    center_x + right_x * half_width,
                    center_y + right_y * half_width,
                    section_z,
                ),
            )
        )
        vertex_uvs.extend(((0.0, height_fraction), (1.0, height_fraction)))
    vertices.append((root_x + lean_x * lean, root_y + lean_y * lean, root_z + height))
    vertex_uvs.append((0.5, 1.0))
    faces.extend(
        (
            (start, start + 1, start + 3, start + 2),
            (start + 2, start + 3, start + 5, start + 4),
            (start + 4, start + 5, start + 6),
        )
    )


def append_meadow_seed_head(
    vertices,
    faces,
    vertex_uvs,
    root_x,
    root_y,
    root_z,
    yaw,
    stem_height,
    lean_angle,
    lean,
):
    """Append one restrained grass inflorescence above a slender stem."""
    append_meadow_blade(
        vertices,
        faces,
        vertex_uvs,
        root_x,
        root_y,
        root_z,
        yaw,
        0.0045,
        stem_height,
        lean_angle,
        lean,
    )
    crown_x = root_x + math.cos(lean_angle) * lean * 0.82
    crown_y = root_y + math.sin(lean_angle) * lean * 0.82
    crown_z = root_z + stem_height * 0.78
    for index, angle_offset in enumerate((-0.34, 0.38)):
        branch_yaw = yaw + angle_offset
        branch_height = stem_height * (0.105 - index * 0.006)
        append_meadow_blade(
            vertices,
            faces,
            vertex_uvs,
            crown_x,
            crown_y,
            crown_z + index * stem_height * 0.037,
            branch_yaw,
            0.0036,
            branch_height,
            branch_yaw,
            branch_height * 0.62,
        )
