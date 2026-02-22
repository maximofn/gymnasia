# Arquitectura - Seguridad y Privacidad

## Datos personales
- Se almacenan en v1:
  - Email (auth)
  - Peso y contornos
  - Fotos (segun modulo)
  - Historial de entrenamiento y dieta

## Seguridad de secretos
- API keys BYOK:
  - Almacenadas cifradas en servidor.
  - Usuario puede ver/rotar/revocar.

## Seguridad de media
- Fotos en servidor UE.
- Cifrado en reposo.
- Acceso por URL firmada temporal.
- Retencion por defecto: 1 anio.

## Cuenta y borrado
- Borrado de cuenta autoservicio.
- Gracia de 30 dias para cancelar.
- Durante gracia:
  - login permitido
  - bloqueadas nuevas subidas y nuevos registros

## Logs
- Objetivo v1: redaccion de PII/secrets en logs tecnicos.

## Safety IA
- Bloqueo de contenido riesgoso:
  - dopaje/farmacos
  - ayuno extremo/purgas
- Avisos de seguridad cuando el contexto lo requiera.
