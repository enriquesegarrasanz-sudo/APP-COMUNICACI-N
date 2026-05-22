# Plan reducido: carpeta local configurable y Drive opcional

Uso MODO B porque la mejora toca 5 archivos principales en una sola fase logica: tipos, defaults, almacenamiento, API de settings y panel de configuracion.

## Objetivo

Permitir que APP SPEAKING guarde los videos subidos en una carpeta local configurable del ordenador donde corre Next.js, manteniendo la subida opcional a Google Drive como destino adicional.

El flujo recomendado queda asi: desde tablet u ordenador se sube el archivo por la app, el servidor lo procesa, lo guarda en la carpeta local configurada y, si Drive esta activo y listo, sube el MP4 comprimido a Drive.

## Estado actual del codigo

- `src/types/video.ts` (133 LOC): define `DriveSettings`, `DriveSettingsStatus`, `VideoEntry` y `AppDatabase`. Actualmente `DriveSettings` solo contempla Drive, compresion y limpieza de originales.
- `src/lib/ai-defaults.ts` (72 LOC): contiene `defaultDriveSettings` con Drive desactivado por defecto y `deleteOriginalAfterProcessing: true`.
- `src/lib/storage.ts` (646 LOC): archivo monolitico. Guarda siempre en `public/uploads/`, valida nombres con `safeUploadPath`, procesa con `processUploadedMedia`, sube a Drive si `database.driveSettings.enabled` esta activo y registra la sesion en `data/app.json`.
- `src/app/api/settings/drive/route.ts` (54 LOC): sanitiza y persiste el PATCH de ajustes Drive. Solo acepta campos Drive/FFmpeg actuales.
- `src/components/settings/DriveSettingsPanel.tsx` (172 LOC): panel cliente para activar Drive, configurar carpeta Drive, variables de entorno, CRF, audio kbps y limpieza de original.

Estructura de datos actual:

```ts
DriveSettings = {
  enabled: boolean;
  folderId: string;
  serviceAccountEmailEnvVar: string;
  serviceAccountPrivateKeyEnvVar: string;
  compressionCrf: number;
  audioBitrateKbps: number;
  deleteOriginalAfterProcessing: boolean;
  updatedAt?: string;
}
```

Puntos de integracion:

- `src/lib/storage.ts:17`: `uploadDir` esta fijado a `public/uploads`.
- `src/lib/storage.ts:171`: `normalizeDriveSettings` debe normalizar los nuevos campos locales.
- `src/lib/storage.ts:331`: `safeUploadPath` debe resolver contra el directorio activo, no solo contra `public/uploads`.
- `src/lib/storage.ts:423`: `getDriveSettingsStatus` debe exponer si la carpeta local esta lista.
- `src/lib/storage.ts:473`: `createVideoEntry` debe usar el directorio local configurado para escribir fuente, comprimido y audio.
- `src/components/settings/DriveSettingsPanel.tsx:90`: el panel actual agrupa Drive y procesado; ahi encaja el bloque de destino local.

Patrones a respetar:

- Persistencia local centralizada en `src/lib/storage.ts` con `withDatabaseLock`.
- Validacion defensiva con `PublicError` para errores mostrables al usuario.
- Settings persistidos en `data/app.json` y defaults en `src/lib/ai-defaults.ts`.
- UI compacta con toggles, labels e iconos `lucide-react`.

Riesgo:

- `src/lib/storage.ts` supera 500 LOC. La edicion debe ser quirurgica y evitar refactors no necesarios.
- Next solo puede guardar en carpetas accesibles para el proceso del servidor. Desde tablet, la carpeta local es la del ordenador servidor, no la tablet.

## Modelo y esfuerzo

**Claude Code / API**
- Modelo: Sonnet 4.6
- Esfuerzo: Medio
- Justificacion: feature estandar multiarchivo con validacion de rutas y UI.

**Codex (OpenAI)**
- Modelo: gpt-5.5 o gpt-5.4
- Esfuerzo (`reasoning.effort`): high
- Justificacion: requiere tocar almacenamiento local con cuidado para no romper subida, transcripcion ni borrado.

Equivalencias funcionales Claude <-> Codex:

| Rol funcional | Claude Code | Codex equivalente | Cuando usar |
|---|---|---|---|
| Maxima dificultad / arquitectura | Opus 4.7 | gpt-5.5 | Validacion critica de rutas |
| Trabajo diario profesional | Sonnet 4.6 | gpt-5.4 | Implementacion normal |
| Subtareas / exploracion | Haiku 4.5 | gpt-5.4-mini | Lectura de archivos grandes |
| Cloud tasks / code review | Opus 4.7 | gpt-5.3-codex | Review automatica |

## Criterios de aceptacion

- [ ] El panel de configuracion permite activar/desactivar el guardado local personalizado y escribir una ruta absoluta de carpeta local.
- [ ] Si la carpeta local personalizada esta activa y es valida, una nueva sesion escribe source/compressed/audio en esa carpeta y la reproduccion/transcripcion siguen funcionando desde la app.
- [ ] Si la carpeta local personalizada esta desactivada o vacia, la app mantiene el comportamiento actual en `public/uploads/`.
- [ ] Si la carpeta configurada no existe o no es escribible, la API responde con un error claro y no crea una entrada inconsistente en `data/app.json`.
- [ ] Drive sigue siendo opcional: si esta activo y listo, sube el MP4 comprimido; si no, la sesion local se crea igualmente con estado Drive `disabled`, `skipped` o `error` segun corresponda.
- [ ] `npm.cmd run lint` y `npm.cmd run build` pasan sin errores nuevos.

## Diseno propuesto

### Datos

Extender `DriveSettings` con campos locales:

```ts
localStorageEnabled: boolean;
localStoragePath: string;
```

Defaults:

```ts
localStorageEnabled: false;
localStoragePath: "";
```

Con este default no cambia nada para usuarios actuales. La ruta se persiste en `data/app.json`, igual que el resto de ajustes.

### Almacenamiento

Crear helpers en `src/lib/storage.ts`:

- `getActiveUploadDir(settings)`: devuelve `settings.localStoragePath` si `localStorageEnabled` y hay ruta; si no, `public/uploads`.
- `ensureUploadDir(settings)`: crea/valida el directorio activo.
- `safeUploadPath(fileName, settings?)`: resuelve contra el directorio activo y evita path traversal.

Para mantener URLs reproducibles, hay dos opciones:

1. Copiar derivados visibles a `public/uploads/` aunque la fuente viva en carpeta externa.
2. Servir los archivos desde una nueva API `/api/media/[fileName]`.

Recomendacion: opcion 2. Si el usuario elige una carpeta fuera de `public`, Next no puede servirla estaticamente con `/uploads/...`. Una ruta API mantiene privado el path real y permite reproducir/transcribir desde la app.

### UI

Actualizar `DriveSettingsPanel` para que el encabezado sea mas claro: "Destino y Drive". Mantener el bloque Drive existente y anadir:

- Toggle "Carpeta local" con icono de carpeta.
- Campo "Ruta carpeta local" visible/usable siempre, con placeholder tipo `C:\Users\i-gamer\Videos\APP SPEAKING`.
- Estado breve: "Local por defecto" / "Carpeta personalizada".

### API

Actualizar `src/app/api/settings/drive/route.ts` para aceptar `localStorageEnabled` y `localStoragePath`. La validacion estricta queda en `normalizeDriveSettings`.

### Seguridad

- Exigir ruta absoluta si `localStorageEnabled` esta activo.
- Rechazar rutas que apunten a un archivo.
- No exponer la ruta absoluta en URLs publicas.
- Mantener el limite de tamano `APP_MAX_UPLOAD_MB`.

## Prompt ejecutable

Archivos a leer antes de empezar:

- `src/types/video.ts`: tipos `DriveSettings`, `DriveSettingsStatus`, `VideoEntry`, `AppDatabase`.
- `src/lib/ai-defaults.ts`: defaults de Drive/procesado.
- `src/lib/storage.ts`: escritura, lectura, procesado, Drive y borrado.
- `src/app/api/settings/drive/route.ts`: PATCH de configuracion.
- `src/components/settings/DriveSettingsPanel.tsx`: UI de ajustes.
- `src/app/api/videos/route.ts`: flujo de creacion de videos.
- `src/lib/media-processing.ts`: procesa source/audio/compressed dentro de `uploadDir`.

Implementa la opcion recomendada: carpeta local configurable en el ordenador servidor + Drive opcional. Extiende `DriveSettings` con `localStorageEnabled` y `localStoragePath`, normaliza ambos campos, anade defaults compatibles y permite guardarlos desde `/api/settings/drive`. Cambia `storage.ts` para que las subidas usen el directorio activo cuando la carpeta local este activada, validando ruta absoluta y permisos de escritura antes de crear la entrada. Como una carpeta externa no puede servirse con `/uploads/...`, crea una ruta API segura para servir medios locales por nombre de archivo y ajusta `videoUrl`/`audioUrl` para usarla cuando corresponda. Mantiene el comportamiento actual si la carpeta personalizada esta desactivada. Actualiza `DriveSettingsPanel` con controles compactos para "Carpeta local" y "Ruta carpeta local", sin romper los controles Drive existentes. No toques transcripcion, analisis IA ni estructura general de tabs. Ejecuta `npm.cmd run lint`, `npm.cmd run build`, levanta `npm.cmd run dev` y prueba en navegador que el panel guarda ajustes y que crear una sesion sigue funcionando.

## Skills y subagentes

- Skills existentes que aplican: `systematic-debugging` si aparece un fallo en build/runtime; `verificador-implementacion-codex` para QA final si se ejecuta en fase separada.
- Skills a crear: ninguna.
- Subagentes: ninguno. El cambio es pequeno y secuencial.

## Dependencias entre tareas

| # | Tarea | Depende de | Paraleliza con | Herramienta |
|---|---|---|---|---|
| 1 | Ampliar tipos/defaults/settings API | - | - | Codex |
| 2 | Adaptar storage y ruta segura de medios | 1 | - | Codex |
| 3 | Actualizar panel de configuracion | 1 | - | Codex |
| 4 | Verificacion completa | 1, 2, 3 | - | Codex |

## Verificacion de Implementacion y QA

1. Ejecutar `npm.cmd run lint`.
2. Ejecutar `npm.cmd run build`.
3. Levantar `npm.cmd run dev`.
4. Abrir la app en navegador y verificar:
   - El panel muestra los nuevos controles locales.
   - Guardar ajustes persiste tras refrescar.
   - Con carpeta personalizada desactivada, una subida sigue usando el flujo actual.
   - Con carpeta personalizada activada y ruta valida, una subida guarda/procesa en esa carpeta y el detalle reproduce el video/audio.
   - Drive no se rompe: con Drive apagado no intenta subir; con Drive encendido mantiene el intento de subida existente.
5. Revisar regresiones en borrar sesion, transcribir y reproducir una sesion previa.
