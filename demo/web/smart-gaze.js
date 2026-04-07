// Thot Pocket gaze controller: WASM engine bridge.
export class SmartGaze {
  constructor(wasmEngine) {
    this.engine = wasmEngine;
    this.lastZone = 'away';
  }

  setMediaPipeZone(zone) {
    if (zone !== this.lastZone) {
      this.engine.user_looking(zone);
      this.lastZone = zone;
    }
  }

  setState(state) {
    this.engine.set_state(state);
  }

  setCulture(name) {
    this.engine.set_culture(name);
  }

  tick(dt) {
    const out = this.engine.tick(dt);
    const result = {
      leftX: out.left_eye_x,
      leftY: out.left_eye_y,
      rightX: out.right_eye_x,
      rightY: out.right_eye_y,
      pupilDiameter: out.pupil_diameter,
      lidOpenness: out.lid_openness,
      blinking: out.blinking,
      lookingAtUser: out.looking_at_user,
      upperLidOffset: out.upper_lid_offset,
    };
    out.free();
    return result;
  }
}
