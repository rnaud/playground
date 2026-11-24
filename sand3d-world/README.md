# A world from code

A house, its furniture and the land around it, walkable in first person. All 100 objects
are [Sand3D](https://sandflow.ai/sand3d/) programs: Python source that is run in the
browser and meshed live. No 3D model files are shipped.

- `data/world.json` holds the 100 programs with their attributions (CC BY 4.0, Sandflow):
  46 household pieces and 6 jointed ones from the objaverse, SimReady and articraft sets,
  and 48 plants, trees, rocks and garden pieces from the Nature set. Each entry also says
  how big the object should stand, and which parts to leave out (most Nature objects
  come on their own patch of soil or snow).
- `worker.js` runs the programs in a Web Worker with Pyodide and the port in
  `../sand3d-live/sand3d.py`, so walking stays smooth while the world builds.
- `world.js` meshes each result with `../sand3d-live/build.js`, merges it into a few
  vertex-coloured meshes, places it by `layout.js`, and handles walking, collisions,
  naming what you look at, and opening jointed objects.
- `layout.js` is the floor plan and the scatter rules.

The first visit builds for about half a minute (about 25 s of Python on the machine it
was made on); each program's result is then kept in IndexedDB, so later visits skip
Python entirely. The house shell, terrain and pond are made by `world.js`, not by Sand3D.

Jointed objects open with E: the cabinet, the chest of drawers, the dryer, the garden
gate; the ceiling fan and the wind turbine spin.

Not done: touch controls, a roof you can see from inside the attic, doors in the door
frames, and a frame-rate check on modest hardware (the scene is about 2.8 M triangles).
