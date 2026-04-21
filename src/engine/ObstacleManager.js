export class ObstacleManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.obstacles = [];
    this.width = 150;
    this.speed = 4.5;
    this.maxSpeed = 9;
    this.minSpawnDistance = 240;
    this.maxSpawnDistance = 340;
    this.spawnTimer = 0;
    this.spawnDistance = this._randomSpawnDistance();
    this.minGap = 210;
    this.maxGap = 315;
    this.passableMinGap = 190;
    this.tightGapChance = 0.34;
    this.minY = 60;

    // Challenge sequence tracking (6-7 same pipes in a row, rare after level 20)
    this.currentScore = 0;
    this.inSequence = false;
    this.sequenceType = null;
    this.sequenceCount = 0;
    this.sequenceLength = 0;
    this.sequenceTopH = 0;
    this.sequenceGap = 0;
    this.sequenceEnded = false;
    this.sequencePendingSpawns = 0;
    this.sequenceCooldown = 0;

    this.accelerationStartScore = 50;
  }

  _isMobileLayout() {
    return this.canvas.width <= 900 || this.canvas.height > this.canvas.width;
  }

  _getSpeedSettings() {
    if (this._isMobileLayout()) {
      return {
        startSpeed: 2.7,
        maxSpeed: 6.0,
        acceleration: 0.0011
      };
    }

    return {
      startSpeed: 3,
      maxSpeed: 7.5,
      acceleration: 0.0012
    };
  }

  _randomSpawnDistance() {
    const minDist = this.minSpawnDistance;
    const maxDist = this.maxSpawnDistance;
    return Math.floor(Math.random() * (maxDist - minDist + 1) + minDist);
  }

  _randomGap() {
    const minGap = this.minGap;
    const maxGap = this.maxGap;

    if (Math.random() < this.tightGapChance) {
      const tightMinGap = this.passableMinGap;
      const tightMaxGap = Math.max(tightMinGap + 20, minGap - 20);
      return Math.floor(Math.random() * (tightMaxGap - tightMinGap + 1) + tightMinGap);
    }

    // For regular gaps, bias toward tighter values to avoid rare oversized openings.
    const t = Math.random();
    const biased = t * t;
    return Math.floor(minGap + biased * (maxGap - minGap + 1));
  }

  reset() {
    this.obstacles = [];
    this.spawnTimer = 0;
    this.speed = 4.5;
    this.spawnDistance = this._randomSpawnDistance();
    this.currentScore = 0;
    this.inSequence = false;
    this.sequenceCount = 0;
    this.sequenceType = null;
    this.sequenceLength = 0;
    this.sequenceGap = 0;
    this.sequenceEnded = false;
    this.sequencePendingSpawns = 0;
    this.sequenceCooldown = 0;
  }

  spawnInitial() {
    // Skip the first pipe, let the game start cleanly
    // First pipe will spawn naturally when spawnTimer reaches spawnDistance
    this.spawnTimer = 0;
    this.spawnDistance = this._randomSpawnDistance();
  }

  _randomType() {
    // Mostly full pairs, but sometimes a single long bottom pipe for variety.
    return Math.random() < 0.22 ? 'bottom-only' : 'full';
  }

  _openingRange(type, topH, gap) {
    if (type === 'bottom-only') {
      return { top: 0, bottom: topH + gap };
    }
    if (type === 'top-only') {
      return { top: topH, bottom: this.canvas.height };
    }
    return { top: topH, bottom: topH + gap };
  }

  _applyTransitionSafety(type, topH, gap, isStuck = false) {
    const prev = this.obstacles[this.obstacles.length - 1];
    if (!prev) return { topH, gap };

    // Final Ease Tuning:
    // Normal: 110, Stuck: 140 (creates a generous common window, scaled down for 600h)
    const minOverlap = isStuck ? 140 : 110;

    const prevRange = this._openingRange(prev.type, prev.topH, prev.gap);
    const currRange = this._openingRange(type, topH, gap);

    const prevCenter = (prevRange.top + prevRange.bottom) / 2;
    let currCenter = (currRange.top + currRange.bottom) / 2;
    const prevSpan = prevRange.bottom - prevRange.top;
    const currSpan = currRange.bottom - currRange.top;

    // 1. Cap the maximum vertical center shift to ensure the jump is physically possible.
    // Final Ease Tuning: 20% limit for normal, 5% limit for stuck (nearly flat transitions)
    const maxShift = isStuck ? this.canvas.height * 0.05 : this.canvas.height * 0.20;
    const rawShift = currCenter - prevCenter;
    if (Math.abs(rawShift) > maxShift) {
      currCenter = prevCenter + Math.sign(rawShift) * maxShift;
    }

    // 2. Ensure minOverlap is respected by placing centers close enough.
    const maxCenterDist = Math.max(0, (prevSpan + currSpan) / 2 - minOverlap);
    const centerDist = currCenter - prevCenter;

    if (Math.abs(centerDist) > maxCenterDist) {
      currCenter = prevCenter + Math.sign(centerDist || 1) * maxCenterDist;
    }

    // Map the resolved center back to topH/gap
    if (type === 'bottom-only') {
      // bottom-only opening is [0, topH + gap], so center = (topH + gap)/2
      const openBottom = Math.max(100, currCenter * 2);
      topH = openBottom - gap;
    } else if (type === 'full') {
      const minTop = this.minY;
      const maxTop = Math.max(minTop, this.canvas.height - gap - this.minY);
      const candidateTop = Math.round(currCenter - gap / 2);
      topH = Math.max(minTop, Math.min(maxTop, candidateTop));
    }

    return { topH, gap };
  }

  spawn() {
    // ── Challenge Sequence (Stuck Pipes) ──────────────────────────
    if (this.inSequence) {
      this.sequenceCount++;
      if (this.sequenceCount >= this.sequenceLength) {
        // End sequence
        this.inSequence = false;
        this.sequenceCount = 0;
        this.sequenceType = null;
        this.sequenceLength = 0;
        this.sequenceEnded = true;
        this.sequenceCooldown = 3;
        return;
      }

      // Spawn a new DIFFERENT pipe but as part of the sequence (effectiveSpawnDistance handles 'stuck')
      let gap = this._randomGap();
      const maxTopH = this.canvas.height - gap - this.minY;
      let rawTopH = Math.floor(Math.random() * (maxTopH - this.minY + 1) + this.minY);

      const safe = this._applyTransitionSafety('full', rawTopH, gap, true);

      this.obstacles.push({
        x: this.canvas.width,
        topH: safe.topH,
        gap: safe.gap,
        type: 'full',
        passed: false
      });
      return;
    }

    // Check if we should start a new challenge sequence
    // Trigger after 20+ points with a small random chance, but guarantee it after a few normal spawns.
    if (this.sequenceCooldown > 0) {
      this.sequenceCooldown--;
    } else if (this.currentScore >= 20) {
      this.sequencePendingSpawns++;
      // Start challenge sequence
      this.inSequence = true;
      this.sequenceCount = 0;
      this.sequenceType = 'full';
      this.sequenceLength = Math.random() < 0.5 ? 6 : 8; // Slightly longer sequences
      this.sequencePendingSpawns = 0;

      // Generate first pipe of the sequence
      let gap = this._randomGap();
      const maxTopH = this.canvas.height - gap - this.minY;
      let topH = Math.floor(Math.random() * (maxTopH - this.minY + 1) + this.minY);

      // (No safety needed for the first pipe in an isolated spawn)

      this.obstacles.push({
        x: this.canvas.width,
        topH: topH,
        gap: gap,
        type: 'full',
        passed: false
      });
      return;
    } else {
      this.sequencePendingSpawns = 0;
    }

    // Normal spawn
    const type = this._randomType();

    let topH, gap;

    if (type === 'full') {
      // Normal: random gap anywhere vertically
      gap = this._randomGap();
      const maxTopH = this.canvas.height - gap - this.minY;
      if (maxTopH <= this.minY) {
        topH = Math.max(40, Math.floor((this.canvas.height - gap) / 2));
      } else {
        topH = Math.floor(Math.random() * (maxTopH - this.minY + 1) + this.minY);
      }

      const adjusted = this._applyTransitionSafety(type, topH, gap, false);
      topH = adjusted.topH;
      gap = adjusted.gap;

    } else if (type === 'bottom-only') {
      // Only bottom pipe — make it as tall as possible.
      // Opening is the free space at the very TOP.
      // bottomY = topH + gap = entryY (where the pipe surface starts)
      const opening = Math.floor(Math.random() * 80 + 240); // 240–320 px opening at top
      gap = this._randomGap(); // gap value is still needed for the formula
      topH = opening - gap;     // may be negative — that's intentional (no top pipe drawn)

      const adjusted = this._applyTransitionSafety(type, topH, gap, false);
      topH = adjusted.topH;
      gap = adjusted.gap;

    } else {
      // type === 'top-only' — only top pipe, as tall as possible.
      // Opening is the free space at the very BOTTOM.
      // topH = where the top pipe ends (= exitY)
      const opening = Math.floor(Math.random() * 80 + 240); // 240–320 px opening at bottom
      gap = this._randomGap();
      topH = this.canvas.height - opening; // pipe fills screen from top down to here
    }

    this.obstacles.push({
      x: this.canvas.width,
      topH: topH,
      gap: gap,
      type: type,
      passed: false
    });
  }

  update(onScore, score = 0) {
    this.currentScore = score;
    this.spawnTimer += this.speed;

    // During sequence, use tight spacing (pipes completely touching - no gap)
    let effectiveSpawnDistance = this.spawnDistance;
    if (this.inSequence) {
      effectiveSpawnDistance = this.width;  // Pipes completely touching, no visual gap
    }

    if (this.spawnTimer >= effectiveSpawnDistance) {
      this.spawn();
      this.spawnTimer = 0;
      if (!this.inSequence) {
        const sequenceEndBoost = this.sequenceEnded ? this.width + 80 : 0;
        this.spawnDistance = this._randomSpawnDistance() + sequenceEndBoost;
        this.sequenceEnded = false;
      }
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= this.speed;

      // Scoring
      if (!obs.passed && obs.x + this.width < this.canvas.width / 4) {
        obs.passed = true;
        onScore();
      }

      // Remove off-screen
      if (obs.x + this.width < 0) {
        this.obstacles.splice(i, 1);
      }
    }

    // Start accelerating only after score/distance reaches the configured threshold.
    if (this.currentScore >= this.accelerationStartScore) {
      this.speed = Math.min(this.maxSpeed, this.speed + 0.002);
    }
  }

  checkCollision(player) {
    for (const obs of this.obstacles) {
      const margin = 4;
      const pLeft = player.x - player.width / 2 + margin;
      const pRight = player.x + player.width / 2 - margin;
      const pTop = player.y - player.height / 2 + margin;
      const pBottom = player.y + player.height / 2 - margin;

      const oLeft = obs.x + margin;
      const oRight = obs.x + this.width - margin;

      if (pRight > oLeft && pLeft < oRight) {
        // Top pipe collision (only for 'full' and 'top-only')
        if (obs.type !== 'bottom-only' && pTop < obs.topH) return true;
        // Bottom pipe collision (only for 'full' and 'bottom-only')
        if (obs.type !== 'top-only' && pBottom > obs.topH + obs.gap) return true;
      }
    }
    return false;
  }

  draw(ctx, pipeImage) {
    for (const obs of this.obstacles) {
      const bottomY = obs.topH + obs.gap;
      const bottomH = this.canvas.height - bottomY;

      // Top pipe (absent for 'bottom-only' obstacles)
      if (obs.type !== 'bottom-only') {
        this.drawPipe(ctx, obs.x, 0, this.width, obs.topH, true, pipeImage);
      }
      // Bottom pipe (absent for 'top-only' obstacles)
      if (obs.type !== 'top-only') {
        this.drawPipe(ctx, obs.x, bottomY, this.width, bottomH, false, pipeImage);
      }
    }
  }

  // Pre-slice the pipe image into cap and tileable body (called once)
  _buildPipeAssets(image) {
    if (this._pipeAssetsReady) return;
    const iw = image.width;
    const ih = image.height;

    // Cap = top 42% of image (the rim/flared section)
    const capSrcH = Math.floor(ih * 0.42);
    const capCanvas = document.createElement('canvas');
    capCanvas.width = iw;
    capCanvas.height = capSrcH;
    capCanvas.getContext('2d').drawImage(image, 0, 0, iw, capSrcH, 0, 0, iw, capSrcH);
    this._capCanvas = capCanvas;

    // Body tile = a 24px slice taken from the lower half of the image
    const bodySliceY = Math.floor(ih * 0.68);
    const bodySliceH = Math.min(24, ih - bodySliceY);
    const bodyCanvas = document.createElement('canvas');
    bodyCanvas.width = iw;
    bodyCanvas.height = bodySliceH;
    bodyCanvas.getContext('2d').drawImage(image, 0, bodySliceY, iw, bodySliceH, 0, 0, iw, bodySliceH);
    this._bodyCanvas = bodyCanvas;

    this._pipeAssetsReady = true;
  }

  drawPipe(ctx, x, y, w, h, isTop, image) {
    if (h <= 0) return;

    if (!image) {
      ctx.fillStyle = '#db2777';
      ctx.fillRect(x, y, w, h);
      return;
    }

    this._buildPipeAssets(image);

    const CAP_H = Math.min(56, h); // fixed cap height on screen
    const bodyH = h - CAP_H;

    if (isTop) {
      // Top pipe: body starts at y=0, cap sits at the bottom (near the gap)
      // Tile body from y=0 downward so the tiling seam is always at the top (off-screen / hidden)
      if (bodyH > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, w, bodyH);
        ctx.clip();

        const bc = this._bodyCanvas;
        const tileH = bc.height;
        // Start tiling from the gap end (capY) upward so seams go offscreen
        let drawn = 0;
        while (drawn < bodyH) {
          const drawH = Math.min(tileH, bodyH - drawn);
          ctx.drawImage(bc, 0, 0, bc.width, drawH, x, y + bodyH - drawn - drawH, w, drawH);
          drawn += drawH;
        }
        ctx.restore();
      }

      // Cap at bottom of top pipe (flipped to point downward into gap)
      const capY = y + bodyH;
      const cc = this._capCanvas;
      ctx.save();
      ctx.translate(x, capY + CAP_H);
      ctx.scale(1, -1);
      ctx.drawImage(cc, 0, 0, cc.width, cc.height, 0, 0, w, CAP_H);
      ctx.restore();

    } else {
      // Bottom pipe: cap at TOP (pointing upward into gap), body below
      // Tile body from below the cap downward so seams go off the bottom
      const capY = y;
      const bodyY = y + CAP_H;

      // Draw cap (normal orientation, pointing upward)
      const cc = this._capCanvas;
      ctx.drawImage(cc, 0, 0, cc.width, cc.height, x, capY, w, CAP_H);

      // Tile body downward from bodyY
      if (bodyH > 0) {
        const bc = this._bodyCanvas;
        const tileH = bc.height;
        let drawn = 0;
        while (drawn < bodyH) {
          const drawH = Math.min(tileH, bodyH - drawn);
          ctx.drawImage(bc, 0, 0, bc.width, drawH, x, bodyY + drawn, w, drawH);
          drawn += drawH;
        }
      }
    }
  }
}
