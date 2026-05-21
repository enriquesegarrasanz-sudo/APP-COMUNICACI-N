# APP SPEAKING - Brief Funcional

## Objetivo

Registrar la evolucion personal hablando frente a camara mediante videos diarios, notas de autoevaluacion, transcripcion fiel y analisis de patrones de comunicacion.

## Usuario

Uso individual. La app esta pensada para una persona que graba rutinas breves de oratoria, corporalidad y presencia en camara.

## Flujo Principal

1. Crear una nueva sesion con numero automatico.
2. Subir un video.
3. Indicar tema, fecha, etiquetas y notas.
4. Transcribir el video con Whisper local o API.
5. Analizar muletillas, repeticiones, estructura y observaciones.
6. Consultar la evolucion por video y de forma global.

## Funcionalidades MVP

- Subida local de videos.
- Registro por sesiones numeradas.
- Notas: me gusto, quiero mejorar, observaciones.
- Transcripcion por proveedor seleccionable.
- Analisis local de texto:
  - muletillas frecuentes,
  - palabras repetidas,
  - conectores de estructura,
  - estimacion de claridad,
  - recomendaciones concretas.
- Informe global acumulado.
- Interfaz responsive para escritorio y tablet.

## Transcripcion

### Whisper Local

Usa `WHISPER_COMMAND` y `WHISPER_MODEL` desde `.env.local`.

Ejemplos:

```env
WHISPER_COMMAND=whisper
WHISPER_MODEL=base
```

```env
WHISPER_COMMAND=python -m whisper
WHISPER_MODEL=small
```

### OpenAI

Usa `OPENAI_API_KEY` y `OPENAI_TRANSCRIBE_MODEL`.

Modelo barato sugerido:

```env
OPENAI_TRANSCRIBE_MODEL=gpt-4o-mini-transcribe
```

## No Objetivos Iniciales

- Login multiusuario.
- Base de datos remota.
- Publicar videos en internet.
- Edicion avanzada de video.
- Analisis corporal por vision artificial.

## Riesgos

- Whisper local requiere Python/Whisper accesible desde terminal.
- Las APIs externas cuestan dinero despues de creditos o planes gratuitos.
- La transcripcion puede omitir muletillas si el proveedor normaliza demasiado el texto.

