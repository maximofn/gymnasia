---
version: 2026-08-v8
effective_date: 2026-08-29
locale: en
lang: en
title: Gymnasia Privacy Policy
url: https://gymnasia.maximofn.com/privacy
alternate_locale: es
alternate_url: https://gymnasia.maximofn.com/privacidad
contact: maximofn@maximofn.com
controller: "Máximo Fernández Núñez"
toc_title: Contents
---

## Summary {#resumen}

Gymnasia runs **primarily on your device**. There is no account or sign-up. Your
workouts, diet, weight, measurements and conversations with the assistant are stored
inside the app itself.

There is one important exception, and it is entirely yours: if you enable the artificial
intelligence assistant, **you** supply an API key from a provider (OpenAI, Anthropic or
Google), and the app talks **directly** to that provider from your device. Whatever you
type into the chat travels to the company you chose, under your own account with them.
We do not see or store it unless you choose **Report** on a response and expressly
approve the preview of the content that will be sent.

This policy explains in detail what is stored, what leaves your device, and what control
you have over it.

## Who is responsible {#responsable}

Data controller: **Máximo Fernández Núñez**.

Contact for anything related to privacy, including exercising your rights and reporting
an assistant response: **maximofn@maximofn.com**.

Gymnasia is a personal project. There is no support department and no designated data
protection officer.

## There is no account and no server {#sin-cuenta}

Gymnasia does not ask for an email address, a password or a username in order to work.
No account system exists.

Gymnasia does not sync your data to a server, make cloud backups or use it for analytics.
The only exception is the optional feedback backend: it receives suggestions and reports
only after an express action and confirmation (see [Third parties](#terceros)). A report
contains the preceding question and the selected response, so it may include personal or
health data found in those two messages.
**There is no analytics, no telemetry and no automatic crash reporting**: the app bundles
no SDK of that kind.

## What the app stores {#datos}

All of the following is stored on your device only:

- **Training activity**: routines, exercises, sets, repetitions, loads in kilograms,
  session duration, rest periods, and estimated volume and calories.
- **Nutrition**: what you log each day, with grams, calories, protein, carbohydrates and
  fat; the foods you create yourself; and the recipes and products you save.
- **Weight and body composition**: weight, body fat percentage, and neck, chest, waist,
  hip, biceps, quadriceps and calf measurements, each with its date.
- **Personal data used for calculations**: sex, height, date of birth, goal (cutting,
  bulking or maintenance) and activity level. Used to estimate your calories and
  macronutrients.
- **Conversations with the assistant**: the complete history of your chat threads,
  including the model's messages.
- **Assistant memory**: free-text notes that you or the assistant save in order to
  remember things between conversations. It may contain anything you have mentioned in
  the chat, including health data.
- **Legacy credentials from removed features**: if an earlier version stored credentials
  in the secure keystore, a normal update may keep them encrypted so they can be reused
  if the feature returns. The current version neither reads nor transmits them. “Reset
  local data” deletes them.
- **Preferences**: interface and notification settings, and your per-provider consent
  for the optional additional health-safety evaluation.
- **AI provider configuration**: the selected model and, when Anthropic requires it for
  an identity-linked key, the workspace identifier (`wrkspc_…`).
- **Debug log**: a technical record of up to 1000 entries covering the rest-timer alerts
  delivered, which include the exercise name and set number. It is never sent over the
  network; you can view and clear it from Settings.

## Where it is stored {#almacenamiento-local}

In the app's private storage on your device. On Android, other apps cannot read it.

**API keys** and, when left by an earlier version, legacy credentials from removed
features are treated differently: they are stored in the operating system's secure
keystore, separate from everything else. The optional Anthropic workspace identifier is
not a secret key and is stored with the app's private configuration.

If your device has Android backup enabled, the operating system may include the app's
data in your Google account backup. That is governed by your device settings and
Google's privacy policy, not by this app.

## Your API key {#byok}

The assistant works on a **bring-your-own-key** basis: no key ships with the app, and
you enter the one from your own account with OpenAI, Anthropic or Google.

- The key is stored **in your device's secure keystore** and is never sent to any
  developer server, because no such server exists.
- The key is sent **only to the provider it belongs to**, with each request, as their
  API requires.
- If an identity-linked Anthropic key requires a workspace identifier, that identifier
  is stored locally and sent only to Anthropic to route requests to the selected
  workspace.
- The key is **not included** in the backup file you export.
- The workspace identifier is not included in that backup either.
- You can delete it at any time from Settings.

**Protection is weaker in the browser.** The web version of Gymnasia runs in a browser,
where no operating system keystore exists: there, the key is stored in browser storage
alongside the rest of your data, without that additional layer of protection. The app
warns you about this on the provider settings screen. If this concerns you, use the
mobile app.

## What the app sends to AI providers {#proveedores}

When you use the assistant, your device connects **directly** to the provider you chose.
The request includes:

- the assistant's system instructions;
- **the last 20 messages** of the conversation thread;
- the results of the tools the assistant uses at your request, which may include your
  weight, your body fat percentage, your measurements, the day's meals or your routines;
- in the food estimator, **the images you provide**, encoded within the request.
- for Anthropic, the workspace identifier, only when you configured one because the key
  type requires it.

If you enable **additional health-safety evaluation** for a provider in Settings, the
current text may be sent to that same provider in a separate classification request
before the normal response is generated. This option is off by default, requires
separate consent for each provider, and can be revoked at any time. Messages classified
locally as high or critical risk are intercepted on the device and are not sent to the
provider.

That content is subject to the privacy policy and terms of the provider you chose, under
your own account with them:

- [OpenAI](https://openai.com/policies/privacy-policy)
- [Anthropic](https://www.anthropic.com/legal/privacy)
- [Google](https://policies.google.com/privacy)

If you configure no key, the app contacts no AI provider and every other feature keeps
working.

## Photographs {#fotos}

Gymnasia uses the camera and the photo library in two places, and treats them
differently:

- **Food estimator**: the images you select (up to six) are sent to the AI provider to
  estimate nutritional values. They are not stored in the app and are not uploaded
  anywhere else.
- **Progress photographs** attached to a measurement: they **never leave your device**.
  The app stores only a reference to the file. That reference is included in the backup
  file you export, and the assistant can see it if it reads that measurement.

## Third parties the app contacts {#terceros}

Besides the AI providers:

- **GitHub** (`raw.githubusercontent.com`, `api.github.com`, `github.com`): the app
  downloads the public catalogues of exercises, foods, products and recipes, their
  images and the assistant's instructions; and checks which version of those instructions
  applies to it. **No data of yours is sent**, but GitHub, like any server you connect
  to, sees your IP address.
- **Gymnasia feedback backend** (`gymnasia-feedback.maximofn.com`): only when you ask
  for it. When you suggest an assistant improvement, or submit a food or exercise that
  is missing from the catalogue, the app first shows you the exact title and summary
  and **sends nothing until you approve them**. It sends only that title, that summary,
  the proposal type and a technical identifier used to prevent duplicates. Suggestions
  do not include literal conversation text or user identifiers. If you use **Report** on
  a response, the preview contains the reason, optional details, immediately preceding
  question, selected response and technical context (surface, origin, provider, model,
  app version and, where applicable, health-intervention data). It does not send the rest
  of the thread, internal reasoning, technical errors, API keys or an account identifier.
  The developer operates the service on Cloudflare infrastructure, and it creates a
  record in a **private** GitHub repository visible only to the developer. The app and
  service remove recognisable key and password patterns before storing it. Cloudflare
  receives the IP address needed to serve the connection; the service applies an HMAC
  before rate limiting, keeps only that pseudonymous value for up to 48 hours and does
  not store the raw IP. A report body is scheduled to be automatically replaced with a
  deletion notice when it reaches 30 days. If you submit no suggestion or report, this
  service is never used.
- **Open Food Facts** (`world.openfoodfacts.org`): if the assistant reads a barcode in
  one of your photos, it looks that barcode up in their public database to obtain the
  product's nutritional information. The barcode is sent, not the image.
## Backups and export {#copias}

You can export all your data to a JSON file from Settings, and import it back later. It
is a manual action: there is no automatic backup.

The exported file **contains**: your measurements and body fat percentages, the
reference to your progress photographs, your complete diet log, your training history,
your personal settings (sex, height, date of birth), the assistant's memory and **the
entire history of your conversations**. It is the most sensitive file the app produces:
store it carefully and think about who you send it to.

The file does **not** contain your API keys or legacy credentials from removed features.

When exporting, the file is written to the app's temporary storage before you choose
where to share it, and that temporary copy stays there. You can remove it by clearing
the app's data from your system settings.

## Reporting an assistant response {#denuncia}

Every reportable final response shown by the assistant includes a **Report** action. It
is also available on health interventions generated on the device, but not on
introductions, technical errors, content that is still streaming or internal reasoning.
After selecting it, you choose a reason, may add details, and see an exact preview before
confirming.

The report includes the immediately preceding question and selected response, not the
rest of the conversation. Review the preview because those two messages may contain
personal or health data. The app removes recognisable secret patterns, but **do not
include your API key** or data you do not want to share.

Reports are reviewed manually and may lead to changes in the assistant's instructions or
safeguards. You can also write to **maximofn@maximofn.com** if you cannot use the in-app
action.

## Permissions the app requests {#permisos}

- **Notifications, exact alarms, vibration and screen wake**: to alert you when a rest
  period ends, even with the screen off.
- **Run after device restart**: to reschedule those alerts.
- **Camera and image access**: only when you pick a photo for the food estimator or for
  a measurement.

None of these permissions is used to collect data in the background. Notifications are
local: they are generated on your device, and there are no push notifications from a
server.

## The web version {#web}

Gymnasia can also be used in a browser. It works the same way, with two differences you
should know about:

- Data is stored in **browser storage**, not in the private storage of an installed app.
  Clearing the site's data deletes it.
- **The API key is not protected by the operating system keystore**, as explained above.

## How long your data is kept {#conservacion}

Indefinitely, for as long as you keep it. Because the data never leaves your device,
there is no server-side retention period to apply: you keep it and you delete it.

Data you have sent to an AI provider is governed by that provider's retention period,
under your account with them.

Suggestions remain in the private repository for as long as needed to manage the
project. For assistant-response reports, the body containing the question and response
is scheduled for automatic deletion when it reaches 30 days. Technical rate-limit
records based on the IP HMAC are deleted within 48 hours.

## How to delete your data {#eliminacion}

Being explicit about what each option does today:

**"Reset local data"** (Settings) is a **partial** deletion. It removes your routines,
your training history, your diet, your measurements, your conversations, your API keys
and encrypted credentials left by removed features. It does **not** remove: the
assistant's memory, the foods you created, your preferences, the debug log, any backups
you exported, or the downloaded catalogues. Work is under way to make this action delete
everything it promises; until then, this policy describes its actual behaviour.

**The debug log** is cleared with its own button, under Settings → Traces.

**Complete deletion**: clear the app's data from your device settings, or uninstall the
app. That removes everything above without exception. Remember that backup files you
exported and saved elsewhere will survive, and that photographs taken with the camera
remain in your gallery.

**Data held by an AI provider**: request it directly from that provider, through your
account with them. Gymnasia cannot delete it on your behalf.

## Minors {#menores}

Gymnasia is intended for people aged **16 or older** and is not designed for children
under 16. The app does not verify the age of its users. If you are 16 or 17, use it with
the consent and supervision of someone responsible for you, particularly regarding
training and nutrition.

## Your rights {#derechos}

The General Data Protection Regulation grants you the rights of access, rectification,
erasure, restriction, portability and objection.

In Gymnasia those rights are exercised, in practice, **without an intermediary**,
because the controller does not hold your data:

- **Access and portability**: the export feature hands you all of your data in a
  standard JSON file.
- **Rectification**: you can edit any data inside the app.
- **Erasure**: see the section above.
- **Objection and restriction**: stop using the features that send data to third
  parties; with no API key configured, nothing is sent to any AI provider.

If you believe the processing does not comply with the regulation, you can write to
**maximofn@maximofn.com** and lodge a complaint with the Spanish Data Protection Agency
([aepd.es](https://www.aepd.es)).

## Gymnasia is not a medical device {#no-dispositivo-medico}

**Gymnasia is not a medical device and does not replace advice from a healthcare
professional.**

The app does not diagnose, treat, cure or prevent any disease. Its calorie,
macronutrient and body composition figures are **estimates** based on general formulas,
not clinical measurements.

The artificial intelligence assistant **is not a person** and can be wrong. It is not a
doctor, a dietitian or a certified trainer, however much its tone may suggest otherwise.
Do not follow its guidance on health, injuries, medication or dietary restriction
without checking it with a qualified professional.

Consult a healthcare professional before starting a training programme or a nutrition
plan, especially if you have a medical condition, are pregnant or take medication.

## Changes to this policy {#cambios}

Whenever what the app does with your data changes, this policy is updated and its
version and date change with it. The version in force is the one shown at the top of
this document.

## Contact {#contacto}

**maximofn@maximofn.com**
