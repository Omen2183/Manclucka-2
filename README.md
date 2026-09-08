# Manclucka 2

Backyard Kalah. Sow Orpington hens around fenced yards, land in your coop for another turn, and steal a flock with a rooster crow.

## Play

- **Classic Kalah** — extra turn on your coop, capture opposite yards, leftovers go to whoever still has hens
- **First empty** — first to clear their yards claims the rest
- **Until empty** — keep sowing until every yard is bare; empty side still plays from across the board
- Solo vs a named hen, pass-and-play on one device, or online with a flock code
- Best of 1 / 3 / 5 / 7

## Run locally

```bash
npm install
npm run dev
```

Open the printed local URL. Production build:

```bash
npm run build
npm run preview
```

Game rules live in `src/game/engine.ts`. Unit tests:

```bash
npx tsx --test src/game/*.test.ts
```

## Credits

Hen and rooster recordings in `public/sfx/` are public-domain clips from Wikimedia Commons / PDSounds. See `public/sfx/CREDITS.txt`.
