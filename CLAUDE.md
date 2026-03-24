See [AGENTS.md](./AGENTS.md) for full project instructions.

## Git

- Siempre hacer commit y push después de completar un cambio, sin preguntar.

## Mobile

Para probar en el móvil a través de un túnel (cuando estoy en otra red):

```
npm --workspace apps/mobile run start -- --tunnel
```

### Notas del túnel

- Antes de lanzar, verificar que el puerto 8081 esté libre: `lsof -ti:8081`
- Si hay un proceso ocupando el puerto, matarlo: `lsof -ti:8081 | xargs kill -9`
- La URL del túnel se obtiene consultando la API de ngrok: `curl -s http://localhost:4040/api/tunnels`
- **Importante**: El manifiesto de Expo envía la URL del bundle como `http://` pero Android bloquea tráfico HTTP (cleartext). Al compartir la URL con el móvil, usar siempre **`https://`**
- La URL tiene formato: `https://<subdomain>-maximofn-8081.exp.direct`
- Expo Go en Android debe estar actualizado a la versión que soporte el SDK del proyecto (actualmente SDK 54)
