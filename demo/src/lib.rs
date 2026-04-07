use wasm_bindgen::prelude::*;
use thot_pocket::{CultureProfile, ConversationState, EyeAnimator, GazeEngine, GazeZone};

#[wasm_bindgen]
pub struct WasmEyeOutput {
    pub left_eye_x: f32,
    pub left_eye_y: f32,
    pub right_eye_x: f32,
    pub right_eye_y: f32,
    pub pupil_diameter: f32,
    pub lid_openness: f32,
    pub blinking: bool,
    pub looking_at_user: bool,
    pub upper_lid_offset: f32,
}

#[wasm_bindgen]
pub struct WasmGazeEngine {
    engine: GazeEngine,
    animator: EyeAnimator,
}

#[wasm_bindgen]
impl WasmGazeEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(culture: &str) -> Self {
        let profile = match culture {
            "east_asian" => CultureProfile::east_asian(),
            "middle_eastern" => CultureProfile::middle_eastern(),
            "south_asian" => CultureProfile::south_asian(),
            _ => CultureProfile::western(),
        };
        Self {
            engine: GazeEngine::new(profile),
            animator: EyeAnimator::new(),
        }
    }

    pub fn set_state(&mut self, state: &str) {
        let s = match state {
            "listening" => ConversationState::Listening,
            "thinking" => ConversationState::Thinking,
            "speaking" => ConversationState::Speaking,
            _ => ConversationState::Idle,
        };
        self.engine.set_state(s);
    }

    pub fn user_looking(&mut self, zone: &str) {
        let z = match zone {
            "at_me" => GazeZone::AtMe,
            "down" => GazeZone::Down,
            _ => GazeZone::Away,
        };
        self.engine.user_looking(z);
    }

    pub fn set_culture(&mut self, name: &str) {
        let profile = match name {
            "east_asian" => CultureProfile::east_asian(),
            "middle_eastern" => CultureProfile::middle_eastern(),
            "south_asian" => CultureProfile::south_asian(),
            _ => CultureProfile::western(),
        };
        self.engine.set_culture(profile);
    }

    pub fn set_head_velocity(&mut self, x: f32, y: f32) {
        self.animator.set_head_velocity(glam::Vec2::new(x, y));
    }

    pub fn tick(&mut self, dt: f32) -> WasmEyeOutput {
        let gaze = self.engine.tick(dt);
        let eyes = self.animator.tick(dt, &gaze);
        WasmEyeOutput {
            left_eye_x: eyes.left_eye.x,
            left_eye_y: eyes.left_eye.y,
            right_eye_x: eyes.right_eye.x,
            right_eye_y: eyes.right_eye.y,
            pupil_diameter: eyes.pupil_diameter,
            lid_openness: eyes.lid_openness,
            blinking: eyes.blinking,
            looking_at_user: gaze.looking_at_user,
            upper_lid_offset: eyes.upper_lid_offset,
        }
    }
}
