# Phaser 3 + Poki Starter Template

A production-ready starter framework for casual browser games built with **Phaser 3**, **TypeScript**, and **Vite**, with **Poki SDK** integration built in from day one.

## Quick Start (under 5 minutes)

```bash
# 1. Clone or download this template
git clone <your-repo-url> my-game
cd my-game

# 2. Install dependencies
npm install

# 3. Start the dev server
npm run dev
```

Open `http://localhost:3000` — you'll see the full scene flow: Boot → Preload → Menu → Game → Result.

For GitHub Pages CI/CD deployment, see [Deployment (GitHub Pages)](#deployment-github-pages).

## Build for Production

```bash
npm run build
```

Output goes to `dist/`. Upload the entire `dist/` folder to Poki or any static host.

If you are deploying with GitHub Pages, follow [Deployment (GitHub Pages)](#deployment-github-pages).

## Deployment (GitHub Pages)

This repo includes an Actions workflow that builds and deploys the game to GitHub Pages automatically.

- **Trigger:** On every push to `main`, GitHub Actions runs install + build + deploy.
- **Workflow file:** `.github/workflows/build` (current workflow filename in this repo; equivalent to `.github/workflows/deploy-pages.yml` if renamed).
- **Required repo setting:** In your repository, go to **Settings → Pages → Source** and set it to **GitHub Actions**.
- **Expected build output directory:** `dist/` (uploaded by the workflow as the Pages artifact).

### Troubleshooting failed deploys

If deployment fails:

1. Open the **Actions** tab and inspect logs for the latest `Build & Deploy to GitHub Pages` run.
2. Verify the build step produces `dist/` (the workflow uploads `./dist`).
3. Confirm repository permissions/settings allow Pages deploy:
   - Pages source is set to **GitHub Actions**.
   - Workflow permissions include `pages: write` and `id-token: write` (already configured in this workflow).

### Optional status badge

You can add a workflow badge near the top of this README:

```md
![Deploy](https://github.com/<OWNER>/<REPO>/actions/workflows/build/badge.svg)
```

Replace `<OWNER>` and `<REPO>` with your GitHub org/user and repository name.

## Project Structure

```
/src
  /core
    Config.ts           — Typed game config interface and default values
    ScaleManager.ts     — Responsive canvas scaling (portrait-first, 9:16)
    AudioManager.ts     — Global mute/unmute, browser audio unlock, SFX/music control
    SaveManager.ts      — localStorage wrapper with typed save/load and silent error handling
  /scenes
    BootScene.ts        — Initializes core services, detects environment, routes to PreloadScene
    PreloadScene.ts     — Loads all assets with progress bar; plugin fires gameLoadingFinished
    MenuScene.ts        — Title screen with Play button and mute toggle
    GameScene.ts        — Placeholder gameplay loop with all systems wired up
    ResultScene.ts      — Score display, restart + menu buttons; rewarded ad hook placeholder
  /components
    UIButton.ts         — Reusable Phaser button with hover/press states and keyboard support
    ProgressBar.ts      — Reusable loading progress bar
  /systems
    ScoreSystem.ts      — Add/reset/get score; high score persisted via SaveManager
    DifficultySystem.ts — Time-based difficulty multiplier driven by balancing.ts
    SpawnSystem.ts      — Timed spawn controller integrated with the game loop
  /data
    gameConfig.ts       — Single source of truth: dimensions, colors, debug flags
    balancing.ts        — All tunable numbers: spawn rates, difficulty ramp, points
  /utils
    helpers.ts          — Shared utility functions (random, clamp, format, etc.)
  main.ts               — Phaser game bootstrap with Poki plugin config
/public
  /assets               — Game assets (add your images, audio, spritesheets here)
index.html              — Entry HTML with correct mobile viewport meta tags
```

## Poki SDK Integration

The `PokiPlugin` is registered globally in `main.ts`. It automatically:

- Fires `gameLoadingFinished` when `PreloadScene` finishes loading
- Fires `gameplayStart` when `GameScene` starts
- Fires `gameplayStop` when `GameScene` stops
- Disables input and audio during ad breaks

### Rewarded Ads

In `ResultScene.ts`, look for the `// TODO: rewarded break hook` comment and add:

```ts
const poki = this.plugins.get('poki') as PokiPlugin
poki.rewardedBreak().then((rewarded) => {
  if (rewarded) {
    // Give the player their reward
  }
})
```

### Commercial Breaks

`autoCommercialBreak: true` is set in the plugin config, so Poki will automatically trigger commercial breaks between gameplay sessions.

## Making Your Game

Replace the placeholder gameplay in `GameScene.ts` with your actual game logic. The systems are already wired up:

| System | What to replace |
|--------|----------------|
| `SpawnSystem` | Change spawn callbacks to create your actual game objects |
| `ScoreSystem` | Call `scoreSystem.add(points)` when the player earns points |
| `DifficultySystem` | Tune values in `balancing.ts` to control ramp speed |
| `GameScene` | Add your player, enemies, physics groups, collision handlers |

## Configuration

All tunable values are in two files:

- **`src/data/gameConfig.ts`** — title, dimensions, background color, debug flag
- **`src/data/balancing.ts`** — spawn intervals, difficulty ramp time, points per event

## Type Checking

```bash
npm run typecheck
```

## Adding Assets

Place images, audio, and spritesheets in `/public/assets/`. Load them in `PreloadScene.ts`:

```ts
this.load.image('player', 'assets/player.png')
this.load.audio('bgm', 'assets/bgm.mp3')
```

## Mobile Notes

- Canvas is portrait-first (480×854, 9:16)
- All buttons have minimum 44×44px hit areas
- Touch events are handled by Phaser's input system
- `user-scalable=no` prevents accidental zoom on double-tap

## License

MIT — use this template for any project, commercial or personal.
