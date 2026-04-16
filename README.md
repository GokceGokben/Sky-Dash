# Sky Dash

Sky Dash is a retro-style browser game inspired by classic side-scrolling dodge games.
You control a pixel bee, avoid pipes, and try to survive as long as possible.

https://gokcegokben.github.io/Sky-Dash/

## Features

- Pixel-art bee and neon UI style
- Animated background with smooth scrolling
- Responsive gameplay for desktop and mobile
- Pause menu and in-game sound controls
- Volume slider (0-100)
- Easter egg confetti celebration at score ?

## Controls

- `Space` / `W` / `ArrowUp`: flap
- `Click` / `Tap`: flap
- `Esc` / `P`: pause-resume
- Top-left sound controls: mute + volume

## Run Locally

Requirements:

- Node.js 20+

Install and run:

```bash
npm install
npm run serve
```

Open:

- `http://localhost:3000`

Alternative (Vite dev server):

```bash
npm run dev
```

## Scripts

- `npm run serve`: starts Node static server (`server.js`)
- `npm run dev`: starts Vite dev server
- `npm run build`: production build
- `npm run preview`: preview built app

## Project Structure

```text
Sky Dash/
├── public/
│   └── assets/              # Images, audio, icon, background
├── src/
│   ├── engine/
│   │   ├── Game.js
│   │   ├── Player.js
│   │   ├── ObstacleManager.js
│   │   └── Renderer.js
│   ├── utils/
│   │   ├── GifAnimator.js
│   │   └── ImageUtils.js
│   └── main.js
├── index.html
├── style.css
├── server.js
└── package.json
```

## Credits

- Music by [kissan4](https://pixabay.com/users/kissan4-10387284/?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=358340)
- Source: [Pixabay](https://pixabay.com/music//?utm_source=link-attribution&utm_medium=referral&utm_campaign=music&utm_content=358340)

## Disclaimer

This project is an independent fan-made game inspired by classic mechanics.
It is not affiliated with or endorsed by any original game IP owner.

Note: The game is mobile-compatible and supports touch controls.

## License

This project is licensed under the MIT License.
See [LICENSE](LICENSE) for details.
