# Playground

Playable worlds, papercraft stories, and browser experiments.

**[Open the Playground on GitHub Pages](https://rnaud.github.io/playground/)**

Choose an experience from the preview cards on the homepage. Everything is served
as a static site; no build step is needed.

## Run locally

From the repository root:

```sh
python3 -m http.server 8765
```

Open [the local Playground](http://localhost:8765/).

GitHub Pages deploys automatically when changes are pushed to `main`, using the
workflow in `.github/workflows/pages.yml`.
