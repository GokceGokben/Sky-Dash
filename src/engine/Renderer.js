export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    
    // Offscreen buffer to cache the latest video frame
    this.videoBuffer = document.createElement('canvas');
    this.videoBufferCtx = this.videoBuffer.getContext('2d');
    this.hasCachedFrame = false;

    // Cached frame from loop start used for subtle end-to-start crossfade.
    this.loopStartBuffer = document.createElement('canvas');
    this.loopStartBufferCtx = this.loopStartBuffer.getContext('2d');
    this.hasLoopStartFrame = false;

    this.bgScrollX = 0;
    this.lastBgTime = null;
  }

  clear() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw background — static position, but animated if a GifAnimator is provided.
   * The animator advances its internal frame each call; we just drawImage the result.
   */
  drawBackground(bgImage, bgVideo, bgAnimator, bgScrollSpeed = 0.4, animateBackground = true) {
    const W = this.canvas.width;
    const H = this.canvas.height;

    // ── Animated GIF background (bg.gif) ──────────────────────────────
    if (bgAnimator?.ready && bgAnimator.currentCanvas) {
      if (animateBackground) {
        bgAnimator.update();
      } else {
        bgAnimator.syncClock();
      }
      const frame = bgAnimator.currentCanvas;

      const now = performance.now();
      if (this.lastBgTime === null || !animateBackground) this.lastBgTime = now;
      const deltaFrames = animateBackground ? (now - this.lastBgTime) / 16.67 : 0;
      this.lastBgTime = now;

      const tileW = Math.max(1, Math.round((frame.width / frame.height) * H));
      this.bgScrollX = (this.bgScrollX + bgScrollSpeed * deltaFrames) % tileW;

      const startX = -this.bgScrollX;
      this.ctx.save();
      this.ctx.imageSmoothingEnabled = false;
      for (let x = startX - tileW; x < W + tileW; x += tileW) {
        this.ctx.drawImage(frame, x, 0, tileW, H);
      }
      this.ctx.restore();
      return;
    }

    // ── MP4 Video background ──────────────────
    if (bgVideo) {
      const loopStartTime = 0.5;
      const loopBlendWindow = 0.9;

      // 2. Cache the frame when the video has data
      const vW = bgVideo.videoWidth;
      const vH = bgVideo.videoHeight;

      if (vW > 0 && vH > 0 && bgVideo.readyState >= 2) {
        if (this.videoBuffer.width !== vW) {
          this.videoBuffer.width = vW;
          this.videoBuffer.height = vH;
          this.loopStartBuffer.width = vW;
          this.loopStartBuffer.height = vH;
          this.hasLoopStartFrame = false;
        }
        this.videoBufferCtx.drawImage(bgVideo, 0, 0, vW, vH);
        this.hasCachedFrame = true;

        // Cache the frame around loop start so we can blend into it near video end.
        if (
          !this.hasLoopStartFrame &&
          bgVideo.currentTime >= loopStartTime - 0.05 &&
          bgVideo.currentTime <= loopStartTime + 0.25
        ) {
          this.loopStartBufferCtx.drawImage(bgVideo, 0, 0, vW, vH);
          this.hasLoopStartFrame = true;
        }
      }

      // 3. Draw from the cached frame to guarantee no blackouts during seek delays
      if (this.hasCachedFrame) {
        // Uniform crop to keep aspect ratio while trimming watermark-prone edges.
        const srcW = this.videoBuffer.width * 0.9;
        const srcH = this.videoBuffer.height * 0.9;
        const srcX = (this.videoBuffer.width - srcW) / 2;
        const srcY = (this.videoBuffer.height - srcH) / 2;
        const srcAspect = srcW / srcH;
        const dstAspect = W / H;
        let cropW = srcW;
        let cropH = srcH;
        let cropX = srcX;
        let cropY = srcY;

        // Always full-cover canvas without letterboxing.
        if (srcAspect > dstAspect) {
          cropW = srcH * dstAspect;
          cropX = srcX + (srcW - cropW) / 2;
        } else {
          cropH = srcW / dstAspect;
          cropY = srcY + (srcH - cropH) / 2;
        }

        // Mobile portrait: slight horizontal emphasis to reduce vertical feel.
        const mobilePortrait = H > W;
        const drawW = mobilePortrait ? W * 1.08 : W;
        const drawX = mobilePortrait ? (W - drawW) / 2 : 0;

        this.ctx.drawImage(this.videoBuffer, cropX, cropY, cropW, cropH, drawX, 0, drawW, H);

        // Subtle blend from end back to beginning to hide the loop seam.
        if (bgVideo.duration && this.hasLoopStartFrame) {
          const blendStart = bgVideo.duration - loopBlendWindow;
          if (bgVideo.currentTime >= blendStart) {
            const t = Math.min(1, Math.max(0, (bgVideo.currentTime - blendStart) / loopBlendWindow));
            this.ctx.save();
            this.ctx.globalAlpha = t * 0.85;
            this.ctx.drawImage(this.loopStartBuffer, cropX, cropY, cropW, cropH, drawX, 0, drawW, H);
            this.ctx.restore();
          }
        }

        // Once blending has mostly completed, jump to loop start point.
        if (bgVideo.duration && bgVideo.currentTime >= bgVideo.duration - 0.03) {
          bgVideo.currentTime = loopStartTime;
        }

        return;
      }
    }

    // ── Static fallback image ─────────────────────────────────────────────
    if (bgImage) {
      this.ctx.drawImage(bgImage, 0, 0, W, H);
      return;
    }

    // ── Procedural gradient fallback ──────────────────────────────────────
    const grad = this.ctx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#1e1040');
    grad.addColorStop(0.55, '#0f172a');
    grad.addColorStop(1, '#0a0f24');
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, W, H);
  }

  draw(player, obstacleManager, assets, bgScrollSpeed, animateBackground) {
    this.clear();
    this.drawBackground(
      assets.background,
      assets.backgroundVideo,
      assets.backgroundAnimator,
      bgScrollSpeed,
      animateBackground
    );
    obstacleManager.draw(this.ctx, assets.obstacle);
    player.draw(this.ctx, assets.player);
  }
}
