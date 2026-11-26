---
name: youtube-create-narration
description: Write or revise the spoken script (guion de vídeo, what the presenter says on camera plus visual cues) of a YouTube video from ideas, articles, transcripts, research, or implementations. Not a computer program or code script. Use for "guion de YouTube", "write the video script", educational explanations, tutorials, case studies, entertainment, hooks, pacing, and viewer retention. Builds an understandable spoken narrative with coordinated visual cues, grounded examples, and an editing pass.
---

# YouTube Script Writing

Deliver a complete spoken script, not just an outline. Honor the user's language, audience, existing corrections, and requested format. Adapt source material for listening and watching; do not read an article aloud unchanged.

## Establish the viewing goal

Use the conversation and source material to determine the audience, what they already know, the question the video answers, and what they should understand or be able to do afterward. For a series, give enough context to enter through this video without watching earlier episodes.

If duration or style is unspecified, choose reasonable defaults and state them briefly. Ask only when missing information materially changes the script. The checkpoints below are internal writing stages, not mandatory user approval gates. Do not stop at an outline when a complete script was requested.

For educational content, understanding and prerequisite order take priority over surprise, point rankings, or delayed reveals. Emotion and curiosity can support the explanation; they are not prerequisites for writing it. For entertainment or independent list items, choose pacing that suits the intended experience.

## 1. Establish the evidence

Read the supplied source before drafting. For implementation-based teaching, verify consequential behavior against code and tests. Identify what was observed, what is an illustrative example, and what is a proposed design. Never present these as interchangeable.

Use primary sources when outside research is needed. A supplied article can be sufficient; competitor research, keyword tools, and a quota of surprising facts are optional. Select details for their explanatory value. Move dates, versions, test counts, paths, and diagnostic details to production notes unless they change the lesson. See [references/research.md](references/research.md).

## 2. Open with an understandable problem

Show a concrete situation and its consequence, then state what the viewer will learn. Align the spoken hook, on-screen text, and title. Avoid unexplained jargon, invented stakes, inflated promises, and withholding a definition merely to keep people watching.

Use [references/hooks.md](references/hooks.md) for optional opening formats, not factual claims or a required formula.

## 3. Order the explanation

Outline the causal sequence before drafting. A useful educational progression is:

1. A natural user situation and the problem it reveals.
2. The actors and their jobs, with enough context to follow the example.
3. A simple mental model of what happens, in the actual execution order.
4. The reusable decision or contract, followed by its technical labels.
5. A worked example and relevant variations or failure cases.
6. Evidence, limits, and the lesson the viewer can apply elsewhere.

Explain each concept before depending on it. Keep an example stable while introducing its parts; change scenarios only when the new one reveals something the first cannot. See [references/structures.md](references/structures.md) for alternative structures. Do not rank dependent teaching points by how surprising they are.

## 4. Write for a listener

- Define a technical term at first use by explaining its job. Describe an app-specific operation before naming its function or identifier.
- Prefer everyday wording. Preserve established technical terms and code identifiers when useful; translate the surrounding explanation naturally.
- Make the actor explicit: who requests, who checks, who executes, who receives the result, and who decides what is allowed next? Do not attribute a program's action to the model or invent a different execution sequence for a story.
- Give domain context before the example. User dialogue should sound like a plausible user request, not a test prompt or an instruction written to expose an internal branch.
- Use connected, speakable sentences and one main idea per beat. Avoid both long nested clauses and a succession of disconnected slogans.
- Follow an abstract rule with a concrete application and its consequence. Restate only when an example or a short transition adds understanding; automatic repetition does not repair an unclear explanation.
- Distinguish a rule, the mechanism enforcing it, and the evidence that it worked. Explain what a test demonstrates and its limits rather than reciting test metadata.
- Teach a transferable pattern rather than touring files, internal module names, or repository history.

## 5. Coordinate narration and visuals

Keep spoken narration separate from cues that are not read aloud. For each necessary visual, specify what appears, in what order, and what the viewer should notice. In a process diagram, show the active step as it is explained. Label external data separately from local program actions when that boundary matters.

Introduce the purpose of a code snippet before showing it, reveal only the relevant lines, and interpret it afterward. Use short plain-English pseudocode for reusable logic; preserve real payloads and identifiers verbatim. Do not read a large JSON object, table, or function aloud. Avoid requiring the viewer to read new dense text while listening to a different explanation.

Use examples, a new consequence, or a resolved question to renew interest. Allow pauses for diagrams and code. Do not prescribe visual changes or rehooks at fixed intervals when they interrupt comprehension. See [references/retention.md](references/retention.md).

## 6. Edit and deliver

Apply [references/editing.md](references/editing.md), including a continuous read-aloud pass. At each transition, check that a first-time viewer knows the actors, the current situation, and why the next step follows. Correct the explanation before shortening it.

Deliver:

- A working title, intended audience, learning promise, and approximate duration.
- Complete spoken narration grouped into useful recording sections.
- Concise, separated visual or performance cues.
- Production notes with sources and distinctions between observed behavior, illustration, and proposals where needed.

Estimate duration from narration-only word count and an explicit speaking-rate assumption, then allow time for visual pauses. Section times are estimates, not measured footage. Use [assets/script-template.md](assets/script-template.md) as a flexible starting point, not a quota of sections.

Close by resolving the opening problem and giving a concrete takeaway. Add a relevant next resource or CTA only if supported by the material; do not invent a future episode or imply the video has been recorded or published. Creating a script does not authorize uploading, publishing, or messaging others.
