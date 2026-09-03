import { Feather } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { mobileTheme } from "../theme";
import type { CatalogSearchAvailability } from "./types";

type CatalogStatusNoticeProps = {
  metadata: CatalogSearchAvailability;
  onRetry: () => void;
  testID: string;
};

function formatCatalogDate(value: string | null): string {
  if (!value) return "fecha desconocida";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "fecha desconocida";
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CatalogStatusNotice({ metadata, onRetry, testID }: CatalogStatusNoticeProps) {
  const refreshing = metadata.sources.some((source) => source.refreshing);
  const healthy = metadata.availability === "fresh" || metadata.availability === "cached";
  const label = refreshing
    ? "Actualizando…"
    : metadata.availability === "fresh"
      ? "Actualizado ahora"
      : metadata.availability === "cached"
        ? `Copia local · ${formatCatalogDate(metadata.fetchedAt)}`
        : metadata.availability === "stale"
          ? "Copia antigua"
          : metadata.availability === "partial"
            ? "Disponibilidad parcial"
            : "Catálogo no disponible";

  if (healthy || refreshing) {
    return (
      <Pressable
        testID={`${testID}-retry`}
        accessibilityLabel={`${label}. Reintentar actualización`}
        onPress={refreshing ? undefined : onRetry}
        style={{
          alignSelf: "flex-start",
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingHorizontal: 9,
          paddingVertical: 5,
          borderRadius: mobileTheme.radius.pill,
          borderWidth: 1,
          borderColor: mobileTheme.color.borderSubtle,
          backgroundColor: mobileTheme.color.bgSurface,
        }}
      >
        {refreshing ? <ActivityIndicator size={11} color={mobileTheme.color.brandPrimary} /> : (
          <Feather name="refresh-cw" size={12} color={mobileTheme.color.brandPrimary} />
        )}
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600" }}>
          {label}
        </Text>
      </Pressable>
    );
  }

  const affectedSources = metadata.sources.filter(
    (source) => source.sourceId !== "user_personal_foods" && source.availability !== "fresh",
  );
  const affected = affectedSources.map((source) => source.label).join(", ");
  const affectedFetchedAt = affectedSources
    .map((source) => source.fetchedAt)
    .filter((value): value is string => !!value)
    .sort()
    .at(-1) ?? null;
  return (
    <View
      testID={testID}
      style={{
        gap: 8,
        borderWidth: 1,
        borderColor: metadata.availability === "unavailable" ? "rgba(255,107,107,0.45)" : "rgba(255,184,77,0.45)",
        backgroundColor: metadata.availability === "unavailable" ? "rgba(255,107,107,0.08)" : "rgba(255,184,77,0.08)",
        borderRadius: mobileTheme.radius.md,
        padding: 11,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Feather
          name={metadata.availability === "unavailable" ? "alert-circle" : "clock"}
          size={15}
          color={metadata.availability === "unavailable" ? "#FF6B6B" : "#FFB84D"}
        />
        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "700", flex: 1 }}>
          {label}
        </Text>
      </View>
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, lineHeight: 17 }}>
        {affected ? `Fuentes afectadas: ${affected}. ` : ""}
        Última actualización válida: {formatCatalogDate(affectedFetchedAt)}.
      </Text>
      {metadata.warnings.length > 0 ? (
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, lineHeight: 16 }}>
          {metadata.warnings.join(" ")}
        </Text>
      ) : null}
      <Pressable
        testID={`${testID}-retry`}
        onPress={onRetry}
        style={{ alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4 }}
      >
        <Feather name="refresh-cw" size={13} color={mobileTheme.color.brandPrimary} />
        <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 12, fontWeight: "700" }}>
          Reintentar
        </Text>
      </Pressable>
    </View>
  );
}
