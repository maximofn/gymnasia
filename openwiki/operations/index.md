# Archivos

- [Build y publicación Android de producción](android-release.md) - Flujo transaccional para convertir un SHA exacto y validado de main en un APK Android firmado, verificado de forma independiente y publicado como release inmutable, usando una VM efímera de wallabot. Incluye invariantes de versión, fronteras de credenciales, recuperación y reversión.
- [Promoción y rollback de políticas](policy-promotion.md) - Runbook verificable para firmar, promover y revertir bundles de política entre Staging y Production, con secuencias anti-rollback, auditoría y snapshots de build sin exponer claves privadas.
