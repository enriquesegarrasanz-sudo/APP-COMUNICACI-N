# APP SPEAKING

Diario minimalista para revisar tu evolucion hablando frente a camara.

## Arranque

```bash
npm.cmd install
npm.cmd run dev
```

Abre `http://localhost:3000`.

## Variables De Entorno

Copia `.env.example` a `.env.local` y rellena lo que vayas a usar.

### Whisper Local

```env
WHISPER_COMMAND=whisper
WHISPER_MODEL=base
FFMPEG_COMMAND=ffmpeg
APP_MAX_UPLOAD_MB=1024
```

Si tu instalacion funciona como modulo Python:

```env
WHISPER_COMMAND=python -m whisper
WHISPER_MODEL=base
```

### Analisis IA: DeepSeek U Ollama

La transcripcion usa Whisper local. Despues puedes analizar la transcripcion con DeepSeek API o con Ollama local.

```env
DEEPSEEK_API_KEY=tu_api_key
OLLAMA_BASE_URL=http://127.0.0.1:11434
```

`OLLAMA_BASE_URL` solo hace falta si cambiaste el host o puerto de Ollama. Con la instalacion normal, la app usa `http://127.0.0.1:11434`.

### Google Drive Y Procesado Drive-First

En modo `APP_STORAGE_DRIVER=drive`, Drive guarda todo: indice, sesiones, original de la tablet, MP4 comprimido, audio, transcripcion, analisis y jobs del worker. Vercel solo sirve la interfaz y coordina llamadas a Google Drive; no guarda videos ni procesa archivos grandes.

Flujo recomendado:

1. Tablet: abre la app desplegada en Vercel, crea la sesion y sube el video original directo a Drive.
2. Drive: guarda la sesion en `app-db/sessions/<session-id>/` y deja un job en `app-db/jobs/pending/`.
3. Ordenador: ejecuta el worker local, descarga el original, comprime con FFmpeg, transcribe con Whisper, analiza con DeepSeek u Ollama y sube los resultados a Drive.
4. Tablet y ordenador: refrescan la app y leen el mismo estado desde Drive.

La subida usa OAuth 2.0 de usuario, no necesita Google Workspace de pago. Los archivos usan tu propia cuenta de Google y tu cuota personal de Drive.

Esta instalacion personal apunta a la carpeta `APP SPEAKING`:

```text
1R4TpxFk7ErNwiXQSLZllnvbQ4eBd5MjC
```

Puedes cambiar ese ID con `GOOGLE_DRIVE_ROOT_FOLDER_ID` o desde el panel `Drive y procesado`.

#### Configurar OAuth

1. Ve a Google Cloud Console > APIs & Services > Credentials.
2. Crea un OAuth Client ID de tipo `Web application`.
3. En `Authorized redirect URIs` anade: `http://localhost:3000/api/google/oauth/callback`
4. Copia el Client ID y Client Secret a `.env.local`:

```env
GOOGLE_OAUTH_CLIENT_ID=tu-client-id
GOOGLE_OAUTH_CLIENT_SECRET=tu-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3000/api/google/oauth/callback
```

5. Arranca la app y ve al panel `Drive y procesado`.
6. Pulsa `Conectar Google Drive` y autoriza con tu cuenta de Google.
7. Si Google muestra `App no verificada`, pulsa `Avanzado` y luego `Ir a APP SPEAKING (no seguro)`. Esto es normal para apps locales no publicadas.

El token de acceso se guarda en `data/google-drive-token.json` (excluido de Git) y se renueva automaticamente. Si el token expira o se revoca, la app pedira reconexion.

Para Vercel necesitas un `GOOGLE_OAUTH_REFRESH_TOKEN` persistente. La forma mas simple es conectar Drive en local, abrir `data/google-drive-token.json`, copiar solo `refresh_token` a una variable de entorno de Vercel y cerrar el archivo sin subirlo a Git. Ese archivo esta ignorado por `.gitignore`; no lo pegues en README, issues, commits ni capturas.

Variables Drive-first principales:

```env
APP_STORAGE_DRIVER=drive
APP_ALLOW_REMOTE_WRITE=true
APP_ACCESS_SECRET=una-frase-larga-aleatoria
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REFRESH_TOKEN=...
GOOGLE_DRIVE_ROOT_FOLDER_ID=...
```

`APP_ACCESS_SECRET` protege las escrituras remotas con una cookie firmada. En Vercel, la primera vez que abras la app, introduce esa clave en el panel `Acceso personal`; despues las acciones de guardar, crear, editar o borrar funcionaran desde la misma URL. Sin esa clave, las rutas de escritura devuelven `401`.

#### Worker local Drive-first

Cuando `APP_STORAGE_DRIVER=drive`, la tablet sube el original a Drive y deja un job en `app-db/jobs/pending/`. En el ordenador, ejecuta:

```bash
npm.cmd run worker:local -- --once
```

El worker descarga el original a `data/worker-cache/<session-id>/`, genera `compressed.mp4` y `audio.m4a` con FFmpeg, transcribe con Whisper local, crea `analysis.json`, sube los artifacts a la carpeta de la sesion y mueve el job a `jobs/done/`.

Opciones utiles:

```bash
npm.cmd run worker:local
npm.cmd run worker:local -- --once --force
npm.cmd run worker:local -- --once --skip-transcription
```

Usa `--skip-transcription` solo para diagnosticar media/Drive cuando Whisper o Python no esten instalados. Para completar una sesion real necesitas `FFMPEG_COMMAND`, `WHISPER_COMMAND` y `WHISPER_MODEL` configurados en `.env.local`.

#### Scope

La app usa `drive.file` como scope minimo, que permite crear archivos en la carpeta configurada. Si recibes errores de permisos al subir a una carpeta concreta, puedes cambiar el scope a `drive` en `src/app/api/google/oauth/start/route.ts`.

### Conectar Con IA

La aplicacion incluye un panel `Conectar con IA` con dos modos:

- `DeepSeek API`: usa `https://api.deepseek.com`, endpoint `chat/completions`, autenticacion `Bearer`, variable `DEEPSEEK_API_KEY` y modelo `deepseek-v4-flash`.
- `Ollama local`: usa Ollama en tu ordenador, endpoint `http://127.0.0.1:11434/api/chat` y modelo `qwen3:14b` por defecto. No necesita clave.

Para Ollama local, deja abierta la aplicacion de Ollama y ten descargado el modelo:

```bash
ollama pull qwen3:14b
ollama pull qwen3-vl:8b
```

DeepSeek y Ollama no se usan para transcribir audio: el boton `Transcribir` usa Whisper local.

Por seguridad, las escrituras por API solo aceptan peticiones desde `localhost` salvo que definas `APP_ALLOW_REMOTE_WRITE=true`. En remoto, esa variable no basta: tambien debe existir `APP_ACCESS_SECRET` y la peticion debe traer la cookie firmada o un `Authorization: Bearer` con esa clave.

El contexto de la app explica a la IA que APP SPEAKING sirve para entrenar comunicacion frente a camara. Con ese contexto, la IA debe:

- Analizar la transcripcion: estructura, claridad, ritmo, muletillas, repeticiones, cierres e intencion.
- Analizar lenguaje corporal solo cuando haya notas del usuario o una conexion de vision activa.
- Devolver consejos breves y accionables para la siguiente grabacion.

## Datos Locales

- Videos: `public/uploads/`
- Audio ligero: `public/uploads/*-audio.m4a`
- Registro: `data/app.json`
- Transcripciones temporales: `data/transcripts/`

Estas rutas estan en `.gitignore` para no subir contenido privado a GitHub.

## Scripts

```bash
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
npm.cmd run worker:local -- --once
```
