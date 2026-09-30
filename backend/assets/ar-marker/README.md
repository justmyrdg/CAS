# AR marker

The one printed marker every AR model is shown on (student app → AR viewer → point the camera at it).
Served publicly at `/api/ar-marker/marker.png` and `/api/ar-marker/marker.mind` (see `src/app.ts`).

- `marker.svg` — the design (seeded random shapes: marker tracking needs lots of high-contrast detail).
- `marker.png` — the image students print (1000×1000). The admin AR Library's "Print AR marker" page prints it.
- `marker.mind` — MindAR 1.2.5 image-target data compiled from `marker.png`. It must match the PNG exactly:
  if you change the design, re-render the PNG and recompile it with MindAR's compiler
  (https://hiukim.github.io/mind-ar-js-doc/tools/compile — upload `marker.png`, download `targets.mind`, save as `marker.mind`).
