/// Cultural gaze profile — shifts the entire gaze model along a spectrum.
///
/// One monolithic gaze model fails 70% of the world (Thot Pocket Research).
/// This single parameter adapts frequency, duration, aversion patterns,
/// and intensity levels for global deployment.
#[derive(Debug, Clone, Copy)]
pub struct CultureProfile {
    /// Fraction of time speaker looks at listener (0.0–1.0)
    pub speaker_gaze_ratio: f32,
    /// Fraction of time listener looks at speaker (0.0–1.0)
    pub listener_gaze_ratio: f32,
    /// Maximum single eye contact episode duration in seconds
    pub max_contact_secs: f32,
    /// Minimum aversion duration in seconds
    pub min_aversion_secs: f32,
    /// How quickly to meet gaze after detecting user looking (seconds)
    pub gaze_meet_latency: f32,
    /// Idle gaze-at-user ratio
    pub idle_gaze_ratio: f32,
    /// Thinking gaze-at-user ratio
    pub thinking_gaze_ratio: f32,
}

impl CultureProfile {
    /// Western (US/Europe): high contact, direct gaze = confidence.
    pub fn western() -> Self {
        Self {
            speaker_gaze_ratio: 0.65,
            listener_gaze_ratio: 0.75,
            max_contact_secs: 3.2,
            min_aversion_secs: 0.3,
            gaze_meet_latency: 0.3,
            idle_gaze_ratio: 0.35,
            thinking_gaze_ratio: 0.40,
        }
    }

    /// East Asian (Japan/Korea/China): lower contact, prolonged = rude.
    pub fn east_asian() -> Self {
        Self {
            speaker_gaze_ratio: 0.45,
            listener_gaze_ratio: 0.55,
            max_contact_secs: 2.0,
            min_aversion_secs: 0.5,
            gaze_meet_latency: 0.5,
            idle_gaze_ratio: 0.20,
            thinking_gaze_ratio: 0.25,
        }
    }

    /// Middle Eastern (same-gender): very high contact = sincerity.
    pub fn middle_eastern() -> Self {
        Self {
            speaker_gaze_ratio: 0.75,
            listener_gaze_ratio: 0.85,
            max_contact_secs: 4.0,
            min_aversion_secs: 0.2,
            gaze_meet_latency: 0.2,
            idle_gaze_ratio: 0.45,
            thinking_gaze_ratio: 0.50,
        }
    }

    /// South Asian: lower with authority figures, avoidance = respect.
    pub fn south_asian() -> Self {
        Self {
            speaker_gaze_ratio: 0.50,
            listener_gaze_ratio: 0.60,
            max_contact_secs: 2.5,
            min_aversion_secs: 0.4,
            gaze_meet_latency: 0.4,
            idle_gaze_ratio: 0.25,
            thinking_gaze_ratio: 0.30,
        }
    }

    /// Interpolate between two profiles. `t` in 0.0–1.0.
    pub fn lerp(a: &Self, b: &Self, t: f32) -> Self {
        let t = t.clamp(0.0, 1.0);
        let l = |x: f32, y: f32| x + (y - x) * t;
        Self {
            speaker_gaze_ratio: l(a.speaker_gaze_ratio, b.speaker_gaze_ratio),
            listener_gaze_ratio: l(a.listener_gaze_ratio, b.listener_gaze_ratio),
            max_contact_secs: l(a.max_contact_secs, b.max_contact_secs),
            min_aversion_secs: l(a.min_aversion_secs, b.min_aversion_secs),
            gaze_meet_latency: l(a.gaze_meet_latency, b.gaze_meet_latency),
            idle_gaze_ratio: l(a.idle_gaze_ratio, b.idle_gaze_ratio),
            thinking_gaze_ratio: l(a.thinking_gaze_ratio, b.thinking_gaze_ratio),
        }
    }
}

impl Default for CultureProfile {
    fn default() -> Self {
        Self::western()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lerp_endpoints() {
        let w = CultureProfile::western();
        let e = CultureProfile::east_asian();
        let at_zero = CultureProfile::lerp(&w, &e, 0.0);
        let at_one = CultureProfile::lerp(&w, &e, 1.0);
        assert!((at_zero.speaker_gaze_ratio - w.speaker_gaze_ratio).abs() < 1e-6);
        assert!((at_one.speaker_gaze_ratio - e.speaker_gaze_ratio).abs() < 1e-6);
    }

    #[test]
    fn lerp_midpoint() {
        let w = CultureProfile::western();
        let e = CultureProfile::east_asian();
        let mid = CultureProfile::lerp(&w, &e, 0.5);
        let expected = (w.speaker_gaze_ratio + e.speaker_gaze_ratio) / 2.0;
        assert!((mid.speaker_gaze_ratio - expected).abs() < 1e-6);
    }
}
