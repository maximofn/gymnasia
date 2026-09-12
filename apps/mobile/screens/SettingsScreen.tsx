import { Feather, Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { memo, useCallback, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import {
  type DataSettingsActions,
  type DataSettingsModel,
  type DietSettingsActions,
  type DietSettingsModel,
  type FoodCatalogSettingsActions,
  type FoodCatalogSettingsModel,
  type MemorySettingsActions,
  type MemorySettingsModel,
  type MeasurementsSettingsActions,
  type MeasurementsSettingsModel,
  SETTINGS_TAB_OPTIONS,
  type NotificationSettingsActions,
  type NotificationSettingsModel,
  type SettingsTabsActions,
  type SettingsTabsModel,
  type TrainingSettingsActions,
  type TrainingSettingsModel,
} from "../controllers/settingsController";
import { CatalogStatusNotice } from "../catalogs/CatalogStatusNotice";
import { foodCatalogImageUri } from "../catalogs/sources";
import type { UserPreferences } from "../storage/userPreferences";
import { shellSurfaceTestId } from "../shell/shellRegistry";
import {
  formatMeasurementHistoryDate,
  formatMeasurementNumber,
} from "../measurements/presentationModel";
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

export const MemorySettingsPanel = memo(function MemorySettingsPanel({
  model,
  actions,
}: {
  model: Readonly<MemorySettingsModel>;
  actions: Readonly<MemorySettingsActions>;
}) {
  return (
    <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12, gap: 12 }}>
      <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>
        Memoria del coach
      </Text>
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>
        Datos personales que el coach recuerda entre conversaciones. Puedes editarlos o dejar que el coach los guarde cuando le compartas información. El coach los consulta cuando los necesita: nunca se envían como instrucciones del sistema ni modifican su comportamiento.
      </Text>
      {model.fields.map((field, index) => (
        <View key={`mem_${index}`} style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, borderRadius: mobileTheme.radius.md, padding: 10, gap: 8 }}>
          <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <TextInput
              style={{ flex: 1, minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, color: mobileTheme.color.textPrimary, paddingHorizontal: 10, fontSize: 13, fontWeight: "700" }}
              testID={`memory-field-key-${index}`}
              value={field.key}
              onChangeText={(text) => actions.updateField(index, "key", text)}
              onBlur={actions.commitField}
              placeholder="Campo"
              placeholderTextColor={mobileTheme.color.textSecondary}
            />
            <Pressable onPress={() => actions.deleteField(index)} style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: "rgba(255,77,79,0.15)", alignItems: "center", justifyContent: "center" }}>
              <Feather name="trash-2" size={13} color="#FF4D4F" />
            </Pressable>
          </View>
          <TextInput
            style={{ minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, color: mobileTheme.color.textSecondary, paddingHorizontal: 10, fontSize: 12 }}
            value={field.description}
            onChangeText={(text) => actions.updateField(index, "description", text)}
            onBlur={actions.commitField}
            placeholder="Descripción (para qué sirve este campo)"
            placeholderTextColor={mobileTheme.color.textSecondary}
          />
          <TextInput
            style={{ minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, color: mobileTheme.color.textPrimary, paddingHorizontal: 10, fontSize: 13 }}
            value={field.value}
            onChangeText={(text) => actions.updateField(index, "value", text)}
            onBlur={actions.commitField}
            placeholder="Valor"
            placeholderTextColor={mobileTheme.color.textSecondary}
          />
        </View>
      ))}
      <View style={{ borderTopWidth: 1, borderTopColor: mobileTheme.color.borderSubtle, paddingTop: 12, gap: 8 }}>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>Añadir campo</Text>
        <MemoryInput value={model.newKey} onChangeText={actions.changeNewKey} placeholder="Campo (ej: Nombre)" bold />
        <MemoryInput value={model.newDescription} onChangeText={actions.changeNewDescription} placeholder="Descripción (ej: Nombre real del usuario)" secondary />
        <MemoryInput value={model.newValue} onChangeText={actions.changeNewValue} placeholder="Valor (ej: Juan)" />
        <Pressable
          onPress={actions.addField}
          disabled={!model.newKey.trim()}
          style={{ height: 44, borderRadius: mobileTheme.radius.md, backgroundColor: model.newKey.trim() ? mobileTheme.color.brandPrimary : "#2F3440", alignItems: "center", justifyContent: "center", opacity: model.newKey.trim() ? 1 : 0.5 }}
        >
          <Text style={{ color: model.newKey.trim() ? "#06090D" : "#9AA2AE", fontWeight: "700" }}>Añadir</Text>
        </Pressable>
      </View>
      {model.fields.length > 0 ? (
        <Pressable onPress={actions.clearAll} style={{ marginTop: 4, height: 44, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: "rgba(255,100,100,0.4)", alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#ffb5b5", fontWeight: "700" }}>Borrar toda la memoria</Text>
        </Pressable>
      ) : null}
    </View>
  );
});

function MemoryInput({
  value,
  onChangeText,
  placeholder,
  bold = false,
  secondary = false,
}: {
  value: string;
  onChangeText(value: string): void;
  placeholder: string;
  bold?: boolean;
  secondary?: boolean;
}) {
  return (
    <TextInput
      style={{ minHeight: 40, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, color: secondary ? mobileTheme.color.textSecondary : mobileTheme.color.textPrimary, paddingHorizontal: 10, fontSize: secondary ? 12 : 13, fontWeight: bold ? "700" : undefined }}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={mobileTheme.color.textSecondary}
    />
  );
}

const DIET_GOALS = [
  { key: "bulk" as const, label: "Volumen" },
  { key: "cut" as const, label: "Definición" },
  { key: "maintain" as const, label: "Mantenimiento" },
];
const ACTIVITY_LEVELS = [
  { key: "moderate" as const, label: "Moderada" },
  { key: "intermediate" as const, label: "Intermedia" },
  { key: "high" as const, label: "Alta" },
];

export const DietSettingsPanel = memo(function DietSettingsPanel({
  model,
  actions,
}: {
  model: Readonly<DietSettingsModel>;
  actions: Readonly<DietSettingsActions>;
}) {
  const draft = model.draft;
  const age = draft.birth_date
    ? Math.floor((Date.now() - new Date(draft.birth_date).getTime()) / 31557600000)
    : null;
  const macroRows = [
    { macro: "protein" as const, kcalLabel: "Proteínas", gkgLabel: "Proteína", hint: model.proteinMaxGramsPerKgHint, value: draft.protein_grams_per_kg },
    { macro: "carbs" as const, kcalLabel: "Carbohidratos", gkgLabel: "Carbohidratos", hint: model.carbsMaxGramsPerKgHint, value: draft.carbs_grams_per_kg },
    { macro: "fat" as const, kcalLabel: "Grasas", gkgLabel: "Grasas", hint: model.fatMaxGramsPerKgHint, value: draft.fat_grams_per_kg },
  ];

  return (
    <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12, gap: 10 }}>
      <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>Plan de dieta</Text>
      <Text style={{ color: mobileTheme.color.textSecondary }}>Define tu objetivo y las calorías diarias.</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 10, alignSelf: "center" }}>Sexo</Text>
        {(["male", "female"] as const).map((sex) => {
          const selected = (draft.sex ?? "male") === sex;
          return (
            <Pressable key={sex} onPress={() => actions.changeSex(sex)} style={{ flex: 1, minHeight: 36, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: selected ? mobileTheme.color.brandPrimary : mobileTheme.color.borderSubtle, backgroundColor: selected ? "rgba(203,255,26,0.12)" : mobileTheme.color.bgApp, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: selected ? mobileTheme.color.brandPrimary : mobileTheme.color.textSecondary, fontWeight: "700", fontSize: 13 }}>
                {sex === "male" ? "Hombre" : "Mujer"}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-end" }}>
        <LabeledDietValue label="Altura" flex={0.7}>
          <TextInput value={draft.height_cm ?? (model.latestHeightCm ? String(model.latestHeightCm) : "")} onChangeText={actions.changeHeight} placeholder="cm" placeholderTextColor={mobileTheme.color.textSecondary} keyboardType="decimal-pad" style={dietValueStyle} />
        </LabeledDietValue>
        <LabeledDietValue label="Peso" flex={0.7}>
          <View style={dietReadonlyStyle}>
            <Text style={{ color: model.latestWeightKg ? mobileTheme.color.textPrimary : mobileTheme.color.textSecondary, fontSize: 14 }}>{model.latestWeightKg ?? "—"}</Text>
          </View>
        </LabeledDietValue>
        <LabeledDietValue label="Edad" flex={0.6}>
          <View style={dietReadonlyStyle}>
            <Text style={{ color: age !== null ? mobileTheme.color.textPrimary : mobileTheme.color.textSecondary, fontSize: 14 }}>{age ?? "—"}</Text>
          </View>
        </LabeledDietValue>
        <LabeledDietValue label="F. Nacimiento" flex={1.5}>
          {model.isWeb ? (
            <TextInput value={draft.birth_date ?? ""} onChangeText={actions.changeBirthDate} placeholder="AAAA-MM-DD" placeholderTextColor={mobileTheme.color.textSecondary} style={dietValueStyle} />
          ) : (
            <>
              <Pressable onPress={actions.showBirthDatePicker} style={{ ...dietReadonlyStyle, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <Text style={{ color: draft.birth_date ? mobileTheme.color.textPrimary : mobileTheme.color.textSecondary, fontSize: 14 }}>{draft.birth_date || "Seleccionar"}</Text>
                <Feather name="calendar" size={14} color={mobileTheme.color.textSecondary} />
              </Pressable>
              {model.birthDatePickerVisible ? (
                <DateTimePicker
                  testID={shellSurfaceTestId("birth-date-picker")}
                  value={draft.birth_date ? new Date(draft.birth_date) : new Date(1990, 0, 1)}
                  mode="date"
                  display={model.isIos ? "spinner" : "default"}
                  maximumDate={new Date()}
                  minimumDate={new Date(1930, 0, 1)}
                  onChange={(_event, selectedDate) => {
                    if (!model.isIos) actions.closeBirthDatePicker();
                    if (selectedDate) actions.selectBirthDate(selectedDate);
                  }}
                />
              ) : null}
            </>
          )}
        </LabeledDietValue>
      </View>
      <ChoiceRow label="Objetivo" options={DIET_GOALS} selected={draft.goal} onSelect={actions.changeGoal} />
      <ChoiceRow label="Nivel de actividad" options={ACTIVITY_LEVELS} selected={draft.activity_level} onSelect={actions.changeActivityLevel} />
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>Calorías diarias</Text>
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>Añádelas a mano o pulsa Calcular para estimarlas automáticamente.</Text>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <TextInput
          testID="diet-plan-daily-calories-input"
          style={{ flex: 1, minHeight: 42, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: model.issues.has("daily_calories") ? "#FF5A5F" : mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, color: mobileTheme.color.textPrimary, paddingHorizontal: 12 }}
          value={draft.daily_calories}
          onChangeText={actions.changeDailyCalories}
          placeholder="Calorías objetivo (kcal)"
          placeholderTextColor={mobileTheme.color.textSecondary}
          keyboardType="decimal-pad"
        />
        <Pressable onPress={actions.calculateDailyCalories} style={{ minHeight: 42, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.brandPrimary, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: "#000", fontSize: 12, fontWeight: "700" }}>Calcular</Text>
        </Pressable>
      </View>
      {model.issues.get("daily_calories") ? (
        <Text testID="diet-plan-error-daily-calories" style={{ color: "#FF8D8D", fontSize: 11 }}>{model.issues.get("daily_calories")?.message}</Text>
      ) : null}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["manual_calories", "protein_by_weight"] as const).map((mode) => {
          const selected = draft.macro_mode === mode;
          return (
            <Pressable key={mode} testID={`diet-macro-mode-${mode}`} onPress={() => actions.changeMacroMode(mode)} style={{ flex: 1, minHeight: 38, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: selected ? mobileTheme.color.brandPrimary : mobileTheme.color.borderSubtle, backgroundColor: selected ? "rgba(203,255,26,0.10)" : mobileTheme.color.bgApp, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: selected ? mobileTheme.color.brandPrimary : mobileTheme.color.textSecondary, fontWeight: "800", fontSize: 12 }}>{mode === "manual_calories" ? "Planificar por kcal" : "Planificar por g/kg"}</Text>
            </Pressable>
          );
        })}
      </View>
      {macroRows.map((row, index) => (
        <MacroSettingsRow key={row.macro} row={row} first={index === 0} model={model} actions={actions} />
      ))}
      <View style={{ borderWidth: 1, borderColor: model.configuredMacroCaloriesExcess > 0 ? "rgba(255,90,95,0.65)" : mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp, padding: 10, gap: 4 }}>
        <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700" }}>Asignadas: {model.configuredMacroCaloriesTotal.toFixed(0)} kcal</Text>
        <Text style={{ color: model.configuredMacroCaloriesExcess > 0 ? "#FF8D8D" : mobileTheme.color.brandPrimary, fontWeight: "700" }}>
          {model.configuredMacroCaloriesExcess > 0 ? `Excedente: ${model.configuredMacroCaloriesExcess.toFixed(0)} kcal · Restantes: 0 kcal` : `Restantes: ${model.configuredMacroCaloriesRemaining.toFixed(0)} kcal`}
        </Text>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
          P: {model.draftProteinTargetGrams.toFixed(1)}g ({(model.draftProteinTargetGrams * 4).toFixed(0)} kcal) • C: {model.draftCarbsTargetGrams.toFixed(1)}g ({(model.draftCarbsTargetGrams * 4).toFixed(0)} kcal) • G: {model.draftFatTargetGrams.toFixed(1)}g ({(model.draftFatTargetGrams * 9).toFixed(0)} kcal)
        </Text>
        {model.configuredMacroCaloriesExcess > 0 ? (
          <Text testID="diet-plan-budget-warning" accessibilityLiveRegion="polite" style={{ color: "#FF8D8D", fontSize: 12, lineHeight: 17 }}>
            Los macros superan el objetivo diario en {model.configuredMacroCaloriesExcess.toFixed(0)} kcal. Puedes guardar el plan, pero el reparto no es coherente.
          </Text>
        ) : null}
      </View>
      <Pressable testID="save-diet-plan" accessibilityRole="button" accessibilityLabel="Guardar plan de dieta" disabled={!model.dirty} onPress={actions.save} style={{ minHeight: 44, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center", opacity: model.dirty ? 1 : 0.45 }}>
        <Text style={{ color: "#06090D", fontWeight: "800" }}>Guardar plan</Text>
      </Pressable>
      {model.saveResult ? (
        <Text testID="diet-plan-save-result" accessibilityLiveRegion="polite" style={{ color: model.saveResult.startsWith("Plan guardado") ? mobileTheme.color.brandPrimary : "#FF8D8D", fontSize: 12 }}>{model.saveResult}</Text>
      ) : null}
    </View>
  );
});

const dietValueStyle = { minHeight: 40, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, color: mobileTheme.color.textPrimary, paddingHorizontal: 10, fontSize: 14 } as const;
const dietReadonlyStyle = { minHeight: 40, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgApp, justifyContent: "center" as const, paddingHorizontal: 10 };

function LabeledDietValue({ label, flex, children }: { label: string; flex: number; children: ReactNode }) {
  return <View style={{ flex, gap: 2 }}><Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600", paddingLeft: 10 }}>{label}</Text>{children}</View>;
}

function ChoiceRow<T extends string>({ label, options, selected, onSelect }: { label: string; options: ReadonlyArray<{ key: T; label: string }>; selected: T | undefined; onSelect(value: T): void }) {
  return <><Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>{label}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{options.map((option) => { const active = selected === option.key; return <Pressable key={option.key} onPress={() => onSelect(option.key)} style={{ borderWidth: 1, borderColor: active ? "rgba(203,255,26,0.45)" : mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.pill, paddingHorizontal: 12, minHeight: 34, alignItems: "center", justifyContent: "center", backgroundColor: active ? "rgba(203,255,26,0.08)" : mobileTheme.color.bgApp }}><Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "600" }}>{option.label}</Text></Pressable>; })}</View></>;
}

function MacroSettingsRow({ row, first, model, actions }: { row: { macro: "protein" | "carbs" | "fat"; kcalLabel: string; gkgLabel: string; hint: number | null; value: string }; first: boolean; model: Readonly<DietSettingsModel>; actions: Readonly<DietSettingsActions> }) {
  const calorieIssue = model.issues.get(`manual_macro_calories.${row.macro}`);
  const gramsIssue = model.issues.get(`${row.macro}_grams_per_kg`);
  return <View>{first ? <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}><Text style={macroHeadingStyle}>kcal</Text><Text style={macroHeadingStyle}>g/kg</Text></View> : null}<View style={{ flexDirection: "row", gap: 10, marginBottom: 2 }}><Text style={macroLabelStyle}>{row.kcalLabel}</Text><Text style={macroLabelStyle} numberOfLines={1}>{row.gkgLabel}{row.hint !== null ? ` · max ${row.hint.toFixed(1)}` : ""}</Text></View><View style={{ flexDirection: "row", gap: 10 }}><MacroNumberInput testID={`diet-plan-${row.macro}-calories-input`} value={model.draft.manual_macro_calories[row.macro]} invalid={!!calorieIssue} step={1} onChange={(value) => actions.changeManualMacroCalories(row.macro, value)} /><MacroNumberInput testID={`diet-plan-${row.macro}-gkg-input`} value={row.value} invalid={!!gramsIssue} step={0.1} onChange={(value) => actions.changeMacroGramsPerKg(row.macro, value)} /></View>{calorieIssue || gramsIssue ? <Text style={{ color: "#FF8D8D", fontSize: 11, marginTop: 3 }}>{(calorieIssue ?? gramsIssue)?.message}</Text> : null}</View>;
}

const macroHeadingStyle = { flex: 1, color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "700" as const, textAlign: "center" as const };
const macroLabelStyle = { flex: 1, color: mobileTheme.color.textSecondary, fontSize: 11, fontWeight: "600" as const, paddingLeft: 12 };

function MacroNumberInput({ testID, value, invalid, step, onChange }: { testID: string; value: string; invalid: boolean; step: number; onChange(value: string): void }) {
  const nextValue = (direction: 1 | -1) => {
    if (step === 1) {
      return String(Math.max(0, (parseInt(value) || 0) + direction));
    }
    return Math.max(0, Math.round(((parseFloat(value) || 0) + step * direction) * 10) / 10).toFixed(1);
  };
  return <View style={{ flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: invalid ? "#FF5A5F" : mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgApp, minHeight: 42 }}><TextInput testID={testID} style={{ flex: 1, color: mobileTheme.color.textPrimary, paddingHorizontal: 12, minHeight: 42 }} value={value} onChangeText={onChange} placeholder={step < 1 ? "g/kg" : "kcal"} placeholderTextColor={mobileTheme.color.textSecondary} keyboardType="decimal-pad" /><View style={{ justifyContent: "center", paddingRight: 6 }}><Pressable onPress={() => onChange(nextValue(1))} style={{ padding: 4 }}><Feather name="chevron-up" size={16} color={mobileTheme.color.textSecondary} /></Pressable><Pressable onPress={() => onChange(nextValue(-1))} style={{ padding: 4 }}><Feather name="chevron-down" size={16} color={mobileTheme.color.textSecondary} /></Pressable></View></View>;
}

export const MeasurementsSettingsPanel = memo(function MeasurementsSettingsPanel({
  model,
  actions,
}: {
  model: Readonly<MeasurementsSettingsModel>;
  actions: Readonly<MeasurementsSettingsActions>;
}) {
  return (
    <View style={{ gap: 12 }}>
      {model.duplicateDateCount > 0 ? (
        <View testID="measurement-settings-duplicate-warning" style={{ borderRadius: 12, borderWidth: 1, borderColor: "rgba(255,190,92,0.45)", backgroundColor: "rgba(255,190,92,0.10)", padding: 12, flexDirection: "row", alignItems: "flex-start", gap: 8 }}>
          <Feather name="alert-triangle" size={17} color="#FFBE5C" style={{ marginTop: 1 }} />
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, lineHeight: 18, flex: 1 }}>
            {`Hay mediciones repetidas en ${model.duplicateDateCount} fecha(s). Se conservan para que decidas cuál editar o eliminar.`}
          </Text>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 16, fontWeight: "700" }}>
          Medidas guardadas ({model.measurements.length})
        </Text>
        <Pressable onPress={actions.addMeasurement} style={{ flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderColor: "rgba(203,255,26,0.45)", borderRadius: mobileTheme.radius.pill, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "rgba(203,255,26,0.08)" }}>
          <Feather name="plus" size={14} color={mobileTheme.color.brandPrimary} />
          <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 12, fontWeight: "700" }}>Añadir</Text>
        </Pressable>
      </View>
      {model.measurements.length === 0 ? (
        <View style={{ backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, padding: 24, alignItems: "center", gap: 8 }}>
          <Feather name="activity" size={32} color={mobileTheme.color.textSecondary} />
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, textAlign: "center" }}>
            No hay medidas guardadas. Pulsa "Añadir" para registrar tus medidas.
          </Text>
        </View>
      ) : model.measurements.map((measurement, index) => {
        const fields = measurementSettingsFields(measurement);
        return (
          <View key={measurement.id} style={{ backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, padding: 12, gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: mobileTheme.color.brandPrimary, fontSize: 13, fontWeight: "700" }}>{formatMeasurementHistoryDate(measurement.measured_on)}</Text>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>#{model.measurements.length - index}</Text>
            </View>
            {fields.length > 0 ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {fields.map((field) => (
                  <View key={field.label} style={{ backgroundColor: "#ffffff08", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, gap: 2 }}>
                    <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10 }}>{field.label}</Text>
                    <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }}>{field.value}</Text>
                  </View>
                ))}
              </View>
            ) : <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>Sin medidas numéricas</Text>}
            <View style={{ flexDirection: "row", gap: 8 }}>
              <Pressable onPress={() => actions.editMeasurement(measurement)} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle }}>
                <Feather name="edit-2" size={13} color={mobileTheme.color.textSecondary} />
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>Editar</Text>
              </Pressable>
              <Pressable testID={`measurement-delete-${measurement.id}`} onPress={() => actions.deleteMeasurement(measurement.id)} style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: mobileTheme.radius.md, borderWidth: 1, borderColor: "#FF6B6B44", backgroundColor: "#FF6B6B10" }}>
                <Feather name="trash-2" size={13} color="#FF6B6B" />
                <Text style={{ color: "#FF6B6B", fontSize: 12, fontWeight: "600" }}>Eliminar</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
});

function measurementSettingsFields(measurement: MeasurementsSettingsModel["measurements"][number]) {
  const fields: Array<{ label: string; value: string }> = [];
  const add = (label: string, value: number | null, unit: string) => {
    if (value !== null) fields.push({ label, value: `${formatMeasurementNumber(value)} ${unit}` });
  };
  add("Peso", measurement.weight_kg, "kg");
  add("Altura", measurement.height_cm, "cm");
  add("Cuello", measurement.neck_cm, "cm");
  add("Pecho", measurement.chest_cm, "cm");
  add("Cintura", measurement.waist_cm, "cm");
  add("Cadera", measurement.hips_cm, "cm");
  add("Bíceps", measurement.biceps_cm, "cm");
  add("Cuádriceps", measurement.quadriceps_cm, "cm");
  add("Gemelo", measurement.calf_cm, "cm");
  if (measurement.photo_uri) fields.push({ label: "Foto", value: "Sí" });
  return fields;
}

export const TrainingSettingsPanel = memo(function TrainingSettingsPanel({
  model,
  actions,
}: {
  model: Readonly<TrainingSettingsModel>;
  actions: Readonly<TrainingSettingsActions>;
}) {
  return (
    <View style={{ gap: 16 }}>
      <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12, gap: 10 }}>
        <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>Rutinas ({model.templates.length})</Text>
        {model.templates.length === 0 ? (
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>No hay rutinas creadas.</Text>
        ) : model.templates.map((template) => (
          <View key={template.id} style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, padding: 10, gap: 6 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 14 }}>{template.name}</Text>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>{trainingCategoryLabel(template.category)}</Text>
            </View>
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>
              {template.exercises.length} ejercicio{template.exercises.length !== 1 ? "s" : ""}{template.duration_minutes ? ` · ${template.duration_minutes} min` : ""}
            </Text>
            {template.exercises.length > 0 ? (
              <View style={{ gap: 4, marginTop: 2 }}>
                {template.exercises.map((exercise, index) => {
                  const totalSeries = exercise.series?.length ?? exercise.sets?.length ?? 0;
                  return (
                    <View key={exercise.id} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {exercise.image_uri ? (
                        <Image source={{ uri: exercise.image_uri }} style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#1a1a1a" }} />
                      ) : (
                        <View style={{ width: 28, height: 28, borderRadius: 6, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#555", fontSize: 10 }}>{index + 1}</Text></View>
                      )}
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, flex: 1 }} numberOfLines={2}>{exercise.name ?? `Ejercicio ${index + 1}`}</Text>
                      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>{totalSeries}×</Text>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </View>
        ))}
      </View>
      <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12, gap: 10 }}>
        <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>Catálogo de ejercicios</Text>
        <CatalogStatusNotice metadata={model.catalogAvailability} onRetry={actions.retryCatalog} testID="settings-exercise-catalog-status" />
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 19 }}>{model.catalogSummary}</Text>
        <Pressable testID="settings-open-exercise-catalog" onPress={actions.openCatalog} style={{ minHeight: 48, borderRadius: mobileTheme.radius.pill, backgroundColor: mobileTheme.color.brandPrimary, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 }}>
          <Feather name="book-open" size={17} color="#07090D" />
          <Text style={{ color: "#07090D", fontSize: 15, fontWeight: "800" }}>Consultar catálogo</Text>
        </Pressable>
      </View>
      {model.localOnlyExercises.length > 0 ? (
        <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12, gap: 10 }}>
          <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>Tus ejercicios (aún no en la app) ({model.localOnlyExercises.length})</Text>
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>Ejercicios que tienes en tus rutinas pero que todavía no están en la base de datos de la app. Se añadirán en próximas actualizaciones.</Text>
          {model.localOnlyExercises.map((exercise) => (
            <View key={exercise.name} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: mobileTheme.color.borderSubtle }}>
              <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "#1a1a1a", alignItems: "center", justifyContent: "center" }}><Feather name="clock" size={16} color={mobileTheme.color.textSecondary} /></View>
              <View style={{ flex: 1 }}><Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }} numberOfLines={2}>{exercise.name}</Text><Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>Pendiente de añadir</Text></View>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10, flexShrink: 0, marginLeft: 6 }}>{exercise.muscle}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
});

function trainingCategoryLabel(category: string | undefined): string {
  if (category === "strength") return "Fuerza";
  if (category === "hypertrophy") return "Hipertrofia";
  if (category === "cardio") return "Cardio";
  if (category === "flexibility") return "Flexibilidad";
  return "Sin categoría";
}

export const FoodsSettingsPanel = memo(function FoodsSettingsPanel({
  model,
  actions,
}: {
  model: Readonly<FoodCatalogSettingsModel>;
  actions: Readonly<FoodCatalogSettingsActions>;
}) {
  const foods = model.foods.filter((food) => !food.source || food.source === "alimento");
  const categories = ["all", ...Array.from(new Set(foods.map((food) => food.category))).sort()];
  const normalizedSearch = model.foodSearch.toLowerCase();
  const filtered = foods.filter((food) => (
    (!normalizedSearch || food.name.toLowerCase().includes(normalizedSearch) || food.category.toLowerCase().includes(normalizedSearch))
    && (model.foodCategory === "all" || food.category === model.foodCategory)
  ));
  return (
    <View style={{ gap: 12 }}>
      <CatalogStatusNotice metadata={model.availability} onRetry={actions.retry} testID="settings-food-catalog-status" />
      <CatalogSearch value={model.foodSearch} onChange={actions.changeFoodSearch} placeholder="Buscar alimento..." />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
        {categories.map((category) => {
          const active = model.foodCategory === category;
          const label = category === "all" ? "Todos" : category.charAt(0).toUpperCase() + category.slice(1);
          return (
            <Pressable key={category} onPress={() => actions.changeFoodCategory(category)} style={{ borderWidth: 1, borderColor: active ? "rgba(203,255,26,0.45)" : mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.pill, paddingHorizontal: 10, minHeight: 30, alignItems: "center", justifyContent: "center", backgroundColor: active ? "rgba(203,255,26,0.08)" : mobileTheme.color.bgSurface }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 11, fontWeight: "600" }}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12, gap: 10 }}>
        <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>Alimentos ({foods.length})</Text>
        {filtered.length === 0 ? (
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>No se encontraron alimentos.</Text>
        ) : filtered.map((food) => (
          <View key={food.id}>
            <FoodCatalogRow food={food} showCategory onPress={() => actions.selectFood(model.selectedFood?.id === food.id ? null : food)} />
            {model.selectedFood?.id === food.id ? (
              <FoodCatalogDetail food={food} testID={shellSurfaceTestId("settings-food-detail")} />
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
});

export const ProductsSettingsPanel = memo(function ProductsSettingsPanel({
  model,
  actions,
}: {
  model: Readonly<FoodCatalogSettingsModel>;
  actions: Readonly<FoodCatalogSettingsActions>;
}) {
  const products = model.foods.filter((food) => food.source === "producto_comercial");
  const normalizedSearch = model.productSearch.toLowerCase();
  const filtered = products.filter((food) => !normalizedSearch || food.name.toLowerCase().includes(normalizedSearch));
  return (
    <View style={{ gap: 12 }}>
      <CatalogStatusNotice metadata={model.availability} onRetry={actions.retry} testID="settings-product-catalog-status" />
      <CatalogSearch value={model.productSearch} onChange={actions.changeProductSearch} placeholder="Buscar producto comercial..." />
      <View style={{ borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, backgroundColor: mobileTheme.color.bgSurface, borderRadius: mobileTheme.radius.lg, padding: 12, gap: 10 }}>
        <Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18 }}>Productos comerciales ({products.length})</Text>
        {filtered.length === 0 ? (
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13 }}>{products.length === 0 ? "No hay productos comerciales." : "No se encontraron productos."}</Text>
        ) : filtered.map((food) => <FoodCatalogRow key={food.id} food={food} onPress={() => actions.selectProduct(food)} />)}
      </View>
      {model.selectedProduct ? (
        <FoodCatalogDetail food={model.selectedProduct} testID={shellSurfaceTestId("settings-product-detail")} onClose={() => actions.selectProduct(null)} showTitle />
      ) : null}
    </View>
  );
});

function CatalogSearch({ value, onChange, placeholder }: { value: string; onChange(value: string): void; placeholder: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: mobileTheme.color.borderSubtle, borderRadius: mobileTheme.radius.md, backgroundColor: mobileTheme.color.bgSurface, paddingHorizontal: 10, height: 40 }}>
      <Feather name="search" size={16} color={mobileTheme.color.textSecondary} />
      <TextInput value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={mobileTheme.color.textSecondary} style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 14, marginLeft: 8 }} />
      {value ? <Pressable onPress={() => onChange("")} style={{ padding: 4 }}><Feather name="x" size={16} color={mobileTheme.color.textSecondary} /></Pressable> : null}
    </View>
  );
}

function FoodCatalogRow({ food, onPress, showCategory = false }: { food: FoodCatalogSettingsModel["foods"][number]; onPress(): void; showCategory?: boolean }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: mobileTheme.color.borderSubtle }}>
      <SettingsFoodThumbnail food={food} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13, fontWeight: "600" }} numberOfLines={1}>{food.name}</Text>
        <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>{food.calories_per_100g} kcal · P:{food.protein_per_100g}g · C:{food.carbs_per_100g}g · G:{food.fat_per_100g}g</Text>
      </View>
      {showCategory ? <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 10 }}>{food.category}</Text> : null}
    </Pressable>
  );
}

function SettingsFoodThumbnail({ food }: { food: FoodCatalogSettingsModel["foods"][number] }) {
  const [failed, setFailed] = useState(false);
  const uri = foodCatalogImageUri(food);
  if (uri && !failed) return <Image source={{ uri }} onError={() => setFailed(true)} style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: mobileTheme.color.bgSurface }} />;
  const emoji = food.category === "proteína" ? "🥩" : food.category === "carbohidrato" ? "🍚" : food.category === "grasa" ? "🫒" : food.category === "fruta" ? "🍎" : food.category === "verdura" ? "🥦" : food.category === "lácteo" ? "🥛" : food.category === "legumbre" ? "🫘" : food.category === "fruto-seco" ? "🥜" : "🍽️";
  return <View style={{ width: 36, height: 36, borderRadius: 8, backgroundColor: "rgba(203,255,26,0.1)", alignItems: "center", justifyContent: "center" }}><Text style={{ fontSize: 16 }}>{emoji}</Text></View>;
}

function FoodCatalogDetail({ food, testID, onClose, showTitle = false }: { food: FoodCatalogSettingsModel["foods"][number]; testID: string; onClose?: () => void; showTitle?: boolean }) {
  const servingCalories = Math.round(food.calories_per_100g * food.serving_size_g / 100);
  return (
    <View testID={testID} style={{ backgroundColor: mobileTheme.color.bgSurface, borderRadius: 12, padding: 16, gap: 12, marginTop: showTitle ? 0 : 6, borderWidth: 1, borderColor: mobileTheme.color.borderSubtle }}>
      {showTitle ? <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Text style={{ color: mobileTheme.color.textPrimary, fontWeight: "700", fontSize: 18, flex: 1 }}>{food.name}</Text><Pressable onPress={onClose} style={{ padding: 4 }}><Feather name="x" size={20} color={mobileTheme.color.textSecondary} /></Pressable></View> : null}
      {showTitle && food.image ? <Image source={{ uri: foodCatalogImageUri(food)! }} style={{ width: "100%", height: 160, borderRadius: 8 }} resizeMode="contain" /> : null}
      <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>Por 100g</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[{ label: "Calorías", value: food.calories_per_100g, unit: "kcal", color: "#FF6B6B" }, { label: "Proteína", value: food.protein_per_100g, unit: "g", color: "#4ECDC4" }, { label: "Carbos", value: food.carbs_per_100g, unit: "g", color: "#FFE66D" }, { label: "Grasa", value: food.fat_per_100g, unit: "g", color: "#FF8A5C" }].map((macro) => <View key={macro.label} style={{ flex: 1, backgroundColor: `${macro.color}15`, borderRadius: 8, padding: 8, alignItems: "center", gap: 2 }}><Text style={{ color: macro.color, fontSize: 16, fontWeight: "700" }}>{macro.value}</Text><Text style={{ color: mobileTheme.color.textSecondary, fontSize: 9 }}>{macro.unit}</Text><Text style={{ color: mobileTheme.color.textSecondary, fontSize: 9 }}>{macro.label}</Text></View>)}
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}><Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12 }}>Fibra</Text><Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "600" }}>{food.fiber_per_100g}g</Text></View>
      {food.serving_size_g > 0 ? <View style={{ backgroundColor: "#ffffff08", borderRadius: 8, padding: 10, gap: 4 }}><Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, fontWeight: "600" }}>{showTitle ? `Ración típica (${food.serving_size_g}g)` : "Ración típica"}</Text>{!showTitle ? <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 13 }}>{food.serving_description || `${food.serving_size_g}g`}</Text> : null}<Text style={{ color: mobileTheme.color.textSecondary, fontSize: 11 }}>{servingCalories} kcal · P:{(food.protein_per_100g * food.serving_size_g / 100).toFixed(1)}g · C:{(food.carbs_per_100g * food.serving_size_g / 100).toFixed(1)}g · G:{(food.fat_per_100g * food.serving_size_g / 100).toFixed(1)}g</Text></View> : null}
    </View>
  );
}
