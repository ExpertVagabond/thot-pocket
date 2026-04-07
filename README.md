# Thot Pocket

**Eye contact intelligence for AI avatars — the missing layer between seeing and connecting.**

[![Crates.io](https://img.shields.io/crates/v/thot-pocket)](https://crates.io/crates/thot-pocket)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Every AI avatar today gets eyes wrong. Eye contact correction systems (Apple FaceTime, NVIDIA Maxine, Microsoft Teams) create a constant creepy stare. Procedural systems (Audio2Face, D-ID) move eyes randomly — [research proves](https://dl.acm.org/doi/10.1145/642611.642699) random gaze is psychologically worse than no movement at all.

Thot Pocket is the intelligence layer that connects gaze detection to eye animation. It knows **when** to look, **where** to look away, and **how long** to hold.

## Architecture

```
Layer 1: SENSE          Layer 2: THINK              Layer 3: ACT
User gaze detection  →  Conversational state     →  Procedural eye animation
MediaPipe / L2CS-Net    machine (the gap no         Saccades, micro-saccades,
Zone: at me|away|down   one else fills)             blinks, VOR, pupil dilation
                        LISTEN|THINK|SPEAK|IDLE     vergence @ 60Hz
```

## Quick Start

```toml
[dependencies]
thot-pocket = "0.1"
```

```rust
use thot_pocket::{GazeEngine, EyeAnimator, CultureProfile, ConversationState, GazeZone};

// Create the engine with a culture profile
let mut gaze = GazeEngine::new(CultureProfile::western());
let mut eyes = EyeAnimator::new();

// Set conversation state
gaze.set_state(ConversationState::Listening);

// Notify when user is looking at the avatar
gaze.user_looking(GazeZone::AtMe);

// Tick at 60Hz
let dt = 1.0 / 60.0;
let gaze_output = gaze.tick(dt);
let eye_output = eyes.tick(dt, &gaze_output);

// Use eye_output to drive your avatar:
// - eye_output.left_eye / right_eye: gaze direction (degrees)
// - eye_output.pupil_diameter: 2-8mm
// - eye_output.lid_openness: 0.0-1.0
// - eye_output.blinking: bool
```

## The Science

Built on 25+ peer-reviewed sources. Key findings that drive the design:

| Finding | Source | Impact |
|---------|--------|--------|
| Preferred eye contact duration: **3.3 seconds** | Binetti et al. 2016 (N=498, 56 nations) | Max contact episode cap |
| Actual mutual eye contact: **0.36s** per episode | Dual eye-tracking studies | Triangle scan, not eye-lock |
| Random gaze is **worse** than no gaze | Garau et al. 2003 (CHI) | Cognitively-motivated aversion |
| Contingent gaze increases engagement **20-40%** | Admoni & Scassellati 2017 | Responsive mutual gaze |
| **71%** of speaker turns end with direct gaze | Kendon 1967 | Turn-yield signal |
| Eye contact triggers **oxytocin** and prefrontal sync | Hirsch 2017, Nagasawa 2015 | Why eyes matter most |

## Conversational Gaze Model

The state machine allocates gaze differently per conversation phase:

| State | At User | Aversion | Blink Rate |
|-------|---------|----------|------------|
| **Listening** | 70-80% | 20-30%, brief returns | 12/min |
| **Thinking** | 30-50% | Up-right (constructing) or down-left (deliberating) | 17/min |
| **Speaking** | 60-70% | Sideways (word-finding) | 22/min, at phrase boundaries |
| **Idle** | 30-40% | Environmental scan | 15/min |

Aversion directions are **cognitively motivated** (Andrist et al. 2014), not random.

## Culture Profiles

One gaze model fails 70% of the world. Thot Pocket includes 4 presets with `lerp` interpolation:

```rust
let western = CultureProfile::western();       // High contact (60-70%)
let eastern = CultureProfile::east_asian();     // Lower contact (30-50%)
let mideast = CultureProfile::middle_eastern(); // Very high same-gender
let south   = CultureProfile::south_asian();    // Lower with authority

// Blend between profiles
let custom = CultureProfile::lerp(&western, &eastern, 0.3);
```

## Procedural Eye Animation

Layer 3 simulates 7 biomechanical behaviors missing from current avatar systems:

- **Micro-saccades**: 0.2-0.5 deg at 1-2Hz (eyes are never still)
- **Ballistic saccades**: raised-cosine velocity profile (not linear interpolation)
- **VOR**: eyes counter-rotate during head movement
- **Blink model**: asymmetric close/open (75ms/150ms), speech-coupled
- **Pupil dilation**: responds to cognitive load and conversation state
- **Triangle scanning**: left eye -> right eye -> mouth at 2-4Hz
- **Vergence**: independent eye movement for depth

## Training Pipeline

The `train/` directory contains a PyTorch pipeline to learn gaze behavior from data, replacing hand-tuned parameters with patterns learned from real conversations:

- **GazeTransformer**: 4-layer, 128-dim, 3 output heads (look/aversion/duration)
- **Dataset**: [purplesquirrelnetworks/thot-pocket-gaze](https://huggingface.co/datasets/purplesquirrelnetworks/thot-pocket-gaze)
- **Export**: ONNX + raw weight `.bin` files for mmap loading in Rust

```bash
cd train && pip install -r requirements.txt
python train.py --data_path synthetic --epochs 100
```

## Links

- [Full Research Document](RESEARCH.md) — 25+ cited sources, complete findings
- [HuggingFace Dataset](https://huggingface.co/datasets/purplesquirrelnetworks/thot-pocket-gaze) — gaze behavior training data
- [crates.io](https://crates.io/crates/thot-pocket) — Rust package

## License

MIT
