---
name: youtube-create-thumbnail
description: Create high-click-through YouTube thumbnails and vertical video covers that spark curiosity without lying. Builds a truthful information-gap concept, preserves up to three referenced identities (taking them from the video's own webcam recording when no photo is given), supports logos and controlled variants, generates the image with Codex (`codex exec`) or, failing that, with Wallabot, and exports a ready-to-upload 1280x720 JPEG under 2 MB. Works in any repo. Use when: "make a YouTube thumbnail", "thumbnail for this video", "MrBeast-style cover", "Shorts cover", "Instagram video cover", "miniatura de YouTube". Chain after any video workflow once its truthful topic and visual direction are known. Not for producing the video, writing the script (youtube-create-narration) or the title and description (youtube-create-metadata).
argument-hint: "[video-topic-or-title] [--image <face-or-logo>] [--ratio 16:9|9:16|4:5]"
---

# YouTube Create Thumbnail

Turn the real promise of a video into an image that is understood in under a second and stays legible on mobile. The thumbnail opens a question the video answers; it never promises a result the content does not deliver. Create a clean concept, generate each variant, inspect it, and make only requested surgical edits.

## UX rules

1. Match the user's language. Keep tool mechanics out of normal chat.
2. Do not ask for facts already in the brief. Ask one compact question only when a missing choice changes the result.
3. Never invent claims, outcomes, products, people, screenshots, metrics or logos that are not true of the video.
4. Do not print raw JSON, job ids or session ids to the user. Deliver the image and a short variant label.
5. A style-reference thumbnail is for visual analysis only. Never pass it to the generator as an image input; copying its identity or exact composition is forbidden.
6. One generation per concept, emotion or camera take. Never ask for several variants in one call.
7. Do not upload or publish the thumbnail unless explicitly asked.

## Intake gates

Collect only what the brief does not answer:

- The video's topic or title and the truthful promise the thumbnail may imply. Read the script or transcript if one exists.
- What the viewer already knows from the title (see youtube-create-metadata: title and thumbnail are a pair, so the thumbnail text must not repeat the title).
- Exact scene requirements, if any.
- Who appears: 0-3 people. If a concept needs a person and no face photo was provided, first try the video's own recording (see "Identity references"); otherwise ask whether to use the user, another provided person, or a generic generated character. Never choose silently.
- Optional style-reference thumbnail. Analyze it with vision for energy, framing, split layout, palette and emotion; do not send it to the generator.
- Optional logo and whether it stays flat or becomes a 3D object. Derive colors, typography, lighting and shapes from the real brand or project when they exist.
- Optional headline of 2-7 words. Default delivery is a clean image with no text, plus a deterministic overlay when the user requests one. Bake text into the generated image only when explicitly requested.
- Ratio: `16:9` for YouTube by default, `9:16` for Shorts, `4:5` for Instagram.
- One final concept or a variant set. If unspecified and alternatives would materially help, offer about four. Hard cap: 16 generations in total.

If the user gives an emotion count without names, use this ladder: shock, hype, rage, awe, laugh, fear, smug, charisma, confusion, determination, disgust.

## Concept gate

Read `references/thumbnail-frameworks.md`. Brainstorm at least five truthful concepts internally, across several frameworks, and pick the strongest information gap with one focal subject and minimal clutter. Combine frameworks only when the result still reads in under a second at roughly 120 px wide.

Prefer a headline with a concrete idea, not a description of the topic: a limitation, a consequence, a contrast, a hard decision, or a claim the video proves. It may flirt with clickbait through curiosity, urgency or surprise, but must never:

- invent a failure, result, figure or danger;
- exaggerate an emotion the video does not contain;
- hide a condition that makes the promise false;
- use absolutes ("nobody", "always", "impossible") without backing.

If the user already chose the text, respect it unless asked to improve it. When improving it, say in one sentence why the new option is stronger and still faithful to the video.

When a reference thumbnail exists, extract this structure before prompting, and let user instructions override it field by field:

```text
brief, generic subject pose/action, elements, location, composition, background,
split (true/false), split_count, person_count, emotion, emotion_detail
```

## Design for the small view

One clear hierarchy: a dominant text hook, a main face, product or object, and a secondary element that explains the conflict or result. High contrast, clean silhouettes, negative space. Keep the face and important text inside the central 90% of the canvas. Check the composition at full size and reduced to about 10-15%.

Avoid busy backgrounds, tiny code, text-heavy interfaces, more than two type styles, ornaments that compete with the hook, and worn-out devices (red arrows, circles, flames, exaggerated surprise faces) unless requested and meaningful.

## Identity references

When the user provides a photo or frame, treat it as an identity reference or an edit target as requested. Preserve face, age, skin tone, hair and recognizable features; allow only a slight, natural change of expression or pose; remove the background only when it improves the composition; never duplicate the face, deform hands or caricature the person. Inspect the file with vision first.

If no photo is given, use frames from the video's own recording (the OBS webcam track, `*-webcam.mp4`, or frames already extracted for the edit). Never use photos from outside the project or from the internet, and say in the delivery which file and instant they come from.

- Pick 4-6 frames from different moments (more angles and expressions help keep identity): front face, eyes open, good light, mouth not mid-word, no motion.
- Crop them to head and shoulders, square, never scaled below about 600 px a side, next to the thumbnail:

  ```bash
  ffmpeg -ss <second> -i <webcam-recording.mp4> -frames:v 1 -vf "crop=<side>:<side>:<x>:<y>" face1.png   # face2.png, face3.png...
  ```

- Review the crops before generating. Pass them as identity references, never as an image that must appear as is.

## Reference order

Pass face photos first in character order, then the logo. When two or more references are attached, the first line of the prompt is a manifest:

```text
IMAGE REFERENCES: image 1 = CHARACTER 1 face reference; image 2 = brand logo.
```

## Prompt contract

Write every main-render prompt as a short specification, in this order:

1. **Frame:** `Bold, punchy YouTube-thumbnail composite, poster-grade, photoreal and high-impact, NOT a muted cinematic movie still, <ratio>, single unified frame, no split-screen, no diagonal divide, everything blends smoothly across the same continuous shot.` For `9:16` add `faces in the upper two-thirds`. A requested graphical representation replaces the photoreal language with a clean diagram or graphic brief.
2. **Scene brief:** depict the user's exact content.
3. **Text:** default `No text, no readable UI labels, no watermark.` For an explicit baked headline: `TEXT: bold thumbnail headline text baked into the image, reading exactly "<TEXT>", massive, ultra-legible sans-serif with a clean outline/glow treatment, placed where it never covers the subject's face. No other text, no watermark.` Demand the exact phrase with its accents, uppercase, heavy type, few lines.
4. **Subjects:** large, foreground-dominant, chest-up or medium-close, about 40-60% of the frame. End with `All faces crisply sharp as the anchors of the shot.`
5. **Key elements:** only the props or effects that explain the information gap.
6. **Logo:** preserve exact shapes, colors, proportions and letterforms; keep it away from faces.
7. **Location:** place, time, weather and atmosphere when relevant.
8. **Composition:** one hero on a power third, clear scale hierarchy, depth, strong subject/background separation.
9. **Background:** vivid high-contrast color field or environment, soft vignette; do not divide it unless a split layout was requested.
10. **Lighting on people:** `signature YouTube thumbnail lighting rig: strong key light sculpting the face, soft dreamy fill lifting shadows, and defined back light plus hair light tracing a clean bright rim around hair, shoulders and silhouette.` Only the rim may use a colored accent.
11. **Grade:** vivid, bright, glossy, poster-punchy, deep blacks, crisp highlights, rich saturated colors, cohesive as one image. Restrain it only for an explicit calm, premium or muted brief.

For each person with a photo reference include:

```text
CHARACTER N: the person from attached face reference #K. IDENTITY LOCK: reproduce
this exact person with a photographic identity match: same bone structure, eye shape,
nose, lips, jawline, skin tone, hairline and hair texture. Do not beautify, average,
or restyle the face. Expression: <emotion phrase>.
```

### Split layouts

Use a split only when the user asks for `split`, `before/after`, `versus`, `side by side`, or the analyzed reference is split. A topical phrase such as "X vs Y" does not itself require a split. Replace the frame block with a clear halves/panels contract and keep labels out unless short, truthful baked text was requested.

## Generating the image

Write the final prompt to a text file in a scratch folder and feed it by stdin, so quotes and multiline blocks survive. Use these backends in order, and say which one was used.

### 1. Codex (preferred)

```bash
codex exec --skip-git-repo-check -i face1.png -i face2.png -i logo.png - < thumbnail-prompt.txt
```

`codex exec` runs Codex non-interactively and uses its built-in image tool, so it needs no API key. `--skip-git-repo-check` is needed outside a git repo. Repeat `-i` for every reference, in manifest order; omit it when there are none. Start the prompt with "Generate ONE image with your built-in image generation tool" and ask for one image per call. A call takes a few minutes: run it in the background. The `AuthRequired` MCP errors in its log are noise.

Codex stores each result under `~/.codex/generated_images/<session-id>/exec-<uuid>.png`. Find it with `find ~/.codex/generated_images -type f -newer thumbnail-prompt.txt`, copy it next to the thumbnail with a descriptive, versioned name, and do not overwrite earlier versions. The file is about 1672x941, so always run the export step afterwards.

Verified on 2026-11-16: a text-only prompt returned a 16:9 image with the quoted headline spelled exactly, accent included.

If `codex` is missing, not logged in, or its image tool is unavailable in the session, tell the user once and go to the next backend.

### 2. Wallabot (fallback)

Use the `wallabot-media` skill (`scripts/wallabot.py image`, 1024 px by default, `--size landscape` for 16:9):

```bash
uv run $WALLABOT/scripts/wallabot.py image "<prompt>" -o thumb-v1.png -r face1.png -r logo.png --size landscape
```

`-r` takes up to 10 references. Follow the Wallabot rules for GPU ownership: check the status before loading, never cut a running call, and unload when done. Quote the exact headline in the prompt only when baked text was requested, and check every character.

If neither backend works, say so before trying anything else.

## Optional 3D logo

Generate a 1:1 render first (same backend, reference = the flat logo, prompt: `Transform the attached 2D logo into a premium 3D logo render: extrude the exact logo shapes into glossy dimensional volumes; preserve every letterform, proportion and brand color; soft studio reflections, subtle bevels, crisp edges, clean dark neutral background, soft contact shadow, centered, generous margins, no extra text, no watermark.`), then pass that render as the logo reference on every thumbnail call.

## Post-render gate

Inspect every result with vision (`Read` the image, and look at a 10-15% downscale too):

- Referenced identities visibly match.
- No stray text or watermark unless baked text was ordered; explicit baked text matches character for character, accents included. A great composition with wrong text is not a valid delivery.
- Face, emotion and hero element stay readable at about 120 px wide.
- The concept truthfully matches the video promise.

On a hard failure, retry the same prompt at most twice. If visual inspection is unavailable, do not claim it passed; deliver for the user's review. Present every passing variant and let the user pick before optional tweaks. Iterate changing one thing at a time, repeating the identity invariants, and never overwrite a previous version unless asked.

## Surgical tweaks

Use the picked image as the only input, with a narrow prompt that states that every other property stays unchanged:

```text
Change ONLY <the person's facial expression to: <phrase>>. Keep identity, face structure, hair, pose,
body, clothing, logo, background, lighting and composition EXACTLY unchanged, pixel-faithful.
Keep the YouTube thumbnail lighting rig intact.
```

Allowed scopes: expression only, background replacement only, background recolor only, or rim-light recolor only. Never silently regenerate the full composition for a surgical request. Each accepted edit becomes the source for the next one.

## Text overlay

Keep the generated image text-free by default. When a headline overlay is requested, read `references/text-overlay-bake.md` and use one of its five presets: Beast, Fire, Neon Lime, Clean Glass or Marker. The overlay path needs an environment that can render HTML canvas; if unavailable, offer either the clean image or an explicitly approved baked-text regeneration. Never pass an HTML preview off as a flattened PNG.

## Export for YouTube

The final file must be exactly `1280 x 720` (16:9), keep the framing and weigh under 2 MB. For an opaque final image:

```bash
scripts/export_thumbnail.sh input.png output.jpg
```

The script (needs ImageMagick) center-crops only what is needed to reach 16:9, strips metadata and lowers the quality step by step to respect the limit. It refuses to overwrite an existing output, so use versioned names. Afterwards check dimensions, weight, spelling, identity, safe zone and legibility at small size. Shorts and Instagram covers keep their requested ratio and skip this script.

## Delivery

Show the thumbnail in the conversation and give a link to the final file. State:

- the chosen hook and how it relates to the content;
- dimensions and weight;
- the final path;
- the prompt used, or a faithful summary if it is long;
- whether it was generated from scratch or edited from a reference image, and which backend was used;
- for identity references taken from the recording, the source file and instant.

Do not expose retry mechanics unless asked.

## Reference files

- `references/thumbnail-frameworks.md`: 16 concept frameworks, the information-gap rule and the truthfulness law.
- `references/text-overlay-bake.md`: five deterministic text-overlay styles and a 4K canvas-bake recipe.
- `scripts/export_thumbnail.sh`: crop, resize and compress to a 1280x720 JPEG under 2 MB.
