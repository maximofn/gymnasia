import notificationSounds from "./notificationSounds.json";

export type NotificationSoundKey = keyof typeof notificationSounds;

export const NOTIFICATION_SOUND_CATALOG = Object.entries(notificationSounds).map(
  ([key, sound]) => ({ key: key as NotificationSoundKey, ...sound }),
);

export const NOTIFICATION_SOUND_KEYS = Object.freeze(
  NOTIFICATION_SOUND_CATALOG.map(({ key }) => key),
) as readonly NotificationSoundKey[];

export const DEFAULT_NOTIFICATION_SOUND = {
  key: "rest_finished",
  ...notificationSounds.rest_finished,
} as const;
