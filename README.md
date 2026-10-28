# Ultimate Chochan

Party-platformer online para el navegador (2 a 4 jugadores, también se puede probar solo).
Cada ronda: **elegís un ítem** de la caja → **lo colocás** en el nivel → **todos corren** hasta la copa.

## Jugar en tu compu

```bash
npm install
npm start
```

Abrí http://localhost:3000, creá una sala y pasales el link (o el código de 4 letras) a tus amigos.

## Publicar gratis en Render

1. Subí esta carpeta a un repositorio de GitHub (sin `node_modules`, ya está en `.gitignore`).
2. En https://render.com → **New → Blueprint** → elegí el repo. Render lee `render.yaml` y crea el servicio web gratis.
   (Alternativa: **New → Web Service**, Build `npm install`, Start `node server.js`, plan Free.)
3. Te da una URL tipo `https://ultimate-chochan.onrender.com`. Compartila y listo.

> El plan gratis de Render "duerme" el servidor después de 15 min sin uso: la primera visita puede tardar ~1 minuto en despertar.

## Estructura

- `server.js` — sirve los archivos y hace de relay WebSocket por sala (código de 4 letras).
- `js/core.js` — constantes, input (teclado + joystick), sonidos sintetizados, partículas.
- `js/content.js` — personajes, temas, niveles (mapas ASCII) e ítems (dibujo).
- `js/game.js` — red, lógica del anfitrión (fases y puntaje), física, render y lobby.

El anfitrión de la sala decide las fases y el puntaje; cada jugador simula su propio personaje y manda su posición.

## Reglas de puntaje

| Logro | Puntos |
|---|---|
| Llegar a la copa | 10 |
| Primero en llegar (si llegan 2+) | +4 |
| Único en llegar | +6 |
| Tu trampa elimina a otro (si alguien llegó) | +3 |
| Llegar con el alfajor | +4 |

Si llegan todos: nadie suma. Gana el primero en llegar a 50.
"# Ultimate-chochan" 
