# Sand3D, built live

A spike: can [Sand3D](https://sandflow.ai/sand3d/) programs be built in the browser at
runtime, instead of shipping the meshes?

- `sand3d.py` is a port of the [sand3d](https://github.com/Sandflow-ai/sand3d) vocabulary
  (Apache-2.0) with no Blender behind it. It runs under Pyodide, keeps the original's
  placement, frame and joint rules, and describes each solid as an extruded outline or a
  stack of rings.
- `build.js` turns that description into three.js meshes, resolves cuts with
  three-bvh-csg, and hangs jointed parts on the parts their joints were read on.
- `app.js` is the viewer: it builds all 100 programs on load and reports what ran.
- `data/programs.json` holds 100 programs sampled at random from the train split of
  [Sandflow/sand3d-articraft](https://huggingface.co/datasets/Sandflow/sand3d-articraft),
  with each one's attribution; `data/renders/` holds the dataset's reference renders,
  shrunk. Programs and renders are CC BY 4.0, Sandflow.

## What is ported

Profiles (`rect`, `circle`, `ellipse`, `slot`, `polygon`, `poly` with arcs, fillets and
chamfers, `spline`, `superellipse`, `station`, `stroke`), solids (`extrude`, `revolve`,
`sweep`, `wire`, `loft`, `box`, `cylinder`, `tube`, `cone`, `sphere`, `wedge`, `torus`,
`dome`, `helix`, `spiral`), placement (`at`, `transform`, `local`, `bbox`, `face` by
direction, `grid`, `ring`, `along`, `Frame`), booleans (`cut`, `hole`, `pocket`,
`intersect`, `seat`), `copy`, `scale`, `material`, `joint`, `pose`, `group`, `assembly`.

Approximated, and said so in the viewer: `join` and `merge` overlay their pieces without
fusing them; `fillet`, `chamfer`, `soften`, `shell`, `displace`, `bend`, `twist`, `taper`,
`dent` and `lay` leave the solid as built; `gear`, `knurl` and `thread` are plain cylinders.

Not ported (the program fails with `NotPorted`): `hull`, `field`, `fill`, `body`, `noise`,
`waves`, `scatter`, `snap`, `vary`, `tufts`, `branches`, `phyllotaxis`, `split`, `wrap`,
`text`, `ob.edge`, `extrude(until=)`. Most of the Nature dataset needs these.

Known gap: `bbox` and `face` read a part's box before its cuts, so a frame read on a part
after a cut that shortens it lands on the uncut box.
