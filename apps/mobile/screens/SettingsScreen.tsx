import { Feather, Ionicons } from "@expo/vector-icons";
import { memo, useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";

import {
  type DataSettingsActions,
  type DataSettingsModel,
  SETTINGS_TAB_OPTIONS,
  type NotificationSettingsActions,
  type NotificationSettingsModel,
  type SettingsTabsActions,
  type SettingsTabsModel,
} from "../controllers/settingsController";
import type { UserPreferences } from "../storage/userPreferences";
import { mobileTheme } from "../theme";

const CHART_PERIOD_LABELS: Record<UserPreferences["chartPeriod"], string> = {
  "1m": "1 mes",
  "3m": "3 meses",
  "6m": "6 meses",
  all: "Todo",
};

export const SettingsTabs = memo(function SettingsTabs({
  model,
  actions,
}: {
  model: Readonly<SettingsTabsModel>;
  actions: Readonly<SettingsTabsActions>;
}) {
  const scrollRef = useRef<ScrollView>(null);
  const scrollXRef = useRef(0);
  const containerWidthRef = useRef(0);
  const contentWidthRef = useRef(0);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const updateScrollArrows = useCallback(() => {
    const maxScrollX = Math.max(0, contentWidthRef.current - containerWidthRef.current);
    setCanScrollLeft(scrollXRef.current > 4);
    setCanScrollRight(scrollXRef.current < maxScrollX - 4);
  }, []);

  return (
    <View style={{ position: "relative" }}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0 }}
        contentContainerStyle={{
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: mobileTheme.spacing[4],
          paddingBottom: 12,
        }}
        scrollEventThrottle={16}
        onLayout={(event) => {
          containerWidthRef.current = event.nativeEvent.layout.width;
          updateScrollArrows();
        }}
        onContentSizeChange={(width) => {
          contentWidthRef.current = width;
          updateScrollArrows();
        }}
        onScroll={(event) => {
          scrollXRef.current = event.nativeEvent.contentOffset.x;
          updateScrollArrows();
        }}
      >
        {SETTINGS_TAB_OPTIONS.map((option) => {
          const isActive = model.activeTab === option.key;
          return (
            <Pressable
              key={option.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              accessibilityLabel={option.label}
              testID={`settings-tab-${option.key}`}
              onPress={() => actions.selectTab(option.key)}
              style={{
                borderWidth: 1,
                borderColor: isActive ? "rgba(203,255,26,0.45)" : mobileTheme.color.borderSubtle,
                borderRadius: mobileTheme.radius.pill,
                paddingHorizontal: 12,
                minHeight: 34,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: isActive ? "rgba(203,255,26,0.08)" : mobileTheme.color.bgSurface,
              }}
            >
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "700" }}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {canScrollLeft ? (
        <Pressable
          onPress={() => {
            const targetX = Math.max(0, scrollXRef.current - 160);
            scrollRef.current?.scrollTo({ x: targetX, animated: false });
          }}
          style={{ position: "absolute", left: 0, top: 0, bottom: 12, width: 40, alignItems: "flex-start", justifyContent: "center", paddingLeft: 4, backgroundColor: "rgba(7,9,13,0.65)" }}
        >
          <Ionicons name="chevron-back" size={20} color="rgba(244,247,251,0.85)" />
        </Pressable>
      ) : null}
      {canScrollRight ? (
        <Pressable
          onPress={() => {
            scrollRef.current?.scrollTo({ x: scrollXRef.current + 160, animated: false });
          }}
          style={{ position: "absolute", right: 0, top: 0, bottom: 12, width: 40, alignItems: "flex-end", justifyContent: "center", paddingRight: 4, backgroundColor: "rgba(7,9,13,0.65)" }}
        >
          <Ionicons name="chevron-forward" size={20} color="rgba(244,247,251,0.85)" />
        </Pressable>
      ) : null}
    </View>
  );
});

export const PreferencesSettingsPanel = memo(function PreferencesSettingsPanel({
  preferences,
}: {
  preferences: Readonly<UserPreferences>;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}>
        Preferencias del usuario
      </Text>
      {Object.entries(preferences).map(([key, value]) => {
        const isChartPeriod = key === "chartPeriod";
        const displayLabel = isChartPeriod ? "Vista del gráfico" : key;
        const displayValue = isChartPeriod
          ? CHART_PERIOD_LABELS[value as UserPreferences["chartPeriod"]] ?? String(value)
          : String(value);
        return (
          <View
            key={key}
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: mobileTheme.color.cardBg,
              borderRadius: 12,
              padding: 14,
              borderWidth: 1,
              borderColor: mobileTheme.color.borderSubtle,
            }}
          >
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontWeight: "600" }}>
              {displayLabel}
            </Text>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "700" }}>
              {displayValue}
            </Text>
          </View>
        );
      })}
    </View>
  );
});

function NotificationToggle({
  testID,
  label,
  description,
  checked,
  disabled = false,
  onPress,
}: {
  testID: string;
  label: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onPress(): void;
}) {
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: mobileTheme.color.bgSurface,
        borderRadius: 12,
        padding: 14,
        borderWidth: 1,
        borderColor: mobileTheme.color.borderSubtle,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "600" }}>
          {label}
        </Text>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
          {description}
        </Text>
      </View>
      <Pressable
        testID={testID}
        accessibilityRole="switch"
        accessibilityLabel={`${label}: ${checked ? "sí" : "no"}`}
        accessibilityState={{ checked, disabled }}
        onPress={onPress}
        disabled={disabled}
        style={{
          width: 52,
          height: 30,
          borderRadius: 15,
          backgroundColor: checked ? mobileTheme.color.brandPrimary : mobileTheme.color.borderSubtle,
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "row",
        }}
      >
        <View
          style={{
            position: "absolute",
            left: checked ? 26 : 4,
            width: 22,
            height: 22,
            borderRadius: 11,
            backgroundColor: "#fff",
          }}
        />
      </Pressable>
    </View>
  );
}

export const NotificationSettingsPanel = memo(function NotificationSettingsPanel({
  model,
  actions,
}: {
  model: Readonly<NotificationSettingsModel>;
  actions: Readonly<NotificationSettingsActions>;
}) {
  const { settings } = model;
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}>
        Notificaciones de descanso
      </Text>
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>
        Configura cómo quieres que te avise la app cuando termina un descanso.
      </Text>

      {model.isAndroid ? (
        <Pressable
          onPress={actions.openExactAlarmSettings}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "rgba(203,255,26,0.06)",
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: "rgba(203,255,26,0.3)",
          }}
        >
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }}>
              Permiso de alarmas exactas
            </Text>
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
              {model.alarmPunctuality.detail}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text
              style={{
                fontSize: 11,
                fontWeight: "700",
                color: model.alarmPunctuality.status === "late"
                  ? "#FF6B6B"
                  : model.alarmPunctuality.status === "ontime"
                    ? mobileTheme.color.brandPrimary
                    : mobileTheme.color.textSecondary,
              }}
            >
              {model.alarmPunctuality.badge}
            </Text>
            <Feather name="chevron-right" size={18} color={mobileTheme.color.textSecondary} />
          </View>
        </Pressable>
      ) : null}

      {model.showBatteryGuidance && model.batteryGuidance ? (
        <Pressable
          onPress={actions.openApplicationSettings}
          style={{
            backgroundColor: model.alarmPunctuality.status === "late" ? "rgba(255,107,107,0.08)" : mobileTheme.color.bgSurface,
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: model.alarmPunctuality.status === "late" ? "rgba(255,107,107,0.35)" : mobileTheme.color.borderSubtle,
            gap: 6,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather
              name="battery-charging"
              size={16}
              color={model.alarmPunctuality.status === "late" ? "#FF6B6B" : mobileTheme.color.textSecondary}
            />
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600", flex: 1 }}>
              {model.batteryGuidance.brand === "tu fabricante"
                ? "Tu móvil puede bloquear los avisos en segundo plano"
                : `Los móviles ${model.batteryGuidance.brand} bloquean los avisos en segundo plano`}
            </Text>
          </View>
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
            Para ahorrar batería, el sistema congela las apps que no estás usando y el aviso de descanso no llega hasta que vuelves a abrir Gymnasia. No es algo que la app pueda cambiar por su cuenta.
          </Text>
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>
            {model.batteryGuidance.path}
          </Text>
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontStyle: "italic" }}>
            Este aviso desaparecerá solo cuando comprobemos que los avisos llegan puntuales.
          </Text>
        </Pressable>
      ) : null}

      {model.permissionGranted === false ? (
        <Pressable
          onPress={actions.openApplicationSettings}
          style={{ backgroundColor: "rgba(255,107,107,0.08)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(255,107,107,0.35)", gap: 4 }}
        >
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }}>
            Notificaciones bloqueadas por Android
          </Text>
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
            Sin ellas solo podremos avisarte con la app abierta. Toca para abrir los ajustes del sistema.
          </Text>
        </Pressable>
      ) : model.isAndroid && model.restChannelImportance !== null && model.restChannelImportance <= 1 ? (
        <Pressable
          onPress={actions.openApplicationSettings}
          style={{ backgroundColor: "rgba(255,107,107,0.08)", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "rgba(255,107,107,0.35)", gap: 4 }}
        >
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }}>
            El canal "Descanso terminado" está silenciado
          </Text>
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
            Los avisos llegarán sin sonido. Toca para reactivarlo en los ajustes del sistema.
          </Text>
        </Pressable>
      ) : null}

      {model.isAndroid ? (
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontStyle: "italic" }}>
          Con la pantalla apagada Android puede retrasar el aviso unos minutos para ahorrar batería. Si el descanso ya había terminado, te avisaremos igualmente al volver a la app.
        </Text>
      ) : null}

      <NotificationToggle
        testID="notification-enabled-toggle"
        label="Activar notificaciones"
        description="Muestra una notificación al terminar el descanso"
        checked={settings.enabled}
        onPress={actions.toggleEnabled}
      />
      <NotificationToggle
        testID="notification-sound-toggle"
        label="Sonido"
        description="Reproduce el sonido de descanso terminado"
        checked={settings.sound}
        disabled={!settings.enabled}
        onPress={actions.toggleSound}
      />
      <NotificationToggle
        testID="notification-vibrate-toggle"
        label="Vibración"
        description="Vibra el móvil al terminar el descanso"
        checked={settings.vibrate}
        disabled={!settings.enabled}
        onPress={actions.toggleVibration}
      />

      {!settings.enabled ? (
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontStyle: "italic" }}>
          Con las notificaciones desactivadas, solo se avisará con sonido/vibración cuando la app esté abierta.
        </Text>
      ) : null}

      <View style={{ gap: 8, backgroundColor: mobileTheme.color.bgSurface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, opacity: settings.enabled ? 1 : 0.4 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 14, fontWeight: "600" }}>
              Sonido de notificación
            </Text>
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
              Elige el tono que sonará al terminar el descanso
            </Text>
          </View>
          <Pressable
            testID="notification-sound-selector-toggle"
            accessibilityRole="switch"
            accessibilityLabel={`Sonido de notificación: ${settings.sound ? "sí" : "no"}`}
            accessibilityState={{ checked: settings.sound, disabled: !settings.enabled }}
            onPress={actions.toggleSound}
            disabled={!settings.enabled}
            style={{ width: 52, height: 30, borderRadius: 15, backgroundColor: settings.sound ? mobileTheme.color.brandPrimary : mobileTheme.color.borderSubtle, alignItems: "center", justifyContent: "center" }}
          >
            <View style={{ position: "absolute", left: settings.sound ? 26 : 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "#fff" }} />
          </Pressable>
        </View>
        {settings.sound ? (
          <View style={{ gap: 6, marginTop: 4 }}>
            {model.soundOptions.map((option) => {
              const isSelected = settings.soundKey === option.key;
              return (
                <Pressable
                  key={option.key}
                  testID={`notification-sound-option-${option.key}`}
                  accessibilityRole="radio"
                  accessibilityLabel={`${option.label}${isSelected ? ", seleccionado" : ""}`}
                  accessibilityState={{ selected: isSelected, disabled: !settings.enabled }}
                  onPress={() => actions.selectSound(option.key)}
                  disabled={!settings.enabled}
                  style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 12, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: isSelected ? mobileTheme.color.brandPrimary : mobileTheme.color.borderSubtle, backgroundColor: isSelected ? "rgba(203,255,26,0.08)" : mobileTheme.color.bgApp }}
                >
                  <Text style={{ color: isSelected ? mobileTheme.color.brandPrimary : mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }}>
                    {option.label}
                  </Text>
                  {isSelected ? <Feather name="check" size={16} color={mobileTheme.color.brandPrimary} /> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );
});

export const DataSettingsPanel = memo(function DataSettingsPanel({
  model,
  actions,
}: {
  model: Readonly<DataSettingsModel>;
  actions: Readonly<DataSettingsActions>;
}) {
  return (
    <View style={{ gap: 12 }}>
      <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}>
        Copia de seguridad
      </Text>
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>
        Exporta tus datos y fotos de progreso a un paquete .gymnasia. Las fotos se optimizan y se eliminan sus metadatos antes de incluirlas. Guárdalo en tu proveedor de nube (Drive, Dropbox, OneDrive…) o donde prefieras. La copia no incluye tus API keys de proveedores IA.
      </Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: mobileTheme.color.bgSurface, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle }}>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontWeight: "600" }}>
          Última copia
        </Text>
        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "700" }}>
          {model.lastBackupLabel}
        </Text>
      </View>
      <Pressable
        testID="backup-export"
        onPress={actions.exportBackup}
        disabled={model.backupBusy !== null}
        style={{ height: 48, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: model.backupBusy !== null ? 0.6 : 1 }}
      >
        {model.backupBusy === "export" ? (
          <ActivityIndicator size="small" color="#06090D" />
        ) : (
          <>
            <Feather name="upload" size={18} color="#06090D" />
            <Text style={{ color: "#06090D", fontWeight: "700", fontSize: 15 }}>
              Exportar copia de seguridad
            </Text>
          </>
        )}
      </Pressable>
      <Pressable
        testID="backup-import-picker"
        onPress={actions.importBackup}
        disabled={model.backupBusy !== null}
        style={{ height: 48, borderRadius: mobileTheme.radius.md, backgroundColor: "transparent", borderWidth: 1, borderColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: model.backupBusy !== null ? 0.6 : 1 }}
      >
        {model.backupBusy === "import" ? (
          <ActivityIndicator size="small" color={mobileTheme.color.brandPrimary} />
        ) : (
          <>
            <Feather name="download" size={18} color={mobileTheme.color.brandPrimary} />
            <Text style={{ color: mobileTheme.color.brandPrimary, fontWeight: "700", fontSize: 15 }}>
              Restaurar desde archivo
            </Text>
          </>
        )}
      </Pressable>

      {model.backupResult ? (
        <View
          testID="backup-result"
          accessibilityLiveRegion="polite"
          style={{
            gap: 4,
            backgroundColor: model.backupResult.status === "ok"
              ? "rgba(203,255,26,0.10)"
              : model.backupResult.status === "warning"
                ? "rgba(255,190,92,0.10)"
                : "rgba(255,138,138,0.10)",
            borderRadius: 12,
            padding: 14,
            borderWidth: 1,
            borderColor: model.backupResult.status === "ok"
              ? "rgba(203,255,26,0.5)"
              : model.backupResult.status === "warning"
                ? "rgba(255,190,92,0.5)"
                : "rgba(255,138,138,0.5)",
          }}
        >
          <Text style={{ color: model.backupResult.status === "error" ? "#FF8A8A" : mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }}>
            {model.backupResult.message}
          </Text>
          {model.backupResult.details.map((detail, index) => (
            <Text key={`${detail}-${index}`} style={{ color: mobileTheme.color.textSecondary, fontSize: 11, lineHeight: 16 }}>
              • {detail}
            </Text>
          ))}
          {model.backupResult.remainingDetailCount > 0 ? (
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>
              Y {model.backupResult.remainingDetailCount} incidencia(s) más.
            </Text>
          ) : null}
        </View>
      ) : null}

      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, opacity: 0.7 }}>
        Restaurar sustituye por completo los datos actuales por los del archivo. El paquete puede contener información sensible y no está cifrado. Tus API keys se mantienen.
      </Text>
      <Pressable accessibilityRole="link" accessibilityLabel="Ver qué contiene la copia de seguridad en la política de privacidad" testID="legal-backup-policy-link" onPress={actions.openBackupPolicy} hitSlop={8}>
        <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 11, fontWeight: "700", textDecorationLine: "underline" }}>
          Qué contiene este archivo
        </Text>
      </Pressable>
      <View style={{ height: 1, backgroundColor: mobileTheme.color.borderSubtle, marginVertical: 8 }} />
      <View style={{ gap: 6 }}>
        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "800" }}>
          Gestionar tus datos
        </Text>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 19 }}>
          Elige el alcance antes de borrar. Gymnasia comprobará cada destino y no dirá que terminó si queda algo pendiente.
        </Text>
      </View>

      {model.deletionReport?.status === "incomplete" ? (
        <View accessibilityLiveRegion="polite" testID="data-deletion-report" style={{ gap: 10, borderWidth: 1, borderColor: "rgba(255,77,79,0.55)", borderRadius: mobileTheme.radius.lg, backgroundColor: "rgba(255,77,79,0.10)", padding: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="alert-triangle" size={17} color="#FF6E6E" />
            <Text style={{ color: "#FF9A9A", fontSize: 14, fontWeight: "800", flex: 1 }}>
              El borrado quedó incompleto
            </Text>
          </View>
          {model.deletionReport.failures.map((failure) => (
            <View key={failure.id} style={{ gap: 2 }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "700" }}>
                {failure.label}
              </Text>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, lineHeight: 17 }}>
                {failure.message}
              </Text>
            </View>
          ))}
          <Pressable
            testID="data-deletion-retry"
            accessibilityRole="button"
            accessibilityLabel="Reintentar borrado de datos"
            disabled={model.deletionBusy}
            onPress={() => actions.retryDeletion(model.deletionReport!.scope)}
            style={{ minHeight: 44, borderRadius: mobileTheme.radius.md, backgroundColor: "#FF4D4F", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, opacity: model.deletionBusy ? 0.6 : 1 }}
          >
            {model.deletionBusy ? <ActivityIndicator size="small" color="#FFE8EB" /> : <Feather name="refresh-cw" size={15} color="#FFE8EB" />}
            <Text style={{ color: "#FFE8EB", fontSize: 14, fontWeight: "800" }}>Reintentar borrado</Text>
          </Pressable>
        </View>
      ) : null}

      <DeletionOption
        icon="rotate-ccw"
        title="Borrar actividad y conversaciones"
        description="Borra entrenamientos, dieta, medidas, chats y sesiones. Conserva memoria, alimentos personales, preferencias y claves API."
        buttonLabel="Borrar actividad"
        testID="data-deletion-open-activity"
        blocked={model.deletionBlocked}
        onPress={() => actions.openDeletion("activity")}
      />
      <DeletionOption
        destructive
        icon="trash-2"
        title="Borrar todos mis datos"
        description="Borra también memoria, alimentos personales, preferencias, claves, cachés, trazas y metadatos locales."
        buttonLabel="Borrar todos mis datos"
        testID="data-deletion-open-all"
        blocked={model.deletionBlocked}
        onPress={() => actions.openDeletion("all-personal")}
      />
      {model.deletionBlocked && !model.deletionBusy ? (
        <Text style={{ color: "#FFCD77", fontSize: 12, lineHeight: 17 }}>
          Termina la conversación, estimación o copia de seguridad en curso antes de borrar.
        </Text>
      ) : null}
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, lineHeight: 17 }}>
        Los archivos exportados, las fotos de la galería, los permisos del sistema y los datos enviados a proveedores están fuera del control de Gymnasia y no se pueden borrar desde aquí.
      </Text>
      <Pressable accessibilityRole="link" accessibilityLabel="Ver cómo eliminar tus datos en la política de privacidad" testID="legal-deletion-policy-link" onPress={actions.openDeletionPolicy} hitSlop={8}>
        <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 11, fontWeight: "700", textDecorationLine: "underline" }}>
          Qué puede borrar Gymnasia
        </Text>
      </Pressable>
    </View>
  );
});

function DeletionOption({
  destructive = false,
  icon,
  title,
  description,
  buttonLabel,
  testID,
  blocked,
  onPress,
}: {
  destructive?: boolean;
  icon: "rotate-ccw" | "trash-2";
  title: string;
  description: string;
  buttonLabel: string;
  testID: string;
  blocked: boolean;
  onPress(): void;
}) {
  return (
    <View style={{ gap: 12, borderWidth: 1, borderColor: destructive ? "rgba(255,77,79,0.42)" : "rgba(255,255,255,0.08)", borderRadius: mobileTheme.radius.lg, backgroundColor: destructive ? "rgba(255,77,79,0.07)" : mobileTheme.color.bgSurface, padding: 14 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: destructive ? "rgba(255,77,79,0.18)" : "rgba(203,255,26,0.10)", alignItems: "center", justifyContent: "center" }}>
          <Feather name={icon} size={17} color={destructive ? "#FF6E6E" : mobileTheme.color.brandPrimary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 15, fontWeight: "800" }}>{title}</Text>
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, lineHeight: 18 }}>{description}</Text>
        </View>
      </View>
      <Pressable
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={blocked}
        onPress={onPress}
        style={{ minHeight: 44, borderRadius: mobileTheme.radius.md, borderWidth: destructive ? 0 : 1, borderColor: "rgba(255,138,138,0.55)", backgroundColor: destructive ? "#FF4D4F" : undefined, alignItems: "center", justifyContent: "center", opacity: blocked ? 0.45 : 1 }}
      >
        <Text style={{ color: destructive ? "#FFE8EB" : "#FFB0B0", fontSize: 14, fontWeight: "800" }}>{buttonLabel}</Text>
      </Pressable>
    </View>
  );
}
