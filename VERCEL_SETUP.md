# Configuracion De Vercel

Esta app es un proyecto Next.js en la raiz del repositorio. En la pantalla de importacion de Vercel usa:

- Framework Preset: `Next.js`
- Root Directory: `./`
- Install Command: dejar en automatico (`npm install`, detectado por `package-lock.json`)
- Build Command: dejar en automatico (`npm run build`)
- Output Directory: dejar en automatico
- Environments: `Production and Preview`

## Variables Para Importar

En `Environment Variables`, pulsa `Import .env` y usa el archivo `.env.vercel.example`.

```env
OPENAI_API_KEY=
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
OPENAI_ANALYSIS_MODEL=gpt-5-nano
```

Rellena `OPENAI_API_KEY` directamente en Vercel con tu clave real. No la guardes en GitHub.

No importes `WHISPER_COMMAND` ni `WHISPER_MODEL` en Vercel: Whisper local solo funciona en tu ordenador porque depende de un binario instalado en la maquina.

No actives `APP_ALLOW_REMOTE_WRITE=true` en Vercel salvo que pongas autenticacion delante. Por defecto, las rutas que crean, editan, borran o cambian configuracion solo aceptan escrituras desde `localhost`.

## Sincronizar Variables A Local

Despues de crear el proyecto en Vercel, puedes traer las variables de Development a tu ordenador con:

```bash
npx vercel env pull .env.local
```

Si cambias variables en Vercel, ejecuta el comando otra vez para actualizar `.env.local`.

## Despliegue Automatico

Al importar el repositorio desde GitHub, Vercel crea despliegues automaticamente:

- Push o PR a ramas distintas de `main`: despliegue Preview.
- Push o merge a `main`: despliegue Production.

## Aviso Importante Sobre Videos

La version actual guarda datos en `data/app.json` y videos en `public/uploads/`. Eso funciona bien en local, pero Vercel Functions tienen filesystem de solo lectura salvo `/tmp`, y las peticiones a Functions tienen limite de payload. Ademas, la API de transcripcion de OpenAI tiene limite de archivo, asi que los videos largos deben subirse a almacenamiento externo y/o convertirse a audio comprimido antes de transcribir.

Para usar la app como web app real en tablet con videos persistentes hay que migrar:

- Metadatos y transcripciones: Postgres, Supabase, Neon o similar.
- Videos/audio: Vercel Blob o almacenamiento tipo S3.

La configuracion de este archivo sirve para desplegar y probar la interfaz, pero el flujo completo de subir videos desde la tablet necesita esa migracion de almacenamiento.
