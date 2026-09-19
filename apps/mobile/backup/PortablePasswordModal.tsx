import { Feather } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from "react-native";
// Un Modal nativo se dibuja fuera del contenedor raíz, así que no hereda sus insets (GYM-249).
import { SafeAreaView } from "react-native-safe-area-context";

import { mobileTheme } from "../theme";
import { validatePortablePassword } from "./portableEncryption";

type PortablePasswordModalProps = {
  visible: boolean;
  mode: "create" | "unlock";
  title: string;
  description: string;
  busy: boolean;
  error: string | null;
  onCancel(): void;
  onSubmit(password: string): void;
};

export function PortablePasswordModal({
  visible,
  mode,
  title,
  description,
  busy,
  error,
  onCancel,
  onSubmit,
}: PortablePasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmationVisible, setConfirmationVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setPassword("");
      setConfirmation("");
      setPasswordVisible(false);
      setConfirmationVisible(false);
      setLocalError(null);
    }
  }, [visible]);

  const submit = () => {
    if (mode === "create") {
      const validationError = validatePortablePassword(password);
      if (validationError) {
        setLocalError(validationError);
        return;
      }
      if (password !== confirmation) {
        setLocalError("Las dos contraseñas no coinciden.");
        return;
      }
    } else if (!password) {
      setLocalError("Escribe la contraseña de esta copia.");
      return;
    }
    setLocalError(null);
    onSubmit(password);
  };

  if (!visible) return null;

  const content = (
    <SafeAreaView
        testID="portable-password-modal"
        accessibilityViewIsModal
        style={{
          ...(Platform.OS === "web"
            ? { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, zIndex: 1200 }
            : { flex: 1 }),
          backgroundColor: "rgba(0,0,0,0.82)",
          paddingHorizontal: 20,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <View
          style={{
            width: "100%",
            maxWidth: 390,
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "rgba(203,255,26,0.28)",
            backgroundColor: mobileTheme.color.bgSurface,
            padding: 20,
            gap: 14,
          }}
        >
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              alignSelf: "center",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(203,255,26,0.09)",
              borderWidth: 1,
              borderColor: "rgba(203,255,26,0.28)",
            }}
          >
            <Feather name={mode === "create" ? "lock" : "unlock"} size={24} color={mobileTheme.color.brandPrimary} />
          </View>
          <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 22, fontWeight: "900", textAlign: "center" }}>
            {title}
          </Text>
          <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 13, lineHeight: 19, textAlign: "center" }}>
            {description}
          </Text>
          <View style={{ gap: 6 }}>
            <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "700" }}>
              Contraseña
            </Text>
            <View style={{ position: "relative" }}>
              <TextInput
                testID="portable-password-input"
                accessibilityLabel="Contraseña de la copia cifrada"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  setLocalError(null);
                }}
                editable={!busy}
                secureTextEntry={!passwordVisible}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="off"
                textContentType="none"
                placeholder={mode === "create" ? "Mínimo 12 caracteres" : "Contraseña de la copia"}
                placeholderTextColor="#697384"
                style={{
                  minHeight: 48,
                  borderRadius: mobileTheme.radius.md,
                  borderWidth: 1,
                  borderColor: mobileTheme.color.borderSubtle,
                  backgroundColor: mobileTheme.color.bgApp,
                  color: mobileTheme.color.textPrimary,
                  paddingLeft: 13,
                  paddingRight: 52,
                  fontSize: 15,
                }}
                onSubmitEditing={mode === "unlock" ? submit : undefined}
              />
              <Pressable
                testID="portable-password-visibility-toggle"
                accessibilityRole="button"
                accessibilityLabel={passwordVisible ? "Ocultar contraseña" : "Mostrar contraseña"}
                disabled={busy}
                hitSlop={6}
                onPress={() => setPasswordVisible((current) => !current)}
                style={{
                  position: "absolute",
                  top: 0,
                  right: 0,
                  width: 48,
                  height: 48,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: busy ? 0.45 : 1,
                }}
              >
                <Feather
                  name={passwordVisible ? "eye-off" : "eye"}
                  size={19}
                  color={mobileTheme.color.textSecondary}
                />
              </Pressable>
            </View>
          </View>
          {mode === "create" ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: mobileTheme.color.textPrimary, fontSize: 12, fontWeight: "700" }}>
                Repite la contraseña
              </Text>
              <View style={{ position: "relative" }}>
                <TextInput
                  testID="portable-password-confirm-input"
                  accessibilityLabel="Repite la contraseña de la copia cifrada"
                  value={confirmation}
                  onChangeText={(value) => {
                    setConfirmation(value);
                    setLocalError(null);
                  }}
                  editable={!busy}
                  secureTextEntry={!confirmationVisible}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  textContentType="none"
                  placeholder="La misma contraseña"
                  placeholderTextColor="#697384"
                  style={{
                    minHeight: 48,
                    borderRadius: mobileTheme.radius.md,
                    borderWidth: 1,
                    borderColor: mobileTheme.color.borderSubtle,
                    backgroundColor: mobileTheme.color.bgApp,
                    color: mobileTheme.color.textPrimary,
                    paddingLeft: 13,
                    paddingRight: 52,
                    fontSize: 15,
                  }}
                  onSubmitEditing={submit}
                />
                <Pressable
                  testID="portable-password-confirm-visibility-toggle"
                  accessibilityRole="button"
                  accessibilityLabel={confirmationVisible ? "Ocultar contraseña repetida" : "Mostrar contraseña repetida"}
                  disabled={busy}
                  hitSlop={6}
                  onPress={() => setConfirmationVisible((current) => !current)}
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    width: 48,
                    height: 48,
                    alignItems: "center",
                    justifyContent: "center",
                    opacity: busy ? 0.45 : 1,
                  }}
                >
                  <Feather
                    name={confirmationVisible ? "eye-off" : "eye"}
                    size={19}
                    color={mobileTheme.color.textSecondary}
                  />
                </Pressable>
              </View>
            </View>
          ) : null}
          {mode === "create" ? (
            <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
              <Feather name="alert-circle" size={15} color="#F5B942" style={{ marginTop: 1 }} />
              <Text style={{ flex: 1, color: mobileTheme.color.textSecondary, fontSize: 12, lineHeight: 17 }}>
                Gymnasia no guarda esta contraseña. Si la pierdes, no se puede recuperar el archivo.
              </Text>
            </View>
          ) : null}
          {localError || error ? (
            <Text testID="portable-password-error" accessibilityLiveRegion="polite" style={{ color: "#FF9AA0", fontSize: 12, lineHeight: 17 }}>
              {localError ?? error}
            </Text>
          ) : null}
          <Pressable
            testID="portable-password-submit"
            accessibilityRole="button"
            disabled={busy}
            onPress={submit}
            style={{
              minHeight: 48,
              borderRadius: mobileTheme.radius.md,
              backgroundColor: mobileTheme.color.brandPrimary,
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "row",
              gap: 8,
              opacity: busy ? 0.58 : 1,
            }}
          >
            {busy ? (
              <ActivityIndicator testID="portable-password-loading" size="small" color="#06090D" />
            ) : (
              <Feather name={mode === "create" ? "shield" : "unlock"} size={17} color="#06090D" />
            )}
            <Text
              testID={busy ? "portable-password-loading-label" : undefined}
              accessibilityLiveRegion="polite"
              style={{ color: "#06090D", fontSize: 15, fontWeight: "800" }}
            >
              {busy
                ? mode === "create" ? "Cifrando…" : "Desbloqueando…"
                : mode === "create" ? "Cifrar y guardar" : "Desbloquear copia"}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onCancel}
            style={{ minHeight: 44, alignItems: "center", justifyContent: "center", opacity: busy ? 0.45 : 1 }}
          >
            <Text style={{ color: mobileTheme.color.textSecondary, fontSize: 14, fontWeight: "700" }}>Cancelar</Text>
          </Pressable>
        </View>
    </SafeAreaView>
  );

  if (Platform.OS === "web") return content;
  return (
    <Modal
      transparent
      visible
      animationType="fade"
      onRequestClose={busy ? undefined : onCancel}
    >
      {content}
    </Modal>
  );
}
