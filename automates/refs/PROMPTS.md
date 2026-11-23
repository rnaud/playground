# Les Automates: graphics reference prompts

Generated on Higgsfield with GPT Image 2.6 Sunburst (quality high, 2K, PNG) on 2026-11-23. Each prompt is the subject line below followed by the shared style block, except `08-hero-face.png`, which is flat pixel art and used only the palette and the "no gradients, no anti-aliasing, no text" constraints.

## Shared style block

> Chunky low-resolution voxel art, every surface built from visible cubes of equal size, as if modelled in MagicaVoxel and rendered with soft ambient occlusion and one warm key light. Paris, 1934: Art Deco geometry, brass, enamel, dark iron, cream stone. Limited palette of about 24 flat colours: brass gold #c9a23a, navy #24406e, metro blue #2f5fae, signal red #d8363e, cream #f4f1e6, limestone #b7ad92, brick #8a4032, walnut #6e4a22, iron #4a4f58, verdigris #4f8a7a, electric cyan #9fe8ff. No gradients, no smooth curves, no photographic textures, no text or logos, no watermark.

## Sheets

| File | Aspect | Subject |
| --- | --- | --- |
| `01-key-art.png` | 16:9 | First-person view down a white-tiled Paris Metro platform at night, three brass clockwork automaton soldiers in navy kepis advancing with rifles, a voxel hand holding a pistol in the lower right, enamel station signs and Art Deco posters on the walls, warm globe lamps. |
| `02-enemies.png` | 16:9 | Character line-up on a plain dark grey background, four robots shown front and side, evenly spaced, same scale: (1) slim brass automaton soldier with a navy kepi, one red eye, a glowing furnace grille in its chest, rifle; (2) verdigris-green diving-suit automaton with a brass dome helmet and twin arm guns; (3) hulking dark-iron colossus with a smokestack head, red rivets, twin guns; (4) small spherical brass flying drone with a top rotor and one red eye. Each about 9 voxels wide and 16 tall. |
| `03-metro-catacombs.png` | 16:9 | Environment sheet split in two halves. Left: Paris Metro station, white bevelled tile walls with a navy base band and a blue stripe, checkerboard grey floor, rails in a gravel trench, enamel name plate, Art Deco poster frame. Right: catacombs, limestone block walls, a wall of stacked skulls, packed-earth floor with scattered bones, a single lantern. Eye-level view, walls 24 voxels high. |
| `04-cellar-chateau.png` | 16:9 | Environment sheet split in two halves. Left: brick wine cellar with arched wine racks, oak casks, flagstone floor, hanging lamp. Right: chateau salon, walnut wainscot panelling below cream and gold diamond wallpaper, gilt-framed landscape painting, herringbone parquet, crimson carpet with a gold lattice, fluted cream columns. Eye-level view, walls 24 voxels high. |
| `05-courtyard-workshop.png` | 16:9 | Environment sheet split in two halves. Left: chateau courtyard under an evening sky, grey ashlar walls with lit shuttered windows, clipped green hedges, lawn and cobbled path. Right: the Baron's workshop, riveted dark iron plate walls, brass pipes with pressure gauges, diamond-plate floor, red fuel drums, an exit lift cage with a red lever. Eye-level view, walls 24 voxels high. |
| `06-weapons.png` | 16:9 | Four first-person weapon models on a plain dark grey background, each held by a hand with a navy sleeve, seen from behind and slightly above: a 1930s service pistol, a double-barrelled shotgun with a walnut stock, a drum-fed submachine gun, and a brass Tesla coil gun with copper rings and a glowing cyan orb at the muzzle. Each about 7 voxels wide and 18 long. |
| `07-pickups-props.png` | 16:9 | Item sheet on a plain dark grey background, evenly spaced in a grid, each object tiny (under 12 voxels on its longest side): baguette, green wine bottle with a cream label, blue-grey Adrian helmet, olive bullet box, red shotgun-shell box, navy energy-cell box with cyan glow, red key, blue key, street lamp with a glowing globe, red fuel drum with a yellow band, oak cask, small table with a candle, wooden door, iron door with a red band, iron door with a blue band. |
| `08-hero-face.png` | 1:1 | HUD portrait sheet, 3 by 2 grid of the same face in flat pixel art at 24 by 24 pixels each, enlarged: a Parisian man with a navy beret and a brown moustache, shown healthy, lightly hurt, badly hurt, grimacing in pain, grinning, and unconscious. Front view, dark brown background. |

## Flat sheets the game is built from (`src/`)

The game's voxels are sampled from a second set of sheets, generated the same way (GPT Image 2.6 Sunburst, high, 2K) but flat and straight-on so they can be read pixel for pixel. `tools/build_art.py` shrinks them to one pixel per voxel and packs them into `../art.js`; `atlas-preview.png` shows the result.

Every prompt ended with the same style line: "Chunky voxel-art style built from visible cubes of equal size, as if modelled in MagicaVoxel, soft ambient occlusion, warm even frontal light. Paris, 1934. No vignette, no text, no watermark."

| Files | Aspect | Prompt shape |
| --- | --- | --- |
| `wall-metro`, `wall-stone`, `wall-skulls`, `wall-brick`, `wall-salon`, `wall-facade`, `wall-iron` | 2:3 | "Flat orthographic front elevation of one wall section: *material*. Viewed perfectly straight-on with zero perspective. The wall fills the entire frame edge to edge, from the floor line at the bottom edge to the ceiling line at the top edge. No floor, no ceiling, no furniture, no lamps. About 32 cubes wide and 48 cubes tall. The pattern must tile seamlessly left to right." |
| `floor-metro`, `floor-rails`, `floor-earth`, `floor-flag`, `floor-parquet`, `floor-carpet`, `floor-lawn`, `floor-cobble`, `floor-plate` | 1:1 | "Seamless tileable floor texture seen from directly above (top-down orthographic, zero perspective), filling the whole frame edge to edge: *material*. No objects, no walls. About 48 cubes across. Must tile seamlessly in both directions." |
| `ceil-metro`, `ceil-salon`, `ceil-iron` | 1:1 | The same, "seen from directly below", each with one Art Deco ceiling light exactly in the centre. Stone and brick vaults reuse the wall sheets. |
| `enemies`, `weapons`, `props-tall`, `props-low`, `props-pickups` | 16:9 | "*N* objects in a single row: *numbered list*. Each object separate with clear gaps between them, on a solid flat pure magenta (#ff00ff) background with no shadows, no ground and no gradient. Front orthographic view, perfectly straight-on, zero perspective. No magenta or pink on the objects." The weapons are instead "seen from behind and slightly above exactly as the shooter sees it". |
| `decals-metro`, `decals-chateau`, `decals-workshop` | 16:9 | Three wall-mounted objects per sheet on the same magenta background: poster, station plate, sconce; painting, wine-rack arch, window; pipes and gauges, Tesla tube, workshop window. The pipeline pastes each onto its plain wall to make the wall variants. |

The order of the objects in each sheet matters: `build_art.py` splits a sheet into objects left to right and names them from its own tables.

### Added for lighting, the Metro hall and combat

| Files | Aspect | What it is |
| --- | --- | --- |
| `props-metro` | 16:9 | Five objects on magenta: hanging Art Deco ceiling lamp, station bench, brass bin, signal post, iron lantern on a chain. |
| `tunnel` | 1:1 | "Flat orthographic front elevation of the end wall of a 1930s Paris Metro station": an arched tunnel mouth in white tile, reaching down to the track bed. Two cells wide. |
| `enemies-back` | 16:9 | The four machines "each seen from directly behind". The pipeline squeezes each onto the outline of its front view. |
| `enemies-aim`, `enemies-fire` | 16:9 | The four machines "each AIMING ITS WEAPON STRAIGHT AT THE VIEWER", and the same "FIRING ... with a bright yellow-white star-shaped muzzle flash at every gun muzzle". |

Glowing pixels (lamp glass, furnace grilles, portholes, muzzle flashes) are picked out by colour in `build_art.py` and stored with alpha 200; the game leaves them out of the baked lighting and blooms them.

### Added for the new renderer's rooms and set pieces

| Files | Aspect | What it is |
| --- | --- | --- |
| `train` | 16:9 | "One single 1930s Paris Metro train carriage seen exactly from the side, a flat orthographic side elevation", on magenta. Three of them run through the station. |
| `props-rooms` | 16:9 | Four objects on magenta: hanging chandelier, stone arch rib for the catacomb tunnels, rack of three casks, workbench. |

### Added for true 3D enemies and music

| Files | Aspect | What it is |
| --- | --- | --- |
| `turn-automate`, `turn-scaphandre`, `turn-colosse` | 16:9 | "A character turnaround sheet ... Exactly three views of the SAME robot in a single row ... seen from the front, seen exactly from its left side in profile, seen from behind", all in "the same neutral A-pose", on magenta. `build_art.py` carves each into a 3D voxel volume: solid where the front and side outlines agree, coloured from the front and back views. |
| `../../music/explore.mp3`, `../../music/combat.mp3` | n/a | ElevenLabs Music v2.5 through Higgsfield's agent chat, 90 seconds each, instrumental: a slow minor-key musette waltz for exploring, and fast gypsy jazz for a fight. |

### Added for the 3D weapons

| Files | Aspect | What it is |
| --- | --- | --- |
| `guns-side` | 16:9 | Four guns "each shown exactly from the side as a flat orthographic side elevation ... every barrel pointing to the right, no hands", on magenta. `build_art.py` carves each into a 3D model with a fixed, rounded thickness (a top-view sheet was requested twice and came back as side views both times). |
| `hand` | 16:9 | "Two views of the same right forearm and hand ... seen exactly from the side ... seen exactly from directly above", fist closed, on magenta. Carved from both views. |

### Added for the two new machines

| Files | Aspect | What it is |
| --- | --- | --- |
| `turn-sauteur` | 16:9 | The same turnaround prompt as the other machines (magenta background, front, left profile and back in one row, neutral A-pose), for "Le Sauteur, a lean 1930s French art-deco clockwork fencer automaton: thin polished brass and dark green enamel body, narrow waist, long straight legs with coiled steel springs wrapped around the shins, long thin arms that end in short steel blades instead of hands, a small narrow head with a fencing-mask grille and a single glowing orange eye, a small red kepi cap". |
| `turn-garde` | 16:9 | The same again for "Le Garde, a broad heavy 1930s French art-deco clockwork riot gendarme automaton: thick navy blue enamel armour plates with brass rivets and brass trim, wide shoulders with round pauldrons, a barrel chest with a brass radiator grille, a helmet shaped like a French Adrian helmet with a narrow visor slit glowing cyan, sturdy legs with brass knee caps, heavy gauntlets", with empty hands: its shield is built in code. |

## Second set: wall fixtures and furniture (2026-11-23)

Eleven more 16:9 sheets, same model and settings, each prompt opening with "Flat solid pure magenta (#ff00ff) background filling the whole image, no shadows, no ground, no gradient. On it, *four separate wall-mounted* / *five separate free-standing* objects in a single row with clear wide gaps between them:" and closing with the front-orthographic and style lines above plus "no letters".

| File | Objects, left to right |
| --- | --- |
| `decals-metro2` | coffee poster in a brass frame, enamel network map, round brass wall clock, red fire-hose reel cabinet |
| `decals-metro3` | ticket window with a brass grille, navy enamel arrow sign, Eiffel Tower travel poster, brass and walnut telephone (its shelf comes out as a separate piece and is dropped) |
| `decals-catacombs` | memorial plaque with a cross and laurel, candle niche with a skull, iron-barred gate in an arch, shelf of bones and skulls |
| `decals-cellar` | oak barrel end with a brass tap in a stone arch, chalkboard of tally marks, hooks with rope, lantern and mallet, shelf of bottles and a demijohn |
| `decals-chateau2` | walnut bookcase, gilt mirror with a sunburst crest, marble fireplace with a mantel clock, portrait of a moustached baron with a monocle |
| `decals-courtyard` | lion-head wall fountain, ivy on a trellis, arched oak door, bust in a stone niche |
| `decals-workshop2` | train of brass gears on an iron plate, blueprint of an automaton, switchboard with knife switches and bulbs, tool rack |
| `props-metro2` | newspaper stand, stack of suitcases with a hat box, penny weighing scale, luggage trolley with a trunk, green advertising column |
| `props-under` | heap of skulls and bones, stone block with lit candles, wheelbarrow of rubble, crate of wine bottles, pile of sacks |
| `props-chateau` | crimson wingback armchair, globe on a stand, suit of armour with a halberd, grandfather clock, potted palm in a brass urn |
| `props-workshop` | Tesla coil with a cyan sphere, anvil on a stump, half-built automaton on a repair stand, stone urn of geraniums, marble statue on a pedestal |

## Third set: floors and ceilings (2026-11-23)

Four more 16:9 sheets. The floor sheets ask for "six separate flat things lying on a floor, each seen from directly above (top-down orthographic, zero perspective), arranged in two rows of three with very wide gaps"; the ceiling sheets for "five separate objects that hang from a ceiling, in a single row", front view.

| File | Objects |
| --- | --- |
| `clutter1` | newspaper sheets, iron manhole cover, brass drain grate; bones and skulls, broken bottle in spilled wine, straw |
| `clutter2` | Persian rug, round Art Deco rug, autumn leaves; oil stain with a wrench, blueprint sheets, coiled cable |
| `hang1` | station arrow sign on two chains, double-faced station clock, iron ring of candles, rail of ham, sausages and garlic, chain hoist |
| `hang2` | run of brass pipes with a valve wheel, ceiling fan, rail of automaton parts, hanging tree roots, crimson banner with a cog emblem |

| `props-centre` | ticket turnstile, octagonal ticket booth, stone sarcophagus, pedestal of stacked skulls with a cross, stone well with a bucket (five free-standing objects, front view, for the middles of the junction and the catacomb rooms) |
