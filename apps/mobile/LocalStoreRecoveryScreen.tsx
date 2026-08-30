import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from "react-native";

import { mobileTheme } from "./theme";
import type { RecoveryQuarantineRecord } from "./persistence/localStoreRecovery";

type RecoveryAction = "restore" | "export" | "retry" | "discard";

type LocalStoreRecoveryScreenProps = {
  quarantine: RecoveryQuarantineRecord;
  hasSnapshot: boolean;
  busy: RecoveryAction | null;
  error: string | null;
  onRestore(): void;
  onExport(): void;
  onRetry(): void;
  onDiscard(): void;
};

type LocalStoreStartupFailureScreenProps = {
  error: string;
  busy: boolean;
  onRetry(): void;
};

type RecoveryButtonProps = {
  testID: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  variant: "primary" | "secondary" | "danger" | "ghost";
  busy: boolean;
  disabled?: boolean;
  onPress(): void;
};

const DANGER = "#FF5A62";
const WARNING = "#F5B942";

function RecoveryButton({
  testID,
  label,
  icon,
  variant,
  busy,
  disabled = false,
  onPress,
}: RecoveryButtonProps) {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isGhost = variant === "ghost";
  const color = isPrimary
    ? "#06090D"
    : isDanger
      ? DANGER
      : mobileTheme.color.textPrimary;
  const backgroundColor = isPrimary
    ? mobileTheme.color.brandPrimary
    : isDanger
      ? "rgba(255,90,98,0.08)"
      : isGhost
        ? "transparent"
        : mobileTheme.color.bgSurface;
  const borderColor = isDanger
    ? "rgba(255,90,98,0.55)"
    : isGhost
      ? "transparent"
      : isPrimary
        ? mobileTheme.color.brandPrimary
        : mobileTheme.color.borderSubtle;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        width: "100%",
        minHeight: 50,
        borderRadius: mobileTheme.radius.md,
        borderWidth: isGhost ? 0 : 1,
        borderColor,
        backgroundColor,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 9,
        opacity: disabled ? 0.42 : pressed ? 0.78 : 1,
      })}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} />
      ) : (
        <Feather name={icon} size={17} color={color} />
      )}
      <Text style={{ color, fontWeight: "800", fontSize: 15 }}>{label}</Text>
    </Pressable>
  );
}

export function LocalStoreRecoveryScreen({
  quarantine,
  hasSnapshot,
  busy,
  error,
  onRestore,
  onExport,
  onRetry,
  onDiscard,
}: LocalStoreRecoveryScreenProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const actionsDisabled = busy !== null;
  const unreadable = quarantine.cause === "storage_read_failed";

  return (
    <SafeAreaView testID="local-store-recovery-screen" style={{ flex: 1, backgroundColor: mobileTheme.color.bgApp }}>
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: mobileTheme.spacing[4],
          paddingVertical: mobileTheme.spacing[6],
        }}
      >
        <View style={{ width: "100%", maxWidth: 520, gap: 14 }}>
          <View
            style={{
              alignSelf: "flex-start",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              borderRadius: mobileTheme.radius.pill,
              borderWidth: 1,
              borderColor: "rgba(245,185,66,0.36)",
              backgroundColor: "rgba(245,185,66,0.08)",
              paddingHorizontal: 11,
              paddingVertical: 7,
            }}
          >
            <Feather name="shield" size={14} color={WARNING} />
            <Text style={{ color: WARNING, fontSize: 12, fontWeight: "800", letterSpacing: 0.6 }}>
              DATOS PROTEGIDOS
            </Text>
          </View>

          <View
            style={{
              borderRadius: mobileTheme.radius.lg,
              borderWidth: 1,
              borderColor: mobileTheme.color.borderSubtle,
              backgroundColor: mobileTheme.color.bgSurface,
              padding: 20,
              gap: 16,
            }}
          >
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(245,185,66,0.1)",
                borderWidth: 1,
                borderColor: "rgba(245,185,66,0.28)",
              }}
            >
              <Feather name="database" size={25} color={WARNING} />
            </View>

            <View style={{ gap: 8 }}>
              <Text
                testID="local-store-recovery-title"
                style={{ color: mobileTheme.color.textPrimary, fontSize: 27, lineHeight: 32, fontWeight: "900" }}
              >
                Tus datos necesitan atención
              </Text>
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 15, lineHeight: 22 }}>
                {unreadable
                  ? "Gymnasia no ha podido acceder al almacenamiento del dispositivo. No hemos guardado nada encima."
                  : "Gymnasia ha encontrado datos que no puede leer con seguridad. Los hemos conservado sin sobrescribirlos."}
              </Text>
            </View>

            {hasSnapshot ? (
              <View
                testID="local-store-snapshot-available"
                style={{
                  borderRadius: mobileTheme.radius.md,
                  backgroundColor: "rgba(203,255,26,0.07)",
                  borderWidth: 1,
                  borderColor: "rgba(203,255,26,0.24)",
                  padding: 12,
                  flexDirection: "row",
                  gap: 10,
                  alignItems: "flex-start",
                }}
              >
                <Feather name="check-circle" size={18} color={mobileTheme.color.brandPrimary} />
                <Text style={{ flex: 1, color: mobileTheme.color.textPrimary, fontSize: 13, lineHeight: 19 }}>
                  Hay una copia anterior verificada. Puedes recuperarla sin usar los datos dañados.
                </Text>
              </View>
            ) : null}

            {error ? (
              <View
                testID="local-store-recovery-error"
                style={{
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: "rgba(255,90,98,0.42)",
                  backgroundColor: "rgba(255,90,98,0.08)",
                  padding: 12,
                }}
              >
                <Text style={{ color: "#FFB3B7", fontSize: 13, lineHeight: 19 }}>{error}</Text>
              </View>
            ) : null}

            <View style={{ gap: 9 }}>
              {hasSnapshot ? (
                <RecoveryButton
                  testID="local-store-recovery-restore"
                  label="Recuperar última copia"
                  icon="rotate-ccw"
                  variant="primary"
                  busy={busy === "restore"}
                  disabled={actionsDisabled && busy !== "restore"}
                  onPress={onRestore}
                />
              ) : null}
              <RecoveryButton
                testID="local-store-recovery-export"
                label="Guardar copia dañada"
                icon="download"
                variant={hasSnapshot ? "secondary" : "primary"}
                busy={busy === "export"}
                disabled={quarantine.rawPayload === null || (actionsDisabled && busy !== "export")}
                onPress={onExport}
              />
              {quarantine.rawPayload !== null ? (
                <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 12, lineHeight: 17 }}>
                  Este archivo conserva el contenido original. Puede incluir datos de salud, conversaciones y, en web, claves de IA. Guárdalo en un lugar privado.
                </Text>
              ) : null}
              <RecoveryButton
                testID="local-store-recovery-retry"
                label="Volver a intentarlo"
                icon="refresh-cw"
                variant="ghost"
                busy={busy === "retry"}
                disabled={actionsDisabled && busy !== "retry"}
                onPress={onRetry}
              />
            </View>

            <View style={{ height: 1, backgroundColor: mobileTheme.color.borderSubtle }} />

            <Pressable
              testID="local-store-recovery-details-toggle"
              onPress={() => setShowDetails((value) => !value)}
              style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 40 }}
            >
              <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, fontWeight: "700" }}>
                Detalles técnicos ({quarantine.issues.length})
              </Text>
              <Feather name={showDetails ? "chevron-up" : "chevron-down"} size={17} color={mobileTheme.color.textSecondary} />
            </Pressable>
            {showDetails ? (
              <View testID="local-store-recovery-details" style={{ gap: 6 }}>
                {quarantine.issues.slice(0, 8).map((issue, index) => (
                  <Text
                    key={`${issue.path}:${issue.code}:${index}`}
                    style={{ color: mobileTheme.color.textSecondary, fontSize: 12, lineHeight: 17 }}
                  >
                    {issue.path} · {issue.code}
                  </Text>
                ))}
              </View>
            ) : null}

            <RecoveryButton
              testID="local-store-recovery-discard"
              label="Descartar estos datos y empezar de cero"
              icon="trash-2"
              variant="danger"
              busy={busy === "discard"}
              disabled={actionsDisabled && busy !== "discard"}
              onPress={() => setConfirmDiscard(true)}
            />
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={confirmDiscard}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => {
          if (!actionsDisabled) setConfirmDiscard(false);
        }}
      >
        <View
          testID="local-store-recovery-discard-confirmation"
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            backgroundColor: "rgba(0,0,0,0.82)",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <View
            style={{
              width: "100%",
              maxWidth: 400,
              borderRadius: mobileTheme.radius.lg,
              borderWidth: 1,
              borderColor: "rgba(255,90,98,0.45)",
              backgroundColor: mobileTheme.color.bgSurface,
              padding: 20,
              gap: 14,
            }}
          >
            <Feather name="alert-triangle" size={30} color={DANGER} />
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 20, fontWeight: "900" }}>
              ¿Descartar los datos dañados?
            </Text>
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 14, lineHeight: 20 }}>
              Se eliminarán las rutinas, el historial, la dieta, las medidas, los chats y la sesión activa que dependían de este almacenamiento. La memoria, los alimentos personales, las preferencias y las claves de IA válidas se conservarán.
            </Text>
            <RecoveryButton
              testID="local-store-recovery-discard-confirm"
              label="Sí, descartar"
              icon="trash-2"
              variant="danger"
              busy={busy === "discard"}
              disabled={actionsDisabled && busy !== "discard"}
              onPress={() => {
                setConfirmDiscard(false);
                onDiscard();
              }}
            />
            <RecoveryButton
              testID="local-store-recovery-discard-cancel"
              label="Conservar y volver"
              icon="arrow-left"
              variant="secondary"
              busy={false}
              disabled={actionsDisabled}
              onPress={() => setConfirmDiscard(false)}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export function LocalStoreStartupFailureScreen({
  error,
  busy,
  onRetry,
}: LocalStoreStartupFailureScreenProps) {
  return (
    <SafeAreaView
      testID="local-store-startup-failure-screen"
      style={{ flex: 1, backgroundColor: mobileTheme.color.bgApp }}
    >
      <StatusBar style="light" />
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: mobileTheme.spacing[4],
          paddingVertical: mobileTheme.spacing[6],
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 520,
            borderRadius: mobileTheme.radius.lg,
            borderWidth: 1,
            borderColor: mobileTheme.color.borderSubtle,
            backgroundColor: mobileTheme.color.bgSurface,
            padding: 20,
            gap: 16,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(245,185,66,0.1)",
              borderWidth: 1,
              borderColor: "rgba(245,185,66,0.28)",
            }}
          >
            <Feather name="shield" size={25} color={WARNING} />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 27, lineHeight: 32, fontWeight: "900" }}>
              No hemos podido comprobar tus datos
            </Text>
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 15, lineHeight: 22 }}>
              Gymnasia ha detenido el arranque para no guardar nada encima. Tus datos siguen sin modificarse.
            </Text>
          </View>
          <View
            testID="local-store-startup-failure-error"
            style={{
              borderRadius: mobileTheme.radius.md,
              borderWidth: 1,
              borderColor: "rgba(245,185,66,0.36)",
              backgroundColor: "rgba(245,185,66,0.08)",
              padding: 12,
            }}
          >
            <Text style={{ color: "#FFE0A1", fontSize: 13, lineHeight: 19 }}>{error}</Text>
          </View>
          <RecoveryButton
            testID="local-store-startup-failure-retry"
            label="Volver a intentarlo"
            icon="refresh-cw"
            variant="primary"
            busy={busy}
            onPress={onRetry}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}
