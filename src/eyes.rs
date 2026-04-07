use glam::Vec2;
use rand::Rng;

use crate::gaze::{AversionDirection, GazeOutput};

/// Output from the procedural eye animation engine per tick.
/// Feed these values directly into your avatar renderer.
#[derive(Debug, Clone, Copy)]
pub struct EyeOutput {
    /// Left eye gaze direction offset from forward (degrees, x=yaw y=pitch).
    pub left_eye: Vec2,
    /// Right eye gaze direction offset from forward (degrees, x=yaw y=pitch).
    pub right_eye: Vec2,
    /// Pupil diameter in mm (2.0–8.0).
    pub pupil_diameter: f32,
    /// Eyelid openness (0.0=closed, 1.0=fully open).
    pub lid_openness: f32,
    /// True if a blink is currently in progress.
    pub blinking: bool,
    /// Upper lid vertical offset tracking gaze pitch.
    pub upper_lid_offset: f32,
}

/// Layer 3: Procedural eye animation engine.
///
/// Generates biologically plausible eye micro-movements at 60Hz:
/// saccades, micro-saccades, blinks, VOR, pupil dilation, vergence,
/// and the triangle scan pattern.
pub struct EyeAnimator {
    // Micro-saccade state
    microsaccade_timer: f32,
    microsaccade_offset: Vec2,

    // Blink state
    blink_timer: f32,
    next_blink_at: f32,
    blink_phase: BlinkPhase,
    blink_progress: f32,

    // Saccade state (for triangle scanning and aversion targets)
    current_target: Vec2,
    saccade_origin: Vec2,
    saccade_progress: f32,
    saccade_duration: f32,
    in_saccade: bool,

    // Triangle scan
    triangle_index: usize,
    triangle_timer: f32,

    // Pupil
    pupil_diameter: f32,
    pupil_target: f32,

    // VOR
    head_velocity: Vec2,

    // Vergence
    vergence_offset: f32,

    rng: rand::rngs::ThreadRng,
}

#[derive(Debug, Clone, Copy, PartialEq)]
enum BlinkPhase {
    Open,
    Closing,
    Closed,
    Opening,
}

impl EyeAnimator {
    pub fn new() -> Self {
        let mut rng = rand::thread_rng();
        Self {
            microsaccade_timer: 0.0,
            microsaccade_offset: Vec2::ZERO,
            blink_timer: 0.0,
            next_blink_at: rng.gen_range(3.0..5.0),
            blink_phase: BlinkPhase::Open,
            blink_progress: 0.0,
            current_target: Vec2::ZERO,
            saccade_origin: Vec2::ZERO,
            saccade_progress: 1.0,
            saccade_duration: 0.05,
            in_saccade: false,
            triangle_index: 0,
            triangle_timer: 0.0,
            pupil_diameter: 3.5,
            pupil_target: 3.5,
            head_velocity: Vec2::ZERO,
            vergence_offset: 0.0,
            rng,
        }
    }

    /// Set current head angular velocity for VOR compensation (degrees/sec).
    pub fn set_head_velocity(&mut self, velocity: Vec2) {
        self.head_velocity = velocity;
    }

    /// Set target pupil diameter (2.0–8.0mm). Use for cognitive load / emotion.
    pub fn set_pupil_target(&mut self, diameter: f32) {
        self.pupil_target = diameter.clamp(2.0, 8.0);
    }

    /// Advance animation by `dt` seconds. Call at 60Hz.
    pub fn tick(&mut self, dt: f32, gaze: &GazeOutput) -> EyeOutput {
        self.update_blink(dt, gaze);
        self.update_microsaccades(dt);
        self.update_saccade(dt);
        self.update_triangle_scan(dt, gaze);
        self.update_pupil(dt, gaze);

        let base_target = self.compute_base_target(gaze);

        // Advance saccade toward target if needed.
        let eye_dir = if self.in_saccade {
            self.saccade_interpolate()
        } else {
            base_target
        };

        // Apply micro-saccade noise.
        let with_noise = eye_dir + self.microsaccade_offset;

        // VOR compensation: counter-rotate eyes against head movement.
        // Gain ~1.0 (eyes move equal and opposite to head).
        let vor = -self.head_velocity * dt * 0.95;
        let final_gaze = with_noise + vor;

        // Vergence: slight inward rotation for near focus.
        let left_eye = final_gaze + Vec2::new(-self.vergence_offset, 0.0);
        let right_eye = final_gaze + Vec2::new(self.vergence_offset, 0.0);

        // Lid tracking: upper lid follows vertical gaze.
        let upper_lid_offset = final_gaze.y * 0.5;

        let lid_openness = match self.blink_phase {
            BlinkPhase::Open => 1.0,
            BlinkPhase::Closing => 1.0 - self.blink_progress,
            BlinkPhase::Closed => 0.0,
            BlinkPhase::Opening => self.blink_progress,
        };

        EyeOutput {
            left_eye,
            right_eye,
            pupil_diameter: self.pupil_diameter,
            lid_openness,
            blinking: self.blink_phase != BlinkPhase::Open,
            upper_lid_offset,
        }
    }

    fn compute_base_target(&mut self, gaze: &GazeOutput) -> Vec2 {
        if gaze.looking_at_user {
            // Triangle scan: left eye → right eye → mouth.
            self.triangle_target()
        } else if let Some(dir) = gaze.aversion {
            aversion_to_degrees(dir)
        } else {
            Vec2::ZERO
        }
    }

    /// The social gaze triangle (left eye → right eye → mouth) at 2-4Hz.
    fn triangle_target(&self) -> Vec2 {
        const TARGETS: [Vec2; 3] = [
            Vec2::new(-1.5, 0.5),  // left eye
            Vec2::new(1.5, 0.5),   // right eye
            Vec2::new(0.0, -1.0),  // mouth
        ];
        TARGETS[self.triangle_index % 3]
    }

    fn update_triangle_scan(&mut self, dt: f32, gaze: &GazeOutput) {
        if !gaze.looking_at_user {
            return;
        }
        self.triangle_timer += dt;
        // Scan at 2-4Hz → switch every 0.25-0.5s.
        let interval = 0.25 + (self.triangle_index as f32 * 0.1) % 0.25;
        if self.triangle_timer >= interval {
            self.triangle_timer = 0.0;
            let prev_index = self.triangle_index;
            self.triangle_index = (self.triangle_index + 1) % 3;

            // Trigger saccade to new triangle point.
            let new_target = self.triangle_target();
            if !self.in_saccade {
                self.start_saccade(new_target);
            }
            let _ = prev_index; // consumed above
        }
    }

    fn start_saccade(&mut self, target: Vec2) {
        self.saccade_origin = self.current_target;
        self.current_target = target;
        self.saccade_progress = 0.0;
        let amplitude = (target - self.saccade_origin).length();
        // Main sequence: duration scales with amplitude.
        // ~30ms for small saccades, ~80ms for larger ones.
        self.saccade_duration = (0.02 + amplitude * 0.005).clamp(0.02, 0.10);
        self.in_saccade = true;
    }

    /// Ballistic saccade profile (raised cosine, not linear interpolation).
    fn saccade_interpolate(&self) -> Vec2 {
        let t = (self.saccade_progress / self.saccade_duration).clamp(0.0, 1.0);
        // Raised cosine: fast start, overshoot slightly, settle.
        let smooth = 0.5 - 0.5 * (t * std::f32::consts::PI).cos();
        self.saccade_origin.lerp(self.current_target, smooth)
    }

    fn update_saccade(&mut self, dt: f32) {
        if self.in_saccade {
            self.saccade_progress += dt;
            if self.saccade_progress >= self.saccade_duration {
                self.in_saccade = false;
                self.saccade_progress = self.saccade_duration;
            }
        }
    }

    /// Micro-saccades: 0.2-0.5° at 1-2Hz. Eyes are NEVER still.
    fn update_microsaccades(&mut self, dt: f32) {
        self.microsaccade_timer += dt;
        let interval = 0.5 + self.rng.gen_range(0.0..0.5); // 1-2Hz
        if self.microsaccade_timer >= interval {
            self.microsaccade_timer = 0.0;
            let amplitude = self.rng.gen_range(0.1..0.5);
            let angle = self.rng.gen_range(0.0..std::f32::consts::TAU);
            self.microsaccade_offset = Vec2::new(
                angle.cos() * amplitude,
                angle.sin() * amplitude,
            );
        }
        // Drift back slowly between microsaccades.
        self.microsaccade_offset *= 0.98;
    }

    /// Blink model: Poisson process, rate modulated by state.
    /// Blink asymmetry: close ~75ms, hold ~50ms, open ~150ms.
    fn update_blink(&mut self, dt: f32, gaze: &GazeOutput) {
        match self.blink_phase {
            BlinkPhase::Open => {
                self.blink_timer += dt;
                if self.blink_timer >= self.next_blink_at {
                    self.blink_phase = BlinkPhase::Closing;
                    self.blink_progress = 0.0;
                    self.blink_timer = 0.0;
                }
            }
            BlinkPhase::Closing => {
                self.blink_progress += dt / 0.075; // 75ms close
                if self.blink_progress >= 1.0 {
                    self.blink_phase = BlinkPhase::Closed;
                    self.blink_progress = 0.0;
                }
            }
            BlinkPhase::Closed => {
                self.blink_progress += dt / 0.050; // 50ms hold
                if self.blink_progress >= 1.0 {
                    self.blink_phase = BlinkPhase::Opening;
                    self.blink_progress = 0.0;
                }
            }
            BlinkPhase::Opening => {
                self.blink_progress += dt / 0.150; // 150ms open (slower than close)
                if self.blink_progress >= 1.0 {
                    self.blink_phase = BlinkPhase::Open;
                    self.blink_progress = 0.0;
                    self.blink_timer = 0.0;
                    // Schedule next blink. Rate varies by state:
                    // Speaking: 22/min, Listening: 12/min, Baseline: 17/min
                    let rate_per_min = match gaze.state {
                        crate::gaze::ConversationState::Speaking => 22.0,
                        crate::gaze::ConversationState::Listening => 12.0,
                        crate::gaze::ConversationState::Thinking => 17.0,
                        crate::gaze::ConversationState::Idle => 15.0,
                    };
                    let mean_interval = 60.0 / rate_per_min;
                    // Gamma-distributed inter-blink interval.
                    self.next_blink_at =
                        mean_interval * self.rng.gen_range(0.5..1.5);
                }
            }
        }
    }

    /// Pupil dilation: smooth toward target. Constriction fast (~200ms),
    /// dilation slower (~500ms).
    fn update_pupil(&mut self, dt: f32, gaze: &GazeOutput) {
        // Thinking/speaking = slight dilation (cognitive load).
        let cognitive_target = match gaze.state {
            crate::gaze::ConversationState::Thinking => 4.5,
            crate::gaze::ConversationState::Speaking => 4.0,
            crate::gaze::ConversationState::Listening => 3.8,
            crate::gaze::ConversationState::Idle => 3.5,
        };
        // Blend toward cognitive target if no explicit target set.
        let target = if (self.pupil_target - 3.5).abs() < 0.01 {
            cognitive_target
        } else {
            self.pupil_target
        };

        let rate = if target < self.pupil_diameter {
            5.0 // constriction: ~200ms
        } else {
            2.0 // dilation: ~500ms
        };
        self.pupil_diameter += (target - self.pupil_diameter) * rate * dt;
        self.pupil_diameter = self.pupil_diameter.clamp(2.0, 8.0);
    }
}

impl Default for EyeAnimator {
    fn default() -> Self {
        Self::new()
    }
}

fn aversion_to_degrees(dir: AversionDirection) -> Vec2 {
    match dir {
        AversionDirection::UpRight => Vec2::new(10.0, 8.0),
        AversionDirection::UpLeft => Vec2::new(-10.0, 8.0),
        AversionDirection::Right => Vec2::new(12.0, 0.0),
        AversionDirection::Left => Vec2::new(-12.0, 0.0),
        AversionDirection::DownRight => Vec2::new(8.0, -6.0),
        AversionDirection::DownLeft => Vec2::new(-8.0, -6.0),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gaze::ConversationState;

    fn make_gaze(looking: bool, state: ConversationState) -> GazeOutput {
        GazeOutput {
            looking_at_user: looking,
            aversion: if looking {
                None
            } else {
                Some(AversionDirection::UpRight)
            },
            user_weight: if looking { 1.0 } else { 0.0 },
            state,
            episode_elapsed: 0.0,
        }
    }

    #[test]
    fn produces_valid_output() {
        let mut anim = EyeAnimator::new();
        let gaze = make_gaze(true, ConversationState::Listening);
        let out = anim.tick(1.0 / 60.0, &gaze);
        assert!(out.lid_openness >= 0.0 && out.lid_openness <= 1.0);
        assert!(out.pupil_diameter >= 2.0 && out.pupil_diameter <= 8.0);
    }

    #[test]
    fn microsaccades_add_noise() {
        let mut anim = EyeAnimator::new();
        let gaze = make_gaze(true, ConversationState::Listening);
        let mut saw_nonzero = false;
        for _ in 0..120 {
            let out = anim.tick(1.0 / 60.0, &gaze);
            if out.left_eye.length() > 0.01 {
                saw_nonzero = true;
                break;
            }
        }
        assert!(saw_nonzero, "microsaccades should produce non-zero offsets");
    }

    #[test]
    fn blink_occurs_within_reasonable_time() {
        let mut anim = EyeAnimator::new();
        let gaze = make_gaze(true, ConversationState::Idle);
        let mut saw_blink = false;
        // Run for 10 simulated seconds at 60Hz.
        for _ in 0..600 {
            let out = anim.tick(1.0 / 60.0, &gaze);
            if out.blinking {
                saw_blink = true;
                break;
            }
        }
        assert!(saw_blink, "should blink within 10 seconds");
    }

    #[test]
    fn pupil_responds_to_state() {
        let mut anim = EyeAnimator::new();
        let idle_gaze = make_gaze(true, ConversationState::Idle);
        for _ in 0..300 {
            anim.tick(1.0 / 60.0, &idle_gaze);
        }
        let idle_pupil = anim.pupil_diameter;

        let think_gaze = make_gaze(false, ConversationState::Thinking);
        for _ in 0..300 {
            anim.tick(1.0 / 60.0, &think_gaze);
        }
        let think_pupil = anim.pupil_diameter;

        assert!(
            think_pupil > idle_pupil,
            "thinking should dilate pupils: {think_pupil} > {idle_pupil}"
        );
    }

    #[test]
    fn vor_compensates_head_movement() {
        let mut anim = EyeAnimator::new();
        anim.set_head_velocity(Vec2::new(100.0, 0.0)); // head turning right
        let gaze = make_gaze(true, ConversationState::Listening);
        let out = anim.tick(1.0 / 60.0, &gaze);
        // Eyes should counter-rotate left (negative x).
        assert!(
            out.left_eye.x < 0.0,
            "VOR should counter-rotate: got {}",
            out.left_eye.x
        );
    }
}
