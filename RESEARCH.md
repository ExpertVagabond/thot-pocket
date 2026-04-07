# Thot Pocket — Eye Contact Intelligence for AI Avatars

> Deep research synthesis on gaze mechanics, psychology, and technical implementation
> for building AI avatars that emulate genuine human connection through eye contact.

---

## Hypothesis

**Eye contact is the single most important factor in making AI avatars feel human.**
Not lip sync, not voice quality, not facial expression fidelity — it's the eyes.
If the gaze is wrong, nothing else matters. If the gaze is right, everything else
is forgiven.

---

## Part 1: The Psychology of Eye Contact

### 1.1 Gaze Duration Norms

Human eye contact in conversation follows precise, measurable patterns:

| Context | Eye Contact Duration | Break Duration |
|---------|---------------------|----------------|
| **Speaker** looking at listener | 40-60% of time | Breaks every 3-5 sec |
| **Listener** looking at speaker | 60-80% of time | Breaks every 5-7 sec |
| **Mutual gaze** (both looking at each other) | 30-60% of overlap | Avg 1.5-3 sec per lock |
| **Comfortable single lock** | 3.3 seconds average (Binetti 2016, N=498, 56 nations) | — |
| **Actual mutual *eye* contact** | ~0.36 seconds per episode (~10% of convo) | Dual eye-tracking |
| **Actual mutual *face* gaze** | ~2.2 seconds per episode (~60% of convo) | Dual eye-tracking |
| **Uncomfortable threshold** | >5 seconds (universally too long >9s) | — |
| **Intimate/aggressive** | >7 seconds continuous | Triggers fight-or-flight |

**Key finding**: The "sweet spot" for a single eye contact episode is **2-5 seconds**, with
the average preferred duration being **3.3 seconds** (Binetti et al., 2016, Royal Society Open
Science, N=498, 56 nations). No participant preferred sub-1s contact; none preferred >9s.

**Critical gap between perception and reality**: People THINK they hold eye contact for ~3s,
but dual eye-tracking studies show actual mutual *eye* contact averages only **0.36 seconds**
(~10% of conversation). Mutual *face* gaze (looking at face region, not necessarily eyes)
averages ~2.2 seconds (~60% of conversation). This means the "feeling" of connection comes
from face gaze, not locked eye-to-eye staring.

### 1.2 The Gaze Triangle

During face-to-face conversation, human eyes don't fixate on a single point. They follow
a **triangular scanning pattern**:

```
    Left Eye ←→ Right Eye
         ↘     ↙
          Mouth
```

- **Business gaze**: Eyes + forehead (formal, maintains professional distance)
- **Social gaze**: Eyes + mouth (standard conversation)
- **Intimate gaze**: Eyes + mouth + body (signals attraction/deep engagement)

The triangle scan happens unconsciously at 2-4 Hz. Avatar systems that lock onto a single
point (center of face, one eye) feel "off" because they lack this scanning pattern.

### 1.3 Speaker vs. Listener Asymmetry (Critical for Avatar Design)

This is one of the most important findings for Thot Pocket:

| Role | Gaze at Partner | Notes |
|------|----------------|-------|
| **Listener** | 60-80% of time | Long sustained looks, brief breaks |
| **Speaker (fluent)** | ~50% of time | Alternating between looking and away |
| **Speaker (hesitant/thinking)** | ~20% of time | Mostly looking away (Kendon, 1967) |

**Turn-taking signals via gaze:**
- **71% of speaker turns end with gaze directed at the listener** — this is THE turn-yielding signal
- **Listeners begin speaking with averted gaze** — they look away as they take the floor,
  then gradually return gaze ~700-800ms into their utterance
- **Listener response lag after speaker establishes gaze: ~400-430ms** (PMC4550266)

**For Thot Pocket**: When the avatar finishes "speaking," it MUST establish eye contact
(turn yield signal). When it begins speaking, it should briefly avert then return.

### 1.4 Gaze Aversion Patterns

Where people look when they break eye contact is **not random** — it carries meaning:

| Direction | Meaning | When It Happens |
|-----------|---------|-----------------|
| **Up-right** | Visual construction (imagining) | Creating a mental image |
| **Up-left** | Visual recall (remembering) | Accessing a memory |
| **Sideways-right** | Auditory construction | Composing what to say |
| **Sideways-left** | Auditory recall | Remembering sounds/words |
| **Down-right** | Kinesthetic processing | Accessing feelings/body sense |
| **Down-left** | Internal dialogue | Self-talk, deliberation |
| **Down (general)** | Emotional processing, submission | Processing emotions |

**Critical insight for avatars**: Random gaze aversion is worse than no aversion at all
(Garau et al., 2003, CHI). Cognitively-motivated aversion — e.g., looking up-right when
"thinking" before answering — is rated as natural and intelligent (Andrist et al., 2014).

### 1.5 Pupillary Synchrony (PNAS 2021)

A landmark finding: during natural conversation, partners' **pupils periodically synchronize**,
marking moments of shared attention. Eye contact commences as pupillary synchrony peaks
and persists through its decline. This means eye contact doesn't just signal attention —
it occurs precisely at the moment of maximum shared cognitive engagement.

**For Thot Pocket**: If we can detect user pupil dilation (possible with high-res webcam),
we can time the avatar's eye contact initiation to match dilation peaks — creating an
unconscious sense of "being in sync."

### 1.6 Blinks as Conversational Punctuation

- Resting blink rate: 10-20/min
- Conversational blink rate: 15-32.5/min (significantly higher)
- **Blinks occur at natural speech pauses** — they function as nonverbal punctuation
- **Blink duration is communicative**: longer blinks from a listener elicit shorter answers
  from speakers (PLOS ONE, 2018)
- **Blink-saccade coupling**: 97% probability of blink during saccades >33° (drops for smaller)

### 1.7 Neuroscience of Eye Contact

Eye contact triggers a cascade of neurological responses:

- **Oxytocin release**: Mutual gaze between humans triggers oxytocin ("bonding hormone").
  This is the same mechanism behind parent-infant bonding through gaze (Nagasawa et al., 2015)
- **Amygdala activation**: Direct gaze activates the amygdala (threat/salience detector),
  which is why sustained eye contact feels intense — it's a signal of social significance
- **Mirror neuron engagement**: Eye contact increases mirror neuron activity, facilitating
  emotional contagion and empathy. This is the neural basis for "feeling seen"
- **Autonomic arousal**: Mutual gaze increases skin conductance, heart rate variability,
  and pupil dilation — measurable physiological markers of social engagement
- **Prefrontal synchronization**: fNIRS studies show that mutual gaze synchronizes
  prefrontal cortex activity between interlocutors (Hirsch et al., 2017)
- **Dopaminergic reward**: Eye contact from an attractive/liked person activates the ventral
  striatum (reward circuitry). The brain literally rewards us for eye contact.

**Why Eye Contact Feels Like "Connection" — Four Mechanisms (Frontiers in Psychology, 2018):**

1. **Subcortical visual processing** — fast, low-level pathways detect eye cues (evolutionarily ancient)
2. **Perception of being attended to** — knowing someone is looking at YOU specifically
3. **Self-referential processing** — eye contact activates brain regions for thinking about the self
4. **Reciprocal interaction possibility** — LIVE gaze produces stronger effects than one-way or photos

**The implication**: Mechanisms 2 and 4 are the key for avatars. The user must perceive that
the avatar is attending to THEM specifically (not generic forward stare), and that the
interaction is reciprocal (avatar responds to user's gaze behavior). Pre-recorded or
clearly one-directional gaze will produce weaker neurological effects.

### 1.5 Cultural Variation

Eye contact norms vary significantly:

| Culture | Eye Contact Level | Notes |
|---------|------------------|-------|
| **Western (US/Europe)** | High (60-70% in conversation) | Sign of confidence and honesty |
| **East Asian (Japan/Korea/China)** | Lower (30-50%) | Prolonged contact = rude/aggressive |
| **Middle Eastern (Arab cultures)** | Very high between same gender | Intense gaze = sincerity |
| **Indigenous Australian** | Low, especially with elders | Avoidance = respect |
| **Latin American** | Moderate-high | Context-dependent |
| **South Asian** | Lower with authority figures | Avoidance to superiors = respect |

**Design implication**: Thot Pocket needs a **culture parameter** that adjusts gaze frequency,
duration, and aversion patterns. A one-size-fits-all gaze model will feel wrong to ~70% of
the world's population.

### 1.6 Trust and Persuasion

Research consistently shows:

- **Speakers who maintain 60-70% eye contact** are rated as more credible, competent,
  and trustworthy than those with more or less (Beebe, 1974)
- **Too much eye contact** (>80%) is perceived as aggressive, dominating, or dishonest
  (trying too hard)
- **Too little** (<30%) signals dishonesty, discomfort, or disinterest
- **Gaze during deception**: Contrary to folk belief, liars don't always look away —
  they often maintain MORE eye contact (overcompensating). The tell is in the timing
  and pattern, not the quantity
- **Persuasion — COUNTERINTUITIVE**: Chen et al. (2013, Psychological Science, Freiburg+Harvard)
  found that more eye contact during persuasive communication predicts LESS attitude change
  when the listener already disagrees. Eye contact activates dominance/confrontation circuits.
  When listener is sympathetic → more eye contact = more receptiveness.
  When listener disagrees → more eye contact = more resistance.
  **For avatars**: reduce eye contact when delivering disagreeable information. Increase during
  rapport-building and agreement.

---

## Part 2: The Uncanny Valley of Eyes

### 2.1 Why Avatar Eyes Feel "Dead"

The uncanny valley is disproportionately concentrated in the eyes. Research identifies
these specific failure modes:

1. **No micro-saccades**: Real eyes are never perfectly still. They exhibit constant
   tiny movements (0.1-1° at 1-3Hz). When absent, eyes appear "locked" — dead.

2. **Wrong blink rate**: Too slow (robotic), too fast (nervous), or too regular
   (mechanical). Human blinks cluster around phrase boundaries and cognitive transitions.

3. **Missing VOR (vestibulo-ocular reflex)**: When the head moves, eyes counter-rotate
   to stabilize gaze. Without this, eyes appear "painted on" the head.

4. **Uniform pupil size**: Real pupils constantly fluctuate with light, cognitive load,
   and emotion. Fixed pupils feel lifeless.

5. **No corneal reflections**: Real eyes have wet, reflective surfaces that catch light.
   Missing specular highlights → dead.

6. **Linear interpolation**: Real saccades are ballistic (fast acceleration, overshoot,
   settle). Linearly interpolated eye movements look robotic.

7. **Constant eye contact**: The #1 mistake. Real humans look away 30-40% of the time.
   An avatar that stares 100% of the time triggers amygdala alarm responses.

8. **Symmetric eye movement**: Real eye movements are NOT perfectly symmetric.
   Each eye moves slightly independently, especially during vergence changes.

### 2.2 The Rendering Gap

Even with perfect animation, rendering must solve:

- **Subsurface scattering** in sclera (whites) and iris — eyes are translucent
- **Corneal refraction** — the cornea bends light, distorting the iris behind it
- **Wet limbus line** — tear film at lower lid catches light
- **Blood vessel patterns** — visible in sclera, absent = porcelain doll effect
- **Iris heterochromia/patterns** — real irises have complex, unique patterns
- **Caustic light patterns** on iris from corneal refraction

---

## Part 3: Technical State of the Art

### 3.1 Gaze Detection (Input Pipeline)

Best current options for detecting where the user is looking:

| System | Method | Accuracy | Speed | Hardware |
|--------|--------|----------|-------|----------|
| **MediaPipe Face Mesh** | 478 landmarks + iris | 4-5° uncalibrated | 30-60 FPS | Any webcam |
| **L2CS-Net** | Appearance-based CNN | ~3.2° on MPIIGaze | 30+ FPS | Webcam + GPU |
| **ETH-XGaze** | ResNet-50 | ~3.5° | 20-30 FPS | Webcam + GPU |
| **OpenFace 2.0** | 3D eye model fitting | 4.5-5.5° | ~30 FPS | Any webcam |
| **Apple ARKit** | TrueDepth camera | ~1-2° | 60 FPS | iPhone/iPad |
| **Apple Vision Pro** | IR eye cameras | <1° | 90 FPS | Vision Pro only |
| **Tobii** | Dedicated IR tracker | <0.5° | 60-120 Hz | $200-$15K hardware |

**Recommendation**: MediaPipe for broad compatibility, L2CS-Net for accuracy on GPU.
Don't try exact point-of-regard — classify into zones: "at me," "away," "down (reading)."

### 3.2 Avatar Gaze Generation (Current Systems)

| System | Eye Gaze Approach | Limitation |
|--------|------------------|------------|
| **NVIDIA Audio2Face/ACE** | Procedural semi-random saccades | Feels dead without explicit attention targets |
| **Unreal MetaHuman** | Motion capture or animation blueprints | Best rendering, but Live Link doesn't capture saccades |
| **Synthesia/HeyGen** | Baked into training data, forward-facing | No interactivity, pre-rendered |
| **D-ID** | Procedural during speech generation | Eyes "swim," noticeably synthetic |
| **VASA-1 (Microsoft)** | Disentangled gaze control | Best controllable gaze in generation, but not shipped |
| **EMO (Alibaba)** | Diffusion-based with gaze | Better naturalness, still has jitter |
| **Meta Codec Avatars 2.0** | Real-time eye tracking → avatar | Best mutual gaze, VR-only |

**Gap**: No system today does all three: (1) detect user gaze, (2) model conversational gaze logic, (3) animate avatar eyes responsively. This is the Thot Pocket opportunity.

### 3.3 Eye Contact Correction Systems

Systems that redirect gaze to simulate camera eye contact:

| System | Method | Quality | Artifacts |
|--------|--------|---------|-----------|
| **Apple FaceTime** | TrueDepth 3D warping | Best consumer | Fails with glasses, uncanny at large angles |
| **NVIDIA Maxine** | GAN/diffusion synthesis | Good, GPU required | Eye texture shifts, glasses issues |
| **Microsoft Teams** | Neural synthesis on NPU/GPU | Variable | Temporal flickering, "creepy stare" (over-corrects) |
| **Zoom** | CPU-based synthesis | Lower quality | Visible artifacts with glasses |

**Common problem across all**: They create CONSTANT eye contact, which is unnatural.
Humans should break eye contact 30-40% of the time. Over-correction is worse than none.

### 3.4 Procedural Eye Animation Parameters

The "Eyes Alive" (Lee et al., 2002) parameters that must be simulated:

| Behavior | Parameter | Value | Why It Matters |
|----------|-----------|-------|----------------|
| **Saccade rate** | Conversation | 2-3/sec | Eyes that don't move = dead |
| **Saccade velocity** | Main sequence | 300-500°/sec for 10° | Linear motion = robotic |
| **Micro-saccade** | Amplitude | 0.2-0.5° | Prevents "locked" appearance |
| **Micro-saccade** | Rate | 1-2/sec | Constant fixation instability |
| **Blink rate** | Baseline | 15-20/min | Too regular = mechanical |
| **Blink rate** | Speaking | 20-26/min | Blinks cluster at phrase ends |
| **Blink duration** | Full close-open | 150-250ms | Too fast or slow = wrong |
| **Pupil size** | Neutral | 3-4mm diameter | — |
| **Pupil range** | Light→dark | 2-8mm | No variation = lifeless |
| **VOR gain** | Head rotation | 0.9-1.0 counter | Missing = eyes glued to head |
| **Fixation drift** | During hold | <0.5°/sec | Random walk character |
| **Vergence** | Near objects | 5-15° convergence | Both eyes same = robotic |

### 3.5 Open Source Stack

**Detection:**
- OpenFace 2.0 — C++, research-grade AU + gaze
- MediaPipe — C++/Python/JS, production-ready iris tracking
- L2CS-Net — PyTorch, best accuracy on standard benchmarks
- rt_gene — Python/ROS, real-time gaze for robotics
- GazeTracking — Python, simple pupil tracking

**Avatar/Animation:**
- FLAME — 3D morphable face model with separate eye rotation params (6 DOF)
- DECA/EMOCA — 3D face reconstruction from images
- SadTalker — Audio-driven talking head generation
- LivePortrait — Portrait animation with gaze control
- FaceFormer — Transformer speech-driven face animation

**Key Datasets:**
- MPIIGaze (213K images), ETH-XGaze (1.1M images), Gaze360 (172K frames)
- GazeCapture (2.5M frames, mobile), Columbia Gaze (5,880 controlled)

---

## Part 4: The Thot Pocket Architecture

### 4.1 System Design

```
┌─────────────────────────────────────────────────────────┐
│                    THOT POCKET                           │
├─────────────┬──────────────────┬────────────────────────┤
│  LAYER 1    │    LAYER 2       │      LAYER 3           │
│  SENSE      │    THINK         │      ACT               │
├─────────────┼──────────────────┼────────────────────────┤
│             │                  │                        │
│ User Gaze   │ Conversational   │ Procedural Eye         │
│ Detection   │ Gaze Model       │ Animation Engine       │
│             │                  │                        │
│ • MediaPipe │ • State machine  │ • Saccade generator    │
│ • Zone      │   (SPEAKING/     │ • Micro-saccade noise  │
│   classify  │   LISTENING/     │ • Blink model          │
│   (at me /  │   THINKING/      │ • VOR compensator      │
│   away /    │   IDLE)          │ • Pupil dilation       │
│   down)     │ • Gaze %         │ • Vergence             │
│             │   allocation     │ • Triangle scan        │
│ • Blink     │ • Aversion       │ • Culture params       │
│   detection │   direction      │                        │
│ • Head pose │   (cognitive)    │ Output: eye rotation   │
│             │ • Culture param  │ quaternions + pupil    │
│             │ • Turn-taking    │ size + blink triggers  │
│             │                  │ @ 60Hz                 │
└─────────────┴──────────────────┴────────────────────────┘
```

### 4.2 The Conversational Gaze State Machine

```
                    ┌──────────┐
              ┌────→│  IDLE    │←────┐
              │     └────┬─────┘     │
              │          │           │
         silence >5s    user speaks  silence >5s
              │          ↓           │
              │     ┌──────────┐     │
              │     │LISTENING │─────┘
              │     └────┬─────┘
              │          │
              │     avatar turn
              │          ↓
              │     ┌──────────┐
              └─────│THINKING  │ (0.3-1.5s pause)
                    └────┬─────┘
                         │
                    begins speaking
                         ↓
                    ┌──────────┐
                    │SPEAKING  │
                    └──────────┘
```

**Gaze allocation per state:**

| State | At User | Aversion | Aversion Direction | Blink Mod |
|-------|---------|----------|--------------------|-----------|
| IDLE | 30-40% | 60-70% | Environmental scan, slow saccades | Baseline 15/min |
| LISTENING | 70-80% | 20-30% | Brief, returns quickly | Reduced 12/min |
| THINKING | 30-50% | 50-70% | Up-right (constructing), down-left (deliberating) | Baseline |
| SPEAKING | 60-70% | 30-40% | Sideways (word-finding), brief up-glances | Elevated 22/min |

### 4.3 The Critical Innovation

What no current system does that Thot Pocket must:

1. **Responsive mutual gaze**: Detect when the user is looking at the avatar, and
   have the avatar "meet" their gaze with appropriate timing (not instant — 200-400ms
   response latency to feel natural)

2. **Cognitively-motivated aversion**: When the avatar "thinks" before responding,
   it looks away in a direction that signals the type of processing (recall vs.
   construction vs. emotional). This is what makes the difference between "the avatar
   looked away" and "the avatar is thinking."

3. **Natural rhythm**: Gaze contact and aversion follow conversational rhythm —
   eye contact intensifies at key points (emphasis, questions, emotional moments)
   and relaxes during filler/transition phrases

4. **Cultural adaptation**: A single parameter that shifts the entire gaze model
   along a spectrum from high-contact (Western/Middle Eastern) to low-contact
   (East Asian/South Asian)

5. **The 3.2-second rule**: No single eye contact episode exceeds ~3.2 seconds
   without a micro-break (brief aversion or triangle scan shift). This single rule
   eliminates the "creepy stare" that ruins every current system.

---

## Part 5: Key Papers (Required Reading)

1. **Ruhland et al. (2015)** — "A Review of Eye Gaze in Virtual Agents, Social Robotics and HCI"
   → The comprehensive review. 150+ references. The bible of this field.

2. **Lee, Badler & Badler (2002)** — "Eyes Alive"
   → Foundational procedural eye animation model. Saccades, micro-saccades, drift, vergence.

3. **Admoni & Scassellati (2017)** — "Social Eye Gaze in Human-Robot Interaction"
   → Gaze-contingent behavior increases engagement 20-40%. Contingent > accurate.

4. **Andrist et al. (2014)** — "Conversational Gaze Aversion for Humanlike Robots"
   → Cognitively-motivated aversion rated natural; random aversion rated creepy.

5. **Garau et al. (2003)** — "The Impact of Eye Gaze on Communication Using Humanoid Avatars"
   → Random gaze worse than no gaze. Informed gaze = significant improvement in co-presence.

6. **Binetti et al. (2016)** — "Pupil dilation as an index of preferred mutual gaze duration"
   → The 3.2-second sweet spot paper. Royal Society Open Science.

7. **Hirsch et al. (2017)** — Prefrontal cortex synchronization during mutual gaze
   → fNIRS evidence that eye contact literally synchronizes brains.

8. **VASA-1 (Microsoft, 2024)** — Disentangled gaze control in talking face generation
   → State of the art in controllable gaze for generated avatars.

9. **Google Project Starline (SIGGRAPH 2023)** — 3D telepresence with geometrically correct
   eye contact using light field display. Solves the Mona Lisa effect.

10. **Nagasawa et al. (2015)** — Oxytocin-gaze positive loop in human-dog bonding
    → Proves eye contact → oxytocin is a fundamental mammalian mechanism, not culturally learned.

---

## Part 6: Validation of Hypothesis

### Evidence Supporting

| Claim | Evidence | Strength |
|-------|----------|----------|
| Eye contact is the strongest social signal | Amygdala activation, oxytocin release, prefrontal synchronization | Strong (neuroscience) |
| Current avatars fail primarily on eyes | Uncanny valley literature concentrates on gaze | Strong (perceptual studies) |
| Contingent gaze > accurate gaze | Admoni & Scassellati meta-analysis, 20-40% engagement increase | Strong (replicated) |
| Random eye behavior is worse than none | Garau et al. 2003, multiple replications | Strong |
| 3.2s is the magic number | Binetti et al. 2016, correlated with personality traits | Moderate (single study, large N) |
| Cultural variation is significant | Cross-cultural studies consistent | Strong |
| Micro-saccades are essential for "aliveness" | Perceptual studies on fixation stability | Moderate |
| VOR absence is immediately detected | Animation industry consensus, perceptual studies | Strong |

### The Hypothesis Holds

**Eye contact IS the most important factor for AI avatar humanness.**

The evidence is overwhelming across neuroscience, psychology, and animation research.
No other single cue — lip sync, voice quality, skin rendering, facial expression —
triggers the same depth of neurological response. Eye contact activates bonding hormones,
synchronizes brain activity, triggers trust/threat evaluation, and is the primary channel
for turn-taking and social regulation.

Every current commercial avatar system gets this wrong, either by:
- Staring too much (eye contact correction systems)
- Moving eyes randomly (procedural systems)
- Not responding to the user's gaze (all non-interactive systems)

**Thot Pocket's opportunity is in Layer 2** — the conversational gaze model. The sensing
(Layer 1) and animation (Layer 3) technologies exist. What's missing is the intelligence
that connects them: knowing WHEN to look, WHERE to look away, and HOW LONG to hold.

---

---

## Part 7: Sources

### Psychology & Neuroscience
- Binetti et al. (2016) — "Pupil dilation as an index of preferred mutual gaze duration" — Royal Society Open Science — https://royalsocietypublishing.org/doi/10.1098/rsos.160086
- PNAS (2021) — "Eye contact marks rise and fall of shared attention" — https://www.pnas.org/doi/10.1073/pnas.2106645118
- Nature Scientific Reports (2018) — "Dual eye tracking in social interaction" — https://www.nature.com/articles/s41598-018-22726-7
- PMC4550266 — "Speaking and listening with the eyes: gaze signaling" — https://pmc.ncbi.nlm.nih.gov/articles/PMC4550266/
- Chen et al. (2013) — "Eye contact increases resistance to persuasion" — Psychological Science — https://pubmed.ncbi.nlm.nih.gov/24068114/
- PMC6121038 — "Affective eye contact: an integrative review" (Frontiers) — https://pmc.ncbi.nlm.nih.gov/articles/PMC6121038/
- eNeuro (2019) — "Neural substrates of mutual eye-gaze (hyperscanning fMRI)" — https://www.eneuro.org/content/6/1/ENEURO.0284-18.2019
- Nature Comms Bio (2022) — "Social synchronization during eye contact" — https://www.nature.com/articles/s42003-022-03352-6
- Oxford Academic (2019) — "Eye contact enhances interpersonal motor resonance" — https://academic.oup.com/scan/article/14/9/967/5566553
- ScienceDirect — "Oxytocin and mirror neuron activation" — https://www.sciencedirect.com/science/article/abs/pii/S0306453018300854
- PMC8566692 — "Pupil dilation and social interaction" — https://pmc.ncbi.nlm.nih.gov/articles/PMC8566692/
- PLOS ONE (2018) — "Eye blinks as communicative signals" — https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0208030
- PMC4340785 — "Eye contact perception in West and East" — https://pmc.ncbi.nlm.nih.gov/articles/PMC4340785/
- ACM ETRA (2025) — "Decoding the uncanny valley via gaze patterns" — https://dl.acm.org/doi/10.1145/3715669.3723121

### Technical / Systems
- Ruhland et al. (2015) — "A Review of Eye Gaze in Virtual Agents, Social Robotics and HCI" — Computer Graphics Forum
- Lee, Badler & Badler (2002) — "Eyes Alive" — ACM TOG
- Admoni & Scassellati (2017) — "Social Eye Gaze in Human-Robot Interaction" — JHRI
- Andrist et al. (2014) — "Conversational Gaze Aversion for Humanlike Robots"
- Garau et al. (2003) — "The Impact of Eye Gaze on Communication Using Humanoid Avatars" — CHI
- Zhang et al. (2020) — "ETH-XGaze" — ECCV — https://ait.ethz.ch/xgaze
- Qian et al. (2024) — "GaussianAvatars: Photorealistic Head Avatars with Rigged 3D Gaussians" — https://shenhanqian.github.io/gaussian-avatars
- Danecek et al. (2023) — "EMOTE: Emotional Speech-Driven Animation" — CVPR
- Meta (2024) — "Audio2Photoreal" — https://research.meta.com/audio2photoreal/
- Microsoft (2024) — "VASA-1: Real-time talking face generation with gaze control"
- Google (2023) — "Project Starline" — SIGGRAPH
- NVIDIA Maxine SDK — https://developer.nvidia.com/maxine
- NVIDIA ACE — https://www.nvidia.com/en-us/omniverse/ace/
- Skantze / Furhat Robotics — https://www.furhatrobotics.com/
- UnityEyes (synthetic eye data) — https://www.cl.cam.ac.uk/research/rainbow/projects/unityeyes/

### Open Source
- MediaPipe — https://github.com/google/mediapipe
- OpenFace 2.0 — https://github.com/TadasBaltrusaitis/OpenFace
- L2CS-Net — https://github.com/Ahmednull/L2CS-Net
- rt_gene — https://github.com/Tobias-Fischer/rt_gene
- FLAME — https://flame.is.tue.mpg.de/
- DECA — https://github.com/yfeng95/DECA
- SadTalker — https://github.com/OpenTalker/SadTalker
- LivePortrait — https://github.com/KwaiVGI/LivePortrait

---

## Next Steps

- [ ] Prototype Layer 2 state machine in Rust
- [ ] Integrate MediaPipe gaze detection as Layer 1 input
- [ ] Build procedural eye animation engine (Eyes Alive model) as Layer 3
- [ ] Test with A/B evaluation: static gaze vs. Thot Pocket gaze model
- [ ] Cultural parameter tuning with diverse evaluators
- [ ] Integrate with Field Studio avatar pipeline
