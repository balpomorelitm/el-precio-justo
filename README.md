# El Precio Justo · Edición aula

A page for teachers to run a classroom game in teams, inspired by the classic TV show. Product descriptions and the guessing question remain in Spanish for language practice; instructions are in English.

## How to play

1. Enter at least two different team names. Before starting, use «Productos y precios» to review or edit the prices and the EUR/HKD exchange rate.
2. Collect guesses in euros, following the displayed turn order. A different team goes first each round: the previous first team moves to the end. Select «Revelar el precio» to reveal the price and scores. A blank field means that the team is not taking part in that round.
3. The closest guess without going over wins one point. Tied winners share that point. Each exact guess earns one additional bonus point.
4. You can finish after the third revealed round. From the fifth revealed round, you can add extras; these follow the six main products without repeating.
5. You can edit guesses in any revealed round; scores update automatically. At the end, download the results as a CSV file.

The game and custom prices are saved locally in that browser and device. Reopen the page to continue. «Nueva partida» lets you download the previous results before starting again. The teacher’s operating buttons remain in Spanish.

## Development

The application needs no dependencies. To open a local preview:

```sh
npm run dev
```

Run the scoring checks with `npm test` and prepare the publishable version with `npm run build`. Netlify uses `netlify.toml` to build the `dist/` directory automatically from GitHub.

Prices are references checked on 6 November 2026 and can be changed on the setup screen. The initial EUR/HKD exchange rate comes from the ECB, dated 5 November 2026.
