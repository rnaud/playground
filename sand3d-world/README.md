# A world from code

A house, its furniture and the land around it, walkable in first person. All 100 objects
are [Sand3D](https://sandflow.ai/sand3d/) programs: Python source that is run in the
browser and meshed live. No 3D model files are shipped.

- `data/world.json` holds the 100 programs with their attributions (CC BY 4.0, Sandflow):
  household pieces and jointed ones from the objaverse, SimReady and articraft sets, and
  trees, shrubs, flowers, rocks and garden pieces from the Nature set. The trees, shrubs,
  rocks and most flowers are the Nature set's "realistic" style, built at a reduced level
  of detail (`lod`), about 10K to 215K triangles each. Each entry also says how big the object
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

Lighting is a sun with soft shadows, a physical sky that fills the shade (about a fifth as
strong as the sun, so shadows read), ambient occlusion and a light bloom. Indoors, each room
is lit by itself: once the house is furnished its middle is photographed all round (windows,
sunlit floor, wall colour) and that picture lights and is mirrored by everything in the room;
it is taken twice, for one more bounce. Each window and outside door also lets in a soft
light of its own size, worked out only while the walker is in the house. The floors darken
under and around the furniture, from a picture of how near each piece hangs over them. By day
the ceiling lamps only fill. The picture is developed with the AgX curve, the eye adapts
between indoors and outdoors, and a lens's corner fall-off and a fine grain are added.
Each room's ceiling
lamp casts shadows, redrawn only when something indoors changes. Household parts get their
extruded edges eased by 3.5 mm, a finish the programs do not ask for. `?quality=low` drops
the ambient occlusion, bloom and anti-aliasing.

Made by this page, not by Sand3D: the house shell, terrain, pond, grass, sky and the surface
detail.

A cold build takes about 15 seconds on the machine it was made on (Apple M5 Pro, with
Pyodide already downloaded): 43 seconds of Python shared by four workers, 3 of meshing.
Each program's result is then kept in IndexedDB, so later visits skip Python; `?fresh`
ignores that cache. The scene is about 7.3 M triangles and draws in 7 to 18 ms a frame there
at 1500 x 1125; it has not been measured on anything slower.

What keeps it quick: the scene is drawn once and ambient occlusion reads that pass's depth;
sun shadows are redrawn only when the walker moves 8 m on or something outdoors changes;
trees and rocks are separate objects, so those out of view are skipped; the crosshair is
tested against a coarse grid of each object, not its triangles; and from indoors only 40% of
the grass is drawn.

That grid (cells of 4 cm for furniture, up to 30 cm for the largest rocks) records where each
object's surfaces are. The walker is stopped by the cells an object fills between shin and
shoulder, so a tree blocks at its trunk and an umbrella at its pole, not across its whole
box; the crosshair names what its ray actually meets, and not through the walls; and a piece
set `on` another rests on the surface under it (the worktop, not the top of the tap).

Parts that a program lays flush on one another (a worktop on its carcass, tea in a cup) are
each swollen by a different hair's breadth, at most 0.4 mm, so that coplanar faces do not
flicker.

Jointed objects open with E: the cabinet, the chest of drawers, the dryer, the garden gate;
the ceiling fan and the wind turbine spin.

Several household pieces come from the Nature set, whose furniture is shown weathered and
overgrown: their lichen, moss and snow parts are left out by name, but their colours stay as
written (the bed's mattress is an olive grey).

Not done: touch controls, doors that open and close (the interior ones stand open), and
curtains, rugs or pictures, which the datasets do not offer in a clean form.
