#!/usr/bin/env python3
"""Turn the generated reference sheets in ../refs/src into the game's voxel art.

Every sheet is sampled down to one pixel per voxel (a quarter of a world unit) and packed into one atlas,
written to ../art.js as a data URI plus a table of rectangles. game.js then builds its voxel models from
those pixels: walls become relief panels, objects are inflated, lathed or extruded from their front views.

Run from anywhere:  python3 automates/tools/build_art.py   (needs Pillow)
"""
import base64, io, json, os, sys
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'refs', 'src')
OUT = os.path.join(HERE, '..', 'art.js')
WALL = (128, 192)        # voxels per wall cell: 16 x 24 units at 8 voxels a unit
FLOOR = 256              # one floor image covers 2 x 2 cells
K = WALL[0] // 64        # the wall object tables below are written at 4 voxels a unit

def load(name):
    p = os.path.join(SRC, name + '.png')
    if not os.path.exists(p):
        print('  missing', name, file=sys.stderr)
        return None
    return Image.open(p).convert('RGBA')

def is_bg(r, g, b):       # the flat magenta the object sheets are generated on, including its soft edges
    return r - g > 70 and b - g > 70 and abs(r - b) < 90

def key(im):              # magenta -> transparent
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if is_bg(r, g, b): px[x, y] = (0, 0, 0, 0)
    return im

def shrink(im, size):     # area-average down to voxel resolution, keeping a hard alpha edge
    pre = Image.new('RGBA', im.size)
    pre.paste(im.convert('RGB'), mask=im.getchannel('A'))            # premultiply so transparent pixels do not bleed colour
    pre.putalpha(im.getchannel('A'))
    small = pre.resize(size, Image.BOX)
    px = small.load()
    for y in range(small.height):
        for x in range(small.width):
            r, g, b, a = px[x, y]
            px[x, y] = (min(255, r * 255 // a), min(255, g * 255 // a), min(255, b * 255 // a), 255) if a >= 128 else (0, 0, 0, 0)
    return small

def components(im, expect):   # split a keyed sheet into its objects, left to right
    k = 8
    m = im.getchannel('A').resize((im.width // k, im.height // k), Image.BOX).point(lambda v: 255 if v > 40 else 0)
    w, h = m.size
    src = m.load()
    grown = [[False] * w for _ in range(h)]
    for y in range(h):
        for x in range(w):
            if src[x, y]:
                for dy in range(-1, 2):
                    for dx in range(-1, 2):
                        if 0 <= x + dx < w and 0 <= y + dy < h: grown[y + dy][x + dx] = True
    seen = [[False] * w for _ in range(h)]
    boxes = []
    for y in range(h):
        for x in range(w):
            if not grown[y][x] or seen[y][x]: continue
            stack, x0, y0, x1, y1, n = [(x, y)], x, y, x, y, 0
            seen[y][x] = True
            while stack:
                cx, cy = stack.pop(); n += 1
                x0, y0, x1, y1 = min(x0, cx), min(y0, cy), max(x1, cx), max(y1, cy)
                for nx, ny in ((cx + 1, cy), (cx - 1, cy), (cx, cy + 1), (cx, cy - 1)):
                    if 0 <= nx < w and 0 <= ny < h and grown[ny][nx] and not seen[ny][nx]:
                        seen[ny][nx] = True; stack.append((nx, ny))
            if n > 40: boxes.append((x0 * k, y0 * k, min(im.width, (x1 + 1) * k), min(im.height, (y1 + 1) * k)))
    boxes.sort(key=lambda b: b[0])
    if len(boxes) != expect: print(f'  expected {expect} objects, found {len(boxes)}: {boxes}', file=sys.stderr)
    out = []
    for b in boxes:
        c = im.crop(b); bb = c.getchannel('A').getbbox()
        out.append(c.crop(bb) if bb else c)
    return out

def flat(im, colours=40):   # a small palette, as voxel art has: it also lets the mesher merge faces
    q = im.convert('RGB').quantize(colours, method=Image.MEDIANCUT, dither=Image.NONE).convert('RGBA')
    q.putalpha(im.getchannel('A'))
    return q

def fit(im, height=None, width=None):   # scale an object to a height (or width) in voxels
    if height: size = (max(1, round(im.width * height / im.height)), height)
    else: size = (width, max(1, round(im.height * width / im.width)))
    return shrink(im, size)

# Glowing pixels (lamp glass, furnace grilles, portholes) are stored with alpha 200: the game leaves them out of
# the baked lighting and lets them bloom. Which colours glow depends on the object.
GLOW = {
    'warm': lambda r, g, b: r > 228 and g > 200 and b > 110,
    'cyan': lambda r, g, b: b > 170 and g > 165 and r < 170,
    'red': lambda r, g, b: r > 200 and g < 100 and b < 100,
    'orange': lambda r, g, b: r > 215 and 100 < g < 205 and b < 100,
    'yellow': lambda r, g, b: r > 225 and g > 185 and b < 130,
}
def glow(im, kinds):
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a and any(GLOW[k](r, g, b) for k in kinds.split()): px[x, y] = (r, g, b, 200)
    return im

art = {}
def add(name, im):
    if im is not None: art[name] = im

# ---- walls: a base per material, then variants with a framed object pasted on ----
WALLS = {'M': 'wall-metro', 'C': 'wall-stone', 'K': 'wall-skulls', 'B': 'wall-brick', 'W': 'wall-salon', 'S': 'wall-facade', 'I': 'wall-iron'}
bases = {}
for t, f in WALLS.items():
    im = load(f)
    if im: bases[t] = flat(shrink(im, WALL)); add('wall_' + t, bases[t])
# (sheet, [objects left to right]); each object: (wall type it makes, base it sits on, width in voxels, bottom edge in voxels above the floor)
DECALS = [
    ('decals-metro', [('P', 'M', 26, 24), ('N', 'M', 52, 46), ('L', 'M', 22, 44)]),
    ('decals-chateau', [('F', 'W', 50, 36), ('V', 'B', 46, 4), ('X', 'S', 56, 14)]),
    ('decals-workshop', [('G', 'I', 40, 8), ('T', 'I', 22, 20), ('Y', 'I', 40, 40)]),
]
LIT = {'L': 'warm', 'X': 'warm', 'T': 'cyan', 'Y': 'cyan'}
for sheet, objs in DECALS:
    im = load(sheet)
    if not im: continue
    for (t, base, wv, bottom), c in zip(objs, components(key(im), len(objs))):
        if base not in bases: continue
        d = fit(c, width=wv * K)
        ox, oy = (WALL[0] - d.width) // 2, max(0, WALL[1] - bottom * K - d.height)
        tile = bases[base].copy()
        tile.alpha_composite(d, (ox, oy))
        tile = flat(tile)
        if t in LIT:                                                  # mark the glow after pasting: compositing would flatten the alpha
            lit, dp, tp = glow(d.copy(), LIT[t]).load(), d.load(), tile.load()
            for y in range(d.height):
                for x in range(d.width):
                    if lit[x, y][3] == 200 and oy + y < WALL[1]: tp[ox + x, oy + y] = dp[x, y][:3] + (200,)
        add('wall_' + t, tile)
        continue
        add('wall_' + t, flat(tile))


im = load('tunnel')            # the end wall of the station, tunnel mouth included: two cells wide, and reaching down to the track bed
if im: add('tunnel', flat(shrink(im, (2 * WALL[0], WALL[1] + 40))))
im = load('wall-metro')        # a strip of plain white tiles for the vault
if im: add('vault', flat(shrink(im.crop((0, int(im.height * .10), im.width // 2, int(im.height * .10) + im.width // 4)), (64, 32)), 16))

# ---- floors and ceilings ----
for n in ['metro', 'rails', 'earth', 'flag', 'parquet', 'carpet', 'lawn', 'cobble', 'plate']:
    im = load('floor-' + n)
    if im: add('floor_' + n, flat(shrink(im, (FLOOR, FLOOR)), 48))
for n, src in [('metro', 'ceil-metro'), ('stone', 'wall-stone'), ('brick', 'wall-brick'), ('salon', 'ceil-salon'), ('iron', 'ceil-iron')]:   # rough stone and brick vaults reuse the wall sheets
    im = load(src)
    if im: add('ceil_' + n, flat(shrink(im.crop((0, 0, im.width, im.width)), (FLOOR, FLOOR)), 48))

# ---- objects: (sheet, [(name, height in voxels)]) ----
SHEETS = [
    ('enemies', [('automate', 68), ('scaphandre', 80), ('colosse', 95), ('lanterne', 30)]),
    ('weapons', [('w_pistol', 88), ('w_shotgun', 96), ('w_smg', 92), ('w_tesla', 96)]),
    ('props-tall', [('lamp', 72), ('column', 96), ('door', 96), ('door_red', 96), ('door_blue', 96)]),
    ('props-low', [('drum', 44), ('cask', 44), ('table', 34), ('crate', 36), ('exit', 80)]),
    ('props-pickups', [('baguette', 14), ('wine', 34), ('helmet', 20), ('bullets', 15), ('shells', 17), ('cells', 16), ('key_red', 16), ('key_blue', 16)]),
    ('props-metro', [('hanglamp', 30), ('bench', 20), ('bin', 18), ('signal', 44), ('lantern', 28)]),
]
SHINE = {'automate': 'red orange', 'scaphandre': 'cyan', 'colosse': 'red', 'lanterne': 'red', 'w_tesla': 'cyan', 'cells': 'cyan',
         'lamp': 'warm', 'table': 'warm', 'hanglamp': 'warm', 'lantern': 'warm yellow', 'signal': 'red'}
for sheet, objs in SHEETS:
    im = load(sheet)
    if not im: continue
    for (name, hv), c in zip(objs, components(key(im), len(objs))):
        d = fit(c, height=hv)
        add(name, glow(d, SHINE[name]) if name in SHINE else d)
for sheet, suffix, extra in [('enemies-aim', '_aim', ''), ('enemies-fire', '_fire', ' yellow warm')]:   # the same four machines with their guns levelled, and firing
    im = load(sheet)
    if not im: continue
    for name, c in zip(['automate', 'scaphandre', 'colosse', 'lanterne'], components(key(im), 4)):
        if name in art: add(name + suffix, glow(fit(c, height=art[name].height), SHINE[name] + extra))
im = load('enemies-back')      # back views, squeezed onto the outline of the matching front view
if im:
    for name, c in zip(['automate', 'scaphandre', 'colosse', 'lanterne'], components(key(im), 4)):
        if name in art: add(name + '_back', shrink(c, art[name].size))

# ---- pack: tallest first, in rows ----
ATLAS_W, x, y, row = 2048, 0, 0, 0
rects = {}
for name, im in sorted(art.items(), key=lambda kv: -kv[1].height):
    if x + im.width > ATLAS_W: x, y, row = 0, y + row + 1, 0
    rects[name] = [x, y, im.width, im.height]
    x += im.width + 1; row = max(row, im.height)
atlas = Image.new('RGBA', (ATLAS_W, y + row))
for name, (ax, ay, w, h) in rects.items(): atlas.paste(art[name], (ax, ay))
buf = io.BytesIO(); atlas.save(buf, 'PNG', optimize=True)
with open(OUT, 'w') as f:
    f.write('// Generated by tools/build_art.py from the sheets in refs/src. Do not edit by hand.\n')
    f.write('window.ART = { rects: ' + json.dumps(rects, separators=(',', ':')) + ",\n  png: 'data:image/png;base64," + base64.b64encode(buf.getvalue()).decode() + "' };\n")
atlas.save(os.path.join(HERE, '..', 'refs', 'atlas-preview.png'))
print(f'{len(rects)} sprites, atlas {atlas.width}x{atlas.height}, {len(buf.getvalue()) // 1024} KB')
