# FASE 02: Subida directa y resumible a Drive

**Plan-slug**: `drive-first-sync`
**Ruta del repo**: `C:\Users\i-gamer\Documents\APP SPEAKING`

## Objetivo de esta fase

Evitar que Vercel reciba videos grandes. La tablet debe crear la sesion en Drive y subir el archivo directamente a Drive mediante upload resumible.

## Estado actual del codigo

- `NewSessionForm.tsx` envia multipart completo a `/api/videos`.
- `/api/videos` llama `request.formData()` y `createVideoEntry`.
- `createVideoEntry` escribe el archivo en `public/uploads`, procesa con FFmpeg y luego sube a Drive.
- Este flujo sirve localmente, pero no es apto para Vercel con videos grandes.

## Criterios de aceptacion

- [ ] Existe endpoint para iniciar upload resumible de Drive sin enviar el archivo a Vercel.
- [ ] `NewSessionForm` crea una sesion en estado pendiente y sube el archivo directo a Drive.
- [ ] La sesion queda visible en tablet/ordenador aunque aun no este comprimida.
- [ ] Si el upload falla, la sesion queda en estado error o se puede reintentar.
- [ ] `npm.cmd run lint` y `npm.cmd run build` pasan.

## Precondiciones

- [ ] Fase 01 completada.
- [ ] Driver Drive puede crear carpetas por sesion y escribir `session.json`.

## Herramienta recomendada

Codex, gpt-5.5, esfuerzo high.

## Prompt ejecutable

```text
## Objective
Implementa upload directo/resumible a Google Drive para que Vercel no procese ni almacene videos grandes.

## Scope included
- Leer antes: src/components/video-form/NewSessionForm.tsx, src/app/api/videos/route.ts, src/lib/storage.ts, src/lib/google-drive.ts, src/types/video.ts.
- Crear endpoints tipo /api/drive/upload-session y /api/videos/finalize-upload si encaja con el patron del proyecto.
- Modificar NewSessionForm para:
  1. crear metadata de sesion,
  2. pedir una resumable upload URL,
  3. subir el archivo directamente a Drive con PUT,
  4. finalizar la sesion con fileId, nombre, mimeType y tamano.
- Ampliar tipos con estados pendientes de procesado local, por ejemplo processingStatus: "pending" y driveStatus: "uploaded".
- Guardar original en Drive bajo sessions/<id>/original.<ext>.

## Scope excluded
- No implementar todavia compresion en navegador.
- No ejecutar FFmpeg en Vercel.
- No quitar aun el camino local antiguo si se usa APP_STORAGE_DRIVER=local.

## Constraints
- Los bytes del video no deben pasar por /api/videos en modo Drive/Vercel.
- El usuario debe ver feedback de "subiendo", "subido" y "pendiente de procesar".
- Mantener aceptacion de video/* y audio/*.

## Validation commands
npm.cmd run lint
npm.cmd run build

## Done when
Desde la UI se puede crear una sesion con archivo usando Drive directo, la sesion aparece en la lista y queda marcada como pendiente de worker local.
```

## Skills y subagentes

- Skills existentes: `api-detective`, `vercel-storage`, `frontend-design`.
- Skills a crear: ninguna.
- Subagentes: ninguno.

## Dependencias y paralelizacion

- Depende de: Fase 01.
- Paraleliza con: -
- Seguridad: secuencial por dependencia de Drive API.

## Verificacion de esta fase

- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run build`
- [ ] Probar con archivo pequeno real.
- [ ] Confirmar que la request de Vercel no contiene el binario completo del video.

## Git en esta fase

- Commit sugerido: `feat: upload sessions directly to drive`

## Riesgos

- CORS/upload resumible debe probarse en navegador real.
- Si Google requiere cabeceras adicionales en el PUT, documentarlas en el helper.
