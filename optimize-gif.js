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

const DEFAULTS = { fps: 15, width: 800, colors: 256 };

function parseArgs(argv) {
  const opts = { ...DEFAULTS, positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--fps" || a === "--width" || a === "--colors") {
      const v = Number(argv[++i]);
      if (!Number.isFinite(v) || v <= 0) fail(`${a} needs a positive number`);
      opts[a.slice(2)] = v;
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
    // Pass 1 — stats_mode=diff weights colours by what actually changes between
    // frames, so the palette is spent on the moving parts rather than the large
    // static background of an editor window.
    ffmpeg([
      ...trim, "-i", input,
      "-vf", `${chain},palettegen=max_colors=${opts.colors}:stats_mode=diff`,
      "-y", palette,
    ]);

    // Pass 2 — bayer dithering is deliberate: it is stable frame to frame, so a
    // mostly-static screencast does not shimmer. diff_mode=rectangle lets ffmpeg
    // re-encode only the changed region of each frame, which is most of the size
    // saving on this kind of clip.
    ffmpeg([
      ...trim, "-i", input, "-i", palette,
      "-lavfi", `${chain}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
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
  console.log(`${output}  ${human(outSize)}   ${opts.width}px wide, ${opts.fps}fps, ${opts.colors} colours`);
  if (outSize > 10 * 1024 * 1024) {
    console.log("\nOver 10 MB — GitHub will not render it inline. Try --fps 10, --width 640, or a shorter --duration.");
  }
}

main();
