# Gymnasia OpenWiki Automation

Repositorio **privado** para actualizar diariamente el Code Brain público de
`maximofn/gymnasia`, mantener un Personal Brain cifrado y enviar un informe
sanitizado por Telegram. Los workflows fallan deliberadamente si este
repositorio no tiene visibilidad privada.

## Requisitos

1. Node.js `22.22.x` para pruebas locales.
2. GitHub Actions habilitado con presupuesto de 0 EUR y bloqueo al alcanzar el
   límite.
3. Los Actions secrets y variables descritos en
   `maximofn/gymnasia/docs/openwiki-automation.md`.
4. Dos service keys diferentes de LangSmith.
5. Un token fine-grained limitado a Gymnasia con `Contents` y `Pull requests`
   en modo read/write.

## Flujos

- `OpenWiki Update`: 08:00 UTC y ejecución manual. Usa la suscripción de
  ChatGPT, actualiza `openwiki/update`, mantiene una única PR y cifra el estado.
- `OpenWiki Daily Report`: 12:00 UTC y ejecución manual. Envía solo indicadores
  sanitizados a Telegram.
- `Tests`: valida cada push y PR de este repositorio privado.

Personal Brain admite exactamente las fuentes acordadas: Linear de solo
lectura, el repositorio de maximofn.com y búsquedas web enfocadas. No habilita
trazas LangSmith para esa parte del flujo.

## Pruebas

```bash
npm ci
npm test
```

No se deben commitear `.env`, semillas, artefactos descifrados, logs o el wiki
privado. Los tokens se introducen únicamente con `gh secret set`.
