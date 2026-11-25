"""A browser port of the sand3d vocabulary (https://github.com/Sandflow-ai/sand3d, Apache-2.0).

The real library builds meshes with Blender. This one runs the same programs under
Pyodide with no Blender: every verb keeps the placement, frame and joint rules of the
original, and records each solid as a small description (an extruded outline, or a stack
of rings) that three.js turns into triangles. Booleans are recorded as "cut this piece
with that one" and resolved in JavaScript.

Pure Python, no numpy. Verbs that are only approximated add a note to `NOTES`; verbs
that are not ported raise `NotPorted`, so a run reports exactly what it could not do.
"""
import math

__version__ = "1.7.0-live"
__all__ = []

NOTES = []          # what this run approximated, in order, without repeats
CHORD, TURN_MIN, TURN_MAX = 0.05, 24, 64
_STATE = {"facets": None, "unit": "mm", "scale": 0.001}
_UNITS = {"mm": 0.001, "cm": 0.01, "m": 1.0}
KEYS = ("x", "y", "z", "rx", "ry", "rz")


class NotPorted(NotImplementedError):
    pass


def _note(text):
    if text not in NOTES:
        NOTES.append(text)


def _unported(verb):
    def refuse(*args, **kwargs):
        raise NotPorted(f"{verb} is not ported yet")
    refuse.__name__ = verb
    return refuse


# ---------------------------------------------------------------- vectors, matrices

class Vec(tuple):
    """A point or a direction: a tuple with x, y, z and the usual arithmetic."""

    def __new__(cls, *v):
        if len(v) == 1 and not isinstance(v[0], (int, float)):
            v = tuple(v[0])
        return tuple.__new__(cls, [float(c) for c in v])

    x = property(lambda s: s[0])
    y = property(lambda s: s[1])
    z = property(lambda s: s[2])
    xy = property(lambda s: Vec(s[0], s[1]))
    xyz = property(lambda s: Vec(s[0], s[1], s[2]))
    length = property(lambda s: math.sqrt(sum(c * c for c in s)))

    # (arithmetic builds the tuple directly: these run millions of times in a tree)
    def __add__(s, o): return _vec(Vec, [a + b for a, b in zip(s, o)])
    def __radd__(s, o): return _vec(Vec, [a + b for a, b in zip(s, o)])
    def __sub__(s, o): return _vec(Vec, [a - b for a, b in zip(s, o)])
    def __rsub__(s, o): return _vec(Vec, [b - a for a, b in zip(s, o)])
    def __mul__(s, k): return _vec(Vec, [a * k for a in s])
    __rmul__ = __mul__
    def __truediv__(s, k): return _vec(Vec, [a / k for a in s])
    def __neg__(s): return _vec(Vec, [-a for a in s])
    def dot(s, o): return sum(a * b for a, b in zip(s, o))

    def cross(s, o):
        return _vec(Vec, (s[1] * o[2] - s[2] * o[1], s[2] * o[0] - s[0] * o[2], s[0] * o[1] - s[1] * o[0]))

    def normalized(s):
        n = s.length
        return Vec(s) if n < 1e-300 else s / n


_vec = tuple.__new__
I4 = (1.0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 1.0, 0, 0, 0, 0, 1.0)


def mmul(a, b):
    """Product of two affine matrices (their last rows are 0 0 0 1), written out for speed."""
    a0, a1, a2, a3, a4, a5, a6, a7, a8, a9, a10, a11 = a[:12]
    b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11 = b[:12]
    return (a0 * b0 + a1 * b4 + a2 * b8, a0 * b1 + a1 * b5 + a2 * b9, a0 * b2 + a1 * b6 + a2 * b10, a0 * b3 + a1 * b7 + a2 * b11 + a3,
            a4 * b0 + a5 * b4 + a6 * b8, a4 * b1 + a5 * b5 + a6 * b9, a4 * b2 + a5 * b6 + a6 * b10, a4 * b3 + a5 * b7 + a6 * b11 + a7,
            a8 * b0 + a9 * b4 + a10 * b8, a8 * b1 + a9 * b5 + a10 * b9, a8 * b2 + a9 * b6 + a10 * b10, a8 * b3 + a9 * b7 + a10 * b11 + a11,
            0.0, 0.0, 0.0, 1.0)


def mpoint(m, p):
    x, y, z = p[0], p[1], (p[2] if len(p) > 2 else 0.0)
    return _vec(Vec, (m[0] * x + m[1] * y + m[2] * z + m[3], m[4] * x + m[5] * y + m[6] * z + m[7],
                      m[8] * x + m[9] * y + m[10] * z + m[11]))


def mdir(m, d):
    x, y, z = d
    return _vec(Vec, (m[0] * x + m[1] * y + m[2] * z, m[4] * x + m[5] * y + m[6] * z, m[8] * x + m[9] * y + m[10] * z))


def mtrans(x=0, y=0, z=0):
    return (1.0, 0, 0, x, 0, 1.0, 0, y, 0, 0, 1.0, z, 0, 0, 0, 1.0)


def mscale(sx, sy, sz):
    return (sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1.0)


def mrot(axis, deg):
    """Rotation by the right hand about a unit axis."""
    x, y, z = Vec(axis).normalized()
    a = math.radians(deg)
    c, s, t = math.cos(a), math.sin(a), 1 - math.cos(a)
    return (t * x * x + c, t * x * y - s * z, t * x * z + s * y, 0,
            t * x * y + s * z, t * y * y + c, t * y * z - s * x, 0,
            t * x * z - s * y, t * y * z + s * x, t * z * z + c, 0, 0, 0, 0, 1.0)


def minv(m):
    """Inverse of an affine matrix (any 3x3 part, mirrors and scales included)."""
    a, b, c, d, e, f, g, h, i = m[0], m[1], m[2], m[4], m[5], m[6], m[8], m[9], m[10]
    det = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g)
    if abs(det) < 1e-300:
        raise ValueError("a placement with no volume cannot be inverted")
    r = ((e * i - f * h) / det, (c * h - b * i) / det, (b * f - c * e) / det,
         (f * g - d * i) / det, (a * i - c * g) / det, (c * d - a * f) / det,
         (d * h - e * g) / det, (b * g - a * h) / det, (a * e - b * d) / det)
    tx, ty, tz = m[3], m[7], m[11]
    return (r[0], r[1], r[2], -(r[0] * tx + r[1] * ty + r[2] * tz),
            r[3], r[4], r[5], -(r[3] * tx + r[4] * ty + r[5] * tz),
            r[6], r[7], r[8], -(r[6] * tx + r[7] * ty + r[8] * tz), 0, 0, 0, 1.0)


def _turned(v):
    """Translation, then turns about X, then Y, then Z (Blender's XYZ Euler)."""
    r = mmul(mrot((0, 0, 1), v["rz"]), mmul(mrot((0, 1, 0), v["ry"]), mrot((1, 0, 0), v["rx"])))
    return mmul(mtrans(v["x"], v["y"], v["z"]), r)


def _clean(v):
    v = Vec(v).normalized()
    return Vec(0.0 if abs(c) < 1e-6 else c for c in v).normalized()


# ---------------------------------------------------------------- resolution

def segments(r, sweep=360.0):
    r = abs(r) * _STATE["scale"] * 1000.0
    if _STATE["facets"] is not None:
        per_turn = _STATE["facets"]
    elif r <= CHORD:
        per_turn = TURN_MIN
    else:
        per_turn = min(max(math.ceil(math.pi / math.acos(1 - CHORD / r)), TURN_MIN), TURN_MAX)
    per_turn = max(4, round(per_turn * _STATE.get("detail", 1.0)))
    return max(1, math.ceil(per_turn * abs(sweep) / 360.0 - 1e-9))


class _FacetScope:
    def __init__(self, value, previous):
        self.value, self.previous = value, previous

    def __enter__(self):
        return self

    def __exit__(self, *error):
        _STATE["facets"] = self.previous
        return False

    def __int__(self):
        return int(self.value)

    def __eq__(self, other):
        return self.value == other

    __hash__ = None


def facets(n=None, smooth=None):
    if n is None:
        return "auto" if _STATE["facets"] is None else _STATE["facets"]
    previous = _STATE["facets"]
    _STATE["facets"] = None if n == "auto" else int(n)
    if smooth is not None:
        _STATE["smooth"] = bool(smooth)
    return _FacetScope(n, previous)


def detail(k=None):
    """How finely curves are cut, as a share of the original's: 1 as written, 0.4 for a lighter
    mesh (rounds get 0.4 of their segments, splines and lofts 0.4 of their steps). Not part of
    sand3d: the page asks for it, to keep heavy objects walkable."""
    if k is None:
        return _STATE.get("detail", 1.0)
    _STATE["detail"] = float(k)
    return k


def _np():
    return globals().get("np")


def _steps(n):
    return max(1, round(n * _STATE.get("detail", 1.0)))


def units(name=None):
    if name is None:
        return _STATE["unit"]
    if name not in _UNITS:
        raise ValueError(f"units: {name!r} is none of {sorted(_UNITS)}")
    _STATE["unit"], _STATE["scale"] = name, _UNITS[name]
    return name


def empty_scene():
    _STATE.update(facets=None, unit="mm", scale=0.001, smooth=False)        # (detail is the host's, and stays)
    del NOTES[:]
    _JOINTS.clear()


def fingerprint():
    return "live-port"


# ---------------------------------------------------------------- profiles and paths

class Profile:
    """Closed outlines in a plane: anticlockwise loops are material, clockwise ones holes."""

    def __init__(self, loops):
        self.loops = [[(float(p[0]), float(p[1])) for p in loop] for loop in loops]

    def __add__(self, other):
        _note("profile + profile: outlines overlaid, not fused")
        return Profile(self.loops + _flat_profile(other).loops)

    def __sub__(self, other):
        return Profile(self.loops + [list(reversed(loop)) for loop in _flat_profile(other).loops])

    def bounds(self):
        xs = [p[0] for loop in self.loops for p in loop]
        ys = [p[1] for loop in self.loops for p in loop]
        return (min(xs), min(ys)), (max(xs), max(ys))


class Placed:
    """A profile placed in space: a loft's section."""

    def __init__(self, profile, matrix):
        self.profile, self.matrix = profile, matrix

    def __sub__(self, other):
        return Placed(self.profile - _flat_profile(other), self.matrix)

    def __add__(self, other):
        return Placed(self.profile + _flat_profile(other), self.matrix)


class Path:
    def __init__(self, points, closed=False, sharp=None):
        self.points = [tuple(float(c) for c in (*p, 0.0)[:3]) for p in points]
        self.closed = closed
        self.sharp = sharp

    def __iter__(self):
        return iter(self.points)

    def __len__(self):
        return len(self.points)

    def __getitem__(self, i):
        return self.points[i]


class Arc(Path):
    def __init__(self, center, r, start, end):
        cx, cy, cz = (*center, 0.0)[:3]
        rx, ry = (r, r) if isinstance(r, (int, float)) else r
        n = segments(max(abs(rx), abs(ry)), end - start)
        pts = [(cx + rx * math.cos(math.radians(start + (end - start) * i / n)),
                cy + ry * math.sin(math.radians(start + (end - start) * i / n)), cz) for i in range(n + 1)]
        closed = abs(abs(end - start) - 360) < 1e-9
        Path.__init__(self, pts[:-1] if closed else pts, closed=closed)


class _Through:
    def __init__(self, through, to):
        self.through, self.to = through, to


class _Tangent:
    def __init__(self, to):
        self.to = to


def _area(loop):
    return sum(a[0] * b[1] - b[0] * a[1] for a, b in zip(loop, loop[1:] + loop[:1])) / 2


def _flat_profile(p):
    """A profile, a placed one (moved within its plane) or a list of points, as a Profile."""
    if isinstance(p, Profile):
        return p
    if isinstance(p, Placed):
        m = p.matrix
        return Profile([[tuple(mpoint(m, (x, y, 0)))[:2] for x, y in loop] for loop in p.profile.loops])
    return poly(p)


def _as_path(path):
    if isinstance(path, Path):
        return path
    if isinstance(path, (Profile, Placed)):
        m = path.matrix if isinstance(path, Placed) else I4
        prof = path.profile if isinstance(path, Placed) else path
        return Path([mpoint(m, (x, y, 0)) for x, y in prof.loops[0]], closed=True)
    return Path(path)


def circle(d):
    return ellipse(d, d)


def ellipse(w, d):
    return Profile([[p[:2] for p in Arc((0, 0), (w / 2, d / 2), 0, 360).points]])


def rect(w, d, r=0, chamfer=0):
    return poly([(-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)], r, chamfer)


def slot(l, d):
    if l <= d:
        return circle(d)
    c = (l - d) / 2
    return poly([arc((c, 0), d / 2, -90, 90), arc((-c, 0), d / 2, 90, 270)])


def polygon(n, d):
    return poly([(d / 2 * math.cos(2 * math.pi * k / n), d / 2 * math.sin(2 * math.pi * k / n)) for k in range(n)])


def superellipse(w, d, n=2, taper=0):
    if w == 0 and d == 0:
        return Profile([[(0, 0)]])
    sides = segments(max(w, d) / 2) if _STATE["facets"] is not None else max(8, _steps(48))
    if _np() is not None and d:                           # the same construction, on arrays
        np_ = _np()
        t = np_.arange(257) * (2 * math.pi / 256)
        c, s_ = np_.cos(t), np_.sin(t)
        px = w / 2 * np_.copysign(np_.abs(c) ** (2 / n), c)
        py = d / 2 * np_.copysign(np_.abs(s_) ** (2 / n), s_)
        px[256], py[256] = px[0], py[0]
        lengths_ = np_.concatenate(([0.0], np_.cumsum(np_.hypot(np_.diff(px), np_.diff(py)))))
        target = lengths_[-1] * np_.arange(sides) / sides
        u, v = np_.interp(target, lengths_, px), np_.interp(target, lengths_, py)
        return Profile([list(zip((u * (1 - taper * 2 * v / d)).tolist(), v.tolist()))])
    dense = []
    for k in range(256):
        t = 2 * math.pi * k / 256
        c, s = math.cos(t), math.sin(t)
        dense.append((w / 2 * math.copysign(abs(c) ** (2 / n), c), d / 2 * math.copysign(abs(s) ** (2 / n), s)))
    lengths = [0.0]
    for a, b in zip(dense, dense[1:] + dense[:1]):
        lengths.append(lengths[-1] + math.dist(a, b))
    pts, j = [], 0
    for k in range(sides):
        target = lengths[-1] * k / sides
        while lengths[j + 1] < target:
            j += 1
        f = (target - lengths[j]) / max(lengths[j + 1] - lengths[j], 1e-12)
        a, b = dense[j], dense[(j + 1) % 256]
        u, v = a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1])
        pts.append((u * (1 - taper * 2 * v / d) if d else u, v))
    return Profile([pts])


def station(z, w, d, x=0, y=0, n=2, taper=0):
    return at(superellipse(w, d, n=n, taper=taper), x=x, y=y, z=z)


def arc(center=(0, 0), r=1, start=0, end=360, *, through=None, to=None):
    if through is not None or to is not None:
        return _Through(through, to)
    return Arc(center, r, start, end)


def tangent_arc(to):
    return _Tangent(to)


def _centripetal(pts, closed, steps=12, tangents=(None, None)):
    """Centripetal Catmull-Rom through pts, `steps` pieces per span."""
    m = len(pts)
    if m < 2:
        raise ValueError("a spline needs two points")
    dim = len(pts[0])
    vs = [Vec((*p, 0.0)[:3]) for p in pts]

    def phantom(end, inner, tangent):
        if tangent is None:
            return end * 2 - inner
        chord = end - inner
        t = Vec((*map(float, tangent), 0.0)[:3]).normalized()
        return end + t * (2 * chord.dot(t)) - chord
    if closed:
        ext = [vs[-1]] + vs + vs[:2]
    else:
        start, end = tangents
        back = None if start is None else [-float(c) for c in start]
        ext = [phantom(vs[0], vs[1], back)] + vs + [phantom(vs[-1], vs[-2], end)]
    out = []
    steps = max(2, _steps(steps))
    for i in range(m if closed else m - 1):
        p0, p1, p2, p3 = ext[i:i + 4]
        t0 = 0.0
        t1 = t0 + max((p1 - p0).length, 1e-9) ** 0.5
        t2 = t1 + max((p2 - p1).length, 1e-9) ** 0.5
        t3 = t2 + max((p3 - p2).length, 1e-9) ** 0.5
        for k in range(steps):
            t = t1 + (t2 - t1) * k / steps
            a1 = p0 * ((t1 - t) / (t1 - t0)) + p1 * ((t - t0) / (t1 - t0))
            a2 = p1 * ((t2 - t) / (t2 - t1)) + p2 * ((t - t1) / (t2 - t1))
            a3 = p2 * ((t3 - t) / (t3 - t2)) + p3 * ((t - t2) / (t3 - t2))
            b1 = a1 * ((t2 - t) / (t2 - t0)) + a2 * ((t - t0) / (t2 - t0))
            b2 = a2 * ((t3 - t) / (t3 - t1)) + a3 * ((t - t1) / (t3 - t1))
            out.append(tuple(b1 * ((t2 - t) / (t2 - t1)) + b2 * ((t - t1) / (t2 - t1)))[:dim])
    if not closed:
        out.append(tuple(vs[-1])[:dim])
    return out


def spline(pts, closed=False, tangents=None, loop=False):
    pts = [tuple(map(float, p)) for p in pts]
    if loop:
        return Path(_centripetal(pts, True), closed=True)
    start, end = tangents if tangents is not None else (None, None)
    dense = _centripetal(pts, closed, tangents=(start, end))
    if closed:
        return Profile([_tidy([p[:2] for p in dense])])
    return Path(dense)


def _tidy(pts):
    """Drop repeated points, and turn the loop anticlockwise."""
    out = []
    for p in pts:
        if not out or math.dist(out[-1], p) > 1e-9:
            out.append((float(p[0]), float(p[1])))
    if len(out) > 1 and math.dist(out[0], out[-1]) <= 1e-9:
        out.pop()
    if _area(out) < 0:
        out.reverse()
    return out


def _circle_through(a, b, c):
    (ax, ay), (bx, by), (cx, cy) = a, b, c
    d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by))
    if abs(d) < 1e-12:
        return None
    ux = ((ax * ax + ay * ay) * (by - cy) + (bx * bx + by * by) * (cy - ay) + (cx * cx + cy * cy) * (ay - by)) / d
    uy = ((ax * ax + ay * ay) * (cx - bx) + (bx * bx + by * by) * (ax - cx) + (cx * cx + cy * cy) * (bx - ax)) / d
    return ux, uy


def _arc_run(center, p0, p1, ccw):
    r = math.dist(center, p0)
    a0 = math.atan2(p0[1] - center[1], p0[0] - center[0])
    a1 = math.atan2(p1[1] - center[1], p1[0] - center[0])
    if ccw and a1 <= a0:
        a1 += 2 * math.pi
    if not ccw and a1 >= a0:
        a1 -= 2 * math.pi
    n = segments(r, math.degrees(a1 - a0))
    return [(center[0] + r * math.cos(a0 + (a1 - a0) * k / n), center[1] + r * math.sin(a0 + (a1 - a0) * k / n))
            for k in range(1, n + 1)]


def poly(pts, fillet=0, chamfer=0):
    """Outline through points, arcs, splines; corners between two straight lines rounded or cut."""
    if isinstance(pts, (Profile, Placed)):
        return _flat_profile(pts)
    out, corner = [], []          # points, and whether each is a corner written as a point
    for q in pts:
        if isinstance(q, Path):
            run = [p[:2] for p in q.points]
            if out and math.dist(out[-1], run[0]) < 1e-9:
                corner[-1] = False
                run = run[1:]
            out += run
            corner += [False] * len(run)
        elif isinstance(q, _Through):
            c = _circle_through(out[-1], q.through, q.to)
            if c is None:
                run = [tuple(q.to)]
            else:
                a, b, e = out[-1], q.through, q.to
                ccw = (b[0] - a[0]) * (e[1] - a[1]) - (b[1] - a[1]) * (e[0] - a[0]) > 0
                run = _arc_run(c, a, tuple(q.to), ccw)
            corner[-1] = False
            out += run
            corner += [False] * len(run)
        elif isinstance(q, _Tangent):
            a, to = out[-1], tuple(q.to)
            prev = out[-2] if len(out) > 1 else (a[0] - 1, a[1])
            t = Vec(a[0] - prev[0], a[1] - prev[1]).normalized()
            n = Vec(-t[1], t[0])
            chord = Vec(to[0] - a[0], to[1] - a[1])
            k = chord.dot(n)
            if abs(k) < 1e-12:
                run = [to]
            else:
                rad = chord.dot(chord) / (2 * k)
                run = _arc_run((a[0] + n[0] * rad, a[1] + n[1] * rad), a, to, rad > 0)
            corner[-1] = False
            out += run
            corner += [False] * len(run)
        else:
            p = (float(q[0]), float(q[1]))
            if out and math.dist(out[-1], p) < 1e-9:
                continue
            out.append(p)
            corner.append(True)
    if len(out) > 1 and math.dist(out[0], out[-1]) < 1e-9:
        out.pop()
        corner[0] = corner[0] and corner.pop()
    if fillet or chamfer:
        out = _corners(out, corner, fillet, chamfer)
    return Profile([_tidy(out)])


def _corners(pts, corner, fillet, chamfer):
    m = len(pts)

    def amount(value, i):
        return (value[i] if i < len(value) else 0) if isinstance(value, (list, tuple)) else value
    out = []
    for i, p in enumerate(pts):
        r, c = amount(fillet, i), amount(chamfer, i)
        a, b = pts[i - 1], pts[(i + 1) % m]
        straight = corner[i] and corner[i - 1] and corner[(i + 1) % m]
        if not ((r or c) and (straight or (corner[i] and m <= 4))):
            out.append(p)
            continue
        d0, d1 = Vec(a[0] - p[0], a[1] - p[1]), Vec(b[0] - p[0], b[1] - p[1])
        l0, l1 = d0.length, d1.length
        if l0 < 1e-9 or l1 < 1e-9:
            out.append(p)
            continue
        u0, u1 = d0 / l0, d1 / l1
        half = math.acos(max(-1.0, min(1.0, u0.dot(u1)))) / 2
        if half < 1e-6 or abs(half - math.pi / 2) < 1e-6:
            out.append(p)
            continue
        if c and not r:
            back = min(c, l0 / 2, l1 / 2)
            out += [(p[0] + u0[0] * back, p[1] + u0[1] * back), (p[0] + u1[0] * back, p[1] + u1[1] * back)]
            continue
        back = min(r / math.tan(half), l0 / 2, l1 / 2)
        rad = back * math.tan(half)
        start = (p[0] + u0[0] * back, p[1] + u0[1] * back)
        end = (p[0] + u1[0] * back, p[1] + u1[1] * back)
        bis = (u0 + u1).normalized()
        centre = (p[0] + bis[0] * rad / math.sin(half), p[1] + bis[1] * rad / math.sin(half))
        ccw = u0[0] * u1[1] - u0[1] * u1[0] < 0
        out += [start] + _arc_run(centre, start, end, ccw)
    return out


def offset(p, t):
    _note("offset: outline scaled about its centre instead of offset")
    p = _flat_profile(p)
    (x0, y0), (x1, y1) = p.bounds()
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    sx = (x1 - x0 + 2 * t) / max(x1 - x0, 1e-9)
    sy = (y1 - y0 + 2 * t) / max(y1 - y0, 1e-9)
    return Profile([[(cx + (x - cx) * sx, cy + (y - cy) * sy) for x, y in loop] for loop in p.loops])


def stroke(path, t):
    pts = [p[:2] for p in _as_path(path).points]
    left, right = [], []
    for i, p in enumerate(pts):
        a, b = pts[max(i - 1, 0)], pts[min(i + 1, len(pts) - 1)]
        d = Vec(b[0] - a[0], b[1] - a[1]).normalized()
        left.append((p[0] - d[1] * t / 2, p[1] + d[0] * t / 2))
        right.append((p[0] + d[1] * t / 2, p[1] - d[0] * t / 2))
    return Profile([_tidy(right + left[::-1])])


def mirror(p, flip="x"):
    p = _flat_profile(p)
    sx, sy = (-1 if "x" in flip else 1), (-1 if "y" in flip else 1)
    _note("mirror(profile): the two halves overlaid, not fused")
    return Profile(p.loops + [_tidy([(x * sx, y * sy) for x, y in loop]) for loop in p.loops])


wrap = _unported("wrap")
text = _unported("text")


# ---------------------------------------------------------------- frames

class Frame:
    part = None
    _basis = None

    def __init__(self, origin=(0, 0, 0), normal=(0, 0, 1), up=None):
        z = _clean(normal)
        if up is None:
            x = Vec(0, 0, 1).cross(z)
            x = x.normalized() if x.length > 1e-6 else Vec(1, 0, 0)
            y = z.cross(x)
        else:
            y = _clean(up)
            y = (y - z * y.dot(z)).normalized()
        self.origin, self.x, self.y, self.z = Vec(origin), y.cross(z), y, z

    @property
    def normal(self):
        return self.z

    @property
    def matrix(self):
        x, y, z, o = self.x, self.y, self.z, self.origin
        return (x[0], y[0], z[0], o[0], x[1], y[1], z[1], o[1], x[2], y[2], z[2], o[2], 0, 0, 0, 1.0)

    def _read_on(self, part, basis):
        self.part, self._basis = part, basis
        return self

    def _kept(self, frame):
        return frame._read_on(self.part, self._basis) if self.part is not None else frame

    def _in_part(self):
        return mmul(minv(self._basis), self.matrix)

    def offset(self, d):
        return self._kept(Frame(self.origin + self.z * d, self.z, self.y))

    def turn(self, rx=0, ry=0, rz=0):
        m = mmul(self.matrix, _turned(dict(x=0, y=0, z=0, rx=rx, ry=ry, rz=rz)))
        return self._kept(Frame(self.origin, (m[2], m[6], m[10]), (m[1], m[5], m[9])))

    def move(self, x=0, y=0, z=0):
        return self._kept(Frame(self.point(x, y, z), self.z, self.y))

    def point(self, x=0, y=0, z=0):
        return self.origin + self.x * x + self.y * y + self.z * z

    def __repr__(self):
        return f"Frame(origin={tuple(self.origin)}, normal={tuple(self.z)}, up={tuple(self.y)})"


class Frames(list):
    def offset(self, d):
        return Frames(f.offset(d) for f in self)

    def turn(self, rx=0, ry=0, rz=0):
        return Frames(f.turn(rx, ry, rz) for f in self)

    def move(self, x=0, y=0, z=0):
        return Frames(f.move(x, y, z) for f in self)

    def __getitem__(self, i):
        got = list.__getitem__(self, i)
        return Frames(got) if isinstance(i, slice) else got

    def __add__(self, other):
        return Frames(list(self) + list(other))



def _frame_of(m):
    return Frame((m[3], m[7], m[11]), (m[2], m[6], m[10]), (m[1], m[5], m[9]))


# ---------------------------------------------------------------- the scene tree

class Piece:
    """One solid as built: what it is, where it sits in its part, and what was cut from it."""

    def __init__(self, geom, matrix=I4):
        self.geom, self.m, self.cuts, self.keeps = geom, matrix, [], []

    def points(self):
        g = self.geom
        if g["t"] == "mesh":
            pts = [tuple(p) for p in g["v"]]
        elif g["t"] == "extrude":
            pts = [(x, y, z) for loop in g["loops"] for x, y in loop for z in (g["lo"], g["hi"])]
        else:
            pts = [p for ring in g["rings"] for p in ring]
        return [mpoint(self.m, p) for p in pts]

    def copy(self):
        twin = Piece(self.geom, self.m)
        twin.cuts, twin.keeps = list(self.cuts), list(self.keeps)
        return twin


class Node:
    """A part (it holds pieces) or a group (it holds children), placed in its parent."""

    def __init__(self, name, pieces=None):
        self.name = str(name)
        self.parent, self.children = None, []
        self.basis = I4
        self.pieces = pieces
        self.look = None
        self.joints, self.jparent = [], None
        self.place = None
        self.gone = False

    def face(self, which):
        return _face(self, which)

    def edge(self, which):
        raise NotPorted("ob.edge is not ported yet")

    def _refuse(self, *a, **k):
        raise TypeError(f"{self.name!r} is a solid: it moves with s3d.transform or s3d.at")

    move = turn = offset = _refuse

    def __repr__(self):
        return f"<{'part' if self.pieces is not None else 'group'} {self.name!r}>"


class Handle:
    def __init__(self, root, **anchors):
        self.root = root
        self.__dict__.update({k: _read_on_root(v, root) for k, v in anchors.items()})

    @property
    def name(self):
        return self.root.name


def _read_on_root(anchor, root):
    if isinstance(anchor, Frame) and anchor.part is None:
        return Frame(anchor.origin, anchor.z, anchor.y)._read_on(root, I4)
    if isinstance(anchor, (list, tuple)) and anchor and all(isinstance(f, Frame) for f in anchor):
        return Frames(_read_on_root(f, root) for f in anchor)
    return anchor


def _root(ob):
    return ob.root if isinstance(ob, Handle) else ob


def _is_ob(ob):
    return isinstance(ob, (Node, Handle))


def _flat(items):
    out = []
    for i in items:
        if isinstance(i, (list, tuple)):
            out += _flat(i)
        elif i is not None:
            out.append(_root(i))
    return out


def _world(node):
    m = node.basis
    while node.parent is not None:
        node = node.parent
        m = mmul(node.basis, m)
    return m


def _set_parent(child, parent):
    if child.parent is not None:
        child.parent.children.remove(child)
    child.parent = parent
    if parent is not None:
        parent.children.append(child)


def _walk(node, m=I4):
    """Every part under `node` with its placement in `node`'s own space."""
    if node.pieces is not None:
        yield node, m
    for c in node.children:
        yield from _walk(c, mmul(m, c.basis))


def _points(node, m):
    return [mpoint(m, p) for part, pm in _walk(node, m) for piece in part.pieces for p in piece.points()]


def _box(pts):
    if not pts:
        return Vec(0, 0, 0), Vec(0, 0, 0)
    return (Vec(min(p[k] for p in pts) for k in range(3)), Vec(max(p[k] for p in pts) for k in range(3)))


def group(name, *children):
    root = Node(name)
    for child in _flat(children):
        _set_parent(child, root)
    return root


def assembly(name, *children, **anchors):
    return Handle(group(name, *children), **anchors)


def attach(handle, name, *children):
    detail = group(name, *children)
    _set_parent(detail, _root(handle))
    return detail


def delete(ob):
    for o in _flat([ob]):
        _set_parent(o, None)
        o.gone = True


def _solid(name, geom, matrix=I4):
    geom.setdefault("flat", _STATE["facets"] is not None and not _STATE.get("smooth"))
    node = Node(name, [Piece(geom)])
    node.basis = matrix
    return node


# ---------------------------------------------------------------- reading frames on parts

_SIDE_WORDS = {"top": "+z", "bottom": "-z", "left": "-x", "right": "+x", "front": "-y", "back": "+y"}


def _sides(which, what):
    text_, terms, i = str(which).strip().lower(), [], 0
    while i < len(text_):
        sign = 1
        if text_[i] in "+-<>":
            sign = -1 if text_[i] in "-<" else 1
            i += 1
        if i >= len(text_) or text_[i] not in "xyz":
            raise ValueError(f"{what}: {which!r} names no side of a box")
        terms.append(("xyz".index(text_[i]), sign))
        i += 1
    if not terms or len({a for a, _ in terms}) < len(terms):
        raise ValueError(f"{what}: {which!r} names no side of a box")
    return terms


def bbox(ob, which):
    root = _root(ob)
    sides = _sides(which, "bbox")
    pts = _points(root, root.basis)
    if not pts:
        raise ValueError(f"bbox: {root.name!r} holds no solid: it has no box")
    lo, hi = _box(pts)
    origin = [(lo[k] + hi[k]) / 2 for k in range(3)]
    for axis, sign in sides:
        origin[axis] = hi[axis] if sign > 0 else lo[axis]
    normal = [0.0, 0.0, 0.0]
    normal[sides[0][0]] = float(sides[0][1])
    return Frame(origin, normal)._read_on(root, root.basis)


def _face(ob, which):
    """The frame of a face: named top or bottom, or the one furthest along a direction.
    Its origin is where the part's own origin projects onto the face."""
    if ob.pieces is None:
        raise ValueError(f"{ob.name!r} is a group: use bbox(group, \"+Z\") or a part's face")
    word = str(which).split(".")[-1].strip().lower()
    word = _SIDE_WORDS.get(word, word)
    if word in ("start", "end") and ob.pieces and ob.pieces[0].geom["t"] == "rings":
        piece = ob.pieces[0]
        rings_ = piece.geom["rings"]
        ring_ = [mpoint(mmul(ob.basis, piece.m), p) for p in (rings_[0] if word == "start" else rings_[-1])]
        other = [mpoint(mmul(ob.basis, piece.m), p) for p in (rings_[1] if word == "start" else rings_[-2])]
        centre = sum(ring_, Vec(0, 0, 0)) / len(ring_)
        out = centre - sum(other, Vec(0, 0, 0)) / len(other)
        nrm = Vec(0, 0, 0)
        for a, b in zip(ring_, ring_[1:] + ring_[:1]):
            nrm = nrm + (a - centre).cross(b - centre)
        nrm = nrm.normalized() if nrm.length > 1e-12 else out.normalized()
        if nrm.dot(out) < 0:
            nrm = -nrm
        return Frame(centre, nrm)._read_on(ob, ob.basis)
    try:
        (axis, sign), = _sides(word, "face")
    except ValueError:
        raise NotPorted(f"face({which!r}): only top, bottom, start, end and directions are ported")
    normal = [0.0, 0.0, 0.0]
    normal[axis] = float(sign)
    n = mdir(ob.basis, normal).normalized()
    pts = _points(ob, ob.basis)
    far = max(Vec(p).dot(n) for p in pts)
    o = Vec(ob.basis[3], ob.basis[7], ob.basis[11])
    return Frame(o + n * (far - o.dot(n)), n)._read_on(ob, ob.basis)


def local(ob, x=0, y=0, z=0, rx=0, ry=0, rz=0):
    root = _root(ob)
    if not isinstance(root, Node):
        raise TypeError(f"local: a part, a group or an assembly is expected, not {type(ob).__name__}")
    basis = root.basis
    return _frame_of(mmul(basis, _turned(dict(x=x, y=y, z=z, rx=rx, ry=ry, rz=rz))))._read_on(root, basis)


# ---------------------------------------------------------------- placing

_ANCHOR_WORDS = {"left": (0, -1), "right": (0, 1), "front": (1, -1), "back": (1, 1),
                 "bottom": (2, -1), "top": (2, 1), "center": None, "centre": None}


def _anchor_point(ob, anchor):
    if anchor in (None, "origin"):
        return Vec(0, 0, 0)
    lo, hi = _box(_points(ob, I4))
    p = list((lo + hi) / 2)
    word = anchor.strip()
    if word and all(c in "+-<>xyzXYZ" for c in word):
        for axis, side in _sides(word, f"anchor {anchor!r}"):
            p[axis] = hi[axis] if side > 0 else lo[axis]
        return Vec(p)
    for w in word.lower().replace("_", "-").replace(" ", "-").split("-"):
        if w not in _ANCHOR_WORDS:
            raise ValueError(f"anchor {anchor!r}: {w!r} is none of {sorted(_ANCHOR_WORDS)}")
        if _ANCHOR_WORDS[w]:
            axis, side = _ANCHOR_WORDS[w]
            p[axis] = hi[axis] if side > 0 else lo[axis]
    return Vec(p)


def _elements(ob):
    if not isinstance(ob, (list, tuple)) or not ob:
        return None
    out = []
    for item in ob:
        if isinstance(item, (list, tuple)):
            inner = _elements(item)
            if inner is None:
                return None
            out += inner
        elif isinstance(item, (Node, Handle, Profile, Placed, Path)):
            out.append(item)
        else:
            return None
    return out


def _pose(frame, values, point):
    m = _turned(values)
    if frame is not None:
        m = mmul(frame, m)
    return mmul(m, mtrans(-point[0], -point[1], -point[2]))


def _recalled(ob):
    if ob.place is not None:
        frame, values, anchor, point = ob.place
        return frame, dict(values), anchor, point
    frame = None if ob.basis == I4 else ob.basis
    return frame, dict.fromkeys(KEYS, 0.0), None, Vec(0, 0, 0)


def _posed(ob, frame, given, anchor):
    if not (given or frame is not None or anchor is not None):
        return ob
    if ob.joints:
        raise ValueError(f"at: {ob.name!r} hangs on a joint: place it before declaring the joint, or use transform")
    kept_frame, values, kept_anchor, point = _recalled(ob)
    if frame is not None:
        kept_frame = frame
    values.update(given)
    if anchor is not None:
        kept_anchor, point = anchor, _anchor_point(ob, anchor)
    ob.basis = _pose(kept_frame, values, point)
    ob.place = (kept_frame, values, kept_anchor, point)
    return ob


def _recalled_value(ob):
    kept = getattr(ob, "_s3d_place", None)
    if kept is not None:
        frame, values, base = kept
        return frame, dict(values), base
    base = ob.matrix if isinstance(ob, Placed) else (I4 if isinstance(ob, Profile) else _as_path(ob))
    return None, dict.fromkeys(KEYS, 0.0), base


def _replaced(ob, frame, given):
    kept_frame, values, base = _recalled_value(ob)
    if frame is not None:
        kept_frame = frame
    values.update(given)
    full = _turned(values)
    if kept_frame is not None:
        full = mmul(kept_frame, full)
    if isinstance(ob, (Profile, Placed)):
        out = Placed(ob.profile if isinstance(ob, Placed) else ob, mmul(full, base))
    else:
        out = Path([mpoint(full, p) for p in base.points], closed=base.closed)
    out._s3d_place = (kept_frame, values, base)
    return out


def at(ob, x=None, y=None, z=None, rx=None, ry=None, rz=None, on=None, anchor=None, *, scale=None):
    """Place it: set what is given, keep the rest."""
    given = {k: v for k, v in zip(KEYS, (x, y, z, rx, ry, rz)) if v is not None}
    if isinstance(on, (list, tuple)):
        return _on_frames(ob, list(on), given, anchor, scale)
    if on is not None and not isinstance(on, Frame):
        raise TypeError(f"at: on is a frame or a list of frames, not {on!r}")
    items = _elements(ob)
    if items is not None:
        return [at(i, x, y, z, rx, ry, rz, on, anchor, scale=scale) for i in items]
    if scale is not None:
        globals()["scale"](ob, scale) if _is_ob(ob) else None
    frame = on.matrix if on is not None else None
    if isinstance(ob, Handle):
        _posed(ob.root, frame, given, anchor)
        return ob
    if isinstance(ob, (Profile, Placed, Path, list, tuple)):
        return _replaced(ob, frame, given)
    return _posed(ob, frame, given, anchor)


def _on_frames(ob, frames, given, anchor, factor=None):
    items = _elements(ob)
    factors = [factor] * len(frames)
    if isinstance(factor, list):
        factors = factor
    out = []
    for item in [ob] if items is None else items:
        if not _is_ob(item):
            out.extend(_replaced(item, f.matrix, given) for f in frames)
            continue
        for f, s in zip(frames, factors):
            twin = copy(item)
            if s is not None:
                scale(twin, s)
            _posed(_root(twin), f.matrix, given, anchor)
            out.append(twin)
        delete(item)
    return out


def _mirror(flip):
    s = [1.0, 1.0, 1.0]
    for c in (flip or "").lower():
        if c not in "xyz":
            raise ValueError(f"transform: mirror is among 'x', 'y', 'z', not {flip!r}")
        s["xyz".index(c)] = -1.0
    return mscale(*s)


def transform(ob, x=0, y=0, z=0, rx=0, ry=0, rz=0, mirror=None):
    """Move it by, as a parent would."""
    return _transform(ob, mmul(_turned(dict(x=x, y=y, z=z, rx=rx, ry=ry, rz=rz)), _mirror(mirror)))


def _transform(ob, m):
    items = _elements(ob)
    if items is not None:
        return [_transform(i, m) for i in items]
    if isinstance(ob, Handle):
        _transform(ob.root, m)
        return ob
    if isinstance(ob, (Profile, Placed, Path, list, tuple)):
        frame, values, base = _recalled_value(ob)
        if isinstance(ob, (Profile, Placed)):
            prof, inner = (ob.profile, ob.matrix) if isinstance(ob, Placed) else (ob, I4)
            out = Placed(prof, mmul(m, inner))
        else:
            path = _as_path(ob)
            out = Path([mpoint(m, p) for p in path.points], closed=path.closed)
        out._s3d_place = (mmul(m, frame) if frame is not None else m, values, base)
        return out
    ob.basis = mmul(m, ob.basis)
    if ob.place is not None:
        frame, values, anchor, point = ob.place
        ob.place = (mmul(m, frame) if frame is not None else m, values, anchor, point)
    return ob


def grid(nx, ny=1, px=0, py=0, stagger=False, on=None):
    base = on if on is not None else Frame()
    out = []
    for j in range(ny):
        shift = px / 2 if stagger and j % 2 else 0
        for i in range(nx):
            centre = px / 4 if stagger and ny > 1 else 0
            out.append(base.move((i - (nx - 1) / 2) * px + shift - centre, (j - (ny - 1) / 2) * py))
    return Frames(out)


def ring(n, r, start=0, angle=360, on=None):
    base = on if on is not None else Frame()
    step = angle / n if abs(angle - 360) < 1e-9 else (angle / (n - 1) if n > 1 else 0)
    out = []
    for k in range(n):
        a = math.radians(start + step * k)
        radial = base.x * math.cos(a) + base.y * math.sin(a)
        out.append(base._kept(Frame(base.origin + radial * r, base.z, base.z.cross(radial))))
    return Frames(out)


def along(path, pitch=None, count=None, spin=0, span=(0, 1)):
    path = _as_path(path)
    pts = [Vec(p) for p in path.points] + ([Vec(path.points[0])] if path.closed else [])
    lengths = [0.0]
    for a, b in zip(pts, pts[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    total = lengths[-1]
    lo, hi = span[0] * total, span[1] * total
    if count is None:
        count = int((hi - lo) / pitch + 1e-9) + 1
        spots = [lo + pitch * k for k in range(count)]
    else:
        full = path.closed and span == (0, 1)
        spots = [lo + (hi - lo) * k / (count if full else max(count - 1, 1)) for k in range(count)]
    out, j = [], 0
    for k, d in enumerate(spots):
        while j < len(lengths) - 2 and lengths[j + 1] < d:
            j += 1
        f = (d - lengths[j]) / max(lengths[j + 1] - lengths[j], 1e-12)
        tangent = (pts[j + 1] - pts[j]).normalized()
        x = Vec(0, 0, 1).cross(tangent)
        x = x.normalized() if x.length > 1e-6 else Vec(1, 0, 0)
        out.append(Frame(pts[j] + (pts[j + 1] - pts[j]) * f, tangent, tangent.cross(x)).turn(rz=spin * k))
    return Frames(out)





# ---------------------------------------------------------------- solids

def extrude(name, profile, h=None, taper=0, twist=0, both=False, h2=None, on=None, until=None):
    if until is not None:
        raise NotPorted("extrude(until=) is not ported yet")
    if h is None:
        raise ValueError("extrude: give `h`, or `until`")
    if isinstance(profile, Placed):
        m = profile.matrix
        if abs(m[11]) > 1e-6 or m[10] < 1 - 1e-6:
            raise ValueError("extrude: the profile is placed out of its plane: give the frame with on=")
    prof = _flat_profile(profile)
    lo, hi = (-h / 2, h / 2) if both else (-(h2 or 0), h)
    if hi < lo:
        lo, hi = hi, lo
    geom = {"t": "extrude", "loops": prof.loops, "lo": lo, "hi": hi, "taper": taper, "twist": twist}
    return _solid(name, geom, on.matrix if on is not None else I4)


def _rings_solid(name, rings, loop=False, caps=True, matrix=I4):
    return _solid(name, {"t": "rings", "rings": [[tuple(p) for p in ring] for ring in rings],
                         "loop": loop, "caps": caps}, matrix)


def revolve(name, profile, angle=360):
    prof = _flat_profile(profile)
    full = abs(abs(angle) - 360) < 1e-9
    solids = []
    for loop in prof.loops:
        if min(x for x, _ in loop) < -1e-9:
            raise ValueError("revolve: the profile crosses the axis (X < 0)")
        n = segments(max(x for x, _ in loop), angle)
        steps = n if full else n + 1
        solids.append([[(x * math.cos(math.radians(angle * k / n)), x * math.sin(math.radians(angle * k / n)), y)
                        for x, y in loop] for k in range(steps)])
    node = _rings_solid(name, solids[0], loop=full, caps=not full)
    for extra in solids[1:]:
        node.pieces.append(Piece({"t": "rings", "rings": extra, "loop": full, "caps": not full}))
    return node


def _path_frames(pts, closed):
    """A tangent and two transported normals at each point of a path."""
    n = len(pts)
    tangents = []
    for i in range(n):
        a = pts[i - 1] if (i > 0 or closed) else pts[i]
        b = pts[(i + 1) % n] if (i < n - 1 or closed) else pts[i]
        t = (Vec(b) - Vec(a)).normalized()
        tangents.append(t if t.length > 0 else Vec(0, 0, 1))
    x = Vec(0, 0, 1).cross(tangents[0])
    x = x.normalized() if x.length > 1e-6 else Vec(1, 0, 0)
    frames = []
    for t in tangents:
        x = (x - t * x.dot(t))
        x = x.normalized() if x.length > 1e-9 else frames[-1][1]
        frames.append((t, x, t.cross(x)))
    return frames


def _law(value, u):
    """A number, an end value reached linearly from 1, or a law [(u, v), …] read at u."""
    if isinstance(value, (int, float)):
        return 1 + (value - 1) * u
    if value and isinstance(value[0], (int, float)):
        return tuple(1 + (v - 1) * u for v in value)
    for (u0, v0), (u1, v1) in zip(value, value[1:]):
        if u <= u1 or (u1, v1) == tuple(value[-1]):
            f = (u - u0) / max(u1 - u0, 1e-12)
            if isinstance(v0, (int, float)):
                return v0 + (v1 - v0) * f
            return tuple(a + (b - a) * f for a, b in zip(v0, v1))
    return value[-1][1]


def sweep(name, profile, path, scale=1, twist=0, frenet=False, *, tip="round", rings=0):
    prof = _flat_profile(profile)
    path = _as_path(path)
    pts = [Vec(p) for p in path.points]
    if len(pts) < 2:
        raise ValueError("sweep: a path needs two points")
    frames = _path_frames(pts, path.closed)
    lengths = [0.0]
    for a, b in zip(pts, pts[1:]):
        lengths.append(lengths[-1] + (b - a).length)
    out = []
    for i, (p, (t, x, y)) in enumerate(zip(pts, frames)):
        u = lengths[i] / max(lengths[-1], 1e-12)
        s = _law(scale, u)
        sx, sy = (s, s) if isinstance(s, (int, float)) else s
        a = math.radians(twist * u if isinstance(twist, (int, float)) else _law(twist, u))
        c, sn = math.cos(a), math.sin(a)
        ring = []
        for px, py in prof.loops[0]:
            qx, qy = px * sx, py * sy
            qx, qy = qx * c - qy * sn, qx * sn + qy * c
            ring.append(tuple(p + x * qx + y * qy))
        out.append(ring)
    return _rings_solid(name, out, loop=path.closed, caps=not path.closed)


def _fillet_path(points, closed, amount, least=0.0):
    pts = [Vec(p) for p in points]
    n = len(pts)
    out = []
    for i, p in enumerate(pts):
        r = (amount[i] if i < len(amount) else 0) if isinstance(amount, (list, tuple)) else amount
        if not r or (not closed and i in (0, n - 1)):
            out.append(p)
            continue
        a, b = pts[i - 1], pts[(i + 1) % n]
        u0, u1 = (a - p), (b - p)
        l0, l1 = u0.length, u1.length
        if l0 < 1e-9 or l1 < 1e-9:
            out.append(p)
            continue
        u0, u1 = u0 / l0, u1 / l1
        half = math.acos(max(-1.0, min(1.0, u0.dot(u1)))) / 2
        if half < 1e-6 or abs(half - math.pi / 2) < 1e-6:
            out.append(p)
            continue
        back = min(r / math.tan(half), l0 / 2, l1 / 2)
        rad = back * math.tan(half)
        centre = p + (u0 + u1).normalized() * (rad / math.sin(half))
        start, end = p + u0 * back, p + u1 * back
        e0, e1 = (start - centre).normalized(), (end - centre).normalized()
        turn = math.acos(max(-1.0, min(1.0, e0.dot(e1))))
        steps = max(2, segments(rad, math.degrees(turn)))
        for k in range(steps + 1):
            f = k / steps
            w0 = math.sin((1 - f) * turn) / math.sin(turn)
            w1 = math.sin(f * turn) / math.sin(turn)
            out.append(centre + (e0 * w0 + e1 * w1) * rad)
    return out


def wire(name, path, d, closed=None, fillet=0, *, tip="round", rings=0):
    if isinstance(d, (tuple, list)) and len(d) == 2 and all(isinstance(v, (int, float)) for v in d):
        section, law = ellipse(*d), 1
    elif isinstance(d, (int, float)):
        section, law = circle(d), 1
    else:
        top = max(v for _, v in d)
        section, law = circle(top), [(u, max(v / top, 1e-3)) for u, v in d]
    path = _as_path(path)
    is_closed = path.closed if closed is None else closed
    pts = path.points
    if fillet:
        pts = _fillet_path(pts, is_closed, fillet)
    return sweep(name, section, Path(pts, closed=is_closed), scale=law)


def _resample(ring, n):
    """`n` points evenly spaced by length round a closed ring of 3D points."""
    pts = [Vec(p) for p in ring]
    if len(pts) == 1:
        return [pts[0]] * n
    lengths = [0.0]
    for a, b in zip(pts, pts[1:] + pts[:1]):
        lengths.append(lengths[-1] + (b - a).length)
    out, j = [], 0
    for k in range(n):
        target = lengths[-1] * k / n
        while lengths[j + 1] < target:
            j += 1
        f = (target - lengths[j]) / max(lengths[j + 1] - lengths[j], 1e-12)
        a, b = pts[j], pts[(j + 1) % len(pts)]
        out.append(a + (b - a) * f)
    return out


def loft(name, *sections, follow=False, loop=False, tip="round", rings=0):
    if len(sections) == 1 and isinstance(sections[0], (list, tuple)):
        sections = tuple(sections[0])
    placed = []
    for s in sections:
        prof, m = (s.profile, s.matrix) if isinstance(s, Placed) else (_flat_profile(s), I4)
        placed.append([mpoint(m, (x, y, 0)) for x, y in prof.loops[0]])
    if len(placed) < 2:
        raise ValueError("loft: two sections at least")
    n = max(len(r) for r in placed)
    shapes = [_resample(r, n) for r in placed]
    steps = 1 if _STATE["facets"] is not None or len(shapes) == 2 else _steps(6)
    out = []
    count = len(shapes)
    for i in range(count if loop else count - 1):
        r0 = shapes[i - 1] if (i > 0 or loop) else shapes[i]
        r1, r2 = shapes[i], shapes[(i + 1) % count]
        r3 = shapes[(i + 2) % count] if (i + 2 < count or loop) else r2
        for k in range(steps):
            u = k / steps
            ring_ = []
            for a, b, c, d in zip(r0, r1, r2, r3):
                ring_.append(tuple((b * 2 + (c - a) * u + (a * 2 - b * 5 + c * 4 - d) * u * u
                                    + (b * 3 - a - c * 3 + d) * u ** 3) * 0.5))
            out.append(ring_)
    if not loop:
        out.append([tuple(p) for p in shapes[-1]])
    return _rings_solid(name, out, loop=loop, caps=not loop)


def helix(d, pitch, h, left=False):
    turns = h / pitch
    n = segments(d / 2, 360 * turns)
    sign = -1 if left else 1
    return Path([(d / 2 * math.cos(sign * 2 * math.pi * turns * i / n),
                  d / 2 * math.sin(sign * 2 * math.pi * turns * i / n), h * i / n) for i in range(n + 1)])


def spiral(d, d2, turns, h=0, left=False):
    n = segments(max(d, d2) / 2, 360 * turns)
    sign = -1 if left else 1
    return Path([((d / 2) * (d2 / d) ** (i / n) * math.cos(sign * 2 * math.pi * turns * i / n),
                  (d / 2) * (d2 / d) ** (i / n) * math.sin(sign * 2 * math.pi * turns * i / n), h * i / n)
                 for i in range(n + 1)])


def box(name, w, d, h):
    return extrude(name, rect(w, d), h)


def cylinder(name, d, h):
    return extrude(name, circle(d), h)


def tube(name, d, d_in, h):
    return extrude(name, circle(d) - circle(d_in), h)


def cone(name, d, h, d2=0):
    pts = [(0, 0), (d / 2, 0), (d2 / 2, h), (0, h)]
    return revolve(name, poly([q for i, q in enumerate(pts) if not (i == 2 and d2 == 0)]))


def sphere(name, d):
    return revolve(name, poly([(0, 0), arc((0, d / 2), d / 2, -90, 90)]))


def wedge(name, w, d, h, top=0):
    shape = poly([(-w / 2, 0), (w / 2, 0), (top / 2, h), (-top / 2, h)])
    ob = extrude(name, shape, d, both=True)
    ob.pieces[0].m = (1.0, 0, 0, 0, 0, 0, -1.0, 0, 0, 1.0, 0, 0, 0, 0, 0, 1.0)
    return ob


def torus(name, d, d_wire):
    return revolve(name, Placed(circle(d_wire), mtrans(d / 2, d_wire / 2, 0)))


def dome(name, d, h):
    r = (d * d / 4 + h * h) / (2 * h)
    base = math.degrees(math.atan2(r - h, d / 2))
    return revolve(name, poly([(0, 0), (d / 2, 0), arc((0, h - r), r, base, 90)]))


def gear(name, teeth, module, width, bore=0, angle=20):
    _note("gear: a toothless disc of the pitch diameter")
    return tube(name, teeth * module, bore, width) if bore else cylinder(name, teeth * module, width)


def knurl(name, d, h, pitch=None, straight=False):
    _note("knurl: a plain cylinder")
    return cylinder(name, d, h)


def thread(name, d, length, pitch, left=False):
    _note("thread: a plain rod")
    return cylinder(name, d, length)


for _name in ("body", "fill"):
    globals()[_name] = _unported(_name)


# ---------------------------------------------------------------- edits

def _solids(verb, *obs):
    out = _flat(obs)
    for o in out:
        if not isinstance(o, Node) or o.pieces is None:
            raise TypeError(f"{verb}: a solid is expected, not {getattr(o, 'name', o)!r}: join the parts of a group "
                            f"first, or give its parts")
    return out


def _parts(verb, obs):
    """The solids given, a group standing for every part under it."""
    out = []
    for o in _flat(obs):
        if not isinstance(o, Node):
            raise TypeError(f"{verb}: a part is expected, not {o!r}")
        out += [part for part, _ in _walk(o)] if o.pieces is None else [o]
    return out


def _into(ob, other):
    """`other`'s pieces as they sit, written in `ob`'s own space."""
    m = mmul(minv(_world(ob)), _world(other))
    out = []
    for piece in other.pieces:
        twin = piece.copy()
        twin.m = mmul(m, piece.m)
        twin.cuts = [(g, mmul(m, cm)) for g, cm in piece.cuts]
        twin.keeps = [(g, mmul(m, cm)) for g, cm in piece.keeps]
        out.append(twin)
    return out


def join(ob, *others):
    """Fused for the eye: the pieces share one part and one material, their overlap left inside."""
    given = _flat([ob, *others])
    parts = _parts("join", given)
    if not parts:
        raise ValueError("join: nothing to join")
    first = parts[0]
    for other in parts[1:]:
        if other is not first:
            first.pieces += _into(first, other)
    for other in given:
        if other is not first and not _under(first, other):
            delete(other)
    return first


def merge(*obs):
    flat = _flat(obs)
    if not flat:
        raise ValueError("merge: nothing to merge")
    return join(flat[0], *flat[1:])


def blend(ob, *others, r=None, step=None):
    _note("blend: joined without the filled creases")
    return join(ob, *others)


def cut(ob, *tools):
    ob, = _solids("cut", ob)
    used = _flat(tools)
    for tool in _parts("cut", used):
        for t in _into(ob, tool):
            for piece in ob.pieces:
                piece.cuts.append((t.geom, t.m))
    delete(used)
    return ob


def intersect(ob, tool):
    ob, = _solids("intersect", ob)
    for t in _parts("intersect", [tool]):
        for q in _into(ob, t):
            for piece in ob.pieces:
                piece.keeps.append((q.geom, q.m))
    delete(tool)
    return ob


def seat(host, part):
    host, = _solids("seat", host)
    for t in _parts("seat", [part]):
        for q in _into(host, t):
            for piece in host.pieces:
                piece.cuts.append((q.geom, q.m))
    return host


def _tool_frames(ob, on):
    """Frames from a frame, a point or a list of either, in the space `ob` is in, each
    moved along its normal to where it leaves the part."""
    if on is None:
        on = (0, 0)
    if isinstance(on, Frame):
        on = [on]
    elif on and isinstance(on[0], (int, float)):
        on = [on]
    pts = _points(ob, ob.basis)
    top = max(p[2] for p in pts)
    frames = [a if isinstance(a, Frame) else Frame((a[0], a[1], top) if len(a) == 2 else tuple(a)) for a in on]
    lo, hi = _box(pts)
    reach = (hi - lo).length + 1.0
    out = []
    for f in frames:
        far = max(Vec(p).dot(f.z) for p in pts)
        out.append(Frame(f.origin + f.z * max(far - f.origin.dot(f.z), 0.0), f.z, f.y))
    return out, reach


def _cut_with(ob, tool, frame):
    m = mmul(minv(ob.basis), mmul(frame.matrix, tool.basis))
    for t in tool.pieces:
        for piece in ob.pieces:
            piece.cuts.append((t.geom, mmul(m, t.m)))


def hole(ob, d, on=(0, 0), depth=None, cbore=None, csk=None):
    ob, = _solids("hole", ob)
    frames, reach = _tool_frames(ob, on)
    for frame in frames:
        over = max(0.01, 0.01 * d) if depth is not None else reach
        bottom = -(depth if depth is not None else reach)
        pts = [(0, over)]
        big, angle = ((csk, 90) if isinstance(csk, (int, float)) else csk) if csk else (0, 90)
        if cbore and cbore[0] > d:
            big, cdepth = cbore
            pts += [(big / 2, over), (big / 2, -cdepth), (d / 2, -cdepth)]
        elif csk and big > d:
            fall = (big - d) / 2 / math.tan(math.radians(angle) / 2)
            pts += [(big / 2 + over * math.tan(math.radians(angle) / 2), over), (d / 2, -fall)]
        else:
            pts += [(d / 2, over)]
        pts += [(d / 2, bottom), (0, bottom)]
        _cut_with(ob, revolve("hole", poly(pts)), frame)
    return ob


def pocket(ob, profile, depth=None, on=None):
    ob, = _solids("pocket", ob)
    if on is None:
        on = _face(ob, "+Z")
    sites = list(on) if isinstance(on, (list, tuple)) else [on]
    frames, reach = _tool_frames(ob, sites) if not isinstance(sites[0], Frame) else (sites, None)
    if reach is None:
        lo, hi = _box(_points(ob, ob.basis))
        reach = (hi - lo).length + 1.0
    for frame in frames:
        deep = depth if depth is not None else reach
        tool = extrude("pocket", profile, deep + reach * 0.001 + 0.01)
        tool.basis = mtrans(0, 0, -deep)
        _cut_with(ob, tool, frame)
    return ob


def copy(ob, name=None):
    items = _elements(ob)
    if items is not None:
        return [copy(i) for i in items]
    if isinstance(ob, (Profile, Placed, Path)):
        return ob
    if isinstance(ob, Handle):
        twins = {}
        root = _copy_tree(ob.root, twins)
        _remap(twins)
        twin = Handle(root)
        for k, v in ob.__dict__.items():
            if k != "root":
                setattr(twin, k, v)
        return twin
    twins = {}
    root = _copy_tree(ob, twins)
    _remap(twins)
    if isinstance(name, str):
        root.name = name
    _set_parent(root, ob.parent)
    return root


def _copy_tree(node, twins):
    twin = Node(node.name, None if node.pieces is None else [p.copy() for p in node.pieces])
    twin.basis, twin.look, twin.place = node.basis, node.look, node.place
    twin.joints, twin.jparent = [dict(j) for j in node.joints], node.jparent
    twins[id(node)] = twin
    for c in node.children:
        child = _copy_tree(c, twins)
        child.parent = twin
        twin.children.append(child)
    return twin


def _remap(twins):
    """Joints inside a copied tree hang on the copies; the others stay on the same parent."""
    for twin in twins.values():
        if twin.jparent is not None and id(twin.jparent) in twins:
            twin.jparent = twins[id(twin.jparent)]
        for j in twin.joints:
            if j["follows"] is not None and id(j["follows"][0]) in twins:
                j["follows"] = (twins[id(j["follows"][0])], j["follows"][1])


def scale(ob, s):
    root = _root(ob)
    if root.pieces is not None:
        sx, sy, sz = (s, s, s) if isinstance(s, (int, float)) else s
        m = mscale(sx, sy, sz)
        for piece in root.pieces:
            piece.m = mmul(m, piece.m)
            piece.cuts = [(g, mmul(m, cm)) for g, cm in piece.cuts]
            piece.keeps = [(g, mmul(m, cm)) for g, cm in piece.keeps]
        return ob
    if not isinstance(s, (int, float)) or s <= 0:
        raise ValueError("scale: a group takes one factor s > 0")

    def walk(node):
        for c in node.children:
            b = list(c.basis)
            b[3], b[7], b[11] = b[3] * s, b[7] * s, b[11] * s
            c.basis = tuple(b)
            c.place = None
            if c.pieces is not None:
                scale(c, s)
            walk(c)
    walk(root)
    return ob


def _approximate(verb, said):
    def skip(ob, *args, **kwargs):
        _note(f"{verb}: {said}")
        return ob
    skip.__name__ = verb
    return skip


def _rim(verb):
    """fillet and chamfer, for what this port can do: the top and bottom rims of an extruded part."""
    def apply(ob, r=None, edges="all", *args, d=None, **kwargs):
        r = d if r is None else r
        words = (" ".join(map(str, edges)) if isinstance(edges, (list, tuple)) else str(edges)).lower()
        top = any(w in words for w in ("all", "top", "+z"))
        bottom = any(w in words for w in ("all", "bottom", "-z"))
        done = False
        for part in _flat([ob]):
            for piece in (part.pieces or []) if isinstance(part, Node) else []:
                g = piece.geom
                if (g["t"] == "extrude" and (top or bottom) and not g.get("twist")
                        and isinstance(r, (int, float)) and r > 0):
                    piece.geom = dict(g, round={"top": r if top else 0, "bottom": r if bottom else 0, "flat": verb == "chamfer"})
                    done = True
        _note(f"{verb}: only the top and bottom rims of extruded parts are shaped" if done else f"{verb}: edges left sharp")
        return ob
    apply.__name__ = verb
    return apply


fillet = _rim("fillet")
chamfer = _rim("chamfer")
soften = _approximate("soften", "edges left sharp")
smooth = _approximate("smooth", "shading left as built")
shell = _approximate("shell", "left solid")
dent = _approximate("dent", "surface left as built")
bend = _approximate("bend", "left straight")
twist = _approximate("twist", "left untwisted")
taper = _approximate("taper", "left untapered")
lay = _approximate("lay", "left where it was placed")


# ---------------------------------------------------------------- materials, lights

PRESETS = {
    "oak": dict(color="#b48a5a", roughness=0.55), "walnut": dict(color="#5e3b25", roughness=0.45),
    "pine": dict(color="#d9b27c", roughness=0.6), "birch": dict(color="#e2c9a0", roughness=0.55),
    "steel": dict(color="#a8abb0", roughness=0.3, metallic=1.0),
    "brushed_steel": dict(color="#b4b7bb", roughness=0.35, metallic=1.0),
    "chrome": dict(color="#e6e8ea", roughness=0.05, metallic=1.0),
    "aluminium": dict(color="#c9ccd0", roughness=0.4, metallic=1.0),
    "brass": dict(color="#c9a24a", roughness=0.25, metallic=1.0),
    "copper": dict(color="#c47a52", roughness=0.25, metallic=1.0),
    "painted_metal": dict(color="#2b2d30", roughness=0.4, coat=0.3),
    "plastic": dict(color="#d8d8d8", roughness=0.5),
    "glossy_plastic": dict(color="#d8d8d8", roughness=0.12, coat=0.5),
    "rubber": dict(color="#202020", roughness=0.9),
    "glass": dict(color="#ffffff", roughness=0.0, transmission=1.0),
    "ceramic": dict(color="#f2f0ea", roughness=0.15, coat=0.6),
    "fabric": dict(color="#8a8f96", roughness=0.85, sheen=0.6),
    "velvet": dict(color="#2f4f5f", roughness=0.9, sheen=1.0),
    "leather": dict(color="#6b3e26", roughness=0.5), "marble": dict(color="#e8e6e1", roughness=0.15, coat=0.4),
    "concrete": dict(color="#9a9893", roughness=0.85), "bark": dict(color="#69503b", roughness=0.9),
    "leaf": dict(color="#52703d", roughness=0.5, coat=0.12), "moss": dict(color="#596344", roughness=0.95),
    "grass": dict(color="#68794a", roughness=0.8), "rock": dict(color="#85827b", roughness=0.9),
    "soil": dict(color="#66503c", roughness=1.0), "sand": dict(color="#c5b58e", roughness=0.9),
    "water": dict(color="#f4f8f8", roughness=0.08, transmission=1.0, ior=1.333),
    "snow": dict(color="#eef1f3", roughness=0.85, coat=0.03), "foam": dict(color="#f5f5f2", roughness=0.95),
    "smoke": dict(color="#ffffff", roughness=0.0, transmission=1.0, ior=1.0),
    "fog": dict(color="#ffffff", roughness=0.0, transmission=1.0, ior=1.0),
    "light": dict(color="#fff1dc", roughness=0.5, emission=12.0),
}


def material(ob, kind, color=None, roughness=None, metallic=None, opacity=None, emission=None, **more):
    if kind not in PRESETS:
        raise ValueError(f"material: {kind!r} is none of the presets: {', '.join(PRESETS)}")
    look = dict(PRESETS[kind], kind=kind)
    function = None
    if callable(color):
        function, color = color, None
    if color is not None and not isinstance(color, str):
        color = "#" + "".join(f"{max(0, min(255, round(c * 255))):02x}" for c in color[:3])
    for key, value in (("color", color), ("roughness", roughness), ("metallic", metallic),
                       ("opacity", opacity), ("emission", emission), ("transmission", more.get("transmission")),
                       ("ior", more.get("ior"))):
        if value is not None:
            look[key] = value
    if function is not None:
        look["function"] = function
    for o in _flat([ob]):
        o.look = look
    return ob


def light(name, kind="point", **settings):
    _note("light: left out, the viewer has its own")
    return Node(name)


# ---------------------------------------------------------------- joints

KINDS = ("revolute", "continuous", "prismatic", "free")
_JOINTS = {}          # every joint declared in this run, by name


def _axis(axis, verb):
    if axis == "normal":
        return "normal"
    word = axis.strip().lower() if isinstance(axis, str) else ""
    sign = -1 if word[:1] in ("-", "<") else 1
    word = word.lstrip("+-<>")
    if word not in ("x", "y", "z"):
        raise ValueError(f"{verb}: axis {axis!r} is a direction (\"+Z\", \"-X\"…) or \"normal\"")
    v = [0.0, 0.0, 0.0]
    v["xyz".index(word)] = float(sign)
    return Vec(v)


def _under(node, top):
    while node is not None:
        if node is top:
            return True
        node = node.parent
    return False


def joint(name, child, on, kind="revolute", axis="normal", range=None, follows=None, ratio=1):
    """How child moves on the part `on` was read on. Returns child."""
    verb = f"joint {name!r}"
    ob = _root(child)
    if not isinstance(ob, Node):
        raise TypeError(f"{verb}: child is the part that moves, not {type(child).__name__}")
    if kind not in KINDS:
        raise ValueError(f"{verb}: kind {kind!r} is none of {', '.join(KINDS)}")
    direction = None if kind == "free" else _axis(axis, verb)
    if not isinstance(on, Frame):
        raise TypeError(f"{verb}: on is a frame read on the parent part, not {type(on).__name__}")
    parent = on.part
    if parent is None:
        raise ValueError(f"{verb}: on is a frame built by hand, read on no part")
    if _under(parent, ob):
        raise ValueError(f"{verb}: on is read on the child itself, or inside it")
    if ob.joints and ob.jparent is not parent:
        raise ValueError(f"{verb}: {ob.name!r} already hangs on {ob.jparent.name!r}")
    if range is not None:
        range = [float(range[0]), float(range[1])]
    w_child = _world(ob)
    w_on = mmul(_world(parent), on._in_part())
    pivot = mmul(minv(w_child), w_on)
    if direction == "normal":
        a = Vec(0, 0, 1)
    elif direction is None:
        a = None
    else:
        space = _world(parent.parent) if parent.parent is not None else I4
        a = _clean(mdir(minv(w_on), mdir(space, direction)))
    leader = None
    if follows is not None:
        if isinstance(follows, str):
            if follows not in _JOINTS:
                raise ValueError(f"{verb}: follows {follows!r}, which names no joint")
            leader = _JOINTS[follows]
        else:
            lead = _root(follows)
            if not lead.joints:
                raise ValueError(f"{verb}: follows {lead.name!r}, which has no joint")
            leader = (lead, 0)
    ob.joints.append({"name": name, "kind": kind, "pivot": pivot, "axis": None if a is None else tuple(a),
                      "range": range, "follows": leader, "ratio": float(ratio), "value": 0.0})
    ob.jparent = parent
    _JOINTS[name] = (ob, len(ob.joints) - 1)
    return child


def _every(node):
    while node.parent is not None:
        node = node.parent
    seen, out, todo = set(), [], [node]
    while todo:
        n = todo.pop()
        if id(n) in seen:
            continue
        seen.add(id(n))
        out.append(n)
        todo += n.children
        if n.jparent is not None:
            todo.append(n.jparent)
            p = n.jparent
            while p.parent is not None:
                p = p.parent
            todo.append(p)
    return out


def pose(ob, value, joint=None):
    node = _root(ob)
    if not node.joints:
        raise ValueError(f"pose: {node.name!r} has no joint")
    target = node.joints[0]
    if joint is not None:
        target = next(j for j in node.joints if j["name"] == joint)
    target["value"] = float(value)
    return ob


def export(root, path=None, *args, **kwargs):
    return None


# ---------------------------------------------------------------- meshes, for the verbs that read or move a surface
# hull, displace, scatter, snap, tufts and colour functions need real triangles. They are
# made here with numpy, only for the pieces those verbs touch; the other pieces still go
# to three.js as outlines and rings. noise, vary, jitter, scatter, phyllotaxis and tufts
# follow the original library's arithmetic (sand3d, Apache-2.0).

try:
    import numpy as np
except ImportError:                      # the plain-solid verbs work without it
    np = None

FACE_BUDGET = 9000        # a displaced piece is refined up to about this many triangles


def _need_numpy(verb):
    if np is None:
        raise NotPorted(f"{verb} needs numpy, which this Python does not have")


def _earclip(loop):
    """Triangles (index triples) of a simple polygon given as 2D points."""
    n = len(loop)
    if n < 3:
        return []
    idx = list(range(n))
    if _area(loop) < 0:
        idx.reverse()
    out, guard = [], 0
    while len(idx) > 3 and guard < 4 * n * n:
        guard += 1
        m = len(idx)
        clipped = False
        for k in range(m):
            i0, i1, i2 = idx[k - 1], idx[k], idx[(k + 1) % m]
            a, b, c = loop[i0], loop[i1], loop[i2]
            cross = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
            if cross <= 1e-14:
                continue
            ear = True
            for j in idx:
                if j in (i0, i1, i2):
                    continue
                p = loop[j]
                d1 = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
                d2 = (c[0] - b[0]) * (p[1] - b[1]) - (c[1] - b[1]) * (p[0] - b[0])
                d3 = (a[0] - c[0]) * (p[1] - c[1]) - (a[1] - c[1]) * (p[0] - c[0])
                if d1 >= 0 and d2 >= 0 and d3 >= 0:
                    ear = False
                    break
            if ear:
                out.append((i0, i1, i2))
                idx.pop(k)
                clipped = True
                break
        if not clipped:                   # a sliver or a self-touching outline: fan what is left
            break
    for k in range(1, len(idx) - 1):
        out.append((idx[0], idx[k], idx[k + 1]))
    return out


def _bridged(outer, holes):
    """One outline for a loop and its holes, each hole joined to the outer by a slit."""
    loop = list(outer)
    for hole in sorted(holes, key=lambda h: -max(p[0] for p in h)):
        k = max(range(len(hole)), key=lambda i: hole[i][0])
        j = min(range(len(loop)), key=lambda i: (loop[i][0] - hole[k][0]) ** 2 + (loop[i][1] - hole[k][1]) ** 2)
        loop = loop[:j + 1] + hole[k:] + hole[:k + 1] + loop[j:]
    return loop


def _inside2(p, loop):
    hit = False
    for a, b in zip(loop, loop[1:] + loop[:1]):
        if (a[1] > p[1]) != (b[1] > p[1]) and p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]:
            hit = not hit
    return hit


def _miter_ring(loop, inset):
    if not inset:
        return loop
    out, n = [], len(loop)
    for i in range(n):
        a, b, c = loop[i - 1], loop[i], loop[(i + 1) % n]
        d0 = Vec(b[0] - a[0], b[1] - a[1]).normalized()
        d1 = Vec(c[0] - b[0], c[1] - b[1]).normalized()
        n0, n1 = Vec(d0[1], -d0[0]), Vec(d1[1], -d1[0])
        bis = (n0 + n1)
        bis = bis.normalized() if bis.length > 1e-9 else n0
        stretch = 1 / max(bis.dot(n0), 0.1)
        out.append((b[0] - bis[0] * inset * stretch, b[1] - bis[1] * inset * stretch))
    return out


def _tess_extrude(g):
    verts, tris, tags = [], [], []
    outers = [l for l in g["loops"] if len(l) > 2 and _area(l) > 0]
    holes = [l for l in g["loops"] if len(l) > 2 and _area(l) < 0]
    inset = (g["hi"] - g["lo"]) * math.tan(math.radians(g.get("taper") or 0))
    turn = math.radians(g.get("twist") or 0)
    c, s = math.cos(turn), math.sin(turn)
    for outer in outers:
        mine = [h for h in holes if _inside2(h[0], outer)]
        loops = [outer] + mine
        flat = _bridged(outer, mine) if mine else outer
        index = {}
        base = len(verts)
        for loop in loops:
            top = _miter_ring(loop, inset)
            for (x, y), (tx, ty) in zip(loop, top):
                index[(x, y)] = len(verts)
                verts.append((x, y, g["lo"]))
                verts.append((tx * c - ty * s, tx * s + ty * c, g["hi"]))
        for a, b, cc in _earclip(flat):
            ia, ib, ic = index[flat[a]], index[flat[b]], index[flat[cc]]
            tris.append((ic, ib, ia)); tags.append("bottom")
            tris.append((ia + 1, ib + 1, ic + 1)); tags.append("top")
        for loop in loops:
            n = len(loop)
            for j in range(n):
                i0, i1 = index[loop[j]], index[loop[(j + 1) % n]]
                tris.append((i0, i1, i1 + 1)); tags.append("side")
                tris.append((i0, i1 + 1, i0 + 1)); tags.append("side")
    return verts, tris, tags


def _cap_ring(ring, verts_offset, flip):
    pts = [Vec(p) for p in ring]
    n = Vec(0, 0, 0)
    for a, b in zip(pts, pts[1:] + pts[:1]):
        n = n + Vec((a[1] - b[1]) * (a[2] + b[2]), (a[2] - b[2]) * (a[0] + b[0]), (a[0] - b[0]) * (a[1] + b[1]))
    if n.length < 1e-12:
        return []
    n = n.normalized()
    u = Vec(0, 1, 0) if abs(n[0]) > 0.9 else Vec(1, 0, 0)
    u = (u - n * u.dot(n)).normalized()
    v = n.cross(u)
    flat = [(p.dot(u), p.dot(v)) for p in pts]
    out = []
    for a, b, c in _earclip(flat):
        out.append((verts_offset + c, verts_offset + b, verts_offset + a) if flip else
                   (verts_offset + a, verts_offset + b, verts_offset + c))
    return out


def _tess_rings(g):
    rings, count = g["rings"], len(g["rings"])
    n = len(rings[0])
    verts = [p for ring in rings for p in ring]
    tris, tags = [], []
    for k in range(count if g["loop"] else count - 1):
        a, b = k * n, ((k + 1) % count) * n
        for j in range(n):
            j1 = (j + 1) % n
            tris.append((a + j, a + j1, b + j1)); tris.append((a + j, b + j1, b + j))
            tags += ["side", "side"]
    if g["caps"] and not g["loop"]:
        for t in _cap_ring(rings[0], 0, True):
            tris.append(t); tags.append("start")
        for t in _cap_ring(rings[-1], (count - 1) * n, False):
            tris.append(t); tags.append("end")
    return verts, tris, tags


def _mesh_of(geom, matrix=I4):
    """(V, F, tags) of a piece's geometry, placed by `matrix`: welded, empty triangles
    dropped, turned outward."""
    _need_numpy("this verb")
    if geom["t"] == "mesh":
        V, F, tags = np.array(geom["v"], dtype=float).reshape(-1, 3), np.array(geom["f"], dtype=int).reshape(-1, 3), list(geom.get("tags") or [])
    else:
        verts, tris, tags = _tess_extrude(geom) if geom["t"] == "extrude" else _tess_rings(geom)
        V, F = np.array(verts, dtype=float).reshape(-1, 3), np.array(tris, dtype=int).reshape(-1, 3)
    if len(F) == 0:
        return V, F, []
    if matrix != I4:
        M = np.array(matrix, dtype=float).reshape(4, 4)
        V = V @ M[:3, :3].T + M[:3, 3]
        if np.linalg.det(M[:3, :3]) < 0:
            F = F[:, ::-1]
    if geom["t"] != "mesh" or not geom.get("welded"):
        span = max(float(np.ptp(V, axis=0).max()), 1e-9)
        keys = np.round(V / (span * 1e-7)).astype(np.int64)
        _, first, inverse = np.unique(keys, axis=0, return_index=True, return_inverse=True)
        V, F = V[first], inverse.reshape(-1)[F]
    keep = (F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])
    if len(tags) == len(F):
        tags = [t for t, k in zip(tags, keep) if k]
    else:
        tags = []
    F = F[keep]
    if len(F) and not geom.get("thin"):
        a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
        if float(np.einsum("ij,ij->i", a, np.cross(b - a, c - a)).sum()) < 0:
            F = F[:, ::-1]
    return V, F, tags


def _mesh_geom(V, F, tags=None, flat=None, thin=False, like=None):
    g = {"t": "mesh", "v": V, "f": F, "tags": tags or [], "welded": True, "thin": thin,
         "flat": (_STATE["facets"] is not None and not _STATE.get("smooth")) if flat is None else flat}
    if like is not None:
        g["flat"] = like.get("flat", g["flat"]) if flat is None else flat
    return g


def _bake(ob):
    """Every piece of a part as a mesh in the part's own space."""
    for piece in ob.pieces:
        if piece.geom["t"] != "mesh" or piece.m != I4:
            V, F, tags = _mesh_of(piece.geom, piece.m)
            piece.geom = _mesh_geom(V, F, tags, flat=piece.geom.get("flat"), thin=piece.geom.get("thin", False))
            piece.m = I4


def _face_data(V, F):
    a, b, c = V[F[:, 0]], V[F[:, 1]], V[F[:, 2]]
    cross = np.cross(b - a, c - a)
    area = np.linalg.norm(cross, axis=1) / 2
    normal = cross / np.maximum(2 * area, 1e-300)[:, None]
    return (a + b + c) / 3, normal, area


# ---- field: a closed level surface of a density, by marching tetrahedra (the original's scheme,
# on a dense grid that is coarsened to a sample budget instead of the original's banded search)

FIELD_SAMPLES = 350000
_TETS = ((0, 1, 2, 6), (0, 2, 3, 6), (0, 3, 7, 6), (0, 7, 4, 6), (0, 4, 5, 6), (0, 5, 1, 6))
_CUBE = ((0, 0, 0), (1, 0, 0), (1, 1, 0), (0, 1, 0), (0, 0, 1), (1, 0, 1), (1, 1, 1), (0, 1, 1))
_TET_CASES = []


def _tetrahedron_cases():
    """For each tetrahedron of a cube and each inside/outside pattern of its corners, the
    triangles to emit as pairs of corners (an edge each), wound to face outward."""
    cube = np.array(_CUBE, dtype=np.float64)
    cases = []
    for tet in _TETS:
        xyz = cube[list(tet)]
        table = {}
        for code in range(1, 15):
            inside = [c for c in range(4) if code & (1 << c)]
            outside = [c for c in range(4) if not code & (1 << c)]
            if len(inside) == 1 or len(outside) == 1:
                one, many = (inside, outside) if len(inside) == 1 else (outside, inside)
                patterns = [[(one[0], c) for c in many]]
            else:
                a, b = inside
                c, d = outside
                patterns = [[(a, c), (a, d), (b, d)], [(a, c), (b, d), (b, c)]]
            oriented = []
            for pattern in patterns:
                pattern = np.array(pattern)
                mid = xyz[pattern].mean(axis=1)
                normal = np.cross(mid[1] - mid[0], mid[2] - mid[0])
                if normal.dot(xyz[outside[0]] - xyz[inside[0]]) < 0:
                    pattern = pattern[[0, 2, 1]]
                oriented.append(pattern)
            table[code] = oriented
        cases.append(table)
    return cases


def field(name, size, density, *, cell, level=0, min_component_cells=3):
    """Closed isosurface: density(x, y, z) < level. size = (w, d, h), centred in X and Y, Z from 0."""
    _need_numpy("field")
    if not _TET_CASES:
        _TET_CASES.extend(_tetrahedron_cases())
    size = tuple(float(v) for v in size)
    cell = float(cell)
    if _STATE["facets"] is not None:
        cell = max(cell, math.pi * max(size) / _STATE["facets"])
    budget = FIELD_SAMPLES * _STATE.get("detail", 1.0)
    coarsest = (size[0] * size[1] * size[2] / budget) ** (1 / 3)
    if coarsest > cell:
        _note("field: sampled more coarsely than asked, to stay light")
        cell = coarsest
    ns = [max(2, math.ceil(v / cell)) + 1 for v in size]
    nx, ny, nz = ns
    axes = [np.linspace(-v / 2 if c < 2 else 0, v / 2 if c < 2 else v, ns[c]) for c, v in enumerate(size)]
    Z, Y, X = np.meshgrid(axes[2], axes[1], axes[0], indexing="ij")
    pts = np.column_stack((X.ravel(), Y.ravel(), Z.ravel()))
    try:
        vals = np.asarray(density(pts[:, 0], pts[:, 1], pts[:, 2]), dtype=np.float64)
        if vals.shape != (len(pts),):
            raise ValueError("shape")
    except (TypeError, ValueError):
        vals = np.fromiter((float(density(*p)) for p in pts), np.float64, len(pts))
    vals = (vals - level).reshape(nz, ny, nx)
    edge = np.zeros_like(vals, dtype=bool)
    edge[0], edge[-1], edge[:, 0], edge[:, -1], edge[:, :, 0], edge[:, :, -1] = True, True, True, True, True, True
    vals[edge] = np.where(vals[edge] == 0, 1.0, np.abs(vals[edge]))            # the box's faces are outside
    flat_vals = vals.ravel()
    plane = nx * ny
    kk, jj, ii = np.meshgrid(np.arange(nz - 1), np.arange(ny - 1), np.arange(nx - 1), indexing="ij")
    base = (kk * plane + jj * nx + ii).ravel()
    corner = np.array([x + y * nx + z * plane for x, y, z in _CUBE])
    ends_a, ends_b = [], []
    for t, tet in enumerate(_TETS):
        ids = base[:, None] + corner[list(tet)][None, :]
        inside_ = flat_vals[ids] < 0
        code = inside_[:, 0] * 1 + inside_[:, 1] * 2 + inside_[:, 2] * 4 + inside_[:, 3] * 8
        for value, patterns in _TET_CASES[t].items():
            hit = np.nonzero(code == value)[0]
            if not len(hit):
                continue
            for pattern in patterns:
                ends_a.append(ids[hit][:, pattern[:, 0]])
                ends_b.append(ids[hit][:, pattern[:, 1]])
    if not ends_a:
        raise ValueError("field: the density has no surface inside the box")
    A, B = np.concatenate(ends_a), np.concatenate(ends_b)                      # (triangles, 3) grid points
    lo, hi = np.minimum(A, B).ravel().astype(np.int64), np.maximum(A, B).ravel().astype(np.int64)
    span = np.int64(len(flat_vals) + 1)                                       # (64-bit: Pyodide's default integer is 32)
    keys, inverse = np.unique(lo * span + hi, return_inverse=True)
    lo, hi = keys // span, keys % span
    va, vb = flat_vals[lo], flat_vals[hi]
    t = (va / np.where(va - vb == 0, 1, va - vb))[:, None]
    V = pts[lo] + (pts[hi] - pts[lo]) * t
    F = inverse.reshape(-1, 3)
    F = F[(F[:, 0] != F[:, 1]) & (F[:, 1] != F[:, 2]) & (F[:, 0] != F[:, 2])]
    if min_component_cells:
        label = np.arange(len(V))
        for _ in range(400):                                                    # the least label spreads along edges
            least = label[F].min(axis=1)
            new = label.copy()
            np.minimum.at(new, F.reshape(-1), np.repeat(least, 3))
            new = new[new]
            if np.array_equal(new, label):
                break
            label = new
        roots, counts = np.unique(label[F[:, 0]], return_counts=True)
        if len(roots) > 1:
            keep = {int(roots[np.argmax(counts)])}
            for root in roots:
                part = V[label == root]
                if len(part) and float(np.ptp(part, axis=0).max()) >= min_component_cells * cell:
                    keep.add(int(root))
            F = F[np.isin(label[F[:, 0]], list(keep))]
    used = np.unique(F)
    remap = -np.ones(len(V), dtype=int)
    remap[used] = np.arange(len(used))
    return Node(name, [Piece(_mesh_geom(V[used], remap[F], tags=["field"] * len(F)))])


# ---- hull

def hull(name, points):
    """Closed convex hull of points, where they are given, with flat faces."""
    _need_numpy("hull")
    coords = sorted({tuple(float(c) for c in (p.origin if isinstance(p, Frame) else p)) for p in points})
    if len(coords) < 4:
        raise ValueError("hull: at least 4 distinct points are required")
    P = np.array(coords)
    extent = float(np.ptp(P, axis=0).max())
    Q = (P - P[0]) / extent
    eps = 1e-9
    i0 = 0
    i1 = int(np.argmax(((Q - Q[i0]) ** 2).sum(axis=1)))
    axis = (Q[i1] - Q[i0]) / np.linalg.norm(Q[i1] - Q[i0])
    i2 = int(np.argmax((np.cross(Q - Q[i0], axis) ** 2).sum(axis=1)))
    normal = np.cross(Q[i1] - Q[i0], Q[i2] - Q[i0])
    if np.linalg.norm(normal) < 1e-7:
        raise ValueError("hull: points are coplanar or degenerate")
    normal /= np.linalg.norm(normal)
    d = (Q - Q[i0]) @ normal
    i3 = int(np.argmax(np.abs(d)))
    if abs(d[i3]) < 1e-7:
        raise ValueError("hull: points are coplanar or degenerate")
    centre = Q[[i0, i1, i2, i3]].mean(axis=0)
    faces = []

    def add(a, b, c):
        n = np.cross(Q[b] - Q[a], Q[c] - Q[a])
        if n @ (centre - Q[a]) > 0:
            b, c, n = c, b, -n
        ln = np.linalg.norm(n)
        faces.append((a, b, c, n / ln if ln > 0 else n))
    for tri in ((i0, i1, i2), (i0, i1, i3), (i0, i2, i3), (i1, i2, i3)):
        add(*tri)
    for p in range(len(Q)):
        if p in (i0, i1, i2, i3):
            continue
        seen = [f for f in faces if f[3] @ (Q[p] - Q[f[0]]) > eps]
        if not seen:
            continue
        edges = {}
        for a, b, c, _ in seen:
            for e in ((a, b), (b, c), (c, a)):
                if (e[1], e[0]) in edges:
                    del edges[(e[1], e[0])]
                else:
                    edges[e] = True
        gone = {id(f) for f in seen}
        faces[:] = [f for f in faces if id(f) not in gone]
        for a, b in edges:
            add(a, b, p)
    F = np.array([f[:3] for f in faces], dtype=int)
    used = np.unique(F)
    remap = -np.ones(len(P), dtype=int)
    remap[used] = np.arange(len(used))
    node = Node(name, [Piece(_mesh_geom(P[used], remap[F], flat=True))])
    return node


# ---- noise (the original's seeded gradient and cell noise)

NOISES = ("perlin", "cells", "ridged", "turbulence")


def _mix(h, seed):
    h = np.asarray(h ^ np.uint32(seed & 0xFFFFFFFF), dtype=np.uint32)
    with np.errstate(over="ignore"):
        h ^= h >> np.uint32(16)
        h *= np.uint32(2246822519)
        h ^= h >> np.uint32(13)
        h *= np.uint32(3266489917)
        h ^= h >> np.uint32(16)
    return h


def noise(x, y, z, seed=0, kind="perlin"):
    """Float64 noise in [-1, 1]; scalars or broadcastable arrays."""
    _need_numpy("noise")
    import itertools
    if kind not in NOISES:
        raise ValueError(f"noise: kind must be one of {NOISES}")
    q = np.broadcast_arrays(*[np.asarray(a, dtype=np.float64) for a in (x, y, z)])
    base = [np.floor(a).astype(np.int64) for a in q]
    frac = [a - b for a, b in zip(q, base)]
    steps = (-1, 0, 1) if kind == "cells" else (0, 1)
    with np.errstate(over="ignore"):
        products = [{d: (b.astype(np.uint32) + np.uint32(d & 0xFFFFFFFF)) * np.uint32(k) for d in steps}
                    for b, k in zip(base, (1597334677, 3812015801, 2798796415))]
    if kind == "cells":
        distance = np.full(q[0].shape, np.inf)
        for delta in itertools.product((-1, 0, 1), repeat=3):
            hashed = products[0][delta[0]] ^ products[1][delta[1]] ^ products[2][delta[2]]
            dist = np.zeros(q[0].shape)
            for c in range(3):
                off = _mix(hashed, seed + 1013 * (c + 1)).astype(np.float64) / 4294967296
                dist += (delta[c] + off - frac[c]) ** 2
            distance = np.minimum(distance, dist)
        result = 1 - 2 * np.minimum(1, np.sqrt(distance) / math.sqrt(3))
    else:
        fade = [f * f * f * (f * (f * 6 - 15) + 10) for f in frac]
        result = np.zeros(q[0].shape)
        for corner in itertools.product((0, 1), repeat=3):
            h = _mix(products[0][corner[0]] ^ products[1][corner[1]] ^ products[2][corner[2]], seed)
            axis = h % 3
            dot = np.zeros(q[0].shape)
            for c in range(3):
                sign = np.where((h >> (c + 3)) & 1, 1.0, -1.0)
                dot = dot + np.where(axis == c, 0.0, sign * (frac[c] - corner[c]))
            weight = np.ones(q[0].shape)
            for c in range(3):
                weight = weight * (fade[c] if corner[c] else 1 - fade[c])
            result = result + weight * dot
        result = np.clip(result, -1, 1)
        if kind == "ridged":
            result = 1 - 2 * np.abs(result)
        if kind == "turbulence":
            result = 2 * np.abs(result) - 1
    return float(result) if result.ndim == 0 else result


def waves(wavelength, direction=None, centers=None, sharpness=0, spread=0, decay=None, phase=0, seed=0):
    """A bounded height field f(x, y, z) in [-1, 1]: one cosine train, or rings round centres."""
    _need_numpy("waves")
    if spread:
        _note("waves: spread left out, one wave train")
    angle = 0.0
    if isinstance(direction, (int, float)):
        angle = math.radians(direction)
    elif isinstance(direction, str):
        v = _axis(direction, "waves")
        angle = math.atan2(v[1], v[0])
    elif direction is not None:
        angle = math.atan2(direction[1], direction[0])
    cx, sy, k, ph = math.cos(angle), math.sin(angle), 2 * math.pi / wavelength, math.radians(phase)

    def shape(t):
        return np.cos(t + sharpness * np.sin(t))

    def f(x, y, z):
        x, y = np.asarray(x, dtype=float), np.asarray(y, dtype=float)
        if centers:
            total, env = np.zeros(np.broadcast(x, y).shape), np.zeros(np.broadcast(x, y).shape)
            for px, py in centers:
                r = np.hypot(x - px, y - py)
                e = np.exp(-r / decay) if decay else 1.0
                total = total + shape(k * r - ph) * e
                env = env + e
            out = total / (np.maximum(env, 1) if decay else len(centers))
        else:
            out = shape(k * (x * cx + y * sy) - ph)
        return float(out) if np.ndim(out) == 0 else out
    return f


# ---- seeded draws (the original's generators, so the same seeds give the same layouts)

def _random(seed, verb):
    import random
    if not isinstance(seed, int):
        raise ValueError(f"{verb}: seed must be an integer")
    return random.Random(seed)


def vary(value, spread, n, seed=0):
    rng = _random(seed, "vary")
    return [float(value + rng.triangular(-spread, spread, 0)) for _ in range(n)]


def _jitter(self, rx=0, ry=0, rz=0, x=0, y=0, z=0, seed=0):
    rng = _random(seed, "jitter")
    out = Frames()
    for f in self:
        a, b, c, dx, dy, dz = [rng.triangular(-v, v, 0) for v in (rx, ry, rz, x, y, z)]
        out.append(f.move(dx, dy, dz).turn(a, b, c))
    return out


Frames.jitter = _jitter


def phyllotaxis(n, d, h=0, angle=137.508, on=None):
    base = on if on is not None else Frame()
    out = Frames()
    for k in range(n):
        a = math.radians(k * angle)
        radial = base.x * math.cos(a) + base.y * math.sin(a)
        r = d / 2 if h else d / 2 * math.sqrt((k + 0.5) / n)
        origin = base.origin + radial * r + base.z * (h * (k + 0.5) / n)
        out.append(base._kept(Frame(origin, radial if h else base.z, base.z if h else base.z.cross(radial))))
    return out


class _Axis:
    def __init__(self, path, d, level, name, parent):
        self.path, self.d, self.level, self.name, self.parent = path, d, level, name, parent


class _Branches(list):
    def __init__(self):
        list.__init__(self)
        self.tips = Frames()


def _frame_along(pts, lengths, d, initial):
    """A frame at arc length d of a path: Z its tangent, Y carried from `initial`."""
    j = 0
    while j < len(lengths) - 2 and lengths[j + 1] < d:
        j += 1
    f = (d - lengths[j]) / max(lengths[j + 1] - lengths[j], 1e-12)
    a, b = Vec(pts[j]), Vec(pts[j + 1])
    tangent = (b - a).normalized()
    up = initial.y - tangent * initial.y.dot(tangent)
    if up.length < 1e-6:
        up = initial.x - tangent * initial.x.dot(tangent)
    return initial._kept(Frame(a + (b - a) * f, tangent, up.normalized()))


def branches(length, d, levels=3, children=3, attach=(0.45, 0.9), angle=45, azimuth=137.508,
             length_ratio=0.55, diameter_ratio=0.55, tip_ratio=0.15, jitter=0, seed=0, on=None,
             wander=0, droop=0, *, step=None):
    """Depth-first axes and leaf-tip frames, straight or curved: the original's draws and
    layout, its curves sampled more coarsely and without its bend limit."""
    import random
    base = on if on is not None else Frame()
    rng, out = random.Random(seed), _Branches()
    curved = bool(wander or droop)

    def grow(frame, size, diameter, level, name, parent):
        path = Path([frame.origin, frame.point(z=size)])
        if curved:
            turns = [(rng.uniform(0, 360), rng.uniform(-wander, wander)) if wander else (0, 0) for _ in range(8)]
            gravity = -base.z if droop >= 0 else base.z
            heading, controls = frame, [frame.origin]
            for bearing, lean in turns:
                if wander:
                    heading = heading.turn(rz=bearing).turn(ry=lean)
                if droop:
                    left = math.acos(max(-1.0, min(1.0, heading.z.dot(gravity))))
                    turn = min(math.radians(abs(droop) / 8), left)
                    axis_ = heading.z.cross(gravity)
                    axis_ = axis_.normalized() if axis_.length > 1e-7 else heading.x
                    r = mrot(axis_, math.degrees(turn))
                    heading = Frame(heading.origin, mdir(r, heading.z), mdir(r, heading.y))
                heading = heading.offset(size / 8)
                controls.append(heading.origin)
            path = Path(_centripetal([tuple(c) for c in controls], False, steps=2))
        pts = path.points
        lengths = [0.0]
        for a, b in zip(pts, pts[1:]):
            lengths.append(lengths[-1] + math.dist(a, b))
        axis = _Axis(path, [(0, diameter), (1, diameter * tip_ratio)], level, name, parent)
        out.append(axis)
        if level == levels or children == 0:
            out.tips.append(_frame_along(pts, lengths, lengths[-1], frame) if curved else frame.offset(size))
            return
        for j in range(children):
            u = attach[0] + (attach[1] - attach[0]) * (j / (children - 1) if children > 1 else 0.5)
            lean = angle * (1 + rng.uniform(-jitter, jitter))
            child_length = size * length_ratio * (1 + rng.uniform(-jitter, jitter))
            bearing = j * azimuth
            if jitter:
                bearing += rng.uniform(-jitter, jitter) * azimuth
            attachment = _frame_along(pts, lengths, u * lengths[-1], frame) if curved else frame.move(z=size * u)
            grow(attachment.turn(rz=bearing).turn(ry=lean), max(child_length, 1e-9), diameter * diameter_ratio,
                 level + 1, f"{name}/{j}", axis)
    grow(base, length, d, 0, "root", None)
    return out


def _surface_parts(targets):
    """(V, F) of every part given, in the space the parts are in (a group: its parent's)."""
    roots = targets if isinstance(targets, (list, tuple)) else [targets]
    out = []
    for root in _flat(roots):
        if root.pieces is not None:
            found = [(root, root.basis)]
        else:
            found = [(part, m) for part, m in _walk(root, root.basis)]
        for part, m in found:
            for piece in part.pieces:
                V, F, _ = _mesh_of(piece.geom, mmul(m, piece.m))
                if len(F):
                    out.append((V, F))
    return out


def _scatter_best(n, candidate, position):
    """n picks, each the best of 16 candidates by distance to those already picked."""
    out = []
    if np is not None:
        chosen = np.empty((max(n, 1), 3))
        for i in range(n):
            options = [candidate() for _ in range(16)]
            if i:
                at = np.array([tuple(position(c)) for c in options])
                gaps = ((at[:, None, :] - chosen[None, :i, :]) ** 2).sum(-1).min(1)
                k = int(np.argmax(gaps))                         # the first of equals, as the original's max()
            else:
                k = 0
            chosen[i] = tuple(position(options[k]))
            out.append(options[k])
        return out
    points = []
    for i in range(n):
        best, best_d = None, -1.0
        for _ in range(16):
            c = candidate()
            p = position(c)
            d = min((sum((a - b) ** 2 for a, b in zip(p, q)) for q in points), default=math.inf)
            if d > best_d:
                best, best_d = c, d
        points.append(tuple(position(best)))
        out.append(best)
    return out


def scatter(n, size, seed=0, surface=False, on=None):
    """Evenly spread frames inside an ellipsoid, on it, or on the surface of parts."""
    import bisect
    rng = _random(seed, "scatter")
    if _is_ob(size) or (isinstance(size, (list, tuple)) and size and _is_ob(size[0])):
        _need_numpy("scatter")
        tris, cumulative, area = [], [], 0.0
        for V, F in _surface_parts(size):
            centre, normal, areas = _face_data(V, F)
            for k in range(len(F)):
                if areas[k] > 0:
                    area += float(areas[k])
                    cumulative.append(area)
                    tris.append((Vec(V[F[k, 0]]), Vec(V[F[k, 1]]), Vec(V[F[k, 2]]), Vec(normal[k])))
        if not area:
            raise ValueError("scatter: parts need a nonzero surface area")

        def candidate():
            a, b, c, normal = tris[min(bisect.bisect_right(cumulative, rng.random() * area), len(tris) - 1)]
            u, v = math.sqrt(rng.random()), rng.random()
            return Frame(a * (1 - u) + b * (u * (1 - v)) + c * (u * v), normal)
        return Frames(_scatter_best(n, candidate, lambda f: f.origin))
    base = on if on is not None else Frame()
    radii = [v / 2 for v in size]

    def candidate():
        while True:
            z, a = rng.uniform(-1, 1), rng.uniform(0, 2 * math.pi)
            r = math.sqrt(max(0, 1 - z * z))
            unit = (r * math.cos(a), r * math.sin(a), z)
            if not surface or rng.random() <= min(radii) * math.sqrt(sum((u / q) ** 2 for u, q in zip(unit, radii))):
                break
        k = 1 if surface else rng.random() ** (1 / 3)
        return Vec([u * q * k for u, q in zip(unit, radii)])
    out = Frames()
    for p in _scatter_best(n, candidate, lambda p: p):
        normal = base.x * p[0] + base.y * p[1] + base.z * p[2]
        if normal.length < 1e-12:
            normal = base.z
        out.append(base._kept(Frame(base.origin + (base.x * p[0] + base.y * p[1] + base.z * p[2]), normal)))
    return out


def _closest_on_triangles(p, a, b, c):
    """The closest point to p on each triangle (a, b, c): arrays of shape (k, 3)."""
    ab, ac, ap = b - a, c - a, p - a
    d1, d2 = (ab * ap).sum(1), (ac * ap).sum(1)
    bp = p - b
    d3, d4 = (ab * bp).sum(1), (ac * bp).sum(1)
    cp = p - c
    d5, d6 = (ab * cp).sum(1), (ac * cp).sum(1)
    vc, vb, va = d1 * d4 - d3 * d2, d5 * d2 - d1 * d6, d3 * d6 - d5 * d4
    with np.errstate(divide="ignore", invalid="ignore"):
        denom = 1 / np.where(va + vb + vc == 0, 1, va + vb + vc)
        v, w = vb * denom, vc * denom
        out = a + ab * v[:, None] + ac * w[:, None]
        e = (d4 - d3) / np.where((d4 - d3) + (d5 - d6) == 0, 1, (d4 - d3) + (d5 - d6))
        out = np.where(((va <= 0) & (d4 - d3 >= 0) & (d5 - d6 >= 0))[:, None], b + (c - b) * e[:, None], out)
        t = d2 / np.where(d2 - d6 == 0, 1, d2 - d6)
        out = np.where(((vb <= 0) & (d2 >= 0) & (d6 <= 0))[:, None], a + ac * t[:, None], out)
        s = d1 / np.where(d1 - d3 == 0, 1, d1 - d3)
        out = np.where(((vc <= 0) & (d1 >= 0) & (d3 <= 0))[:, None], a + ab * s[:, None], out)
    out = np.where(((d6 >= 0) & (d5 <= d6))[:, None], c, out)
    out = np.where(((d3 >= 0) & (d4 <= d3))[:, None], b, out)
    out = np.where(((d1 <= 0) & (d2 <= 0))[:, None], a, out)
    return out


def snap(targets, points, direction=None):
    """Frames on the surface of targets: the nearest spot, or where a line along direction first meets it."""
    _need_numpy("snap")
    ray = None
    if direction is not None:
        ray = np.array(_axis(direction, "snap") if isinstance(direction, str) else Vec(direction).normalized())
    parts = _surface_parts(targets)
    if not parts:
        return Frames()
    A = np.concatenate([V[F[:, 0]] for V, F in parts])
    B = np.concatenate([V[F[:, 1]] for V, F in parts])
    C = np.concatenate([V[F[:, 2]] for V, F in parts])
    N = np.cross(B - A, C - A)
    N = N / np.maximum(np.linalg.norm(N, axis=1), 1e-300)[:, None]
    out = Frames()
    centre = (A + B + C) / 3
    reach = np.sqrt(np.maximum(((A - centre) ** 2).sum(1), np.maximum(((B - centre) ** 2).sum(1), ((C - centre) ** 2).sum(1))))
    for q in points:
        p = np.array(q.origin if isinstance(q, Frame) else q, dtype=float)
        if ray is None:
            away = np.sqrt(((centre - p) ** 2).sum(1))
            maybe = np.nonzero(away - reach <= (away + reach).min())[0]     # the rest are farther than one already in hand
            near = _closest_on_triangles(p[None, :], A[maybe], B[maybe], C[maybe])
            j = int(np.argmin(((near - p) ** 2).sum(1)))
            out.append(Frame(near[j], N[maybe[j]]))
            continue
        e1, e2 = B - A, C - A
        h = np.cross(ray[None, :], e2)
        det = (e1 * h).sum(1)
        ok = np.abs(det) > 1e-12
        inv = 1 / np.where(ok, det, 1)
        s = p[None, :] - A
        u = (s * h).sum(1) * inv
        qv = np.cross(s, e1)
        v = (qv @ ray) * inv
        t = (e2 * qv).sum(1) * inv
        hit = ok & (u >= -1e-9) & (v >= -1e-9) & (u + v <= 1 + 1e-9) & (t >= -1e-9)
        if not hit.any():
            continue
        k = int(np.argmin(np.where(hit, t, np.inf)))
        normal = N[k]
        out.append(Frame(p + ray * t[k], normal))
    return out


def tufts(name, sites, height, width, blades=5, lean=20, direction=None, shape="blade", seed=0):
    """One mesh of pointed pieces rooted at frames."""
    _need_numpy("tufts")
    sites = [sites] if isinstance(sites, Frame) else list(sites)
    points = np.asarray([tuple(f.origin) for f in sites], dtype=float).reshape(-1, 3)
    normals = np.asarray([tuple(f.z) for f in sites], dtype=float).reshape(-1, 3)

    def field_(value, vector=False):
        count = len(points)
        want = (count, 3) if vector else (count,)
        if callable(value):
            try:
                out = np.asarray(value(*points.T, normals.T), dtype=float)
                if out.shape != want:
                    raise ValueError
            except Exception:
                out = np.asarray([value(*p, tuple(n)) for p, n in zip(points, normals)], dtype=float).reshape(want)
            return out
        return np.broadcast_to(np.asarray(value, dtype=float), want)
    if not len(points):
        return Node(name, [])
    h, w, tilt = field_(height), field_(width), field_(lean)
    z = normals if direction is None else field_(direction, vector=True)
    z = z / np.linalg.norm(z, axis=1)[:, None]
    ref = np.zeros_like(z)
    ref[:, 2] = 1
    ref[np.abs(z[:, 2]) > .9] = (1, 0, 0)
    x = np.cross(ref, z)
    x /= np.linalg.norm(x, axis=1)[:, None]
    y = np.cross(z, x)
    rng = np.random.default_rng(seed)
    count = len(sites) * blades
    a = rng.uniform(0, 2 * np.pi, count)
    t = np.deg2rad(np.repeat(tilt, blades)) * rng.random(count)
    side = np.repeat(x, blades, axis=0) * np.cos(a)[:, None] + np.repeat(y, blades, axis=0) * np.sin(a)[:, None]
    axis = np.repeat(z, blades, axis=0) * np.cos(t)[:, None] + side * np.sin(t)[:, None]
    across = np.cross(axis, side)
    across /= np.linalg.norm(across, axis=1)[:, None]
    root = np.repeat(points, blades, axis=0)
    tip = root + axis * np.repeat(h, blades)[:, None]
    middle = (root + tip) / 2
    radius = np.repeat(w, blades)[:, None] / 2
    if shape == "blade":
        vertices = np.stack((root, middle - across * radius, middle + across * radius, tip), axis=1)
        template = np.array([(0, 2, 1), (1, 2, 3)])
    else:
        other = np.cross(axis, across)
        ring_ = [middle + radius * (across * np.cos(q) + other * np.sin(q)) for q in (0, 2 * np.pi / 3, 4 * np.pi / 3)]
        vertices = np.stack((root, *ring_, tip), axis=1)
        template = np.array([(0, 2, 1), (0, 3, 2), (0, 1, 3), (4, 1, 2), (4, 2, 3), (4, 3, 1)])
    faces = (template[None, :, :] + np.arange(count)[:, None, None] * vertices.shape[1]).reshape(-1, 3)
    return Node(name, [Piece(_mesh_geom(vertices.reshape(-1, 3), faces, flat=True, thin=True))])


# ---- displace

def _refined(V, F, tags, target, budget):
    """Triangles split until no edge is longer than target, or the budget is spent."""
    V = [tuple(v) for v in V]
    F = [tuple(f) for f in F]
    tags = list(tags) if len(tags) == len(F) else [""] * len(F)
    for _ in range(8):
        if len(F) * 2 > budget:
            break
        mids, long_ = {}, target * target

        def mid(i, j):
            key = (i, j) if i < j else (j, i)
            if key not in mids:
                a, b = V[i], V[j]
                if (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2 <= long_:
                    mids[key] = -1
                else:
                    mids[key] = len(V)
                    V.append(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2))
            return mids[key]
        out, out_tags, split = [], [], False
        for (a, b, c), tag in zip(F, tags):
            ab, bc, ca = mid(a, b), mid(b, c), mid(c, a)
            marks = (ab >= 0) + (bc >= 0) + (ca >= 0)
            if marks == 0:
                new = [(a, b, c)]
            elif marks == 3:
                new = [(a, ab, ca), (ab, b, bc), (ca, bc, c), (ab, bc, ca)]
            elif marks == 1:
                new = ([(a, ab, c), (ab, b, c)] if ab >= 0 else
                       [(a, b, bc), (a, bc, c)] if bc >= 0 else [(a, b, ca), (ca, b, c)])
            else:
                if ab < 0:
                    new = [(a, b, bc), (a, bc, ca), (ca, bc, c)]
                elif bc < 0:
                    new = [(a, ab, ca), (ab, b, c), (ab, c, ca)]
                else:
                    new = [(a, ab, c), (ab, bc, c), (ab, b, bc)]
            split = split or marks > 0
            out += new
            out_tags += [tag] * len(new)
        F, tags = out, out_tags
        if not split:
            break
    return np.array(V, dtype=float), np.array(F, dtype=int), tags


def _pick_faces(V, F, tags, faces):
    """The triangles `faces` names: top, bottom, side, a direction, or a list of them."""
    _, normal, _ = _face_data(V, F)
    names = faces if isinstance(faces, (list, tuple)) else [faces]
    picked = np.zeros(len(F), dtype=bool)
    for name in names:
        word = str(name).split(".")[-1].strip().lower()
        if word in ("top", "bottom", "side", "start", "end") and len(tags) == len(F) and word in tags:
            picked |= np.array([t == word for t in tags])
        elif word == "top":
            picked |= normal[:, 2] > 0.5
        elif word == "bottom":
            picked |= normal[:, 2] < -0.5
        elif word == "side":
            picked |= np.abs(normal[:, 2]) <= 0.5
        else:
            try:
                d = np.array(_axis(word, "displace"))
                along_ = normal @ d
                far = (V[F].mean(axis=1) @ d)
                picked |= (along_ > 0.5) & (far > far.max() - 0.25 * max(float(np.ptp(V @ d)), 1e-9))
            except Exception:
                picked |= True
    return picked


def displace(ob, amount, size, noise="perlin", octaves=1, seed=0, direction="normal", fade=None, *,
             faces=None, coords="local", step=None):
    """Push the surface out and in by up to amount, features size across."""
    _need_numpy("displace")
    parts = _parts("displace", [ob])
    custom = callable(noise)
    if coords == "path":
        _note("displace: path coordinates read as local ones")
    kind = noise
    for part in parts:
        _bake(part)
        for piece in part.pieces:
            g = piece.geom
            V, F, tags = g["v"], g["f"], g["tags"]
            if not len(F):
                continue
            box_ = float(np.ptp(V, axis=0).max())
            target = step if step else max(size / 4, box_ / 128)
            if step is None and _STATE["facets"] is not None:
                target = max(target, math.pi * box_ / _STATE["facets"])
            if step != 0:
                _, _, areas = _face_data(V, F)
                floor_ = math.sqrt(float(areas.sum()) / (0.43 * FACE_BUDGET * _STATE.get("detail", 1.0)))
                if floor_ > target:
                    _note("displace: refined more coarsely than asked, to stay light")
                    target = floor_
                V, F, tags = _refined(V, F, tags, target, FACE_BUDGET * 2)
            picked = _pick_faces(V, F, tags, faces) if faces is not None else None
            weight = np.ones(len(V))
            if picked is not None:
                inside_, outside = np.zeros(len(V), dtype=bool), np.zeros(len(V), dtype=bool)
                inside_[F[picked].reshape(-1)] = True
                outside[F[~picked].reshape(-1)] = True
                border = V[inside_ & outside]
                weight = inside_.astype(float)
                if len(border):
                    moving = np.where(inside_)[0]
                    sample = border[:: max(1, len(border) // 400)]
                    for start in range(0, len(moving), 2000):
                        idx = moving[start:start + 2000]
                        d = np.sqrt(((V[idx][:, None, :] - sample[None, :, :]) ** 2).sum(-1)).min(1)
                        t = np.clip(d / size, 0, 1)
                        weight[idx] = t * t * (3 - 2 * t)
            if fade is not None:
                z0, z1 = fade
                weight = weight * np.clip((V[:, 2] - z1) / (z0 - z1), 0.0, 1.0)
            centre, normal, areas = _face_data(V, F)
            if custom:
                values = np.asarray(noise(V[:, 0], V[:, 1], V[:, 2]), dtype=float)
                values = np.broadcast_to(values, (len(V),)).copy()
                values = np.clip(values, -1, 1)
            else:
                values, total = np.zeros(len(V)), 0.0
                Q = V / size
                for k in range(int(octaves)):
                    f, w = 2.0 ** k, 0.5 ** k
                    values += w * globals()["noise"](Q[:, 0] * f + 31.7 * seed, Q[:, 1] * f - 17.3 * seed,
                                                     Q[:, 2] * f + 5.1 * seed, seed=int(seed), kind=kind)
                    total += w
                values /= total
                share = np.zeros(len(V))
                np.add.at(share, F.reshape(-1), np.repeat(areas / 3, 3))
                mass = float((share * weight).sum())
                mean = float((share * weight * values).sum()) / mass if mass else 0.0
                values = (values - mean) / (1 + abs(mean))
            if direction == "normal":
                push = np.zeros_like(V)
                np.add.at(push, F.reshape(-1), np.repeat(normal * areas[:, None], 3, axis=0))
                push /= np.maximum(np.linalg.norm(push, axis=1), 1e-300)[:, None]
            elif direction == "radial":
                push = V / np.maximum(np.linalg.norm(V, axis=1), 1e-300)[:, None]
            else:
                d = np.array(_axis(direction, "displace") if isinstance(direction, str) else Vec(direction).normalized())
                push = np.broadcast_to(d, V.shape)
            V = V + push * (amount * weight * values)[:, None]
            piece.geom = _mesh_geom(V, F, tags, flat=g.get("flat"), thin=g.get("thin", False))
    return ob


def split(ob, frame, keep="above"):
    """What lies on one side of a frame's plane: the other side is cut away."""
    part, = _solids("split", ob)
    lo, hi = _box(_points(part, part.basis))
    reach = (hi - lo).length * 2 + 1.0
    tool = extrude("split", rect(reach * 2, reach * 2), reach)
    if keep == "above":
        tool.basis = mtrans(0, 0, -reach)
    elif keep != "below":
        raise NotPorted("split(keep=) other than above or below is not ported yet")
    _cut_with(part, tool, frame)
    return ob


def _face_colours(node_look, V, F):
    """sRGB per face from a colour function, or None if it cannot be read."""
    fn = node_look["function"]
    centre, normal, _ = _face_data(V, F)
    count = fn.__code__.co_argcount - (1 if hasattr(fn, "__self__") else 0)
    args = [centre[:, 0], centre[:, 1], centre[:, 2]]
    if count >= 4:
        args.append(normal.T)
    if count >= 5:
        span = float(np.ptp(V[:, 2])) or 1.0
        args.append((centre[:, 2] - V[:, 2].min()) / span)
        _note("material: a colour function's construction coordinate read as height")
    try:
        out = np.asarray(fn(*args), dtype=float)
        if out.shape != (len(F), 3):
            raise ValueError("shape")
    except Exception:
        rows = []
        for k in range(len(F)):
            one = [float(a[k]) for a in args[:3]] + ([tuple(normal[k])] if count >= 4 else []) + ([float(args[4][k])] if count >= 5 else [])
            c = fn(*one)
            if isinstance(c, str):
                c = [int(c[i:i + 2], 16) / 255 for i in (1, 3, 5)]
            rows.append([float(v) for v in c][:3])
        out = np.array(rows)
    return np.clip(out, 0, 1)


# ---------------------------------------------------------------- handing the scene to three.js

def scene(root):
    """The built object as plain lists and dicts: a tree of placed parts, their pieces,
    looks and joints, lengths in the program's unit, `scale` to metres."""
    root = _root(root)
    if isinstance(root, (list, tuple)):
        root = group("scene", *root)
    if not isinstance(root, Node):
        raise TypeError(f"the entry returned {type(root).__name__}, not a part, a group or an assembly")
    tops = [root]
    for n in _every(root):                       # parts a joint hangs on, outside the returned tree
        top = n
        while top.parent is not None:
            top = top.parent
        if top not in tops:
            tops.append(top)
    ids, order = {}, []

    def number(node):
        ids[id(node)] = len(order)
        order.append(node)
        for c in node.children:
            number(c)
    for top in tops:
        number(top)

    def geom(g, colours=None):
        if g["t"] == "mesh":
            V, F = g["v"], g["f"]
            return {"t": "mesh", "v": [round(float(c), 2) for c in V.reshape(-1)], "f": [int(i) for i in F.reshape(-1)],
                    "c": None if colours is None else [round(float(c), 3) for c in colours.reshape(-1)],
                    "flat": bool(g.get("flat")), "thin": bool(g.get("thin"))}
        if g["t"] == "extrude":
            return {"t": "extrude", "loops": [[[round(x, 5), round(y, 5)] for x, y in loop] for loop in g["loops"]],
                    "lo": g["lo"], "hi": g["hi"], "taper": g["taper"], "twist": g["twist"], "flat": bool(g.get("flat")),
                    "round": g.get("round")}
        return {"t": "rings", "loop": g["loop"], "caps": g["caps"], "flat": bool(g.get("flat")),
                "rings": [[[round(c, 3) for c in p] for p in ring] for ring in g["rings"]]}

    def pieces_of(node, look):
        out = []
        painted = look is not None and look.get("function") is not None and np is not None
        if painted:
            _bake(node)
        for p in node.pieces:
            colours = None
            if painted and len(p.geom["f"]):
                try:
                    colours = _face_colours(look, p.geom["v"], p.geom["f"])
                except Exception as error:
                    _note(f"material: a colour function failed ({type(error).__name__}), preset colour shown")
            out.append({"g": geom(p.geom, colours), "m": list(p.m),
                        "cuts": [{"g": geom(g), "m": list(m)} for g, m in p.cuts],
                        "keeps": [{"g": geom(g), "m": list(m)} for g, m in p.keeps]})
        return out
    nodes = []
    for node in order:
        look, up = node.look, node
        while look is None and up.parent is not None:
            up = up.parent
            look = up.look
        entry = {"name": node.name, "parent": ids[id(node.parent)] if node.parent is not None else -1,
                 "m": [float(c) for c in node.basis], "joints": [], "jparent": -1,
                 "look": None if look is None else {k: v for k, v in look.items() if k != "function"}}
        if node.pieces is not None:
            entry["pieces"] = pieces_of(node, look)
        if node.joints and id(node.jparent) in ids:
            entry["jparent"] = ids[id(node.jparent)]
            for j in node.joints:
                lead = j["follows"]
                entry["joints"].append({
                    "name": j["name"], "kind": j["kind"], "pivot": list(j["pivot"]), "axis": j["axis"],
                    "range": j["range"], "ratio": j["ratio"], "value": j["value"],
                    "follows": [ids[id(lead[0])], lead[1]] if lead is not None and id(lead[0]) in ids else None})
        nodes.append(entry)
    return {"nodes": nodes, "scale": _STATE["scale"], "notes": list(NOTES)}


def run(source, entry, lod=1.0):
    """Build one program from its source and the name of its entry function."""
    import json
    empty_scene()
    detail(lod)
    space = {"__name__": "__sand3d_program__"}
    exec(compile(source, "<sand3d program>", "exec"), space)
    if not entry or entry not in space:
        entry = next((k for k, v in space.items() if callable(v) and getattr(v, "__module__", "") ==
                      "__sand3d_program__" and not k.startswith("_")), None)
    if entry is None:
        raise ValueError("the program defines no function to call")
    return json.dumps(scene(space[entry]()), default=float)
