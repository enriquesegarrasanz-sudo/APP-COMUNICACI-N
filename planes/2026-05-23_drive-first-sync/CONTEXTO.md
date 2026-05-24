# Contexto compartido del plan

**Proyecto**: APP SPEAKING
**Ruta absoluta del repo**: `C:\Users\i-gamer\Documents\APP SPEAKING`
**Stack**: Next.js App Router, TypeScript, React, CSS propio, Google Drive API, ejecucion local opcional con FFmpeg/Whisper/Ollama.
**Rama actual al planificar**: `codex/deepseek-only-ai`
**Estado inicial**: la app funciona en local con `data/app.json` y `public/uploads/`; Drive ya existe para subir MP4 procesados, pero no es aun el almacenamiento central de sesiones.

## Decision de arquitectura

Drive sera el centro de datos y archivos. Vercel no debe almacenar videos ni procesar archivos grandes. Vercel sirve la UI y coordina llamadas a Drive:

- Tablet: abre la app en Vercel, crea sesiones, sube archivos a Drive y consulta resultados.
- Ordenador: abre la misma app y, cuando proceda, ejecuta un worker local para descargar originales de Drive, comprimir, transcribir/analizar y subir resultados.
- Drive: guarda sesiones, index, settings, media, transcripciones, analisis y jobs.
- Vercel: no usa Supabase/Neon. No guarda datos persistentes propios. Solo usa variables de entorno y Google Drive API.

## Estructura Drive objetivo

```text
APP SPEAKING/
  app-db/
    index.json
    settings.json
    sessions/
      <session-id>/
        session.json
        original.<ext>
        compressed.mp4
        audio.m4a
        transcript.txt
        analysis.json
    jobs/
      pending/
        <session-id>.json
      done/
        <session-id>.json
```

## Snapshot de archivos clave

| Archivo | LOC | Que hace | Riesgo |
|---------|-----|----------|--------|
| `src/lib/storage.ts` | 619 | Lee/escribe `data/app.json`, crea sesiones, procesa local y sube MP4 a Drive | Monolitico |
| `src/lib/google-drive.ts` | 84 | Sube archivos a Drive con upload multipart | Normal |
| `src/lib/google-oauth-tokens.ts` | 119 | Guarda token OAuth en `data/google-drive-token.json` | Normal |
| `src/types/video.ts` | 131 | Tipos compartidos de sesiones, ajustes, Drive e IA | Normal |
| `src/app/api/videos/route.ts` | 36 | Lista y crea videos por multipart hacia el servidor | Normal |
| `src/app/api/videos/[id]/route.ts` | 71 | GET/PATCH/DELETE de sesion | Normal |
| `src/app/api/transcribe/route.ts` | 78 | Transcribe con proveedor local o API desde servidor | Normal |
| `src/app/api/analyze/route.ts` | 66 | Analiza transcripcion desde servidor | Normal |
| `src/components/app-shell.tsx` | 302 | Estado cliente principal, tabs y seleccion | Normal |
| `src/components/video-form/NewSessionForm.tsx` | 150 | Formulario de subida actual por multipart | Normal |
| `src/components/video-detail/SessionDetail.tsx` | 623 | Detalle, ficha, guardado manual, transcripcion y analisis | Monolitico |
| `src/lib/media-processing.ts` | 199 | FFmpeg local para audio y compresion | Normal |
| `src/lib/transcribers/localWhisper.ts` | 87 | Ejecuta Whisper local | Normal |

## Schema actual relevante

```ts
type AppDatabase = {
  videos: VideoEntry[];
  aiSettings: AiSettings;
  driveSettings: DriveSettings;
};

type VideoEntry = {
  id: string;
  numero: number;
  titulo: string;
  tema: string;
  fecha: string;
  etiquetas: string[];
  videoUrl: string;
  originalFileName: string;
  storedFileName: string;
  sourceFileName?: string;
  audioFileName?: string;
  audioUrl?: string;
  mimeType: string;
  size: number;
  compressedSize?: number;
  audioSize?: number;
  processingStatus?: "ready" | "error" | "skipped";
  driveStatus?: "disabled" | "uploaded" | "error" | "skipped";
  driveFileId?: string;
  driveFileName?: string;
  driveWebViewLink?: string;
  transcript: string;
  transcriptStatus: "idle" | "processing" | "ready" | "error";
  analysis?: AnalysisResult;
};
```

## Patrones del proyecto a respetar

- UI en `src/components/`.
- Logica de negocio en `src/lib/`.
- Tipos compartidos en `src/types/`.
- Rutas API en `src/app/api/`.
- No guardar claves en codigo; usar `.env.local` y variables Vercel.
- No introducir Supabase/Neon/Base de datos externa.
- Usar `lucide-react` para acciones.
- Verificar siempre con `npm.cmd run lint`, `npm.cmd run build`, `npm.cmd run dev` y navegador.

## Riesgos transversales

- `storage.ts` y `SessionDetail.tsx` son monoliticos; tocar con cambios pequenos y verificacion frecuente.
- Vercel no tiene filesystem persistente. Cualquier token o dato escrito en `data/` no sirve como fuente de verdad en produccion.
- Las funciones de Vercel no deben recibir videos grandes por multipart. La subida debe ir directa a Drive con upload resumible.
- El refresh token de Google debe vivir en variables de entorno de Vercel para produccion; el archivo local queda solo como fallback de desarrollo.
- La app en Vercel necesita algun control de acceso personal antes de permitir escrituras contra Drive.
