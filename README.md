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

