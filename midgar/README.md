# Midgar, in paper

A short, playable Final Fantasy VII opening: Aerith on Loveless Street, the city
reveal, three railway signals, and Cloud's arrival at the Sector 01 platform.
The Playground entry links to `midgar/`; the scene links back to the Playground.

Serve the repository root with `python3 -m http.server 8765`, then visit
<http://localhost:8765/midgar/>. All artwork and runtime modules are local;
there is no build step or CDN dependency.

## Play

- Click or tap the action button, or press Space, to advance.
- Set each signal while the needle is inside the striped green band. A missed
  signal is retryable and does not reset progress.
- Enable **Untimed signals** to set the same three signals at your own pace.
  The choice persists through replay within the current visit.
- After the train stops, Cloud steps onto the platform. Replay starts the opening
  again. Reduced motion skips the city zoom and train/leap animation.

## Verify

Run the dependency-free state/input regression checks from the repository root:

```sh
node --test midgar/tests/opening.test.mjs
```

Browser checks: follow the Playground link; try a missed signal and three valid
signals; wait for arrival; replay; enable untimed signals using the keyboard;
complete again; follow the return link. Check desktop, phone portrait, short
landscape, and rotation while the opening is running. Cloud and the active
controls should remain visible, including on reduced motion settings.

For repeatable visual review, the scene extends the paper kit's existing
`window.__papercraft` hooks: `restart()` resets both the chapter and paper folds,
`step(seconds)` pauses live playback and advances both clocks, and `resume()`
continues live playback. The normal action button still drives the chapters.
The procedural prints, paper kit and hinge renderer remain together in this
folder so the scene can ship as a static page.
