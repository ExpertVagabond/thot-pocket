// "Industry standard" avatar gaze: constant stare, metronome blinks, no life.
export class DumbGaze {
  constructor() {
    this.blinkTimer = 0;
    this.blinkInterval = 4.0; // exact 15/min, no variation
    this.blinkPhase = 'open';
    this.blinkProgress = 0;
  }

  tick(dt) {
    let lidOpenness = 1.0;
    let blinking = false;

    switch (this.blinkPhase) {
      case 'open':
        this.blinkTimer += dt;
        if (this.blinkTimer >= this.blinkInterval) {
          this.blinkPhase = 'closing';
          this.blinkProgress = 0;
          this.blinkTimer = 0;
        }
        break;
      case 'closing':
        this.blinkProgress += dt / 0.1; // symmetric 100ms (wrong — real is 75ms)
        blinking = true;
        lidOpenness = 1 - this.blinkProgress;
        if (this.blinkProgress >= 1) {
          this.blinkPhase = 'opening';
          this.blinkProgress = 0;
        }
        break;
      case 'opening':
        this.blinkProgress += dt / 0.1; // symmetric 100ms (wrong — real is 150ms)
        blinking = true;
        lidOpenness = this.blinkProgress;
        if (this.blinkProgress >= 1) {
          this.blinkPhase = 'open';
          this.blinkProgress = 0;
        }
        break;
    }

    return {
      leftX: 0,      // constant stare — no movement
      leftY: 0,
      rightX: 0,
      rightY: 0,
      pupilDiameter: 3.5,  // fixed, no variation
      lidOpenness: Math.max(0, Math.min(1, lidOpenness)),
      blinking,
      lookingAtUser: true,  // always staring
      upperLidOffset: 0,
    };
  }
}
