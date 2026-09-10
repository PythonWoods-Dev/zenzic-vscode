#!/usr/bin/env bash
# SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
# SPDX-License-Identifier: Apache-2.0
#
# Phase 1: record the full in-editor sequence -- squiggle, hover, quick fix,
# applied fix -- as an MP4 that `optimize-gif.js` turns into the README asset.
#
# This extends the proven Phase 0 flow (docker/capture-squiggle.sh) rather than
# replacing it: same engine install, same provenance gate, same fixture, same
# window-wait. What is new is the interaction and the checks around it.
#
# FOUR CONSTRAINTS, none of which is a preference:
#
#   1. Positioning is keyboard-only. Ctrl+G to the line, then character
#      movement along a line whose exact text is known. No pixel coordinates:
#      a click at (x,y) silently lands somewhere else the moment a font,
#      a theme, or the scale factor changes, and the recording still "works".
#
#   2. Steps are separated by state verification, not by `sleep`. A sleep long
#      enough on this machine today is not a control. Sleeps that remain are
#      pacing for the viewer, and are never the thing that decides a step
#      finished.
#
#   3. The fix check asserts the FILE now reads `[TODO](guide.md)`. Asserting
#      that "a menu appeared" is not the same claim: a blind Return could
#      select "Suppress Z108 for this line" and produce a demo in which the
#      product hides a problem instead of fixing it. The menu order is client
#      presentation and cannot be read from the server, so this script probes
#      it by execution first and asserts the result afterwards.
#
#   4. Capture is at 2x device pixels with the window at its natural size.
#      SCREEN_GEOMETRY is 2560x1600 and VS Code runs with
#      --force-device-scale-factor=2, so a window filling that screen is a
#      natural 1280x800 window rendered into 2560x1600 device pixels -- a
#      supersample. The failure mode being avoided is the opposite: maximizing
#      a 1x window on a 2x screen and downscaling the whole frame, which
#      shrinks the logical text and nearly erases the squiggle, because
#      VS Code draws it at a fixed device-pixel width.
set -uo pipefail

CORE=/mnt/zenzic-core
EXT_SRC=/mnt/zenzic-vscode
OUT=${OUT:-/out}
GEOM=${SCREEN_GEOMETRY:-2560x1600x24}
SW=${GEOM%%x*}
SH=$(echo "$GEOM" | cut -dx -f2)
DSF=${DEVICE_SCALE_FACTOR:-2}
# Window height AND capture height, in device pixels. Two things set it: the
# fluxbox toolbar at the bottom of the screen must stay out of frame, and the
# fixture is a 19-line file -- at the full 1540 the bottom third of every frame
# was empty editor. 1120 device px is 560 logical px: title bar, tab, the whole
# document, room for the lightbulb menu under line 10, and the status bar.
# Never larger than the screen: x11grab fails outright when the requested
# geometry exceeds the display, every grab() then produces no file, and each
# measurement built on it returns nothing. That is what made the chat-panel
# guard conclude from an empty value -- the guard was the symptom, this is the
# cause. Defaults to the screen height rather than a constant that was correct
# only for a 2560x1600 display.
CAP_H=${CAPTURE_HEIGHT:-$SH}
FPS=${RECORD_FPS:-25}
mkdir -p "$OUT"

die() { echo "FAIL: $*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# Red-pixel measurement. Used as the diagnostics detector, so it needs a
# positive and a negative control rather than a threshold picked by eye.
#
# A histogram is the cheap way to do this: ImageMagick emits one line per
# distinct colour with its count, so summing the red-dominant ones is an awk
# job over thousands of lines instead of an -fx pass over four million pixels.
# ---------------------------------------------------------------------------
redcount() {
    local f=$1
    # A measurement that cannot be taken is not a measurement of zero. Every
    # numeric guard below compares this value, and returning 0 from a failed
    # convert reads as "no error pixels" -- clean -- the exact inversion the
    # chat-panel guard produced from an empty value.
    [ -s "$f" ] || { echo "MEASUREMENT-FAILED"; return 0; }
    # -depth 8 so the hex column is #RRGGBB regardless of the build's quantum
    # depth; a Q16 ImageMagick otherwise prints twelve hex digits. Parsed with
    # POSIX awk only -- Ubuntu's default awk is mawk, whose match() has no
    # capture-array form.
    convert "$f" -depth 8 -format %c histogram:info:- 2>/dev/null | awk '
        function h2(s,   i, c, v, d) {
            v = 0
            for (i = 1; i <= length(s); i++) {
                c = toupper(substr(s, i, 1))
                d = index("0123456789ABCDEF", c) - 1
                if (d < 0) return -1
                v = v * 16 + d
            }
            return v
        }
        { seen = 1
            hex = ""
            for (i = 1; i <= NF; i++) if (substr($i, 1, 1) == "#") hex = $i
            if (hex == "") next
            w = int((length(hex) - 1) / 3)
            if (w < 1) next
            r = h2(substr(hex, 2, w))
            g = h2(substr(hex, 2 + w, w))
            b = h2(substr(hex, 2 + 2 * w, w))
            if (r < 0 || g < 0 || b < 0) next
              # Proximity to editorError.foreground (#F14C4C), not a generic
              # redness test: the old predicate also matched the salmon used for
              # Markdown link syntax and the error badge, so it counted pixels
              # that are not the squiggle and could not tell them apart.
              dr = r - 241; dg = g - 76; db = b - 76
              if (dr*dr + dg*dg + db*db < 2025) total += ($1 + 0)   # 45^2
          }
          END { if (seen == 0) { print "MEASUREMENT-FAILED"; exit 0 } print total + 0 }'
}

# Guard helper: refuse to compare anything that is not a number. Bash's `-lt`
# on an empty string is a syntax error whose message ("integer expression
# expected") is easy to read past, and on "MEASUREMENT-FAILED" it is the same.
# Both mean the same thing and must stop the run rather than yield a verdict.
require_number() {
    local label=$1 value=$2
    case "$value" in
        # Returns non-zero rather than calling die: this runs inside $( ), a
        # subshell, where exit would end the subshell and let the caller carry
        # on with an empty value -- which is precisely the failure being guarded
        # against. The caller must check the status.
        ""|*[!0-9-]*)
            echo "FAIL: $label could not be measured (got: '"'"'${value}'"'"')" >&2
            return 1 ;;
    esac
    printf '%s' "$value"
}

grab() {
    ffmpeg -loglevel error -f x11grab -video_size "${SW}x${CAP_H}" -i :99.0+0,0 \
        -frames:v 1 -y "$1" 2>/dev/null
}

# A probe capture plus its red count, in one call.
probe_red() {
    grab /tmp/probe.png || return 1
    redcount /tmp/probe.png
}

fixture_line() { sed -n '10p' "$WS/docs/index.md"; }

echo "### 1. engine: editable install from the mounted local repo"
pip install --quiet -e "$CORE" 2>&1 | tail -2
# Recorded for completeness only. It cannot discriminate the local checkout
# from the published release: the version bump is the last step of a release,
# so both carry the same number for the whole development cycle.
zenzic --version

echo
echo "### 2. extension: package locally, install the .vsix"
rm -rf /home/demo/ext
cp -r "$EXT_SRC" /home/demo/ext
cd /home/demo/ext || die "no extension source"
npm ci --no-audit --no-fund >/dev/null 2>&1
npx --yes @vscode/vsce package --allow-missing-repository -o /home/demo/local.vsix >/dev/null 2>&1
code --install-extension /home/demo/local.vsix >/dev/null 2>&1
code --list-extensions --show-versions | grep -i zenzic

echo
echo "### 2b. PROVENANCE GATE -- the checks that actually discriminate"
# The verifier is supplied by the operator, not hardcoded here: it proves the
# engine and the extension came from the mounted checkouts rather than from a
# published release, and where it lives is the operator's business. Point
# PROVENANCE_SCRIPT at it (see README.md); the default is a copy placed in the
# container.
PROV="${PROVENANCE_SCRIPT:-/home/demo/verify_local_provenance.py}"
[ -f "$PROV" ] || die "no provenance verifier at $PROV -- provenance UNVERIFIED"
python3 "$PROV" --mount "$CORE" --extensions /home/demo/.vscode/extensions \
    || die "this is not provably the local build; refusing to record"

echo
echo "### 3. workspace: a writable copy of the Z108 fixture"
WS=/home/demo/z108
rm -rf "$WS"
cp -r "$CORE/examples/z108-empty-link-text" "$WS"
ORIGINAL_LINE="$(fixture_line)"
echo "line 10 before: $ORIGINAL_LINE"
case "$ORIGINAL_LINE" in
    '- [](guide.md)'*) ;;
    *) die "fixture line 10 is not the empty link this script positions on" ;;
esac

echo
echo "### 3b. strip UI that is not the subject"
# The image's settings cover theme and fonts. These are about what is IN FRAME:
# the first recording gave a third of every frame to VS Code's built-in chat
# panel ("Sign In", "Build with Agent", "AI responses may be inaccurate") in a
# demo whose entire claim is that a deterministic engine did the work. Removing
# the bundled assistant extension from the image does not remove that panel --
# the view is in VS Code core -- so it is closed here as well as hidden.
python3 - <<'PYEOF'
import json, pathlib
p = pathlib.Path("/home/demo/.config/Code/User/settings.json")
s = json.loads(p.read_text())
s.update({
    # The one that actually removes the chat view, the Sessions view and the
    # "Sign In" button. Verified against three alternatives that do not:
    # "workbench.secondarySideBar.defaultVisibility": "hidden" leaves the
    # panel open, Ctrl+Alt+B does nothing to it, and the palette's "Toggle
    # Secondary Side Bar" MAXIMIZES chat over the whole window.
    "chat.disableAIFeatures": True,
    "workbench.secondarySideBar.defaultVisibility": "hidden",
    "window.commandCenter": False,
    "workbench.layoutControl.enabled": False,
    "workbench.editor.editorActionsLocation": "hidden",
    "breadcrumbs.enabled": False,
    "editor.stickyScroll.enabled": False,
    "workbench.tips.enabled": False,
})
p.write_text(json.dumps(s, indent=2))
print("settings:", ", ".join(k for k in s if k.startswith(("workbench", "chat", "window", "breadcrumbs"))))
PYEOF

echo
echo "### 4. launch VS Code at ${SW}x${SH}, device scale factor ${DSF}"
/usr/share/code/code \
     --no-sandbox --disable-gpu --disable-dev-shm-usage \
     --force-device-scale-factor="$DSF" \
     --new-window \
     --disable-workspace-trust \
     --skip-release-notes --skip-welcome \
     --log info \
     "$WS" "$WS/docs/index.md" >/home/demo/code.log 2>&1 &

# `xdotool search` exits 0 with EMPTY output when it finds nothing, so waiting
# on its exit status is a decorative check. Wait on a real window id.
win=""
for _ in $(seq 1 90); do
    win="$(xdotool search --onlyvisible --class code 2>/dev/null | head -1)"
    [ -n "$win" ] && break
    sleep 1
done
[ -n "$win" ] || die "no VS Code window ever mapped"
echo "window mapped: id=$win name=$(xdotool getwindowname "$win")"

# Fill the 2x screen, minus the strip fluxbox paints its own toolbar into at
# the bottom: the first recording caught that toolbar under VS Code's status
# bar. CAP_H is both the window height and the capture height, so the frame
# contains the editor and nothing of the container's window manager.
xdotool windowsize "$win" "$SW" "$CAP_H"
xdotool windowmove "$win" 0 0
xdotool windowactivate --sync "$win" 2>/dev/null || xdotool windowactivate "$win"
sleep 2
echo "window geometry now: $(xdotool getwindowgeometry "$win" | tr '\n' ' ')"

# A setting a given VS Code build does not honour fails silently, so read the
# frame rather than the config. The chat panel's header sits in the top-right
# strip with a label and four icons; with the panel gone that strip is flat
# tab-bar background. Distinct colours separate the two cleanly.
aux_header_colours() {
    grab /tmp/aux.png || return 1
    convert /tmp/aux.png -crop "400x60+$((SW - 450))+55" +repage \
        -depth 8 -format %c histogram:info:- 2>/dev/null | wc -l
}
AUX="$(require_number "chat panel header colours" "$(aux_header_colours)")" \
    || die "cannot measure the chat panel header -- refusing to record blind"
echo "distinct colours where the chat panel header would be: $AUX"
[ "$AUX" -lt 40 ] \
    || die "the chat panel is still on screen ($AUX colours) -- a recording of Zenzic should not be a third someone else's product"

echo
echo "### 5. interaction primitives"
# Everything goes through XTEST against the focused window; `xdotool key
# --window` sends synthetic events that Electron ignores.
k()  { xdotool key --clearmodifiers "$@"; }
goto_empty_link() {
    xdotool windowactivate "$win"; sleep 0.3
    k Escape; sleep 0.3
    k ctrl+g; sleep 0.8
    xdotool type --delay 80 "10"; sleep 0.5
    k Return; sleep 0.8
    k Home; sleep 0.2
    # "- [](guide.md)": column 4 is between the brackets. Character movement on
    # a line whose text is asserted above is exact; word movement is not, since
    # "-" and "[" are separate word boundaries in some configurations.
    k Right Right Right; sleep 0.3
}

# Same landing point, without the Go-to-Line round trip. Used only after the
# quick fix, where the caret is already on line 10; if it ever is not, the
# final assertion on the line's text is what catches it -- which is why this
# shortcut is safe to take and the assertion is not optional.
park_on_link() {
    xdotool windowactivate "$win"; sleep 0.2
    k Escape; sleep 0.2
    k Home; sleep 0.2
    k Right Right Right; sleep 0.3
}

echo
echo "### 6. PROBE -- which lightbulb entry is the real fix, and does the"
echo "###    squiggle actually exist? Both answered by one intervention."
#
# An earlier version measured red pixels right after the window mapped and
# called that a negative control. It is not one: the language server can
# publish diagnostics within a second of the window appearing, so the
# "before" frame already contained the squiggle and the step never showed. A
# baseline that races the thing it is supposed to precede is not a control.
#
# What IS a control is an intervention we perform ourselves. Applying the fix
# removes the error; undoing it brings the error back. If the red count falls
# when the fix lands and rises when it is undone, the pixels being counted are
# the diagnostic and not the syntax highlighting -- and, separately, a
# lightbulb that produced no change proves no diagnostic was there to fix.
#
# The server offers two code actions; their ORDER in the menu is client-side
# presentation and is not readable from the server. Determined here by
# execution, unrecorded, so the recorded pass never gambles on a blind Return.
#
# The menu is NOT just the server's two entries. VS Code bundles
# markdown-language-features, which contributes its own Markdown refactors --
# "Convert to reference link" among them, which rewrites [](guide.md) to
# [][def]. That is what the earlier run kept applying: a real quick fix, from
# another extension, sitting above Zenzic's. Verified against the server
# directly over stdio: it offers exactly two actions and the placeholder fix is
# index 0 in three consecutive runs, so the ordering the recording sees is
# entirely the client's doing.
#
# Hence the sweep spans six entries rather than three, and the assertion is on
# the resulting TEXT rather than on the entry's position -- position is the
# thing that is not ours to predict.
sleep 20            # settle, not a check: the checks are the assertions below
FIX_INDEX=-1
RED_WITH=0
RED_WITHOUT=0
# Selected by TITLE, not by position. The quick-fix widget filters as you type,
# so typing a substring unique to Zenzic's action leaves it as the only entry
# and Return cannot land on anything else. Position was the original assumption
# and it was wrong twice over: VS Code bundles markdown-language-features, whose
# "Extract to link definition" shares the menu, and the ordering is client
# presentation the server cannot report. "placeholder" appears in Zenzic's title
# ("Fix Z108: Inject placeholder link text ('TODO')") and in no competing one.
#
# The retry loop stays: it is not searching for the right entry any more, only
# absorbing the case where diagnostics have not yet been published when the
# menu is opened.
FILTER="placeholder"
for sweep in 1 2 3; do
    for n in 0; do
        goto_empty_link
        RED_TRY="$(require_number "red pixels before fix" "$(probe_red)")" \
            || die "cannot measure the diagnostic before the fix"
        k ctrl+period; sleep 3
        xdotool type --window "$win" --delay 60 "$FILTER"; sleep 2
        k Return; sleep 1.5
        k ctrl+s; sleep 1.5
        AFTER="$(fixture_line)"
        echo "  sweep $sweep (filter '$FILTER') -> $AFTER"
        case "$AFTER" in
            '- [TODO](guide.md)'*)
                FIX_INDEX="$n"
                RED_WITH="$RED_TRY"
                RED_WITHOUT="$(require_number "red pixels after fix" "$(probe_red)")" \
                    || die "cannot measure the diagnostic after the fix"
                ;;
        esac
        # Put the file back and prove it went back, whether or not this entry
        # was the fix.
        xdotool windowactivate "$win"; sleep 0.3
        for _ in 1 2 3 4 5; do k ctrl+z; sleep 0.3; done
        k ctrl+s; sleep 1.5
        [ "$(fixture_line)" = "$ORIGINAL_LINE" ] \
            || die "undo did not restore line 10; refusing to record from a dirty fixture"
        [ "$FIX_INDEX" -ge 0 ] && break
    done
    [ "$FIX_INDEX" -ge 0 ] && break
    echo "  no entry worked on sweep $sweep -- diagnostics may still be pending"
    sleep 10
done
[ "$FIX_INDEX" -ge 0 ] || die "no lightbulb entry ever produced [TODO](guide.md)"
echo "real fix is menu entry #$FIX_INDEX"

echo
echo "### 6b. POSITIVE CONTROL: the red count answers to the intervention"
RED_BACK="$(probe_red)"
DROP=$((RED_WITH - RED_WITHOUT))
RECOVER=$((RED_BACK - RED_WITHOUT))
echo "red pixels  with error=$RED_WITH  after fix=$RED_WITHOUT  after undo=$RED_BACK"
echo "  drop when fixed = $DROP   recovery when undone = $RECOVER"
# Threshold is 100, not 300. The 300 was calibrated for the old predicate, which
# counted every salmon pixel of the Markdown link tokens as well as the squiggle
# and so reported thousands. The proximity detector counts only pixels within 45
# of #F14C4C: measured here at 211 with the diagnostic present, exactly 0 with it
# fixed, and 211 again after undo. Keeping 300 would fail a correct measurement
# for being smaller than a wrong one.
[ "$DROP" -gt 100 ] || die "applying the fix did not change the error-red count ($DROP) -- what is being counted is not the diagnostic"
[ "$RECOVER" -gt 100 ] || die "undoing the fix did not bring the diagnostic back ($RECOVER)"
DIAG_RED="$RED_WITH"

echo
echo "### 7. did the extension genuinely activate? (log, not silence)"
find /home/demo/.config/Code/logs -type f -name '*.log' 2>/dev/null \
    | xargs grep -ilE 'zenzic' 2>/dev/null | head -5

echo
echo "### 7b. ready to record: fixture restored, cursor parked at the top"
[ "$(fixture_line)" = "$ORIGINAL_LINE" ] || die "fixture not restored before recording"
xdotool windowactivate "$win"; sleep 0.3
k ctrl+Home; sleep 1

echo
echo "### 8. write probe on the output directory"
touch "$OUT/.write-probe" 2>/dev/null || die "$OUT is not writable by uid $(id -u)"
rm -f "$OUT/.write-probe"
MP4="$OUT/demo.mp4"
rm -f "$MP4"

echo
echo "### 9. RECORD"
# yuv444p, not yuv420p: this is an intermediate for a GIF, and chroma
# subsampling smears exactly the thin coloured strokes the demo is about.
# The capture is CAP_H tall so fluxbox's own toolbar is out of frame.
ffmpeg -loglevel error -f x11grab -video_size "${SW}x${CAP_H}" -framerate "$FPS" -i :99.0+0,0 \
    -c:v libx264 -preset ultrafast -qp 14 -pix_fmt yuv444p -y "$MP4" 2>/dev/null &
FFPID=$!
T0=$(date +%s.%N)
# awk, not bc: bc is not installed in this image and a missing timestamp
# would be silent.
mark() { echo "  mark $1 t=$(awk -v a="$(date +%s.%N)" -v b="$T0" 'BEGIN{printf "%.1f", a-b}')"; }
sleep 1
kill -0 "$FFPID" 2>/dev/null || die "ffmpeg died immediately"

mark start
sleep 1.2                    # a beat on the untouched file, squiggle in frame
goto_empty_link
sleep 0.8

# Hover, by keybinding. Frames are grabbed now and MEASURED after the take:
# an ImageMagick histogram mid-take freezes the picture for over a second,
# and three of those were most of the difference between a 36-second clip and
# a 22-second one. Grabbing is cheap; measuring is not.
PRE_HOVER=/tmp/pre-hover.png; grab "$PRE_HOVER"
mark hover
k ctrl+k ctrl+i
sleep 1.2
POST_HOVER=/tmp/post-hover.png; grab "$POST_HOVER"
sleep 1.5

k Escape; sleep 0.6

PRE_MENU=/tmp/pre-menu.png; grab "$PRE_MENU"
mark menu
k ctrl+period
sleep 1.3
POST_MENU=/tmp/post-menu.png; grab "$POST_MENU"
sleep 0.8

# Same selection as the probe: type the filter, so the recorded pass and the
# verified pass choose the entry the same way. Replaying by position here would
# reintroduce exactly the assumption the probe stopped relying on.
xdotool type --window "$win" --delay 60 "$FILTER"
sleep 1.2
mark apply
k Return
sleep 1.5
k ctrl+s
sleep 0.8

echo
echo "### 10. the check that decides whether this recording is usable"
FIXED_LINE="$(fixture_line)"
echo "line 10 after the quick fix: $FIXED_LINE"
case "$FIXED_LINE" in
    '- [TODO](guide.md)'*) ;;
    *) kill -INT "$FFPID" 2>/dev/null; wait "$FFPID" 2>/dev/null
       die "the applied action did not produce [TODO](guide.md) -- it was: $FIXED_LINE" ;;
esac
FRAME_FIXED=/tmp/after-quickfix.png; grab "$FRAME_FIXED"
sleep 1.5

# ---------------------------------------------------------------------------
# The quick fix does not end the story, and pretending it does would be the
# marketing version rather than the true one. `TODO` is itself a finding --
# Z501 PLACEHOLDER_TEXT, a warning, verified by running the engine on the fixed
# file: "0 errors, 1 warning" at docs/index.md:10:3. So the error goes away and
# a warning takes its place, deliberately, telling you to write real link text.
# Recording the last step too means the clip can end on a clean document, and
# it demonstrates the re-check-as-you-type claim the README makes.
# ---------------------------------------------------------------------------
mark replace
park_on_link
for _ in 1 2 3 4; do k shift+Right; sleep 0.1; done
sleep 0.5
xdotool type --delay 70 "Setup guide"
sleep 0.8
k ctrl+s
sleep 1.2

FINAL_LINE="$(fixture_line)"
echo "line 10 after typing real link text: $FINAL_LINE"
case "$FINAL_LINE" in
    '- [Setup guide](guide.md)'*) ;;
    *) kill -INT "$FFPID" 2>/dev/null; wait "$FFPID" 2>/dev/null
       die "typing real link text did not land: $FINAL_LINE" ;;
esac
FRAME_END=/tmp/after-typing.png; grab "$FRAME_END"
mark end
sleep 2

kill -INT "$FFPID" 2>/dev/null
wait "$FFPID" 2>/dev/null

echo
echo "### 10b. the mid-take checks, computed now that the take is over"
echo "hover changed pixels: $(compare -metric AE "$PRE_HOVER" "$POST_HOVER" null: 2>&1 | tr -d '\n')"
echo "menu changed pixels:  $(compare -metric AE "$PRE_MENU" "$POST_MENU" null: 2>&1 | tr -d '\n')"
RED_FIXED="$(redcount "$FRAME_FIXED")"
RED_AFTER="$(redcount "$FRAME_END")"
echo "red pixels  with the error=$DIAG_RED  after the quick fix=$RED_FIXED  at the end=$RED_AFTER"

echo
echo "### 11. recording"
[ -s "$MP4" ] || die "no video was written"
ffprobe -v error -select_streams v:0 \
    -show_entries stream=width,height,r_frame_rate,nb_frames,duration \
    -of default=noprint_wrappers=1 "$MP4"
stat -c 'demo.mp4 bytes=%s' "$MP4"

# Frames from the recorded pass, for the record and for cropping decisions.
cp /tmp/post-hover.png "$OUT/frame-hover.png" 2>/dev/null
cp /tmp/post-menu.png  "$OUT/frame-menu.png"  2>/dev/null
grab "$OUT/frame-fixed.png"
echo "wrote frame-hover.png frame-menu.png frame-fixed.png"
