# Configuracion De Vercel

APP SPEAKING se despliega como app personal privada. Vercel sirve la UI y escribe en Google Drive; el ordenador hace el procesado pesado con el worker local.

## Importar Proyecto

En la pantalla de importacion de Vercel usa:

- Framework Preset: `Next.js`
- Root Directory: `./`
- Install Command: automatico (`npm install`, detectado por `package-lock.json`)
- Build Command: automatico (`npm run build`)
- Output Directory: automatico
- Environments: `Production and Preview`

## Variables Obligatorias

En `Environment Variables`, pulsa `Import .env` y usa `.env.vercel.example` como plantilla. Rellena los valores reales solo en Vercel.

```env
APP_STORAGE_DRIVER=drive
APP_ALLOW_REMOTE_WRITE=true
APP_ACCESS_SECRET=

GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REFRESH_TOKEN=
GOOGLE_DRIVE_ROOT_FOLDER_ID=

DEEPSEEK_API_KEY=
```

`APP_ACCESS_SECRET` debe ser una frase larga y aleatoria. La app usa esa clave para crear una cookie firmada; sin cookie valida, las rutas de escritura remota devuelven `401`. Si `APP_ALLOW_REMOTE_WRITE=true` esta activo pero falta `APP_ACCESS_SECRET`, las escrituras remotas quedan bloqueadas.

No importes `WHISPER_COMMAND`, `WHISPER_MODEL`, `FFMPEG_COMMAND` ni `OLLAMA_BASE_URL` en Vercel. Esas variables pertenecen al ordenador que ejecuta el worker.

## Obtener Refresh Token

1. En Google Cloud Console crea un OAuth Client ID de tipo `Web application`.
2. Para local, anade `http://localhost:3000/api/google/oauth/callback` en `Authorized redirect URIs`.
3. Copia `GOOGLE_OAUTH_CLIENT_ID` y `GOOGLE_OAUTH_CLIENT_SECRET` a `.env.local`.
4. Arranca la app local y conecta Google Drive desde el panel `Drive y procesado`.
5. Abre `data/google-drive-token.json` y copia solo el campo `refresh_token`.
6. Pega ese valor en `GOOGLE_OAUTH_REFRESH_TOKEN` dentro de Vercel.

`data/google-drive-token.json` esta ignorado por Git. No lo subas, no lo pegues en documentacion y no lo guardes en `.env.example`.

## Acceso Personal En La App

Cuando abras la URL de Vercel, veras el panel `Acceso personal`. Introduce el valor de `APP_ACCESS_SECRET`. La app guardara una cookie `HttpOnly`, `SameSite=Lax` y firmada con ese secreto.

Con acceso valido:

- Crear sesiones desde tablet escribe el indice y el job en Drive.
- Guardar ajustes, transcripciones, analisis y borrados funciona desde la misma URL.
- Las peticiones same-origin de la interfaz llevan la cookie automaticamente.

Sin acceso valido:

- Las rutas `POST`, `PATCH` y `DELETE` protegidas devuelven `401`.
- Las peticiones cross-origin siguen bloqueadas por validacion de `Origin`.

## Worker Local

Usa el worker cuando la tablet ya subio originales a Drive y quieras producir artifacts finales desde el ordenador.

Requisitos en el ordenador:

- FFmpeg disponible en `FFMPEG_COMMAND`.
- Whisper local disponible en `WHISPER_COMMAND` y modelo en `WHISPER_MODEL`.
- Opcional: Ollama abierto si vas a analizar con modelos locales.
- `.env.local` con credenciales Google y `APP_STORAGE_DRIVER=drive`.

Comandos:

```bash
npm.cmd run worker:local -- --once
npm.cmd run worker:local -- --once --force
npm.cmd run worker:local -- --once --skip-transcription
```

El worker descarga `original.<ext>` desde Drive, genera `compressed.mp4` y `audio.m4a`, transcribe, crea `analysis.json`, sube todo a la carpeta de la sesion y mueve el job de `app-db/jobs/pending/` a `app-db/jobs/done/`.

## Sincronizar Variables A Local

Despues de crear el proyecto en Vercel, puedes traer las variables de Development a tu ordenador con:

```bash
npx vercel env pull .env.local
```

Si cambias variables en Vercel, ejecuta el comando otra vez. Recuerda que `vercel env pull` puede sobrescribir `.env.local`.

## Despliegue Automatico

Al importar el repositorio desde GitHub, Vercel crea despliegues automaticamente:

- Push o PR a ramas distintas de `main`: despliegue Preview.
- Push o merge a `main`: despliegue Production.

No hace falta Supabase, Neon, Auth0, Clerk ni almacenamiento persistente de Vercel para esta fase. Drive es la fuente de verdad.
