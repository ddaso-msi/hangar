"""
Make a .blend safe to hand to strangers.

    Blender --background --factory-startup --python package_scene.py -- <src.blend> <out.blend>

The baked scenes reference their textures by absolute path on the machine that
built them. For anyone else every material opens magenta -- and the path leaks
the builder's username and folder layout. This opens the scene, makes every path
relative, packs the images into the file so it is self-contained, and writes a
new file. The source file is never written.

The new file is written with bpy.data.libraries.write, not save_as_mainfile.
save_as_mainfile always includes window-manager and screen state, and that
carries the file browser's directory -- the builder's home folder -- into every
file. libraries.write takes only the scenes and what they reference, so it also
sheds the orphaned pre-bake materials and unused maps the build leaves behind.

--factory-startup matters: it keeps user add-ons (such as the bridge, which
opens a socket on every launch) from loading during packaging.
"""
import sys
import bpy

argv = sys.argv[sys.argv.index("--") + 1:]
src, out = argv[0], argv[1]

bpy.ops.wm.open_mainfile(filepath=src, load_ui=False)

bpy.ops.file.make_paths_relative()
images = [i for i in bpy.data.images if i.source == "FILE"]
bpy.ops.file.pack_all()

# Once packed, a path is only a label -- but Blender 4 stores it twice: on the
# image, and again on each of its packed_files entries, which records the
# ABSOLUTE source path at pack time. Clearing only the first still leaks. Both
# become a relative label with no directory structure.
for img in bpy.data.images:
    if img.filepath:
        img.filepath = "//textures/" + bpy.path.basename(img.filepath)
    for pf in img.packed_files:
        if pf.filepath:
            pf.filepath = "//textures/" + bpy.path.basename(pf.filepath)

for scene in bpy.data.scenes:
    scene.render.filepath = "//renders/"

for lib in bpy.data.libraries:
    lib.filepath = bpy.path.relpath(lib.filepath)

bpy.data.libraries.write(
    out,
    set(bpy.data.scenes) | set(bpy.data.texts),
    path_remap="RELATIVE_ALL",
    fake_user=True,
    compress=False,
)

# Re-open what was written and report on that, not on the session we built it from.
bpy.ops.wm.open_mainfile(filepath=out, load_ui=False)
used = len(bpy.data.images)
packed = sum(1 for i in bpy.data.images if i.packed_file)
print(f"PACKAGE_OK images={used} packed={packed} objects={len(bpy.data.objects)} out={out}")
