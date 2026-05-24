# Plan Maestro: Drive-first sync para tablet y ordenador

**Fecha**: 2026-05-23
**Proyecto**: APP SPEAKING
**Plan-slug**: `drive-first-sync`
**Modo**: C, porque toca almacenamiento, APIs, UI, worker local, documentacion y despliegue.

## Objetivo general

Convertir APP SPEAKING en una app Drive-first desplegable en Vercel: la tablet y el ordenador ven los mismos datos, los cambios se guardan automaticamente en Drive, y el ordenador puede procesar localmente con FFmpeg/Whisper/Ollama sin que Vercel almacene ni procese videos grandes.

## Modelo y esfuerzo globales

**Claude Code / API**
- **Modelo**: Opus 4.7 / Sonnet 4.6
- **Esfuerzo**: Alto
- **Justificacion**: cambio de arquitectura con datos persistentes, OAuth, subida grande, autosave y worker local.

**Codex (OpenAI)**
- **Modelo**: gpt-5.5 o gpt-5.4
- **Esfuerzo (`reasoning.effort`)**: high
- **Justificacion**: requiere refactor multiarchivo, compatibilidad local/Vercel y QA funcional.

**Equivalencias funcionales para este plan**:
| Rol | Claude | Codex |
|---|---|---|
| Planificacion | Opus 4.7 / opusplan | gpt-5.5 |
| Implementacion | Sonnet 4.6 | gpt-5.4 / gpt-5.5 |
| Subtareas | Haiku 4.5 | gpt-5.4-mini |
| Review final | Opus 4.7 | gpt-5.3-codex |

## Fases

| # | Fase | Herramienta | Modelo Claude | Modelo Codex equiv. | Depende de | Paraleliza con | Documento |
|---|------|-------------|--------------|---------------------|------------|-----------------|-----------|
| 01 | Drive como storage central | Codex | Sonnet 4.6 | gpt-5.5 | - | - | `./FASE_01_drive-store.md` |
| 02 | Subida directa/resumible a Drive | Codex | Sonnet 4.6 | gpt-5.5 | 01 | - | `./FASE_02_drive-upload.md` |
| 03 | Autosave y refresco entre dispositivos | Codex | Sonnet 4.6 | gpt-5.4 | 01 | 04 parcial | `./FASE_03_autosave-sync.md` |
| 04 | Worker local de procesado e IA | Codex | Sonnet 4.6 | gpt-5.5 | 01, 02 | 03 parcial | `./FASE_04_local-worker.md` |
| 05 | Vercel, seguridad y documentacion | Codex | Sonnet 4.6 | gpt-5.4 | 01, 02, 03, 04 | - | `./FASE_05_vercel-config-docs.md` |
| 06 | Verificacion de implementacion y QA | Codex/Reviewer | Sonnet 4.6 | gpt-5.5 | todas | - | `./FASE_06_verificacion-implementacion.md` |

## Analisis de paralelizacion

**Grupos paralelos**:
| Grupo | Fases | Archivos exclusivos | Riesgo | Herramienta |
|-------|-------|---------------------|--------|-------------|
| Secuencial base | F01 -> F02 | storage y upload comparten Drive API | Alto si se paraleliza | Codex |
| Parcial | F03 y F04 tras F02 | F03 UI/API autosave, F04 scripts worker | Medio: ambos usan storage facade | Codex con cuidado |
| Final | F05 -> F06 | docs/config y QA global | Secuencial | Codex |

**Diagrama de ejecucion**:

```text
F01 -> F02 -> F03 ----\
              F04 -----> F05 -> F06
```

**Recomendacion**:
- Ejecutar F01 y F02 en orden.
- Tras F02, F03 y F04 pueden avanzar en paralelo si se coordinan sobre la misma interfaz de storage.
- F05 y F06 son secuenciales.

## Analisis de automatizacion

| # | Fase | Clasificacion | Razon |
|---|------|---------------|-------|
| 01 | Drive storage | Manual | requiere revisar OAuth/env y puede necesitar token real |
| 02 | Upload Drive | Manual | requiere prueba con Drive real y archivo grande |
| 03 | Autosave | Auto-encolable parcial | puede verificarse con mocks/local, pero Drive real es manual |
| 04 | Worker local | Manual | requiere FFmpeg/Whisper/Ollama locales |
| 05 | Vercel/docs | Manual | requiere variables y despliegue |
| 06 | QA | Manual | requiere navegador y smoke test con Drive |

**Cadena automatica posible**: no se recomienda cola completa; hay credenciales externas y pruebas reales de Drive.

## Verificacion global

- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run dev`
- Browser tablet `768x1024`: crear sesion, autosave, cambiar tabs, refrescar.
- Smoke real Drive: crear JSON, subir archivo pequeno, listar sesiones, editar nota.
- Smoke local worker: procesar una sesion pendiente de prueba y subir resultado.

## Estrategia de Git

- Rama sugerida: mantener `codex/deepseek-only-ai` o crear `codex/drive-first-sync`.
- Commits: uno por fase completada.
- Rollback: desactivar driver Drive con `APP_STORAGE_DRIVER=local` y conservar storage local como fallback durante la migracion.

## Despliegue

Vercel necesitara variables:

```env
APP_STORAGE_DRIVER=drive
APP_ACCESS_SECRET=...
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REFRESH_TOKEN=...
GOOGLE_DRIVE_ROOT_FOLDER_ID=...
```

El refresh token se obtiene una vez con OAuth local y se pega como variable de entorno en Vercel. No se guarda en Git.

## Riesgos globales

- Subida de videos grandes desde tablet: debe ser directa a Drive; no multipart a Vercel.
- Compresion desde tablet: no asumir compresion inmediata en Vercel. Si el ordenador no esta procesando, el original queda en Drive como pendiente.
- Conflictos autosave: usar `updatedAt`/revision y guardar por sesion, no un JSON gigante.
- Seguridad: app Vercel publica necesita acceso privado antes de permitir escrituras.
- Drive como DB ligera es viable para uso personal, pero hay que minimizar escrituras globales a `index.json`.

## Como usar este plan

1. Lee `CONTEXTO.md`.
2. Ejecuta cada `FASE_XX_*.md` en orden.
3. No implementes subida grande por `/api/videos` multipart en Vercel; sustituir por upload resumible Drive.
4. Mantener fallback local hasta que Drive-first este verificado.
