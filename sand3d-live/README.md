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
`sweep`, `wire`, `loft`, `hull`, `box`, `cylinder`, `tube`, `cone`, `sphere`, `wedge`,
`torus`, `dome`, `helix`, `spiral`), placement (`at` with `scale` and `anchor`,
`transform`, `local`, `bbox`, `face` by direction or end cap, `grid`, `ring`, `along`,
`phyllotaxis`, `branches`, `scatter`, `snap`, `vary`, `Frames.jitter`, `Frame`), booleans
(`cut`, `hole`, `pocket`, `intersect`, `seat`, `split`), surface verbs (`displace`,
`noise`, `waves`, `tufts`, colour functions as one colour a face), `copy`, `scale`,
`material`, `joint`, `pose`, `group`, `assembly`, `facets`.

The mesh-level verbs need numpy, which Pyodide loads on request. `noise`, `vary`,
`jitter`, `scatter`, `phyllotaxis` and `tufts` follow the original's arithmetic, so the
same seeds give the same layouts; `displace` refines to a triangle budget rather than to
the original's density, and `branches` samples its curves more coarsely.

Approximated, and said so in the viewer: `join` and `merge` overlay their pieces without
fusing them; `fillet`, `chamfer`, `soften`, `shell`, `bend`, `twist`, `taper`, `dent` and
`lay` leave the solid as built; `gear`, `knurl` and `thread` are plain cylinders; `snap`
and `scatter` read a part's surface before its cuts.

Not ported (the program fails with `NotPorted`): `field`, `fill`, `body`, `wrap`, `text`,
`ob.edge`, `extrude(until=)`.

Reach, on random samples run natively: 664 of 756 Nature programs, 824 of 840 objaverse
programs, 148 of 156 SimReady programs, 120 of 120 articraft programs. Only the articraft
set was checked against the published meshes; the others were checked by eye on
`sheet.html`, a contact sheet that builds each program beside the dataset's render
(`sheet.html?data=<json of {title, program, entry, img}>&from=0&n=30`).

Known gap: `bbox` and `face` read a part's box before its cuts, so a frame read on a part
after a cut that shortens it lands on the uncut box.
