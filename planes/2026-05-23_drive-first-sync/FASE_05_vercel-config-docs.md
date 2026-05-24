# FASE 05: Vercel, seguridad y documentacion

**Plan-slug**: `drive-first-sync`
**Ruta del repo**: `C:\Users\i-gamer\Documents\APP SPEAKING`

## Objetivo de esta fase

Dejar la app preparada para Vercel como app personal privada, con variables claras, sin secretos en codigo y documentacion del flujo tablet/ordenador/Drive.

## Estado actual del codigo

- `.env.example`, `.env.vercel.example`, `VERCEL_SETUP.md` y `README.md` existen.
- `requireLocalWriteRequest` bloquea escrituras remotas salvo `APP_ALLOW_REMOTE_WRITE=true`.
- En Vercel, una URL publica sin auth expondria escrituras contra Drive.

## Criterios de aceptacion

- [ ] Existe control de acceso personal antes de permitir escrituras en Vercel.
- [ ] Las escrituras same-origin en Vercel funcionan cuando el acceso personal es valido.
- [ ] `.env.example` y `.env.vercel.example` documentan Drive-first.
- [ ] README explica: tablet sube a Drive, ordenador procesa con worker, Drive guarda todo.
- [ ] `npm.cmd run lint` y `npm.cmd run build` pasan.

## Precondiciones

- [ ] Fases 01-04 completadas.

## Herramienta recomendada

Codex, gpt-5.4/gpt-5.5, esfuerzo medium.

## Prompt ejecutable

```text
## Objective
Prepara APP SPEAKING Drive-first para despliegue personal en Vercel, con seguridad minima y docs claras.

## Scope included
- Leer antes: src/lib/security.ts, next.config.ts, README.md, VERCEL_SETUP.md, .env.example, .env.vercel.example, Start-App-Speaking.ps1.
- Ajustar requireLocalWriteRequest para permitir Vercel solo con control de acceso personal.
- Implementar una proteccion simple adecuada para app personal: cookie firmada o secreto de acceso mediante APP_ACCESS_SECRET. No dejar escrituras publicas anonimas.
- Documentar variables:
  APP_STORAGE_DRIVER=drive
  GOOGLE_OAUTH_CLIENT_ID
  GOOGLE_OAUTH_CLIENT_SECRET
  GOOGLE_OAUTH_REFRESH_TOKEN
  GOOGLE_DRIVE_ROOT_FOLDER_ID
  APP_ACCESS_SECRET
- Documentar como obtener refresh token sin guardarlo en Git.
- Documentar worker local: cuando usarlo, comandos, requisitos FFmpeg/Whisper/Ollama.

## Scope excluded
- No meter Supabase/Auth0/Clerk.
- No hacer multiusuario.

## Constraints
- La app es personal, no SaaS.
- Seguridad simple pero real: no basta APP_ALLOW_REMOTE_WRITE=true sin proteccion.

## Validation commands
npm.cmd run lint
npm.cmd run build

## Done when
La configuracion de Vercel queda clara y la app no permite escrituras anonimas a Drive.
```

## Skills y subagentes

- Skills existentes: `security-auditor`, `vercel-env-vars`, `vercel-deployments-cicd`.
- Skills a crear: ninguna.
- Subagentes: ninguno.

## Dependencias y paralelizacion

- Depende de: Fases 01-04.
- Paraleliza con: -

## Verificacion de esta fase

- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run build`
- [ ] Revisar que no hay secretos en repo.
- [ ] Probar acceso sin secreto: no puede escribir.
- [ ] Probar acceso con secreto/cookie: puede guardar.

## Git en esta fase

- Commit sugerido: `docs: document drive-first vercel setup`

## Riesgos

- Un control de acceso demasiado complejo retrasaria la feature. Mantenerlo personal y simple.
