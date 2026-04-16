import { Game } from './engine/Game.js';
import { removeWhiteBackground, cropToContent } from './utils/ImageUtils.js';
import { GifAnimator } from './utils/GifAnimator.js';

const canvas = document.getElementById('game-canvas');

function burstConfetti(layer, amount = 320) {
  if (!layer) return;

  const colors = ['#ff4ea2', '#ffc735', '#5ed1ff', '#7efc86', '#ffffff'];
  for (let i = 0; i < amount; i++) {
    const piece = document.createElement('span');
    piece.className = 'confetti-piece';
    piece.style.background = colors[Math.floor(Math.random() * colors.length)];
    piece.style.left = `${Math.random() * 100}%`;
    piece.style.top = `${-12 + Math.random() * 112}%`;

    const drift = (Math.random() - 0.5) * 300;
    const rise = 20 + Math.random() * 80;
    const fall = 160 + Math.random() * 380;
    const rotate = (Math.random() - 0.5) * 720;
    const duration = 1400 + Math.random() * 1100;
    const delay = Math.random() * 220;

    layer.appendChild(piece);
    piece.animate(
      [
        { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
        { transform: `translate(${drift * 0.25}px, ${-rise}px) rotate(${rotate * 0.35}deg)`, opacity: 1, offset: 0.2 },
        { transform: `translate(${drift}px, ${fall}px) rotate(${rotate}deg)`, opacity: 0 }
      ],
      {
        duration,
        delay,
        easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)'
      }
    ).onfinish = () => piece.remove();
  }
}

const ui = {
  menu:           document.getElementById('main-menu'),
  gameOver:       document.getElementById('game-over'),
  pauseMenu:      document.getElementById('pause-menu'),
  hud:            document.getElementById('hud'),
  confettiLayer:  document.getElementById('confetti-layer'),
  scoreSpan:      document.getElementById('current-score'),
  finalScoreSpan: document.getElementById('final-score'),
  startBtn:       document.getElementById('start-btn'),
  restartBtn:     document.getElementById('restart-btn'),
  resumeBtn:      document.getElementById('resume-btn'),
  quitBtn:        document.getElementById('quit-btn'),
  pauseBtn:       document.getElementById('pause-btn'),

  showHUD(show) {
    this.hud.classList.toggle('hidden', !show);
    this.pauseBtn.classList.toggle('hidden', !show);
    const sc = document.getElementById('sound-controls');
    if (sc) sc.style.display = show ? 'none' : '';
  },
  updateScore(score) {
    this.scoreSpan.innerText      = score;
    this.finalScoreSpan.innerText = score;
  },
  showGameOver(score) {
    this.gameOver.classList.remove('hidden');
    this.hud.classList.add('hidden');
    this.pauseMenu.classList.add('hidden');
    this.pauseBtn.classList.add('hidden');
    const sc = document.getElementById('sound-controls');
    if (sc) sc.style.display = '';
  },
  showPause(show) {
    this.pauseMenu.classList.toggle('hidden', !show);
    this.pauseBtn.classList.toggle('hidden', show);
    const sc = document.getElementById('sound-controls');
    if (sc) sc.style.display = show ? '' : 'none';
  },
  hideOverlays() {
    this.menu.classList.add('hidden');
    this.gameOver.classList.add('hidden');
    this.pauseMenu.classList.add('hidden');
  },
  showConfetti() {
    burstConfetti(this.confettiLayer, 360);
  }
};

const game = new Game(canvas, ui);

// ── Flap input ───────────────────────────────────────────────────
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
    game.handleInput();
  }
  // Escape / P → toggle pause
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (game.state === 'PLAYING') {
      game.pause();
      if (!isMuted) music.pause();
    } else if (game.state === 'PAUSED') {
      game.resume();
      if (!isMuted) music.play().catch(() => {});
    }
  }
});

window.addEventListener('pointerdown', (e) => {
  // Only flap if the interaction isn't on a UI button
  if (e.target.closest('button')) return;

  // Prevent page gestures (scroll/zoom) from stealing touches on mobile.
  if (e.pointerType === 'touch') {
    e.preventDefault();
  }

  game.handleInput();
}, { passive: false });

ui.startBtn.addEventListener('click', () => {
  ui.hideOverlays();
  game.start();
});

ui.restartBtn.addEventListener('click', () => {
  ui.hideOverlays();
  game.start();
});

// Pause button in HUD
ui.pauseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  game.pause();
  if (!isMuted) music.pause();
});

// Resume button in pause overlay
ui.resumeBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  game.resume();
  if (!isMuted) music.play().catch(() => {});
});

// Quit button — return to main menu
ui.quitBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  game.state = 'MENU';
  ui.hideOverlays();
  ui.showHUD(false);
  ui.menu.classList.remove('hidden');
  music.pause();
  music.currentTime = 0;
});

// ── Music & Sound ──────────────────────────────────────
const music = document.getElementById('bg-music');
const soundBtn = document.getElementById('sound-btn');
const volumeSlider = document.getElementById('volume-slider');

music.volume = 0.5;

let musicStarted = false;
let isMuted = false;
let previousVolume = 0.5;

function updateSoundBtn() {
  soundBtn.textContent = isMuted ? '🔇' : '🔊';
  soundBtn.classList.toggle('muted', isMuted);
}

function setVolumeFromSlider() {
  const nextVolume = Math.max(0, Math.min(1, Number(volumeSlider.value) / 100));
  music.volume = nextVolume;

  if (nextVolume <= 0) {
    isMuted = true;
    music.muted = true;
    music.pause();
  } else {
    isMuted = false;
    music.muted = false;
    previousVolume = nextVolume;
    if (musicStarted && game.state === 'PLAYING') {
      music.play().catch(() => {});
    }
  }

  updateSoundBtn();
}

soundBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (isMuted || Number(volumeSlider.value) === 0) {
    volumeSlider.value = String(Math.max(1, Math.round(previousVolume * 100)));
    setVolumeFromSlider();
  } else {
    previousVolume = music.volume > 0 ? music.volume : previousVolume;
    volumeSlider.value = '0';
    setVolumeFromSlider();
  }
  if (!isMuted && musicStarted && game.state === 'PLAYING') {
    music.play().catch(() => {});
  }
});

volumeSlider.addEventListener('input', (e) => {
  e.stopPropagation();
  setVolumeFromSlider();
});

// Initialize icon + mute state from slider's initial value
setVolumeFromSlider();

// Wrap gameOver to stop music
const _originalGameOver = game.gameOver.bind(game);
game.gameOver = function() {
  _originalGameOver();
  music.pause();
  music.currentTime = 0;
};

// Wrap start to restart music
const _originalStart = game.start.bind(game);
game.start = function() {
  _originalStart();
  music.currentTime = 0;
  if (!isMuted) {
    music.play().catch(() => {});
    musicStarted = true;
  }
};

// First interaction starts music
function startMusicOnce() {
  if (!musicStarted && !isMuted) {
    music.play().catch(() => {});
    musicStarted = true;
  }
}
window.addEventListener('keydown', startMusicOnce, { once: true });

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('[main] service worker registration failed', err);
    });
  });
}

// Asset Loading
async function loadAssets() {
  // ── Regular image assets ────────────────────────────────────────────────
  const imageAssets = [
    { name: 'player',   src: './public/assets/bee.jpg' },
    { name: 'obstacle', src: './public/assets/Pipe.JPG' }
  ];

  imageAssets.forEach((asset) => {
    void new Promise((resolve) => {
      const img = new Image();
      img.src = asset.src;
      img.onload = () => {
        console.log(`Loaded asset: ${asset.name}`);

        // Keep sprite/pipes transparent as soon as they load.
        try {
          const noBg = removeWhiteBackground(img);
          game.setAsset(asset.name, cropToContent(noBg));
        } catch (e) {
          console.warn(`[main] post-process failed for ${asset.name}`, e);
          game.setAsset(asset.name, img);
        }

        resolve();
      };
      img.onerror = () => {
        console.error(`Failed to load: ${asset.src}`);
        resolve();
      };
    });
  });

  const loadGifBackground = async () => {
    // Fast path: draw GIF as a static image first so menu has instant background.
    const staticGif = new Image();
    staticGif.src = './public/assets/bg.gif';
    staticGif.onload = () => {
      game.setAsset('background', staticGif);
    };

    try {
      const animator = new GifAnimator();
      await animator.load('./public/assets/bg.gif');
      if (animator.ready) {
        animator.playbackRate = 0.5;
        console.log('[main] GIF background loaded');
        game.setAsset('backgroundAnimator', animator);
      } else {
        console.warn('[main] GIF loaded but has no frames');
      }
    } catch (e) {
      console.warn('[main] GIF load failed', e);
    }
  };

  // Load heavy background GIF lazily; static fallback appears quickly.
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(() => {
      void loadGifBackground();
    }, { timeout: 1200 });
  } else {
    setTimeout(() => {
      void loadGifBackground();
    }, 0);
  }
}

// Start rendering immediately; assets stream in progressively.
game.loop();
void loadAssets();
