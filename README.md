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

### Conexiones IA

La aplicacion incluye un panel `Conexiones IA` para configurar proveedor, base URL, variable de clave, modelo de transcripcion, modelo de analisis y contexto global de la app. Las claves no se guardan en el codigo: se leen desde `.env.local` usando el nombre de variable definido en el panel.

El contexto de la app explica a la IA que APP SPEAKING sirve para entrenar comunicacion frente a camara. Con ese contexto, la IA debe:

- Transcribir audio o video de forma fiel, conservando muletillas y pausas habladas.
- Analizar la transcripcion: estructura, claridad, ritmo, muletillas, repeticiones, cierres e intencion.
- Analizar lenguaje corporal solo cuando haya notas del usuario o una conexion de vision activa.
- Devolver consejos breves y accionables para la siguiente grabacion.

## Datos Locales

- Videos: `public/uploads/`
- Registro: `data/app.json`
- Transcripciones temporales: `data/transcripts/`

Estas rutas estan en `.gitignore` para no subir contenido privado a GitHub.

## Scripts

```bash
npm.cmd run dev
npm.cmd run build
npm.cmd run lint
```
