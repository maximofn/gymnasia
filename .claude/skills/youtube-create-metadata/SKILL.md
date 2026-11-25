---
name: youtube-create-metadata
description: Use when the user wants YouTube metadata for a video: a click-worthy but honest title, an SEO/above-the-fold description, tags, and timestamped chapters. Accepts a transcript (ideally timestamped SRT), a script, an article, a project, a topic, or a freeform description. Works in any repo, used standalone and by /produce-video. Triggers on "youtube title", "youtube description", "youtube chapters", "youtube tags", "youtube metadata", "youtube-create-metadata", and the Spanish "título/descripción/etiquetas del vídeo". Not for writing the script (use youtube-create-narration) or the thumbnail (use youtube-create-thumbnail).
---

# YouTube Create Metadata

Write the pieces of YouTube metadata that drive clicks and rank: **title, description, tags, chapters**. The package may flirt with clickbait through curiosity, conflict or surprise, but must never promise what the video does not deliver. Ground everything in the provided source (transcript / script / topic) and never invent claims, numbers, results or links the source does not support.

Write the metadata in the language, tone and terminology of the video and its creator (keep audience terms such as `tool`, `LLM`, `system prompt`, `harness` when the audience uses them).

## Understand the video first

Before drafting, identify:

- what actually happens in the video;
- what the viewer learns, discovers or gets;
- who it is for and how much they already know;
- the conflict, decision, result or detail that is most interesting;
- the thumbnail text and idea, if a thumbnail already exists;
- which proper names, technologies and links are confirmed.

Ask a question only when a missing fact would materially change the promise of the video. A missing secondary fact is omitted or marked as pending.

## Writing rule (non-negotiable)

**Never use em-dashes or en-dashes. Use a hyphen `-` instead.** This applies to the title, description, chapter separators, everything.

## Title and thumbnail are a pair

The title must make sense alone and also complete the thumbnail. Do not repeat the thumbnail text word for word unless asked. Split the information: the thumbnail raises the conflict, surprise or question; the title brings the cause, the project, the transformation or the consequence.

Look for an honest tension: an unexpected result, a real limitation, a hard decision, the gap between the initial intent and the final result. Do not use fear, urgency, controversy, failure or success if the video does not show them. Avoid absolutes ("nobody", "always", "impossible", "the only") without evidence.

Title rules:

- **60-70 characters** (hard max 100; past ~70 it truncates on most surfaces).
- **Primary keyword near the front**, so the topic is clear at a glance.
- Do all three: spark curiosity or emotion, include the keyword, and set honest expectations.
- Raise a concrete question, not an empty curiosity. It must sound natural read aloud.
- A **number** when natural, and emotive words when they fit ("actually", "finally", "stop", "the right way", "without").
- No ALL CAPS, emoji, exclamation spam or keyword stuffing. Usually no hashtags in the title.
- Useful starters (pick what fits, do not force): "How to X (without Y)", "The X that Y", "Stop doing X - do this instead", "X explained in N minutes", "I tried X so you don't have to", "N ways to X".

Draft 2-3 options internally and pick the strongest. Offer 3-5 alternatives only when they bring really different angles (more emotional, clearer, more technical, more search-oriented).

## Description

Front-loaded: the first ~100-160 characters show above the fold and in search, so the **first two lines must work without "Show more"**. State the conflict or result and why the video is worth watching. Do not waste them on greetings, links or a literal repeat of the title.

1. **Hook (first 1-2 sentences)** with the primary keyword. Promise the outcome.
2. A short paragraph (2-4 sentences) with enough context for someone who does not know the channel or the project, and the scope, so expectations are right.
3. Learnings or topics as a list, only when it helps scanning.
4. **Chapters** (below) for videos over ~10 min or with clear sections.
5. **One main CTA**, tied to the natural next step. Only links the user provided or that are confirmed; never fabricate URLs.
6. **2-3 relevant hashtags** at the very end, kept separate from the internal tags.

Length: tight and useful, roughly 150-300 words / under ~1000 characters. Write for humans, weave related keywords in naturally, keep the creator's voice. It must not hide basic information nor turn into a transcript.

## Tags

- **5-15** tags, primary keyword or phrase first.
- Mix **broad** (`react`, `webdev`) and **specific** (`react router loader data`) tags. Add the project, product or series name, technologies and entities actually mentioned, and specific searches that describe the viewer's intent.
- Spanish and English variants only when the community uses both.
- No trends, competitors or popular concepts just to attract traffic. No near-identical variations, no overly generic tags, no terms that promise a topic the video lacks.
- Deliver them **comma-separated, without `#`**, ready to paste into YouTube Studio.

## Chapters (need a timestamped source)

YouTube hard rules: the **first chapter must be `00:00`**, **at least 3 chapters** in ascending order, each **>= 10 seconds**. Without a timestamped source (SRT or `words.json`), ask for one or skip chapters and say so.

- The first chapter answers "why did they click?": name it the payoff or topic (e.g. "Type-safe loader data", "The final result"), never "Intro".
- Titles of **3-8 words**, one clear noun phrase. Replace useless labels ("Intro", "Demo", "Conclusion", "Q&A") with the real topic of the section.
- Roughly every **2-4 minutes** for tutorials, **5-10 minutes** for long-form; **5-15 chapters**, never more than ~20.
- Take each `MM:SS` (or `H:MM:SS` past an hour) from the moment the section actually begins. Separator is a hyphen.

If the user asks only for title, description and tags, leave chapters out. Do not add pinned comment, social copy, shorts or publishing strategy unless asked.

## Output format

Unless the user asks for another format, deliver (write `youtube.md` when `/produce-video` calls this skill, into its output folder):

```
# YouTube

**Title**

<recommended title>

<one sentence on why it complements the video and the thumbnail>

**Alternatives** (only if they offer different, useful angles)

- ...

**Description**

<ready to copy and paste>

**Tags**

tag one, tag two, tag three

**Chapters**

00:00 - <chapter>
01:15 - <chapter>
```

If the thumbnail text is known, quote it when justifying the title.

## Final check

- Title and thumbnail complement each other and do not duplicate the same idea.
- The strongest promise is backed by the content.
- Title <= 70 characters, keyword-forward, understandable out of context.
- The first lines of the description create interest and explain the topic; no invented links, features or results.
- Tags 5-15, genuinely about the video, not inflated.
- Chapters start at 00:00, ascending, 3 or more, descriptive.
- Language, tone and terminology match the creator. **No em-dashes anywhere.**

## References

- [vidIQ - YouTube titles (11 formulas)](https://vidiq.com/blog/post/youtube-video-title/)
- [vidIQ - YouTube descriptions](https://vidiq.com/blog/post/youtube-video-descriptions/)
- [YouTube Help - Video chapters](https://support.google.com/youtube/answer/9884579)
