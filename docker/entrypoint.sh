#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
# SPDX-License-Identifier: Apache-2.0
#
# Bring up the virtual display, then hand over to whatever the caller asked for.
#
# Every step here is verified rather than assumed: Xvfb is polled until it
# actually answers an X query, because a `sleep 2` that happens to be long
# enough on this machine is not a control (Rule 31 -- a check whose result is
# only consumed by `echo` is decorative).
set -euo pipefail

: "${DISPLAY:=:99}"
: "${SCREEN_GEOMETRY:=1280x800x24}"

Xvfb "${DISPLAY}" -screen 0 "${SCREEN_GEOMETRY}" -ac +extension GLX +render -noreset &
XVFB_PID=$!

# Wait for the server to answer, not for a fixed number of seconds.
for _ in $(seq 1 50); do
    if xdpyinfo -display "${DISPLAY}" >/dev/null 2>&1; then
        break
    fi
    sleep 0.2
done

if ! xdpyinfo -display "${DISPLAY}" >/dev/null 2>&1; then
    echo "entrypoint: Xvfb never answered on ${DISPLAY} -- nothing below can work." >&2
    kill "${XVFB_PID}" 2>/dev/null || true
    exit 1
fi

# A window manager is required for VS Code to map and size its window; without
# one the Electron window exists but is never given a frame, which captures as
# a blank screen and reads exactly like the Wayland failure this image exists
# to escape.
fluxbox >/dev/null 2>&1 &

# Give fluxbox a moment to own the root window, then confirm the display is
# genuinely writable by drawing to it -- a positive control for the capture
# path, so a later black frame cannot be blamed on an unproven display.
sleep 1

exec "$@"
