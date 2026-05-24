# FASE 01: Drive como storage central

**Plan-slug**: `drive-first-sync`
**Ruta del repo**: `C:\Users\i-gamer\Documents\APP SPEAKING`

## Objetivo de esta fase

Crear una capa Drive-first para leer/escribir sesiones, settings e index en Google Drive, manteniendo el storage local como fallback durante la migracion.

## Estado actual del codigo

- `src/lib/storage.ts` (619 LOC) concentra local JSON, subida, procesado y CRUD.
- `src/lib/google-drive.ts` (84 LOC) solo sube archivos multipart.
- `src/lib/google-oauth-tokens.ts` (119 LOC) guarda tokens en archivo local.
- `src/types/video.ts` (131 LOC) no tiene campos para rutas Drive-first ni estado pendiente de worker.
- Monoliticos: `storage.ts` supera 500 LOC.

## Criterios de aceptacion

- [ ] Existe una capa Drive API capaz de crear carpetas, buscar por nombre, leer/escribir JSON, listar archivos y actualizar archivos por `fileId`.
- [ ] El refresh token puede venir de `GOOGLE_OAUTH_REFRESH_TOKEN` en Vercel y de `data/google-drive-token.json` en local.
- [ ] Existe un storage facade con driver `local` y `drive`, controlado por `APP_STORAGE_DRIVER`.
- [ ] `listVideoEntries`, `getVideoEntry`, `updateVideoEntry`, settings de IA y settings de Drive funcionan contra Drive.
- [ ] `npm.cmd run lint` y `npm.cmd run build` pasan.

## Precondiciones

- [ ] Leer `CONTEXTO.md`.
- [ ] No borrar el storage local actual.
- [ ] No introducir Supabase/Neon.

## Herramienta recomendada

Codex, gpt-5.5, esfuerzo high.

## Prompt ejecutable

```text
## Objective
Implementa la base Drive-first de APP SPEAKING sin romper el fallback local actual.

## Scope included
- Leer antes: src/lib/storage.ts, src/lib/google-drive.ts, src/lib/google-oauth-tokens.ts, src/types/video.ts, src/app/page.tsx.
- Crear o refactorizar helpers Drive en src/lib/google-drive.ts o nuevos modulos bajo src/lib/.
- Separar un storage local y un storage Drive detras de una interfaz comun.
- Anadir soporte de refresh token por env GOOGLE_OAUTH_REFRESH_TOKEN para Vercel, manteniendo el archivo local como fallback.
- Crear helpers para estructura Drive: root folder, app-db/index.json, app-db/settings.json, app-db/sessions/<id>/session.json.

## Scope excluded
- No implementar aun subida resumible de videos grandes.
- No cambiar aun la UI de formulario.
- No eliminar data/app.json ni public/uploads.

## Constraints
- No guardar secretos en codigo.
- Drive es la fuente de verdad cuando APP_STORAGE_DRIVER=drive.
- Mantener APIs existentes funcionando con la misma firma publica.
- Evitar un unico JSON gigante: sesion individual en session.json + index pequeno.

## Validation commands
npm.cmd run lint
npm.cmd run build

## Done when
Con APP_STORAGE_DRIVER=local la app se comporta como antes. Con APP_STORAGE_DRIVER=drive, las funciones de lectura/escritura usan Drive y devuelven los mismos tipos.
```

## Skills y subagentes

- Skills existentes que aplican: `planificador-tareas-codex`, `api-detective`, `database-navigator`, `vercel-storage`.
- Skills a crear: ninguna.
- Subagentes: ninguno salvo que el usuario pida paralelizacion explicita.

## Dependencias y paralelizacion

- Depende de: -
- Paraleliza con: -
- Seguridad: fase base, secuencial obligatoria.

## Verificacion de esta fase

- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run build`
- [ ] Revisar que `src/app/page.tsx` no necesita saber si storage es local o Drive.
- [ ] Revisar que no hay secretos nuevos en `.env.example`.

## Git en esta fase

- Commit sugerido: `feat: add drive-first storage layer`

## Riesgos

- `storage.ts` es grande. Si queda demasiado acoplado, extraer `local-storage.ts` y `drive-storage.ts`.
- Si Drive falla, la app debe mostrar error claro y no crear datos corruptos.
