import * as Clipboard from "expo-clipboard";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { resolvePrivacyPolicyUrl } from "./agent/externalLinks";
import { MEDICAL_DISCLAIMER } from "./agent/generated/legalCopy.generated";
import { openExternalUrl } from "./openExternalUrl";
import { mobileTheme } from "./theme";

/**
 * Pie de la pantalla de Ajustes: enlace a la política de privacidad y descargo
 * sanitario (GYM-190).
 *
 * Se renderiza fuera de cualquier pestaña, así que se ve en todas ellas. No repite
 * la versión de la app: la muestra ya el bloque de entorno que tiene encima. El copy
 * legal viene del módulo generado desde docs/legal/, nunca escrito aquí a mano,
 * igual que el de AiIdentityDisclosure.
 */
export function LegalFooter() {
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const openPolicy = async () => {
    const url = resolvePrivacyPolicyUrl();
    const result = await openExternalUrl(url);
    // Si el enlace no se puede abrir, el usuario debe poder leer la URL y copiarla:
    // un aviso legal inalcanzable no cumple su función.
    setFallbackUrl(result.ok ? null : url);
    setCopied(false);
  };

  const copyPolicyUrl = async () => {
    if (!fallbackUrl) return;
    await Clipboard.setStringAsync(fallbackUrl);
    setCopied(true);
  };

  return (
    <View style={{ gap: 6, marginTop: 8, alignItems: "center" }}>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Abrir la política de privacidad de Gymnasia"
        testID="legal-privacy-link"
        onPress={openPolicy}
        hitSlop={8}
      >
        <Text
          style={{
            color: mobileTheme.color.brandPrimary,
            fontSize: 12,
            fontWeight: "700",
            textAlign: "center",
            textDecorationLine: "underline",
          }}
        >
          Política de privacidad
        </Text>
      </Pressable>

      <Text
        testID="legal-medical-disclaimer"
        style={{
          color: mobileTheme.color.textSecondary,
          fontSize: 11,
          lineHeight: 15,
          textAlign: "center",
          opacity: 0.75,
          paddingHorizontal: 12,
        }}
      >
        {MEDICAL_DISCLAIMER.es}
      </Text>

      {fallbackUrl ? (
        <View style={{ gap: 4, alignItems: "center", paddingHorizontal: 12 }}>
          <Text
            testID="legal-privacy-fallback"
            style={{ color: "#ffb5b5", fontSize: 11, textAlign: "center" }}
          >
            No se pudo abrir el navegador. Consulta la política en {fallbackUrl}
          </Text>
          <Pressable accessibilityRole="button" onPress={copyPolicyUrl} hitSlop={8}>
            <Text
              style={{
                color: mobileTheme.color.brandPrimary,
                fontSize: 11,
                fontWeight: "700",
                textDecorationLine: "underline",
              }}
            >
              {copied ? "Enlace copiado" : "Copiar enlace"}
            </Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}
