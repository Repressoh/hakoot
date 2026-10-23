# Shared step pagination: before and after

Evidence for [PR #58](https://github.com/Repressoh/hakoot/pull/58).

The captures render the actual `SharedGameSteps` components from main at
`b5abfb6` (before) and `3586041` (after), using the same temporary demo harness:
25 quiz steps, pages of ten, a simulated 700 ms page delay, and a 390 × 844
viewport per panel. The loaded-step counter belongs to the demo harness.
These are component browser captures with simulated pagination, rather than a
recording of a live Convex session. No player data is shown. The temporary
routes were removed after capture.

- [Automatic loading comparison](01-automatic-loading.png): the same swipe
  leaves the old viewer at ten loaded steps; the new viewer preloads twenty.
- [Persistent Next comparison](02-persistent-next.png): after all 25 steps
  load, the old viewer has no Next button. The new viewer keeps Previous and
  Next and can advance from step 24 to step 25.
- [Animated comparison](before-after.gif).
- [MP4 recording](before-after.mp4).

The recording first scrolls both viewers to the loaded boundary. It then uses
the old viewer's manual Next control twice to load its remaining pages, while
the new viewer loads its final page after another swipe. Finally, it selects
step 24 in both viewers and demonstrates Next and Previous in the new viewer.
