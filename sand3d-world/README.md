# A world from code

A house, its furniture and the land around it, walkable in first person. All 100 objects
are [Sand3D](https://sandflow.ai/sand3d/) programs: Python source that is run in the
browser and meshed live. No 3D model files are shipped.

- `data/world.json` holds the 100 programs with their attributions (CC BY 4.0, Sandflow):
  household pieces and jointed ones from the objaverse, SimReady and articraft sets, and
  trees, shrubs, flowers, rocks and garden pieces from the Nature set. The trees, shrubs
  and most flowers are the Nature set's "realistic" style, built at a reduced level of
  detail (`lod`), about 15K to 215K triangles each. Each entry also says how big the object
  should stand, and which parts to leave out (many Nature objects come on their own patch
  of soil or snow).
- `worker.js` runs the programs in Web Workers (up to four) with Pyodide and the port in
  `../sand3d-live/sand3d.py`, so walking stays smooth while the world builds.
- `world.js` meshes each result with `../sand3d-live/build.js`, merges it by surface, places
  it by `layout.js`, and handles walking, collisions, naming what you look at, and opening
  jointed objects.
- `look.js` is how surfaces look. Sand3D gives each part a material kind and a flat colour,
  with no textures or UVs. This keeps each part's roughness, metal, coat and glass, and adds
  fine detail by kind (wood grain, weave, stone, bark, plaster, tiles) from noise, projected
  without UVs. A brown part that names only plastic is treated as wood.
- `grass.js` is the lawn: one patch of blades that follows the walker.
- `layout.js` is the floor plan and the scatter rules.

Lighting is a physical sky that also lights every surface, a sun with soft shadows, ambient
occlusion and a light bloom; rooms reflect a neutral room, not the sky. `?quality=low` drops
the ambient occlusion, bloom and anti-aliasing.

Made by this page, not by Sand3D: the house shell, terrain, pond, grass, sky and the surface
detail.

The first visit builds for about 20 seconds on the machine it was made on (Apple M5 Pro);
each program's result is then kept in IndexedDB, so later visits skip Python. The scene is
about 4.8 M triangles and drew in 16 to 24 ms a frame there at 1500 x 1125; it has not been
measured on anything slower.

Jointed objects open with E: the cabinet, the chest of drawers, the dryer, the garden gate;
the ceiling fan and the wind turbine spin.

Not done: touch controls, shadows from the indoor lamps, doors in the interior door frames,
realistic rocks (they need the `field` verb, which is not ported), and surface detail on the
six jointed objects.
