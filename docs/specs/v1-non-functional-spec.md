# V1 Non-Functional Spec

## 1. Rendimiento y limites
- Timeout chat IA: 300s.
- Timeout multimedia IA: 600s.
- Rate limit chat: 10 mensajes/min por usuario.

## 2. Confiabilidad
- Infra free tier aceptada (sin SLA).
- KPI de salida beta:
  - sync exitoso >= 98%
  - sesiones sin crash >= 99%

## 3. Seguridad
- Cifrado de API keys BYOK en backend.
- Region de datos UE.
- Fotos con cifrado en reposo y URL firmadas temporales (objetivo v1 funcional completo).

## 4. Privacidad y ciclo de vida de datos
- Borrado de cuenta autoservicio.
- Gracia de 30 dias para cancelar.
- Retencion de fotos por defecto: 1 anio.

## 5. Safety IA
- Bloqueo de respuestas sobre dopaje/farmacos.
- Bloqueo de contenido de ayuno extremo/purgas.
- Avisos de seguridad cuando se detecta riesgo.

## 6. Riesgos conocidos
- Conflictos por timestamp cliente en estrategia LWW.
- Sin auditoria historica completa en v1.
- Sin soporte humano para beta.
