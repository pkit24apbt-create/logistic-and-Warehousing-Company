"""
SafeStack - Blender warehouse scene
===================================

Builds a modelled warehouse interior (racking, pallets, forklift, pedestrian,
loading dock, emergency exit, floor markings and five safety hazards), then:

  1. renders a 360 degree equirectangular PANORAMA with Cycles
        -> warehouse-360-blender.png   (use it in the Virtual Tour)
  2. exports the whole scene as a 3D model
        -> warehouse.glb               (the "Blender asset")
  3. writes the SQL for the Virtual Tour markers, placed on the exact pixels of
     the panorama
        -> tour_markers.sql

HOW TO RUN
  1. Install Blender (free, blender.org) - version 3.6 or newer.
  2. File > New > General.   (This script DELETES everything in the open file.)
  3. Open the "Scripting" workspace, click New, paste this whole file, click Run Script.
  4. Wait for the render. Keep QUALITY = "preview" for a first quick test (about a
     minute), then set QUALITY = "final" and run again in a fresh file.
  5. The files are written to OUTPUT_DIR (printed in the console).

Running it outside Blender (python safestack_warehouse_scene.py) just prints the
marker SQL, because the marker maths does not need Blender.
"""

import math
import os
import random

try:
    import bpy  # only available inside Blender
except ImportError:  # pragma: no cover
    bpy = None

# ----------------------------------------------------------------------------
# SETTINGS - change these if you like
# ----------------------------------------------------------------------------
QUALITY = "preview"                      # "preview" (fast) or "final" (sharp)
OUTPUT_DIR = os.path.join(os.path.expanduser("~"), "safestack_blender")
PANORAMA_NAME = "warehouse-360-blender.png"
GLB_NAME = "warehouse.glb"
SQL_NAME = "tour_markers.sql"
LIGHT_ENERGY = 2000                      # watts per ceiling light; raise if too dark
SHOW_DEBUG_MARKERS = False               # True = draw glowing red balls where the tour markers will appear

QUALITY_PRESETS = {                      # (width, height, samples)
    "preview": (2048, 1024, 24),
    "final": (4096, 2048, 128),
}

# The camera stands in the middle of the hall at eye height. The CENTRE of the
# panorama image looks along +Y; the right-hand side of the image looks along +X.
CAMERA_POS = (0.0, 0.0, 1.6)
CAMERA_FORWARD = (0.0, 1.0, 0.0)

HALL_X, HALL_Y, HALL_H = 15.0, 10.0, 8.0   # half length, half width, height (metres)

# Tour markers (what the amber dots in the Virtual Tour explain).
TOUR_MARKERS = [
    {"label": "Loading Dock", "pos": (-14.7, -2.0, 2.0),
     "description": "Goods arrive and leave here. Keep the doors and the bollard zone clear, and never walk behind a reversing vehicle."},
    {"label": "Racking Aisle", "pos": (-5.0, 6.6, 3.0),
     "description": "Pallets are stored on beam racking up to six metres high. Check load stability and never climb the racking."},
    {"label": "Emergency Exit", "pos": (14.8, 2.0, 2.6),
     "description": "This exit and the route to it must stay clear at all times so everyone can leave quickly in an emergency."},
    {"label": "Forklift Operating Zone", "pos": (3.0, 3.0, 1.4),
     "description": "Forklifts work in this area. Stay on the marked walkway, make eye contact with the driver and obey the speed limit."},
    {"label": "Pedestrian Walkway", "pos": (-3.0, -3.0, 0.05),
     "description": "The yellow lines mark the safe route for people on foot. Nothing may be stored or left inside the lines."},
]


# ----------------------------------------------------------------------------
# Marker maths (no Blender needed). Equirectangular convention: the image centre
# looks along CAMERA_FORWARD and the image x axis increases towards the RIGHT.
# ----------------------------------------------------------------------------
def project_to_equirect(point, cam_pos=CAMERA_POS, forward=CAMERA_FORWARD):
    """Return (x_percent, y_percent) of a world point in the panorama image."""
    fx, fy = forward[0], forward[1]
    flen = math.hypot(fx, fy)
    fx, fy = fx / flen, fy / flen
    rx, ry = fy, -fx                      # right = forward x up(0,0,1)
    dx, dy, dz = point[0] - cam_pos[0], point[1] - cam_pos[1], point[2] - cam_pos[2]
    d_forward = dx * fx + dy * fy
    d_right = dx * rx + dy * ry
    azimuth = math.atan2(d_right, d_forward)              # + = to the right of forward
    elevation = math.atan2(dz, math.hypot(d_forward, d_right))
    u = 0.5 + azimuth / (2.0 * math.pi)
    v = 0.5 - elevation / math.pi                         # 0 = top of the image
    return round(100.0 * u, 2), round(100.0 * v, 2)


def _sql_text(value):
    return value.replace("'", "''")


def tour_markers_sql(markers=None):
    markers = TOUR_MARKERS if markers is None else markers
    rows = []
    for i, m in enumerate(markers):
        x, y = project_to_equirect(m["pos"])
        rows.append("  (%.2f, %.2f, '%s', '%s', %d)" % (x, y, _sql_text(m["label"]), _sql_text(m["description"]), i))
    return (
        "-- Virtual Tour markers for the Blender panorama (generated by safestack_warehouse_scene.py)\n"
        "-- Keep a copy of the current markers first (only created once, so re-running never overwrites it).\n"
        "CREATE TABLE IF NOT EXISTS tour_hotspots_backup AS SELECT * FROM tour_hotspots;\n"
        "DELETE FROM tour_hotspots;\n"
        "INSERT INTO tour_hotspots (x_percent, y_percent, label, description, sort_order) VALUES\n"
        + ",\n".join(rows) + ";\n"
    )


# ----------------------------------------------------------------------------
# Blender helpers
# ----------------------------------------------------------------------------
_materials = {}

COLOURS = {
    "concrete": (0.42, 0.42, 0.44, 1), "wall": (0.72, 0.74, 0.76, 1), "wall_band": (0.18, 0.27, 0.36, 1),
    "steel": (0.25, 0.26, 0.28, 1), "blue": (0.04, 0.22, 0.65, 1), "orange": (0.95, 0.42, 0.03, 1),
    "wood": (0.55, 0.38, 0.20, 1), "cardboard": (0.62, 0.47, 0.28, 1), "cardboard2": (0.70, 0.55, 0.34, 1),
    "yellow": (0.95, 0.72, 0.03, 1), "green": (0.0, 0.50, 0.20, 1), "red": (0.70, 0.04, 0.04, 1),
    "black": (0.02, 0.02, 0.02, 1), "white": (0.88, 0.88, 0.88, 1), "skin": (0.75, 0.55, 0.42, 1),
    "navy": (0.05, 0.08, 0.20, 1), "puddle": (0.08, 0.16, 0.30, 1), "door": (0.50, 0.52, 0.55, 1),
}


def material(name, rough=0.6, metallic=0.0, emission=None):
    """Create (or reuse) a simple Principled material from COLOURS[name]."""
    key = (name, rough, metallic, emission)
    if key in _materials:
        return _materials[key]
    mat = bpy.data.materials.new("SS_" + name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = COLOURS[name]
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metallic
    if emission is not None:
        for socket in ("Emission Color", "Emission"):      # name differs between Blender versions
            try:
                bsdf.inputs[socket].default_value = COLOURS[name]
                break
            except KeyError:
                continue
        try:
            bsdf.inputs["Emission Strength"].default_value = emission
        except KeyError:
            pass
    _materials[key] = mat
    return mat


def box(name, loc, size, mat, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = size
    obj.rotation_euler = rot
    obj.data.materials.append(mat)
    return obj


def cylinder(name, loc, radius, depth, mat, rot=(0.0, 0.0, 0.0)):
    bpy.ops.mesh.primitive_cylinder_add(radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def sphere(name, loc, radius, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.materials.append(mat)
    return obj


def _rotate(local, yaw):
    """Rotate a local (x, y) offset by yaw radians about the vertical axis."""
    c, s = math.cos(yaw), math.sin(yaw)
    return local[0] * c - local[1] * s, local[0] * s + local[1] * c


# ----------------------------------------------------------------------------
# The building
# ----------------------------------------------------------------------------
def build_shell():
    box("Floor", (0, 0, -0.05), (2 * HALL_X, 2 * HALL_Y, 0.1), material("concrete", rough=0.85))
    wall = material("wall", rough=0.9)
    band = material("wall_band", rough=0.8)
    t = 0.2
    box("Wall_Back", (0, HALL_Y + t / 2, HALL_H / 2), (2 * HALL_X + 2 * t, t, HALL_H), wall)
    box("Wall_Front", (0, -HALL_Y - t / 2, HALL_H / 2), (2 * HALL_X + 2 * t, t, HALL_H), wall)
    box("Wall_Left", (-HALL_X - t / 2, 0, HALL_H / 2), (t, 2 * HALL_Y, HALL_H), wall)
    box("Wall_Right", (HALL_X + t / 2, 0, HALL_H / 2), (t, 2 * HALL_Y, HALL_H), wall)
    box("Roof", (0, 0, HALL_H + t / 2), (2 * HALL_X + 2 * t, 2 * HALL_Y + 2 * t, t), material("steel", rough=0.7))
    # darker painted band along the base of every wall
    box("Band_Back", (0, HALL_Y - 0.02, 0.6), (2 * HALL_X, 0.04, 1.2), band)
    box("Band_Front", (0, -HALL_Y + 0.02, 0.6), (2 * HALL_X, 0.04, 1.2), band)
    box("Band_Left", (-HALL_X + 0.02, 0, 0.6), (0.04, 2 * HALL_Y, 1.2), band)
    box("Band_Right", (HALL_X - 0.02, 0, 0.6), (0.04, 2 * HALL_Y, 1.2), band)
    for i, x in enumerate((-12, -6, 0, 6, 12)):           # roof trusses
        box("Truss_%d" % i, (x, 0, HALL_H - 0.45), (0.3, 2 * HALL_Y, 0.4), material("steel", rough=0.6, metallic=0.6))


def build_floor_markings():
    yellow = material("yellow", rough=0.5)
    for i, x in enumerate((-3.6, -2.4)):                   # pedestrian walkway edges
        box("Walkway_Line_%d" % i, (x, 0, 0.011), (0.12, 2 * HALL_Y - 2.0, 0.02), yellow)
    for i, y in enumerate(range(-8, 9, 4)):                # cross hatching inside the walkway
        box("Walkway_Bar_%d" % i, (-3.0, y, 0.011), (1.2, 0.08, 0.02), yellow)
    box("Stop_Line", (3.0, -1.2, 0.011), (5.0, 0.15, 0.02), material("white", rough=0.5))


def build_racking_row(prefix, x_start, y_center, bays=9, bay_w=2.7, depth=1.1, seed=1):
    rng = random.Random(seed)
    blue, orange = material("blue", rough=0.4, metallic=0.3), material("orange", rough=0.4, metallic=0.3)
    wood, card_a, card_b = material("wood", rough=0.8), material("cardboard", rough=0.9), material("cardboard2", rough=0.9)
    height, levels = 6.2, (0.35, 2.35, 4.35)

    for i in range(bays + 1):
        for j, off in enumerate((-depth / 2, depth / 2)):
            box("%s_Upright_%d_%d" % (prefix, i, j), (x_start + i * bay_w, y_center + off, height / 2), (0.1, 0.1, height), blue)
    for li, z in enumerate(levels):
        for i in range(bays):
            cx = x_start + (i + 0.5) * bay_w
            for j, off in enumerate((-depth / 2, depth / 2)):
                box("%s_Beam_%d_%d_%d" % (prefix, li, i, j), (cx, y_center + off, z), (bay_w, 0.08, 0.14), orange)
            if rng.random() < 0.12:                       # an occasional empty bay looks natural
                continue
            box("%s_Pallet_%d_%d" % (prefix, li, i), (cx, y_center, z + 0.14), (1.2, 1.0, 0.14), wood)
            for k in range(rng.choice((2, 3, 4))):
                w, d, h = rng.uniform(0.45, 0.62), rng.uniform(0.4, 0.5), rng.uniform(0.35, 0.8)
                bx = cx + (k - 1.5) * 0.3
                box("%s_Box_%d_%d_%d" % (prefix, li, i, k), (bx, y_center, z + 0.21 + h / 2), (w, d, h), rng.choice((card_a, card_b)))


def build_loading_dock():
    door, bollard = material("door", rough=0.4, metallic=0.6), material("yellow", rough=0.5)
    for i, y in enumerate((-6.5, -2.0, 2.5)):
        box("Dock_Door_%d" % i, (-HALL_X + 0.1, y, 1.8), (0.15, 2.6, 3.6), door)
        box("Dock_Frame_%d" % i, (-HALL_X + 0.12, y, 3.7), (0.2, 3.0, 0.2), material("steel"))
        for j, off in enumerate((-1.7, 1.7)):
            cylinder("Bollard_%d_%d" % (i, j), (-HALL_X + 0.9, y + off, 0.5), 0.12, 1.0, bollard)


def build_forklift(prefix, loc, yaw):
    """A simple counterbalance forklift. Local +X is the front (the forks)."""
    yellow, grey, black = material("yellow", rough=0.5), material("steel", rough=0.5, metallic=0.5), material("black", rough=0.9)

    def put(name, local, size, mat):
        ox, oy = _rotate((local[0], local[1]), yaw)
        box("%s_%s" % (prefix, name), (loc[0] + ox, loc[1] + oy, local[2]), size, mat, rot=(0, 0, yaw))

    put("Body", (0.0, 0.0, 0.65), (1.8, 1.0, 0.7), yellow)
    put("Counterweight", (-0.95, 0.0, 0.7), (0.6, 1.0, 0.8), grey)
    put("Mast_L", (1.15, 0.35, 1.2), (0.1, 0.1, 2.2), grey)
    put("Mast_R", (1.15, -0.35, 1.2), (0.1, 0.1, 2.2), grey)
    put("Fork_L", (1.7, 0.3, 0.1), (1.1, 0.12, 0.06), grey)
    put("Fork_R", (1.7, -0.3, 0.1), (1.1, 0.12, 0.06), grey)
    put("CabRoof", (-0.1, 0.0, 2.15), (1.0, 0.9, 0.05), grey)
    for i, (px, py) in enumerate(((0.35, 0.4), (0.35, -0.4), (-0.55, 0.4), (-0.55, -0.4))):
        put("CabPost_%d" % i, (px, py, 1.6), (0.06, 0.06, 1.1), grey)
    put("Seat", (-0.2, 0.0, 1.15), (0.4, 0.4, 0.15), black)
    for i, (px, py) in enumerate(((0.6, 0.55), (0.6, -0.55), (-0.6, 0.55), (-0.6, -0.55))):
        ox, oy = _rotate((px, py), yaw)
        cylinder("%s_Wheel_%d" % (prefix, i), (loc[0] + ox, loc[1] + oy, 0.3), 0.3, 0.22, black, rot=(math.pi / 2, 0, yaw))
    ox, oy = _rotate((-0.1, 0.0), yaw)
    sphere("%s_Beacon" % prefix, (loc[0] + ox, loc[1] + oy, 2.25), 0.08, material("orange", rough=0.3, emission=8.0))


def build_person(prefix, loc):
    navy, vest, skin, helmet = material("navy"), material("orange", rough=0.6), material("skin"), material("yellow", rough=0.4)
    for i, off in enumerate((-0.1, 0.1)):
        cylinder("%s_Leg_%d" % (prefix, i), (loc[0] + off, loc[1], 0.425), 0.09, 0.85, navy)
    box("%s_Torso" % prefix, (loc[0], loc[1], 1.15), (0.4, 0.22, 0.6), vest)
    for i, off in enumerate((-0.27, 0.27)):
        box("%s_Arm_%d" % (prefix, i), (loc[0] + off, loc[1], 1.12), (0.1, 0.12, 0.55), vest)
    sphere("%s_Head" % prefix, (loc[0], loc[1], 1.58), 0.12, skin)
    sphere("%s_Helmet" % prefix, (loc[0], loc[1], 1.65), 0.135, helmet)


def build_hazards():
    wood, card_a, card_b = material("wood", rough=0.8), material("cardboard", rough=0.9), material("cardboard2", rough=0.9)

    # 1. Unmarked obstruction: a pallet and boxes left inside the pedestrian walkway
    box("Hazard1_Pallet", (-3.0, 4.0, 0.07), (1.2, 1.0, 0.14), wood)
    for k, (dx, dz) in enumerate(((-0.25, 0.0), (0.25, 0.0), (0.0, 0.42))):
        box("Hazard1_Box_%d" % k, (-3.0 + dx, 4.0, 0.14 + 0.2 + dz), (0.5, 0.5, 0.4), card_a if k % 2 == 0 else card_b)

    # 2. Racking overload: boxes stacked above the beam and overhanging into the aisle
    cx = -13.5 + (4 + 0.5) * 2.7
    for k in range(3):
        box("Hazard2_Stack_%d" % k, (cx, 7.2, 4.35 + 0.6 + k * 0.55), (0.6, 0.5, 0.5), card_a)
    box("Hazard2_Overhang", (cx + 0.5, 6.55, 4.35 + 0.45), (0.7, 0.55, 0.5), card_b, rot=(0.0, 0.0, 0.35))

    # 3. Forklift working right next to a pedestrian
    build_forklift("Forklift", (3.0, 3.0), math.pi)       # driving towards -X, towards the person
    build_person("Pedestrian", (1.3, 3.2, 0.0))

    # 4. Emergency exit blocked by stacked boxes
    box("Exit_Door", (HALL_X - 0.08, 2.0, 1.1), (0.1, 1.3, 2.2), material("green", rough=0.5))
    box("Exit_Sign", (HALL_X - 0.12, 2.0, 2.6), (0.05, 0.9, 0.28), material("green", rough=0.3, emission=10.0))
    box("Exit_Pallet", (HALL_X - 1.0, 2.0, 0.07), (1.2, 1.4, 0.14), wood)
    # three boxes across the whole width of the door, two more stacked on top
    for k, (by, bz) in enumerate(((1.55, 0.39), (2.05, 0.39), (2.55, 0.39), (1.8, 0.89), (2.3, 0.89))):
        box("Exit_Block_%d" % k, (HALL_X - 1.0, by, bz), (0.7, 0.6, 0.5), card_a if k % 2 else card_b)

    # 5. Unsigned liquid spill on the floor
    cylinder("Hazard5_Spill", (4.5, -4.5, 0.012), 0.9, 0.02, material("puddle", rough=0.03))


def build_lights():
    for ix, x in enumerate((-10, -5, 0, 5, 10)):
        for iy, y in enumerate((-6, 0, 6)):
            light = bpy.data.lights.new("Ceiling_%d_%d" % (ix, iy), type="AREA")
            light.energy = LIGHT_ENERGY
            light.size = 3.0
            light.shape = "RECTANGLE"
            light.size_y = 1.0
            obj = bpy.data.objects.new("Ceiling_%d_%d" % (ix, iy), light)
            obj.location = (x, y, HALL_H - 0.7)
            bpy.context.scene.collection.objects.link(obj)


def build_debug_markers():
    mag = material("red", rough=0.3, emission=20.0)
    for i, m in enumerate(TOUR_MARKERS):
        sphere("Marker_%d" % i, m["pos"], 0.25, mag)


# ----------------------------------------------------------------------------
# Camera, render, export
# ----------------------------------------------------------------------------
def setup_camera():
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("PanoCamera")
    cam_data.type = "PANO"
    try:
        cam_data.panorama_type = "EQUIRECTANGULAR"           # Blender 4.x
    except AttributeError:
        cam_data.cycles.panorama_type = "EQUIRECTANGULAR"    # Blender 3.x
    cam = bpy.data.objects.new("PanoCamera", cam_data)
    scene.collection.objects.link(cam)
    cam.location = CAMERA_POS
    cam.rotation_euler = (math.pi / 2, 0.0, 0.0)              # a camera turned 90 degrees about X looks along +Y
    scene.camera = cam


def setup_render(width, height, samples):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = samples
    try:
        scene.cycles.use_denoising = True
    except AttributeError:
        pass
    scene.render.resolution_x = width
    scene.render.resolution_y = height
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    try:
        scene.view_settings.view_transform = "Standard"
    except TypeError:
        pass
    world = bpy.data.worlds.new("SafeStackWorld")
    world.use_nodes = True
    background = world.node_tree.nodes["Background"]
    background.inputs[0].default_value = (0.6, 0.65, 0.7, 1.0)
    background.inputs[1].default_value = 0.3
    scene.world = world


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.meshes):
        if block.users == 0:
            bpy.data.meshes.remove(block)


def main():
    sql = tour_markers_sql()
    if bpy is None:
        print("Blender (bpy) is not available here - printing the tour marker SQL only.\n")
        print(sql)
        return

    width, height, samples = QUALITY_PRESETS[QUALITY]
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    panorama_path = os.path.join(OUTPUT_DIR, PANORAMA_NAME)
    glb_path = os.path.join(OUTPUT_DIR, GLB_NAME)
    sql_path = os.path.join(OUTPUT_DIR, SQL_NAME)

    print("SafeStack: building the warehouse ...")
    clear_scene()
    build_shell()
    build_floor_markings()
    build_racking_row("RackA", -13.5, 7.2, seed=1)
    build_racking_row("RackB", -13.5, -7.2, seed=2)
    build_loading_dock()
    build_hazards()
    build_lights()
    if SHOW_DEBUG_MARKERS:
        build_debug_markers()
    setup_camera()
    setup_render(width, height, samples)

    with open(sql_path, "w", encoding="utf-8") as handle:
        handle.write(sql)
    print("SafeStack: wrote", sql_path)

    print("SafeStack: rendering %dx%d at %d samples (%s) - please wait ..." % (width, height, samples, QUALITY))
    bpy.context.scene.render.filepath = panorama_path
    bpy.ops.render.render(write_still=True)
    print("SafeStack: panorama saved to", panorama_path)

    try:
        bpy.ops.export_scene.gltf(filepath=glb_path, export_format="GLB")
        print("SafeStack: 3D model saved to", glb_path)
    except Exception as error:  # the glTF add-on can be switched off in Preferences
        print("SafeStack: could not export the .glb (%s). Enable Edit > Preferences > Add-ons > glTF 2.0." % error)

    print("\nDONE. Next steps:")
    print("  1. Copy %s to frontend/public/assets/photos/" % PANORAMA_NAME)
    print("  2. Run %s in pgAdmin to place the tour markers" % SQL_NAME)
    print("  3. Point backend/routes/tourRoutes.js at /assets/photos/%s" % PANORAMA_NAME)


if __name__ == "__main__":
    main()