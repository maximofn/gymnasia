---
version: 2026-08-v2
effective_date: 2026-08-22
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

Gymnasia runs **on your device**. There is no account, no sign-up, and no Gymnasia
server that receives your data. Your workouts, your diet, your weight, your measurements
and your conversations with the assistant are stored inside the app itself.

There is one important exception, and it is entirely yours: if you enable the artificial
intelligence assistant, **you** supply an API key from a provider (OpenAI, Anthropic or
Google), and the app talks **directly** to that provider from your device. Whatever you
type into the chat travels to the company you chose, under your own account with them.
We never see it, never store it, and cannot retrieve it.

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

Gymnasia does not store your data on any server. The app does not send it to
infrastructure controlled by the developer — not for storage, not for backups, not for
analytics. The only exception is sending improvement suggestions, which happens only when
you expressly approve it and never includes your personal data (see
[Third parties](#terceros)).
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
- **Preferences**: interface and notification settings.
- **Debug log**: a technical record of up to 1000 entries covering the rest-timer alerts
  delivered, which include the exercise name and set number. It is never sent over the
  network; you can view and clear it from Settings.

## Where it is stored {#almacenamiento-local}

In the app's private storage on your device. On Android, other apps cannot read it.

**API keys** are the only data treated differently: they are stored in the operating
system's secure keystore, separate from everything else.

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
- The key is **not included** in the backup file you export.
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
  images and the assistant's instructions; checks which version of those instructions
  applies to it; and checks whether a newer release has been published. **No data of
  yours is sent**, but GitHub, like any server you connect to, sees your IP address.
- **Open Food Facts** (`world.openfoodfacts.org`): if the assistant reads a barcode in
  one of your photos, it looks that barcode up in their public database to obtain the
  product's nutritional information. The barcode is sent, not the image.
- **VivaGym / MyVitale** (`vivagym.myvitale.com`): optional feature. If you choose to
  use it, you enter the email address and password of **your VivaGym account**, which
  are stored in the device's secure keystore and sent to VivaGym's servers to obtain
  your gym access QR code. That code contains your membership identifier. If you do not
  use this feature, nothing is sent. This integration is scheduled for removal in a
  future version.

## Backups and export {#copias}

You can export all your data to a JSON file from Settings, and import it back later. It
is a manual action: there is no automatic backup.

The exported file **contains**: your measurements and body fat percentages, the
reference to your progress photographs, your complete diet log, your training history,
your personal settings (sex, height, date of birth), the assistant's memory and **the
entire history of your conversations**. It is the most sensitive file the app produces:
store it carefully and think about who you send it to.

The file does **not** contain your API keys.

When exporting, the file is written to the app's temporary storage before you choose
where to share it, and that temporary copy stays there. You can remove it by clearing
the app's data from your system settings.

## Reporting an assistant response {#denuncia}

If the assistant produces an inappropriate, dangerous or incorrect response, write to
**maximofn@maximofn.com** describing what happened. You may attach the text of the
response if you wish, but **do not send your API key** or data you would rather not
share: review what you copy before sending it.

Reports are reviewed manually and may lead to changes in the assistant's instructions or
safeguards. Reporting currently happens by email; a future version will add an in-app
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

## How to delete your data {#eliminacion}

Being explicit about what each option does today:

**"Reset local data"** (Settings) is a **partial** deletion. It removes your routines,
your training history, your diet, your measurements, your conversations and your API
keys. It does **not** remove: the assistant's memory, the foods you created, your
preferences, the debug log, your VivaGym credentials, any backups you exported, or the
downloaded catalogues. Work is under way to make this action delete everything it
promises; until then, this policy describes its actual behaviour.

**The debug log** is cleared with its own button, under Settings → Traces.

**Complete deletion**: clear the app's data from your device settings, or uninstall the
app. That removes everything above without exception. Remember that backup files you
exported and saved elsewhere will survive, and that photographs taken with the camera
remain in your gallery.

**Data held by an AI provider**: request it directly from that provider, through your
account with them. Gymnasia cannot delete it on your behalf.

## Minors {#menores}

Gymnasia is not aimed at children under 14 and does not verify the age of its users. If
you are a minor, use the app with the consent and supervision of someone responsible for
you, particularly regarding training and nutrition.

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
