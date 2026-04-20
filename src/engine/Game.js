import { Player } from './Player.js';
import { ObstacleManager } from './ObstacleManager.js';
import { Renderer } from './Renderer.js';

const CONFETTI_TRIGGER_SCORE = 100;

export class Game {
  constructor(canvas, ui) {
    this.canvas = canvas;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.player = new Player(canvas);
    this.obstacleManager = new ObstacleManager(canvas);

    this.state = 'MENU'; // MENU, PLAYING, PAUSED, GAMEOVER
    this.score = 0;
    this.hundredCelebrated = false;
    this.assets = {
      player: null,
      background: null,
      backgroundVideo: null,
      backgroundAnimator: null,
      obstacle: null
    };

    this.resize();
    window.addEventListener('resize', () => this.resize());

    // Bind methods
    this.loop = this.loop.bind(this);
  }

  resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;

    if (H > W) {
      // Portrait (Mobile): Fix logical width at 600, adapt height
      this.canvas.width = 600;
      this.canvas.height = 600 * (H / W);
    } else {
      // Landscape (Desktop): Fix logical height at 800, adapt width
      this.canvas.height = 800;
      this.canvas.width = 800 * (W / H);
    }

    this.player.reset();
    this.obstacleManager.reset();
  }

  start() {
    this.state = 'PLAYING';
    this.score = 0;
    this.hundredCelebrated = false;
    this.player.reset();
    this.obstacleManager.reset();
    this.obstacleManager.spawnInitial();
    this.ui.showHUD(true);
    this.ui.updateScore(0);
  }

  pause() {
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.ui.showPause(true);
  }

  resume() {
    if (this.state !== 'PAUSED') return;
    this.state = 'PLAYING';
    this.ui.showPause(false);
  }

  gameOver() {
    this.state = 'GAMEOVER';
    if (this.assets.backgroundVideo) {
      this.assets.backgroundVideo.pause();
    }
    this.player.die();
    this.ui.showGameOver(this.score);
  }

  handleInput() {
    if (this.state === 'PLAYING') {
      this.player.flap();
    }
  }

  update() {
    if (this.state !== 'PLAYING') return;

    this.player.update();
    this.obstacleManager.update(() => {
      this.score++;
      this.ui.updateScore(this.score);

      if (!this.hundredCelebrated && this.score >= CONFETTI_TRIGGER_SCORE) {
        this.hundredCelebrated = true;
        if (this.ui.showConfetti) {
          this.ui.showConfetti();
        }
      }
    }, this.score);

    if (this.assets.backgroundVideo) {
      // The base speed is 4. When speed increases, increase video playback rate to match.
      // Use Math.min/max to prevent extreme values if speed gets crazy
      const rate = Math.max(0.2, Math.min(3.5, this.obstacleManager.speed / 4));
      if (this.assets.backgroundVideo.playbackRate !== rate) {
        this.assets.backgroundVideo.playbackRate = rate;
      }
    }

    if (this.obstacleManager.checkCollision(this.player)) {
      this.gameOver();
    }
  }

  loop() {
    this.update();
    const animateBackground = this.state === 'PLAYING';
    this.renderer.draw(
      this.player,
      this.obstacleManager,
      this.assets,
      this.getBackgroundScrollSpeed(),
      animateBackground
    );
    requestAnimationFrame(this.loop);
  }

  getLevel() {
    // Increase level every 10 points.
    return 1 + Math.floor(this.score / 10);
  }

  getBackgroundScrollSpeed() {
    // Keep background slower than obstacles at level 1, then ramp up per level.
    const level = this.getLevel();
    const speed = 0.06 + (level - 1) * 0.02;
    return Math.min(0.45, speed);
  }

  setAsset(name, image) {
    this.assets[name] = image;
  }
}
