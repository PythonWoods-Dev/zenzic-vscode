# SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
# SPDX-License-Identifier: Apache-2.0
#
# Demo-capture sandbox for the Zenzic VS Code extension.
#
# WHY THIS EXISTS
# ---------------
# The development host runs a real Wayland session. A Wayland compositor does
# not expose the desktop to X11 clients, so `ffmpeg -f x11grab` on :0 captures
# a black frame and no input-synthesis tool can drive the editor. Both blocks
# are measured, not assumed: the black frame is 993 bytes with a mean luminance
# of 16 and 9 distinct pixel rows, against 31,804 bytes / 147 / 800 rows for the
# same capture on this image's virtual display.
#
# This image supplies the display the host cannot: a virtual X server (Xvfb)
# that Zenzic's own processes own end to end, so x11grab captures real pixels.
#
# THE MOUNTED CORE IS READ-ONLY
# -----------------------------
# The engine is installed editable from the mounted checkout, and that checkout
# is mounted `:ro`. Verified: pip's editable install completes and the module
# still resolves under the mount, because hatchling's editable hook writes its
# redirect into site-packages inside the container, not into the source tree.
# The operator's working tree is therefore never mutated by a capture run --
# checked by hashing a clean clone before and after (identical), not assumed.
#
# THE LOCAL-CODEBASE CONSTRAINT
# -----------------------------
# The extension's `zenzic.autoProvision` setting defaults to ON, which silently
# downloads the published PyPI engine when none is found. A capture recorded
# against that engine films a different product than the one in the working
# tree. This image therefore installs nothing from PyPI: the engine comes from
# the mounted core repository as an editable install, and autoProvision is
# switched off explicitly in the machine settings written below.
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    DISPLAY=:99 \
    SCREEN_GEOMETRY=1280x800x24

# One layer, one purpose. Grouped so a reader can see why each set is here.
RUN apt-get update && apt-get install -y --no-install-recommends \
        # virtual display, window manager, capture
        xvfb fluxbox x11-utils x11-xserver-utils ffmpeg imagemagick \
        # input synthesis -- absent on the Wayland host, available here
        xdotool \
        # the engine and the extension toolchain
        python3 python3-venv python3-pip git curl ca-certificates \
        # VS Code's own runtime dependencies (it is an Electron app)
        libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 libcups2t64 libdrm2 \
        libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
        libgbm1 libasound2t64 libpango-1.0-0 libcairo2 libgtk-3-0t64 \
        libsecret-1-0 xdg-utils \
        # fonts -- a capture with fallback glyphs is not a marketing asset
        fonts-dejavu-core fonts-liberation2 fonts-noto-color-emoji \
    && rm -rf /var/lib/apt/lists/*

# Node.js 22 from NodeSource: `vsce package` needs a modern Node, and Ubuntu's
# own nodejs package is older than @vscode/vsce supports.
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# VS Code from Microsoft's own apt repository, pinned to the stable channel.
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc \
        | gpg --dearmor -o /usr/share/keyrings/microsoft.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft.gpg] \
https://packages.microsoft.com/repos/code stable main" \
        > /etc/apt/sources.list.d/vscode.list \
    && apt-get update && apt-get install -y --no-install-recommends code \
    && rm -rf /var/lib/apt/lists/* \
    # Pruned in the SAME layer as the install, because a later `rm` in its own
    # RUN removes nothing from the image -- the bytes stay in the layer below.
    # Measured with `du` inside the built image, not estimated:
    #   the bundled assistant extension         178 MB
    #   its prebuilt native runtimes            136 MB
    #   bin/code-tunnel                          33 MB
    #   locales/*.pak except en-US               46 MB
    # The assistant extension is not only weight: it draws inline suggestions,
    # which could appear in a marketing frame of a recording whose whole point
    # is that what you see is this repository's engine and nothing else. The
    # remote-tunnel client is never invoked here, and the capture runs in one
    # locale. What is NOT removed, and why, is in README.md.
    && rm -rf /usr/share/code/resources/app/extensions/copilot \
              /usr/share/code/resources/app/node_modules.asar.unpacked/@github \
              /usr/share/code/bin/code-tunnel \
    && find /usr/share/code/locales -type f -name '*.pak' ! -name 'en-US.pak' -delete

# VS Code refuses to run as root without --no-sandbox; a real user is cleaner
# and matches how a human would actually run it.
#
# The core repository is mounted READ-ONLY (see the run command in README.md),
# so this user never needs to match the host's uid: nothing in the container
# writes to the mounted tree. The build arguments remain for the case where an
# operator deliberately mounts something writable, but the documented flow does
# not use them and a uid mismatch is no longer a failure mode.
# Ubuntu 24.04 already ships a uid/gid 1000 (`ubuntu`), so the ids are only
# applied when they are actually free; otherwise the user is created with
# whatever the system assigns. Nothing here depends on a particular value now
# that the mount is read-only.
ARG DEMO_UID=1000
ARG DEMO_GID=1000
RUN if getent group "${DEMO_GID}" >/dev/null; then \
        groupadd demo; \
    else \
        groupadd -g "${DEMO_GID}" demo; \
    fi \
    && if getent passwd "${DEMO_UID}" >/dev/null; then \
        useradd -ms /bin/bash -g demo demo; \
    else \
        useradd -ms /bin/bash -u "${DEMO_UID}" -g demo demo; \
    fi
USER demo
WORKDIR /home/demo

# The engine lives in a venv owned by this user, never in the system Python.
# --system-site-packages is deliberately NOT used: the venv must contain only
# what we put there, so a module-path check proves provenance unambiguously.
RUN python3 -m venv /home/demo/.venv
ENV PATH="/home/demo/.venv/bin:${PATH}"

# Machine-level settings. These are what actually disable autoProvision -- the
# constraint the whole exercise depends on -- and they are written into the
# image rather than passed at runtime so no invocation can forget them.
RUN mkdir -p /home/demo/.config/Code/User \
    && printf '%s\n' \
    '{' \
    '  "zenzic.autoProvision": false,' \
    '  "zenzic.executablePath": "/home/demo/.venv/bin/zenzic",' \
    '  "workbench.colorTheme": "Default Dark Modern",' \
    '  "window.menuBarVisibility": "hidden",' \
    '  "workbench.startupEditor": "none",' \
    '  "update.mode": "none",' \
    '  "telemetry.telemetryLevel": "off",' \
    '  "editor.fontSize": 16,' \
    '  "editor.minimap.enabled": false,' \
    '  "workbench.activityBar.location": "hidden",' \
    '  "editor.fontFamily": "'"'"'Liberation Mono'"'"', '"'"'DejaVu Sans Mono'"'"', monospace"' \
    '}' \
    > /home/demo/.config/Code/User/settings.json

COPY --chown=demo:demo entrypoint.sh /home/demo/entrypoint.sh
RUN chmod +x /home/demo/entrypoint.sh

ENTRYPOINT ["/home/demo/entrypoint.sh"]
CMD ["bash"]
