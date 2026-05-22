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

### Google Drive Y Procesado

La app procesa cada subida con `ffmpeg`: crea un MP4 comprimido para ver la sesion y un M4A ligero para transcribir. Si activas Drive en el panel `Drive y procesado`, el MP4 comprimido se sube a la carpeta configurada.

Usa una Service Account y comparte la carpeta de Drive con el email de esa cuenta.

```env
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=email-de-la-service-account
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

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

Por seguridad, las escrituras por API solo aceptan peticiones desde `localhost` salvo que definas `APP_ALLOW_REMOTE_WRITE=true`. No actives esa variable en una app publicada sin poner autenticacion delante.

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
```
