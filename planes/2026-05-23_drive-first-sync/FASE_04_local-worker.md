# FASE 04: Worker local de procesado e IA

**Plan-slug**: `drive-first-sync`
**Ruta del repo**: `C:\Users\i-gamer\Documents\APP SPEAKING`

## Objetivo de esta fase

Permitir que el ordenador procese sesiones pendientes guardadas en Drive: descargar original, comprimir, extraer audio, transcribir/analizar localmente y subir resultados a Drive.

## Estado actual del codigo

- `media-processing.ts` ya comprime y extrae audio con FFmpeg, pero espera archivos locales.
- `localWhisper.ts` ya ejecuta Whisper local.
- `transcribe/route.ts` intenta transcribir desde el servidor; en Vercel esto no puede usar tu ordenador.
- No existe worker local ni cola de jobs Drive.

## Criterios de aceptacion

- [ ] Existe script `npm.cmd run worker:local` o equivalente.
- [ ] El worker lista sesiones/jobs pendientes en Drive.
- [ ] Descarga original a carpeta temporal local, genera `compressed.mp4` y `audio.m4a`.
- [ ] Ejecuta Whisper/Ollama local cuando esten configurados.
- [ ] Sube artifacts y actualiza `session.json`, `transcript.txt`, `analysis.json` y job done.
- [ ] `npm.cmd run lint` y `npm.cmd run build` pasan.

## Precondiciones

- [ ] Fase 01 completada.
- [ ] Fase 02 completada.
- [ ] FFmpeg instalado localmente.

## Herramienta recomendada

Codex, gpt-5.5, esfuerzo high.

## Prompt ejecutable

```text
## Objective
Crea un worker local para procesar sesiones Drive-first pendientes usando las capacidades locales del ordenador.

## Scope included
- Leer antes: src/lib/media-processing.ts, src/lib/transcribers/localWhisper.ts, src/lib/transcribers/index.ts, src/lib/analysis.ts, src/lib/ai-api.ts, src/lib/storage.ts, src/lib/google-drive.ts, package.json.
- Anadir script worker local, preferiblemente TypeScript con dependencia dev `tsx` si es necesario.
- Reutilizar helpers existentes de FFmpeg/Whisper/analysis.
- Descargar original desde Drive a `data/worker-cache/<session-id>/`.
- Subir compressed.mp4, audio.m4a, transcript.txt y analysis.json a la carpeta de la sesion en Drive.
- Marcar estados: pending -> processing -> ready/error.
- Hacer que el worker sea idempotente: si una sesion ya esta ready, no reprocesar salvo flag.

## Scope excluded
- No hacer que Vercel ejecute FFmpeg/Whisper local.
- No implementar servicio residente complejo; basta comando manual/polling simple.

## Constraints
- Los archivos temporales locales no deben subirse a Git.
- Errores deben guardarse en session.json para verse en tablet.
- Mantener compatibilidad con Ollama local solo desde ordenador.

## Validation commands
npm.cmd run lint
npm.cmd run build
npm.cmd run worker:local -- --once

## Done when
Una sesion subida desde tablet queda pendiente; al ejecutar worker local en ordenador, se comprime, analiza y el resultado aparece luego en la app de Vercel/tablet.
```

## Skills y subagentes

- Skills existentes: `audio-timing-expert`, `systematic-debugging`, `api-detective`.
- Skills a crear: ninguna.
- Subagentes: ninguno.

## Dependencias y paralelizacion

- Depende de: Fase 01 y Fase 02.
- Paraleliza con: Fase 03 parcialmente.
- Seguridad: el contrato de storage Drive debe estar estable.

## Verificacion de esta fase

- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run build`
- [ ] `npm.cmd run worker:local -- --once` con sesion de prueba.
- [ ] Confirmar que Drive contiene artifacts y la UI muestra estado listo.

## Git en esta fase

- Commit sugerido: `feat: add local drive processing worker`

## Riesgos

- En esta maquina actual `whisper` y `python` no estan disponibles; documentar instalacion o permitir saltar transcripcion con error claro.
