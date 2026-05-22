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

### OpenAI

```env
OPENAI_API_KEY=tu_api_key
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

### Google Drive Y Procesado

La app procesa cada subida con `ffmpeg`: crea un MP4 comprimido para ver la sesion y un M4A ligero para transcribir. Si activas Drive en el panel `Drive y procesado`, el MP4 comprimido se sube a la carpeta configurada.

Usa una Service Account y comparte la carpeta de Drive con el email de esa cuenta.

```env
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=email-de-la-service-account
GOOGLE_DRIVE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Conexiones IA

La aplicacion incluye un panel `Conexiones IA` para configurar proveedor, base URL, endpoints, modo de autenticacion, variable de clave, modelo de transcripcion, modelo de analisis y contexto global de la app. OpenAI es solo el preset inicial: tambien puedes conectar APIs compatibles, proveedores mas economicos o un endpoint propio/proxy. Las claves no se guardan en el codigo: se leen desde `.env.local` usando el nombre de variable definido en el panel.

Por seguridad, las escrituras por API solo aceptan peticiones desde `localhost` salvo que definas `APP_ALLOW_REMOTE_WRITE=true`. No actives esa variable en una app publicada sin poner autenticacion delante.

El contexto de la app explica a la IA que APP SPEAKING sirve para entrenar comunicacion frente a camara. Con ese contexto, la IA debe:

- Transcribir audio o video de forma fiel, conservando muletillas y pausas habladas.
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
