#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 PythonWoods <dev@pythonwoods.dev>
// SPDX-License-Identifier: Apache-2.0
//
// Convert a screen recording (MP4/MOV/WebM) into a GIF sized for the VS Code
// Marketplace listing.
//
// Two passes, because one does not work well: pass 1 analyses the whole clip and
// builds a palette from the colours actually present; pass 2 re-encodes against
// that palette. GIF is limited to 256 colours per frame, so letting ffmpeg pick
// a generic palette produces visible banding on an editor screenshot, where most
// of the frame is a handful of flat UI colours and the interesting part is thin
// coloured squiggles.
//
//   node optimize-gif.js demo.mp4
//   node optimize-gif.js demo.mp4 assets/demo.gif --fps 12 --width 720
//   node optimize-gif.js demo.mp4 --start 00:00:03 --duration 8

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

// Meaning-carrying colours forced into the palette. These are VS Code's
// editorError.foreground and editorWarning.foreground -- the squiggle that is
// the whole subject of the asset, and the warning the quick fix leaves behind.
// See seedPalette() for why they cannot be left to palettegen.
const DEFAULT_SEED = ["F14C4C", "CCA700"];
// dither defaults to `none`, not `bayer`. Measured on the real recording:
// `none` gave identical RMSE against the unquantised reference (1.35 vs 1.52),
// a smaller file (263 KB vs 274 KB), and -- the reason -- it snaps each pixel
// to the NEAREST palette entry, so a seeded exact colour is actually reached.
// Bayer dithering spreads a pixel across neighbouring entries, which is the
// right choice when the palette lacks the colour and the wrong one when it has
// been put there deliberately.
const DEFAULTS = { fps: 15, width: 800, colors: 256, dither: "none", seed: DEFAULT_SEED };

function parseArgs(argv) {
  const opts = { ...DEFAULTS, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fps" || a === "--width" || a === "--colors") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v <= 0) fail(`${a} needs a positive number`);
      opts[a.slice(2)] = v;
    } else if (a === "--dither") {
      opts.dither = argv[++i];
    } else if (a === "--seed") {
      const v = argv[++i] ?? "";
      opts.seed = v === "none" ? [] : v.split(",").map((h) => h.trim().replace(/^#/, ""));
      for (const h of opts.seed) {
        if (!/^[0-9A-Fa-f]{6}$/.test(h)) fail(`--seed needs RRGGBB hex values, got: ${h}`);
      }
    } else if (a === "--start" || a === "--duration") {
      opts[a.slice(2)] = argv[++i];
    } else if (a === "-h" || a === "--help") {
      usage(0);
    } else if (a.startsWith("-")) {
      fail(`unknown option: ${a}`);
    } else {
      opts.positional.push(a);
    }
  }
  return opts;
}

function usage(code) {
  console.log(`
optimize-gif — screen recording to Marketplace-ready GIF

  node optimize-gif.js <input> [output] [options]

  --fps <n>        frames per second        (default ${DEFAULTS.fps})
  --width <px>     output width, height auto (default ${DEFAULTS.width}; never upscales)
  --colors <n>     palette size, 2-256      (default ${DEFAULTS.colors})
  --dither <mode>  none|bayer|floyd_steinberg|sierra2 (default ${DEFAULTS.dither})
  --seed <hex,...> force exact colours into the palette, or "none"
                   (default ${DEFAULT_SEED.map((h) => "#" + h).join(",")})
  --start <ts>     trim start, e.g. 00:00:03
  --duration <s>   seconds to keep

Output defaults to <input>.gif beside the input.
`);
  process.exit(code);
}

function fail(msg) {
  console.error(`optimize-gif: ${msg}`);
  process.exit(1);
}

function ffmpeg(args) {
  return execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", ...args], {
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// Force exact colours into a generated palette, in place.
//
// WHY THIS IS NECESSARY, measured rather than assumed. palettegen allocates its
// 256 slots by frequency. An antialiased 1-2px underline is the least frequent
// thing on an editor screenshot, so the colour carrying the entire message
// competes against flat UI fill and loses. On the real recording the nearest
// entry `stats_mode=full` allocated to #F14C4C was #C96256 -- a distance of
// 46.7, outside even the loose proximity threshold the asset used to be checked
// with. Every squiggle pixel then collapsed onto that one entry: zero pixels
// anywhere near the product's own error colour, in an asset whose only subject
// is that colour.
//
// TWO ALTERNATIVES WERE MEASURED AND REJECTED:
//   - stats_mode=full alone. This is what shipped; see above.
//   - per-frame palettes (stats_mode=single + paletteuse new=1), the option that
//     sounds like it fixes the problem at the root. It does not: allocation is
//     still by frequency, just within one frame, and the squiggle is still the
//     rarest thing in that frame. Nearest entry 47.1 -- no better than `full` --
//     for a file 53x larger (13.9 MB against 263 KB). It was rejected on
//     fidelity, and would have been rejected on size anyway.
// Seeding gets the exact colour for one palette slot each.
//
// The entry replaced is the one NEAREST the target, not the least used: the
// nearest entry is a near-duplicate of what we want, so the swap costs almost
// nothing elsewhere, whereas evicting a rare-but-distinct colour trades one
// visible artefact for another.
//
// The palette is read and written as raw RGB through ffmpeg rather than with an
// image library, so this script still depends on ffmpeg and nothing else.
function seedPalette(palette, seeds) {
  if (seeds.length === 0) return [];
  const raw = execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-i", palette, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
    { maxBuffer: 1 << 20 },
  );
  const side = Math.round(Math.sqrt(raw.length / 3));
  if (side * side * 3 !== raw.length) {
    fail(`palette is ${raw.length} bytes, which is not a square RGB image`);
  }
  const claimed = new Set();
  const applied = [];
  for (const hex of seeds) {
    const t = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < raw.length; i += 3) {
      if (claimed.has(i)) continue;
      const d =
        (raw[i] - t[0]) ** 2 + (raw[i + 1] - t[1]) ** 2 + (raw[i + 2] - t[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) fail("palette has no free entry to seed");
    const was = [raw[best], raw[best + 1], raw[best + 2]];
    claimed.add(best);
    [raw[best], raw[best + 1], raw[best + 2]] = t;
    applied.push({
      hex,
      was: was.map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase(),
      distance: Math.sqrt(bestD),
    });
  }
  execFileSync(
    "ffmpeg",
    ["-hide_banner", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
     "-video_size", `${side}x${side}`, "-i", "-", "-y", palette],
    { input: raw },
  );
  return applied;
}

function human(bytes) {
  return bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(2)} MB`
    : `${(bytes / 1024).toFixed(0)} KB`;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.positional.length === 0) usage(1);

  const input = opts.positional[0];
  if (!fs.existsSync(input)) fail(`input not found: ${input}`);
  if (opts.colors < 2 || opts.colors > 256) fail("--colors must be between 2 and 256");

  const output =
    opts.positional[1] ??
    path.join(path.dirname(input), `${path.basename(input, path.extname(input))}.gif`);

  try {
    execFileSync("ffmpeg", ["-version"], { stdio: "ignore" });
  } catch {
    fail("ffmpeg not found on PATH — install it first (see README)");
  }

  // Trim flags go before -i so ffmpeg seeks rather than decoding and discarding.
  const trim = [];
  if (opts.start) trim.push("-ss", opts.start);
  if (opts.duration) trim.push("-t", String(opts.duration));

  // `min(width,iw)` so a small recording is never blown up into a blurry GIF.
  // lanczos keeps text edges crisp, which matters when the subject is an editor.
  const chain =
    `fps=${opts.fps},scale='min(${opts.width},iw)':-1:flags=lanczos`;

  const paletteDir = fs.mkdtempSync(path.join(os.tmpdir(), "optimize-gif-"));
  const palette = path.join(paletteDir, "palette.png");

  try {
      // Pass 1 — stats_mode=full, NOT diff. `diff` weights the palette by what
      // changes between frames, which sounds right for a screencast and is wrong
      // for this one: the error squiggle is a 1-2px antialiased underline that is
      // *static* once drawn, so it changes least and gets no palette entry at all.
      // It is then dithered into the surrounding salmon of the Markdown link
      // tokens, and the GIF ends up demonstrating a diagnostic absent from its own
      // frames -- which is what shipped in v0.30.0.
      //
      // Measured on identical input (same frames, same dithering, only this
      // parameter differing): diff -> 0 pixels within 45 of #F14C4C, full -> 60.
      // The correct palette cost 65 bytes.
      //
      // Verify a regenerated GIF by colour proximity to #F14C4C
      // (editorError.foreground), never by a raw red-pixel count: syntax
      // highlighting paints link tokens salmon and satisfies such a count on its
      // own, which is how the original defect passed its own check.
    ffmpeg([
      ...trim, "-i", input,
      "-vf", `${chain},palettegen=max_colors=${opts.colors}:stats_mode=full`,
      "-y", palette,
    ]);

    // Pass 1b — put the meaning-carrying colours in the palette by force.
    for (const a of seedPalette(palette, opts.seed)) {
      console.log(
        `seeded #${a.hex} over #${a.was} (nearest entry, ${a.distance.toFixed(1)} away)`,
      );
    }

    // Pass 2 — diff_mode=rectangle lets ffmpeg re-encode only the changed region
    // of each frame, which is most of the size saving on this kind of clip.
    // `dither` is an option now rather than a constant; see DEFAULTS for why its
    // default changed from bayer to none once the palette started being seeded.
    const dither =
      opts.dither === "bayer" ? "bayer:bayer_scale=5" : `${opts.dither}`;
    ffmpeg([
      ...trim, "-i", input, "-i", palette,
      "-lavfi", `${chain}[x];[x][1:v]paletteuse=dither=${dither}:diff_mode=rectangle`,
      "-loop", "0", "-y", output,
    ]);
  } catch (err) {
    const detail = err.stderr ? err.stderr.toString().trim() : err.message;
    fail(`ffmpeg failed:\n${detail}`);
  } finally {
    fs.rmSync(paletteDir, { recursive: true, force: true });
  }

  const inSize = fs.statSync(input).size;
  const outSize = fs.statSync(output).size;
  console.log(`${input}  ${human(inSize)}`);
  console.log(
    `${output}  ${human(outSize)}   ${opts.width}px wide, ${opts.fps}fps, ` +
      `${opts.colors} colours, dither=${opts.dither}`,
  );
  if (outSize > 10 * 1024 * 1024) {
    console.log("\nOver 10 MB — GitHub will not render it inline. Try --fps 10, --width 640, or a shorter --duration.");
  }
}

main();
