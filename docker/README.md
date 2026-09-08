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
  disables it and pins the executable path. `capture-squiggle.sh` verifies
  provenance before recording and refuses to continue if it fails.
- **`zenzic --version` cannot confirm this.** The local checkout and the latest
  release carry the same version for the whole development cycle, because the
  version bump is the last step of a release. Provenance comes from where the
  module resolves and from pip's and VS Code's own install records.
- D-Bus errors on startup are noise.

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
