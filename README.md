# Ultimate Chochan

Party-platformer online para el navegador (2 a 4 jugadores, también se puede probar solo).
Cada ronda: **elegís un ítem** de la caja → **lo colocás** en el nivel → **todos corren** hasta la copa.

## Jugar en tu compu

```bash
npm install
npm run dev
```

Abrí http://localhost:8787, creá una sala y abrí otra pestaña para unirte con el código.
(`npm start` levanta una versión alternativa con Node en http://localhost:3000.)

## Publicar gratis en Cloudflare Workers

Usa el plan gratis de Cloudflare (sin tarjeta). Cada sala corre en un *Durable Object* que se crea
cerca de quien la arma (Sudamérica si estás en Argentina), así que el lag es bajo y nunca se "duerme".

1. Creá una cuenta gratis en https://dash.cloudflare.com/sign-up
2. En esta carpeta:

   ```bash
   npx wrangler login
   ```

   Se abre el navegador para autorizar. Después:

   ```bash
   npm run deploy
   ```

3. Te da una URL tipo `https://ultimate-chochan.TU-SUBDOMINIO.workers.dev`. Compartila y listo.

Cada vez que cambies algo, volvé a correr `npm run deploy`.

> Límite gratis: 100.000 pedidos por día (cada 20 mensajes del juego cuentan como 1), unas 6–7 horas
> diarias de partida con 4 jugadores. Si se pasa, las salas dan error hasta las 21 h (hora de Argentina); nunca cobra.

## Estructura

- `worker/index.js` — servidor en Cloudflare: sirve el juego y cada sala es un Durable Object que hace de relay WebSocket.
- `wrangler.jsonc` — configuración de Cloudflare.
- `server.js` — servidor alternativo con Node (para probar sin Cloudflare).
- `public/js/core.js` — constantes, input (teclado + joystick), sonidos sintetizados, partículas.
- `public/js/content.js` — personajes, temas, niveles (mapas ASCII) e ítems (dibujo).
- `public/js/game.js` — red, lógica del anfitrión (fases y puntaje), física, render y lobby.

El anfitrión de la sala decide las fases y el puntaje; cada jugador simula su propio personaje y manda su posición.
Si el anfitrión se va, otro jugador toma su lugar y la partida sigue.

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
