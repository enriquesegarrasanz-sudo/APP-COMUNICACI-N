# APP SPEAKING - Reglas Del Proyecto

## Intencion

Aplicacion local para registrar la evolucion hablando frente a camara. El foco es el habito diario: subir un video, escribir observaciones, transcribir lo dicho y detectar patrones de oratoria.

## Stack

- Next.js con App Router y TypeScript.
- React para la interfaz interactiva.
- CSS propio con tokens en `src/styles/tokens.css`.
- Datos locales en `data/app.json`.
- Videos locales en `public/uploads/`.
- Transcripcion por adaptadores: Whisper local u OpenAI API.

## Convenciones

- La UI vive en `src/components/`.
- La logica de negocio vive en `src/lib/`.
- Los tipos compartidos viven en `src/types/`.
- Las rutas API viven en `src/app/api/`.
- No guardar claves en codigo. Usar `.env.local`.
- No subir videos, transcripciones locales ni `data/app.json` a GitHub.

## Diseno

- Estetica minimalista, clara y diaria.
- Tonos azules con superficies luminosas y contraste suficiente.
- Sin landing page: la primera pantalla es la herramienta.
- Controles visibles, compactos y aptos para tablet.
- Usar iconos de `lucide-react` para acciones.

## Verificacion

Antes de dar por cerrado un cambio:

1. Ejecutar `npm.cmd run lint`.
2. Ejecutar `npm.cmd run build`.
3. Probar `npm.cmd run dev` y abrir la app en navegador.

