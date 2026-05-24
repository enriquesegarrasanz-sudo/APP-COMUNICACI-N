# FASE 06: Verificacion de implementacion y QA

**Plan-slug**: `drive-first-sync`
**Ruta del repo**: `C:\Users\i-gamer\Documents\APP SPEAKING`

## Objetivo de esta fase

Validar que la arquitectura Drive-first queda completa: tablet y ordenador ven los mismos datos, Drive guarda todo, Vercel no procesa videos grandes y el worker local sube resultados.

## Estado actual esperado

Tras fases previas deberian existir:

- Storage Drive/local seleccionable.
- Upload directo/resumible a Drive.
- Autosave en ficha/transcripcion.
- Worker local.
- Docs de Vercel/Drive.
- Seguridad personal para escrituras.

## Criterios de aceptacion

- [ ] `npm.cmd run lint` pasa.
- [ ] `npm.cmd run build` pasa.
- [ ] Browser tablet `768x1024`: UI sin scroll horizontal y controles tactiles.
- [ ] Subida de archivo pequeno crea sesion en Drive sin enviar binario por `/api/videos`.
- [ ] Edicion autosave persiste tras recargar.
- [ ] Worker local procesa una sesion pendiente de prueba o reporta error claro por falta de Whisper/Ollama.
- [ ] No hay secretos nuevos en Git.

## Herramienta recomendada

Codex/Reviewer, gpt-5.5, esfuerzo medium-high.

## Prompt ejecutable

```text
## Objective
Haz QA integral de la implementacion Drive-first.

## Scope included
- Leer CONTEXTO.md, PLAN_MAESTRO.md y los diffs reales.
- Ejecutar npm.cmd run lint y npm.cmd run build.
- Arrancar npm.cmd run dev y probar con navegador en desktop/tablet.
- Verificar que el upload Drive no manda videos grandes a Vercel.
- Verificar autosave y refresco.
- Verificar worker local en modo --once con sesion de prueba si hay credenciales.
- Revisar secretos: .env.local, data/google-drive-token.json y media no deben entrar en Git.

## Scope excluded
- No hacer deploy real sin confirmacion del usuario.

## Constraints
- Reportar SKIP si falta credencial real o Whisper/Ollama, no marcar PASS falso.

## Validation commands
npm.cmd run lint
npm.cmd run build
npm.cmd run dev

## Done when
Hay reporte QA con PASS/FAIL/SKIP y lista corta de bloqueantes, si existen.
```

## Skills y subagentes

- Skills existentes: `verificador-implementacion-codex`, `web-design-reviewer`, `security-auditor`, `playwright`.
- Skills a crear: ninguna.
- Subagentes: ninguno salvo peticion explicita.

## Dependencias y paralelizacion

- Depende de: todas.
- Paraleliza con: -
- Seguridad: fase final secuencial.

## Verificacion de esta fase

- [ ] Reporte final con estado APROBADA / CON OBSERVACIONES / RECHAZADA.
- [ ] Si hay fallos bloqueantes, no hacer deploy.

## Git en esta fase

- Commit sugerido: `test: verify drive-first sync`

## Riesgos

- Algunas pruebas reales dependen de credenciales de Google y de tener una sesion Drive de prueba.
