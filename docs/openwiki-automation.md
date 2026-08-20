# Automatización privada de OpenWiki

## Decisión de arquitectura

`maximofn/gymnasia` es público. La autenticación de ChatGPT se trata como una
contraseña y no se almacena ni se ejecuta desde sus workflows. OpenAI documenta
la persistencia de autenticación en CI como un patrón avanzado para
infraestructura privada de confianza y desaconseja usarlo en repositorios
públicos/open source.

La automatización se aloja en el repositorio privado independiente
[`maximofn/gymnasia-openwiki-automation`](https://github.com/maximofn/gymnasia-openwiki-automation).
El directorio `ops/openwiki-automation-template/` conserva su plantilla fuente.
El workflow se niega a ejecutarse si detecta una visibilidad distinta de
`private`.

GitHub Free incluye 2.000 minutos mensuales de runners estándar para
repositorios privados y 500 MB de almacenamiento. Una ejecución diaria cabe en
la cuota si promedia menos de unos 66 minutos. La cuenta tiene un presupuesto de
Actions de 0 EUR con `Stop usage` activo y avisos del consumo incluido, por lo
que no puede generar cargos accidentales al agotar la cuota gratuita.

## Qué ejecuta

- `openwiki-update.yml`, diariamente a las 08:00 UTC:
  - restaura exclusivamente el OAuth de OpenWiki desde un artefacto cifrado;
  - actualiza el Code Brain de Gymnasia con la suscripción de ChatGPT;
  - reutiliza siempre la rama `openwiki/update` y crea o actualiza una única PR;
  - actualiza opcionalmente Personal Brain desde Linear, maximofn.com y Tavily;
  - cifra de nuevo el OAuth rotado y el estado privado antes de persistirlos.
- `openwiki-report.yml`, a las 12:00 UTC: consulta el workflow anterior y envía
  a Telegram solo estado general, salud de OAuth y Personal Brain, PR y URL. No
  lee ni envía logs.
- `tests.yml`: valida cifrado, filtrado OAuth, export seguro de Linear y
  configuración de Personal Brain.

`openwiki cron list` seguirá sin mostrar estos horarios: ese comando administra
el `launchd` local de macOS para conectores de Personal Brain. En Linux OpenWiki
solo guarda la expresión y avisa que la instalación nativa es exclusiva de
macOS; el horario remoto lo proporciona GitHub Actions.

## Secretos y variables del repositorio privado

| Nombre | Uso |
| --- | --- |
| `GYMNASIA_REPO_TOKEN` | Token fine-grained limitado a `maximofn/gymnasia`, con `Contents: read/write` y `Pull requests: read/write`. |
| `OPENWIKI_OAUTH_PASSPHRASE` | Cifra/descifra los seis campos OAuth permitidos. Mínimo 32 caracteres. |
| `OPENWIKI_OAUTH_SEED` | Sobre cifrado solo para arranque o recuperación. No permanece configurado durante la operación normal. |
| `LANGSMITH_API_KEY` | Escribe las trazas de la ejecución de Code Brain en el proyecto `openwiki`. |
| `OPENWIKI_LANGSMITH_API_KEY` | Lee los proyectos configurados en `openwiki/.langsmith.json`. |
| `LINEAR_READONLY_API_KEY` | Clave independiente de Linear con permiso `Read` solamente. |
| `TAVILY_API_KEY` | Búsquedas web enfocadas para Personal Brain. |
| `OPENWIKI_PERSONAL_STATE_PASSPHRASE` | Cifra el wiki privado, manifiestos y estado de conectores. Debe ser distinta de la contraseña OAuth. |
| `MAXIMOFN_REPO_TOKEN` | Solo hace falta si el repositorio de maximofn.com es privado. |
| `TELEGRAM_BOT_TOKEN` | Autoriza el bot del informe diario. |
| `TELEGRAM_CHAT_ID` | Chat o canal que recibe el informe. |

Variable de Actions, no secreta:

| Nombre | Uso |
| --- | --- |
| `MAXIMOFN_REPOSITORY` | Repositorio de la web: `maximofn/portafolio`. Ya configurado en Actions. |

Los secretos de ejecución no van en el `.env` raíz de Gymnasia. Para ejecución
local de OpenWiki, las claves gestionadas por OpenWiki viven en
`~/.openwiki/.env`; para CI viven en **Actions secrets** del repositorio privado.

## Claves de LangSmith

Las dos claves deben ser service keys diferentes, aunque pertenezcan al mismo
workspace:

- `LANGSMITH_API_KEY` solo escribe las trazas producidas por OpenWiki.
- `OPENWIKI_LANGSMITH_API_KEY` permite que el conector de OpenWiki lea los tres
  proyectos declarados: `gymnasia-app-agent`, `gymnasia-food-agent` y
  `openwiki`.

En Actions y en `~/.openwiki/.env` ambos nombres están configurados con valores
distintos. La cuenta usa la región europea: tanto el conector declarado en
`openwiki/.langsmith.json` como el SDK de trazas apuntan a
`https://eu.api.smith.langchain.com`.

Personal Brain ejecuta sin `LANGCHAIN_TRACING_V2`: sus datos de Linear,
repositorios privados y búsquedas no se envían a LangSmith. Code Brain sí traza
la ejecución `openwiki`, pero el workflow activa por defecto
`LANGSMITH_HIDE_INPUTS`, `LANGSMITH_HIDE_OUTPUTS` y
`LANGSMITH_HIDE_METADATA`; se conservan estructura y estado de las operaciones,
no prompts, respuestas ni atributos. Esta minimización reduce el riesgo, pero
no sustituye revisar periódicamente el proyecto y la política de retención.

Ninguna clave LangSmith del propietario se incluye en la app móvil. En una
futura integración BYOK, cada clave enviará las trazas al workspace de ese
usuario: podrá ver sus propias interacciones, pero no las de otros usuarios ni
las del propietario. Esa integración deberá usar el mismo modo oculto por
defecto y permitir contenido parcial solo mediante una decisión explícita. Los
proyectos `gymnasia-app-agent` y `gymnasia-food-agent` del workspace del
propietario recibirán únicamente las ejecuciones realizadas con su propia clave.

## Estado del repositorio privado

El repositorio ya está creado con visibilidad privada, permisos predeterminados
de Actions de solo lectura y aprobación de PR deshabilitada para su
`GITHUB_TOKEN`. `OpenWiki Update`, `OpenWiki Daily Report` y `Tests` están
activos. Todos los secretos y la variable de las tablas anteriores están
configurados; `OPENWIKI_OAUTH_SEED` se eliminó después de verificar la
restauración desde artefacto.

Puesta en servicio verificada el 20 de agosto de 2026:

- la [actualización completa](https://github.com/maximofn/gymnasia-openwiki-automation/actions/runs/32352293394)
  terminó correctamente con Code Brain, LangSmith, Personal Brain y la PR;
- los artefactos `openwiki-oauth-state` y `openwiki-personal-state` se crearon
  cifrados desde esa misma ejecución;
- la rama fija actualizó la [PR de documentación #18](https://github.com/maximofn/gymnasia/pull/18);
- el [informe manual](https://github.com/maximofn/gymnasia-openwiki-automation/actions/runs/32353104131)
  fue aceptado correctamente por la API de Telegram.

### Permiso de PR

Con este diseño no hay que activar `Allow GitHub Actions to create and approve
pull requests` en Gymnasia: esa opción controla su `GITHUB_TOKEN`, pero la
automatización privada usa `GYMNASIA_REPO_TOKEN`. El recordatorio correcto es
crear ese token fine-grained con acceso exclusivo a Gymnasia y los dos permisos
anteriores. Si en el futuro se vuelve a trasladar la creación de PR al workflow
público, entonces sí habrá que activar dicha opción.

## Sembrar OAuth sin pegarlo en el chat

Primero debe existir un login válido en `~/.openwiki/.env`, generado localmente
con el asistente interactivo de OpenWiki. Desde el clon del repositorio privado:

```bash
export OPENWIKI_OAUTH_PASSPHRASE="$(openssl rand -base64 48)"
openwiki_seed_file="$(mktemp -t openwiki-oauth-seed)"

node scripts/oauth-state.mjs \
  encrypt "$HOME/.openwiki/.env" "$openwiki_seed_file"

printf '%s' "$OPENWIKI_OAUTH_PASSPHRASE" \
  | gh secret set OPENWIKI_OAUTH_PASSPHRASE \
      --repo maximofn/gymnasia-openwiki-automation
gh secret set OPENWIKI_OAUTH_SEED \
  --repo maximofn/gymnasia-openwiki-automation \
  < "$openwiki_seed_file"

rm -f "$openwiki_seed_file"
unset OPENWIKI_OAUTH_PASSPHRASE openwiki_seed_file
```

El cifrado AES-256-GCM solo acepta:

- `OPENAI_CHATGPT_ACCESS_TOKEN`
- `OPENAI_CHATGPT_REFRESH_TOKEN`
- `OPENAI_CHATGPT_EXPIRES_AT`
- `OPENAI_CHATGPT_ACCOUNT_ID`
- `OPENAI_CHATGPT_EMAIL`
- `OPENAI_CHATGPT_PLAN`

Tras una ejecución correcta y la aparición del artefacto
`openwiki-oauth-state`, borrar `OPENWIKI_OAUTH_SEED`. Si el refresh token se
revoca, repetir el login y la semilla. La renovación no es garantía permanente;
Telegram notificará un `401`, `invalid_grant` o fallo de refresh clasificado.

## Personal Brain: fuentes 1, 3 y 5

### Linear

Crear una API key nueva en `Settings → Security & access` con permiso `Read`
solamente y guardarla como `LINEAR_READONLY_API_KEY`. El exportador consulta la
API GraphQL oficial, ordena issues por actualización y conserva solo metadatos:
identificador, título, URL, estado, responsable, proyecto, etiquetas y fechas.
Omite expresamente descripciones, comentarios, adjuntos y correo del usuario;
además redacta patrones evidentes de contraseña, token, secret y API key.

### Repositorio de maximofn.com

La variable `MAXIMOFN_REPOSITORY` apunta a `maximofn/portafolio`. El repositorio
es privado y usa un token fine-grained independiente, limitado a ese repositorio
y con `Contents: read-only`, guardado como `MAXIMOFN_REPO_TOKEN` en Actions.

### Búsqueda web

Guardar una clave Tavily en `TAVILY_API_KEY`. Las consultas están limitadas a:

- Expo/React Native local-first, seguridad y cambios incompatibles;
- LangChain, LangGraph y LangSmith;
- OpenWiki y sus conectores;
- seguridad de agentes móviles BYOK y prompt injection.

El wiki, raw data y estado de conectores se comprimen y cifran con una clave
separada antes de subirse como `openwiki-personal-state`. Nunca se copian al
directorio público `openwiki/` de Gymnasia.

## Telegram

El bot y el chat están configurados y el envío manual está verificado. Para
rotar cualquiera de los dos valores sin pegarlos en conversaciones:

```bash
gh secret set TELEGRAM_BOT_TOKEN \
  --repo maximofn/gymnasia-openwiki-automation
gh secret set TELEGRAM_CHAT_ID \
  --repo maximofn/gymnasia-openwiki-automation
```

El informe no incluye prompts, código, contenido del wiki, trazas, errores
completos ni credenciales. Solo indica estado general, salud del OAuth, salud de
Personal Brain, URL de la PR y enlace al workflow.

## Validación

Desde la plantilla o el repositorio privado:

```bash
npm ci
npm test
```

Antes de activar o modificar los horarios hay que validar los YAML, comprobar
los scripts shell con `bash -n`, pasar `zizmor` y ejecutar manualmente ambos
workflows. La puesta en servicio actual pasó 22 tests de la plantilla, el CI del
repositorio privado, 61 tests deterministas de Gymnasia, `zizmor` sin hallazgos
y las dos ejecuciones manuales; estas comprobaciones deben repetirse cuando
cambie la plantilla.

## Referencias oficiales

- [OpenAI: mantener autenticación de cuenta en CI/CD](https://learn.chatgpt.com/docs/auth/ci-cd-auth)
- [GitHub Actions: facturación y cuota incluida](https://docs.github.com/en/billing/concepts/product-billing/github-actions)
- [LangSmith: service keys y PAT](https://docs.langchain.com/langsmith/create-account-api-key)
- [LangSmith: ocultar y redactar datos sensibles](https://docs.langchain.com/langsmith/mask-inputs-outputs)
- [Linear: API GraphQL y autenticación](https://linear.app/developers/graphql)
- [Linear: MCP y acceso de solo lectura](https://linear.app/docs/mcp)
- [Tavily: créditos de API](https://docs.tavily.com/documentation/api-credits)
- [Telegram Bot API: `sendMessage`](https://core.telegram.org/bots/api#sendmessage)
