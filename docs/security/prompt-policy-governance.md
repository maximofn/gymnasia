# Gobierno de cambios sensibles

## Qué se protege

`.github/prompt-policy.json` es la fuente de verdad de las rutas sensibles, el
propietario y los checks obligatorios. `npm run sync:prompt-policy` genera
`CODEOWNERS` y el payload versionado del ruleset; `npm run check:prompt-policy`
detecta cualquier deriva.

La frontera incluye toda la app móvil porque `App.tsx` es monolítico y una ruta
aparentemente ajena al prompt podría sustituir su cargador o composición. También
incluye Actions, automatización OpenWiki, instrucciones del agente y el futuro
publicador de políticas firmadas.

## Autorización de pull requests

Toda modificación de `main` entra mediante pull request y supera
`prompt-policy`, `gymnasia/owner-authorization` y
`gymnasia/policy-promotion`:

1. Una PR escrita por `@maximofn` queda autorizada automáticamente.
2. Una PR externa sin rutas sensibles no necesita review, pero el merge sigue
   siendo manual y solo lo realiza alguien con permiso en el repositorio.
3. Una PR externa sensible necesita un review `APPROVED` de `@maximofn` sobre
   el SHA actual. Un commit posterior invalida la autorización.
4. Una PR que cambia `prompts/` o `policy/health-safety/` queda pendiente hasta
   que el SHA exacto tenga un deployment `gymnasia-policy` exitoso en
   Production. Las demás PR superan este tercer check automáticamente.

La reconciliación privilegiada usa `pull_request_target` exclusivamente para
leer metadatos y deployments y publicar estados. Siempre ejecuta el script del
SHA base; nunca descarga ni ejecuta el head de la PR, no recibe secretos y no
dispone de permisos sobre contenidos.

## Emergencia

No existe bypass del ruleset. Si falla la infraestructura de checks:

1. Abrir una PR de reparación y conservar el SHA exacto.
2. Ejecutar localmente `npm ci`, `npm run check:prompt-policy`,
   `npm run test:prompt-policy`, `npm test` y el type-check.
3. Reparar o reejecutar el check de GitHub; no fusionar usando un push directo.
4. Documentar en la PR el incidente, comandos y resultados.

La eliminación de `main` y los force-push permanecen bloqueados incluso durante
una emergencia. La firma criptográfica de bundles definida en GYM-140 (ticket para
autenticar bundles de política con firmas verificables) tampoco se puede omitir mediante
este procedimiento.

## Seguridad de la cuenta del propietario

Revisar manualmente sin guardar respuestas, códigos ni capturas en el repo:

- [ ] 2FA habilitado en la cuenta `maximofn`.
- [ ] Al menos una passkey o llave física registrada.
- [ ] Códigos de recuperación regenerados y guardados fuera del repositorio.
- [ ] Sesiones, tokens, GitHub Apps y claves SSH revisados; revocar lo desconocido.
- [ ] Correo de recuperación y métodos alternativos actualizados.

En Linear se registra únicamente que la revisión se realizó, nunca sus datos.

## Auditoría

Tras cambiar la política, comprobar el ruleset efectivo, el emisor de ambos
checks y los estados de Secret Scanning, Push Protection y Dependabot. Las PR y
sus reviews son el registro de autorización; no se habilita auto-merge.

Cada publicación, promoción, rechazo y rollback crea además un deployment con task
`gymnasia-policy-audit` y schema `PolicyOperationAuditV1`. Este registro es distinto del
deployment `gymnasia-policy` que consume la app: no puede confundirse con un bundle
activo. Su payload está limitado a metadatos operativos y excluye de forma contractual
prompts, mensajes, claves, inputs, outputs y datos de salud. El job se ejecuta con
`if: always()` y deja diagnosticada también la ausencia o el fallo del aviso Telegram.

Los procedimientos de consulta, motivos cerrados, bot dedicado y recuperación están en
`docs/architecture/policy-environments.md`. El ensayo real exigido por GYM-141 (ticket
para añadir rollback, auditoría y alertas de la política) debe conservar como evidencia
la activación del patch sin cambios de contenido, el rollback y la restauración final;
ninguno de esos pasos autoriza a saltarse la aprobación explícita de cambios en
instrucciones.
