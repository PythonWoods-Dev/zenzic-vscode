<!-- SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev> -->
<!-- SPDX-License-Identifier: Apache-2.0 -->

# Demo-capture sandbox

Builds a container with a virtual X display, so a screen capture of the
extension can be produced on a machine whose own session does not expose one.
Used to produce the demo GIF in the README; not part of the extension, and
excluded from the packaged `.vsix`.

The operational rationale — why each choice was made, what was measured, and
the failure modes behind the flags below — is maintained separately by the
maintainer. This file carries only what you need to run it.

For the extension itself, see the [README](../README.md); for how to report a
problem with it, [SECURITY.md](../SECURITY.md) and [CONTRIBUTING.md](../CONTRIBUTING.md).

## Build

```bash
docker build -t zenzic-demo:phase0 docker/
```

## Run

```bash
docker run --rm \
  -v /path/to/zenzic:/mnt/zenzic-core:ro \
  -v /path/to/zenzic-vscode:/mnt/zenzic-vscode:ro \
  -v "$PWD/out":/out \
  -v "$PWD/docker/capture-squiggle.sh":/home/demo/capture.sh:ro \
  zenzic-demo:phase0 bash /home/demo/capture.sh
```

The core checkout is mounted read-only: the engine is installed editable from
it, and nothing in the container writes back to it.

## Recording the demo

`capture-squiggle.sh` proves the environment: engine and extension provenance,
activation, one frame with the squiggle in it. `record-demo.sh` is the take —
same setup, then the interaction, then an MP4 that `../optimize-gif.js` turns
into the README asset.

```bash
docker run --rm \
  -e SCREEN_GEOMETRY=2560x1600x24 \
  -v /path/to/zenzic:/mnt/zenzic-core:ro \
  -v /path/to/zenzic-vscode:/mnt/zenzic-vscode:ro \
  -v "$PWD/out":/out \
  -v "$PWD/docker/record-demo.sh":/home/demo/record.sh:ro \
  -v /path/to/your/verifier.py:/home/demo/verify_local_provenance.py:ro \
  zenzic-demo:phase0 bash /home/demo/record.sh

node optimize-gif.js out/demo.mp4 images/demo.gif --fps 12 --width 1280
```

Four things in that script are load-bearing, and each is there because the
alternative was tried and failed:

- **Positioning is keyboard-only.** Ctrl+G to the line, then character movement
  along a line whose exact text the script asserts first. A pixel coordinate
  survives no font, theme, or scale-factor change, and the recording still
  "succeeds".
- **Steps are separated by state verification, not by `sleep`.** The remaining
  sleeps are pacing for the viewer; none of them decides that a step finished.
- **The fix check asserts the file now reads `[TODO](guide.md)`.** "A menu
  appeared" is a different claim: a blind Return could pick *Suppress Z108 for
  this line* and produce a demo in which the product hides a problem instead of
  fixing it. Menu order is client-side presentation and cannot be read from the
  server, so the script determines it by execution first, unrecorded.
- **The squiggle's existence is proved by intervention, not by a baseline.**
  An earlier version measured red pixels right after the window mapped and
  called that a negative control; the language server publishes within a second
  of the window appearing, so the "before" frame already had the squiggle in
  it. Applying the fix and undoing it moves the count by ~1700 in both
  directions — that is a control.

Two things the first take got wrong were fixed in the script, not in post.

VS Code's chat side bar took a third of every frame. `chat.disableAIFeatures`
is the setting that removes it. Three other routes do not:
`workbench.secondarySideBar.defaultVisibility` leaves the panel open, Ctrl+Alt+B
does nothing to it, and the palette's *Toggle Secondary Side Bar* maximizes chat
over the whole window.

The window was also tall enough that the bottom third of each frame was empty
editor. `CAPTURE_HEIGHT` sets it, and defaults to 1120 device pixels.

## The CLI demo assets, and their own image

Two further assets are recorded here, and neither needs an editor:
`record-precommit-demo.sh` (the pre-commit refusal, in the core README) and
`record-lab-demo.sh` (`zenzic lab z201`, on the security examples page). Both use
asciinema on a real pty and render with `agg`. That makes the `.cast` the
complete source of every pixel. A token absent from the cast cannot appear in a
frame, so "the raw key does not appear" is a complete check rather than a sample
of frames.

They build on [`Dockerfile.recorder`](./Dockerfile.recorder), not on the editor
image above. A terminal recording needs a pty, a Python and a renderer; it needs
no VS Code, no Xvfb and no xdotool. The editor image is 1.74 GB and exists for a
different job, and depending on it meant this pipeline broke the day that image
was unavailable. The recorder image is 393 MB.

```bash
docker build -f docker/Dockerfile.recorder -t zenzic-recorder:1 .
mkdir -p .demo-out && chmod 777 .demo-out
docker run --rm \
  -v /path/to/zenzic:/work/zenzic:ro \
  -v "$PWD/.demo-out":/out \
  -v "$PWD/docker/record-lab-demo.sh":/home/demo/rec.sh:ro \
  --entrypoint bash zenzic-recorder:1 /home/demo/rec.sh
```

Both scripts refuse to produce an asset rather than produce a wrong one. The
provenance gate aborts if `zenzic` is on `PATH` before the local editable
install. The outcome is asserted from `git` or from the process exit code, never
from how the terminal looked. The credential measurements run before `agg` is
invoked, so a bad asset is never written to disk.

## Things that are not obvious

- **VS Code needs `--no-sandbox --disable-gpu --disable-dev-shm-usage`** in a
  container. Without them it exits before mapping a window and prints nothing.
  Launch `/usr/share/code/code` directly — the `code` wrapper backgrounds the
  app, so its exit status tells you nothing.
- **`xdotool search` exits 0 with empty output** when it finds no window. Wait
  on a real window id, not on the exit status.
- **The engine must come from the mounted checkout, not from PyPI.** The
  extension's `zenzic.autoProvision` setting defaults to on and will download
  the published engine if it finds none — silently, with no error. The image
  disables it and pins the executable path. Both scripts run a provenance
  verifier before recording and refuse to continue if it fails.
- **The verifier is yours to supply.** Set `PROVENANCE_SCRIPT` to its path
  inside the container (mount it, or bake a copy in at
  `/home/demo/verify_local_provenance.py`, the default). It must exit non-zero
  when the engine or the extension did not come from the mounts. Without it
  the scripts stop rather than record something they cannot vouch for.
- **`zenzic --version` cannot confirm this.** The local checkout and the latest
  release carry the same version for the whole development cycle, because the
  version bump is the last step of a release. Provenance comes from where the
  module resolves and from pip's and VS Code's own install records.
- D-Bus errors on startup are noise.

## What the image weighs, and why

1.74 GB, measured with `docker history` and `du` inside the built image rather
than estimated:

| layer | size | what it is |
| --- | --- | --- |
| `ubuntu:24.04` | 78 MB | base |
| apt: display, capture, toolchain | 807 MB | Xvfb, fluxbox, ffmpeg, ImageMagick, xdotool, python3, git, curl, Electron's runtime libraries, fonts |
| Node 22 | 203 MB | `/usr/bin/node` is 120 MB of it; `vsce package` needs it |
| VS Code | 638 MB | the product being filmed |
| venv | 13 MB | pip only — the engine is installed at run time from the mount |

**The image contains no copy of either repository.** They arrive only as bind
mounts, so a capture films the working tree as it is now, not as it was when
the image was built. Verified by execution, not by reading the Dockerfile:
`find / -name 'zenzic*' -o -name '*.git'` returns nothing, `/mnt` is empty, and
`/home/demo` holds only the venv and `entrypoint.sh`. This is what makes the
provenance gate meaningful — a baked-in copy would defeat it silently.

Apt caches are removed in the same `RUN` that creates them: `/var/lib/apt/lists`
is 4 KB, `/var/cache/apt` 20 KB, and there are zero `.deb` files left.

Four things were pruned out of the VS Code install, in the same layer that
installs it — a later `rm` in its own `RUN` frees nothing, because the bytes
remain in the layer below:

| removed | size | why |
| --- | --- | --- |
| `extensions/copilot` | 178 MB | a source of inline suggestions that could appear in a frame of a recording whose point is that you are seeing this repository's engine |
| `node_modules.asar.unpacked/@github` | 136 MB | its prebuilt native runtimes |
| `bin/code-tunnel` | 33 MB | never invoked here |
| `locales/*.pak` except `en-US` | 46 MB | the capture runs in one locale |

That is 412 MB; the image was 2.15 GB before.

What is **not** removed, with the numbers, because each is genuinely required:

- `libLLVM.so.20.1` (137 MB) and `libgallium` (41 MB). These look like GPU
  material on a `--disable-gpu` run, but `apt-get -s remove libgl1-mesa-dri`
  cascades into removing **xvfb** and **ffmpeg** — the display and the capture.
  178 MB is the price of a virtual display, not bloat.
- `/usr/share/code/code` (210 MB), `node_modules.asar` (53 MB), `@vscode`
  (38 MB), `@microsoft` (37 MB) — VS Code itself.
- ImageMagick pulls ghostscript and poppler (~40 MB). Dropping them means
  hand-picking `libmagickcore` variants, and `convert`/`compare` are what every
  verification in `record-demo.sh` is built on; the saving does not justify
  risking the instrument.

## Capture quality

Software rendering is fine — glyphs are properly antialiased. Capture at
2560×1600 with the window left at its natural size and crop; do not maximize
the window and downscale the whole frame, which shrinks the effective text size
and nearly erases the squiggle (VS Code draws it at a fixed device-pixel width).

`render-compare.sh` captures both cases for comparison:

```bash
docker run --rm -e SCREEN_GEOMETRY=2560x1600x24 \
  -v /path/to/zenzic:/mnt/zenzic-core:ro \
  -v /path/to/zenzic-vscode:/mnt/zenzic-vscode:ro \
  -v "$PWD/docker/render-compare.sh":/home/demo/rc.sh:ro \
  -v "$PWD/out":/out \
  zenzic-demo:phase0 bash /home/demo/rc.sh 2560x1600 1 hidpi
```
