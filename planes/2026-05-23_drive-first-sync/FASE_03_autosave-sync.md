# FASE 03: Autosave y refresco entre dispositivos

**Plan-slug**: `drive-first-sync`
**Ruta del repo**: `C:\Users\i-gamer\Documents\APP SPEAKING`

## Objetivo de esta fase

Eliminar la dependencia del boton Guardar para la ficha/transcripcion. Cada cambio importante debe guardarse automaticamente en Drive y verse desde tablet u ordenador tras refresco/polling.

## Estado actual del codigo

- `SessionDetail.tsx` guarda manualmente con `patchVideo`.
- El estado de videos vive en `AppShell` y solo cambia por callbacks locales.
- No hay indicador global de autosave ni recarga desde Drive.

## Criterios de aceptacion

- [ ] Editar titulo, tema, fecha, tags, notas o transcripcion dispara autosave con debounce.
- [ ] La UI muestra `Guardando...`, `Guardado` o error.
- [ ] El boton Guardar se elimina o queda como respaldo manual secundario.
- [ ] La app puede refrescar sesiones desde Drive sin perder la seleccion actual.
- [ ] `npm.cmd run lint` y `npm.cmd run build` pasan.

## Precondiciones

- [ ] Fase 01 completada.

## Herramienta recomendada

Codex, gpt-5.4/gpt-5.5, esfuerzo medium-high.

## Prompt ejecutable

```text
## Objective
Implementa autosave robusto para la ficha y transcripcion, manteniendo sincronizacion entre dispositivos.

## Scope included
- Leer antes: src/components/video-detail/SessionDetail.tsx, src/components/app-shell.tsx, src/app/api/videos/[id]/route.ts, src/lib/storage.ts.
- Crear hook local si ayuda: src/lib/use-autosave.ts o src/components/... segun patron.
- Aplicar debounce de 700-1200ms para campos editables.
- Guardar PATCH parcial, no toda la sesion si no hace falta.
- Mostrar estado visual compacto de autosave en SessionDetail.
- Anadir forma de refrescar datos desde Drive: boton icono o polling suave al volver a la pestaña.
- Proteger contra respuestas antiguas: usar updatedAt o contador local para no pisar cambios recientes.

## Scope excluded
- No introducir colaboracion en tiempo real.
- No resolver edicion simultanea compleja; basta detectar conflicto simple por updatedAt.

## Constraints
- No saturar Drive con una escritura por tecla: siempre debounce.
- No perder texto local si falla la red.
- Mantener controles comodos para tablet.

## Validation commands
npm.cmd run lint
npm.cmd run build

## Done when
El usuario puede escribir notas/transcripcion y ver guardado automatico sin pulsar Guardar; al abrir/refrescar desde otro dispositivo aparecen los cambios.
```

## Skills y subagentes

- Skills existentes: `frontend-design`, `systematic-debugging`.
- Skills a crear: ninguna.
- Subagentes: ninguno.

## Dependencias y paralelizacion

- Depende de: Fase 01.
- Paraleliza con: Fase 04 con cuidado.
- Seguridad: no tocar upload directo salvo necesidad de tipos.

## Verificacion de esta fase

- [ ] `npm.cmd run lint`
- [ ] `npm.cmd run build`
- [ ] Browser tablet: editar una nota, esperar estado Guardado, recargar, comprobar persistencia.
- [ ] Edge case: simular error de PATCH y comprobar que el texto no desaparece.

## Git en esta fase

- Commit sugerido: `feat: autosave session edits`

## Riesgos

- `SessionDetail.tsx` es monolitico; si el cambio crece, extraer subcomponentes pequenos solo donde reduzca riesgo.
