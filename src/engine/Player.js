export class Player {
  constructor(canvas) {
    this.canvas = canvas;
    this.width = 65;
    this.height = 50;
    this.reset();
    
    this.gravity = 0.6;
    this.jumpStrength = -10;
    this.maxVelocity = 15;
    this.rotation = 0;
  }

  reset() {
    this.x = this.canvas.width / 4;
    this.y = this.canvas.height / 2;
    this.velocity = 0;
    this.rotation = 0;
    this.isDead = false;
  }

  flap() {
    if (this.isDead) return;
    this.velocity = this.jumpStrength;
  }

  update() {
    if (this.isDead) return;

    this.velocity += this.gravity;
    if (this.velocity > this.maxVelocity) this.velocity = this.maxVelocity;
    
    this.y += this.velocity;

    // Rotation based on velocity
    this.rotation = Math.min(Math.PI / 4, Math.max(-Math.PI / 4, (this.velocity / 20) * (Math.PI / 2)));

    // Floor — stop the bee, don't die (game over only from pipes)
    if (this.y + this.height / 2 > this.canvas.height) {
      this.y = this.canvas.height - this.height / 2;
      this.velocity = 0;
    }
    if (this.y - this.height / 2 < 0) {
      this.y = this.height / 2;
      this.velocity = 0;
    }
  }

  die() {
    this.isDead = true;
  }

  draw(ctx, birdImage) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    if (birdImage) {
      // Draw image if loaded
      ctx.drawImage(birdImage, -this.width / 2, -this.height / 2, this.width, this.height);
    } else {
      // Fallback: Aesthetic teardrop/bird shape if image fails
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.width/2, this.height/2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    
    ctx.restore();
  }
}
