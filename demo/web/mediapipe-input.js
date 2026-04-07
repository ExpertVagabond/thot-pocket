const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22';

export class MediaPipeInput {
  constructor() {
    this.zone = 'at_me';
    this.confidence = 0;
    this.ready = false;
    this.denied = false;
    this.faceLandmarker = null;
    this.video = null;
    this.simulating = false;
    this.simTimer = 0;
  }

  async init(videoEl) {
    this.video = videoEl;
    try {
      const vision = await self.FilesetResolver.forVisionTasks(VISION_CDN + '/wasm');
      this.faceLandmarker = await self.FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: VISION_CDN + '/face_landmarker.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: false,
        outputFacialTransformationMatrixes: false,
      });

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
      });
      this.video.srcObject = stream;
      await this.video.play();
      this.ready = true;
      this._detectLoop();
    } catch (e) {
      console.warn('MediaPipe/webcam init failed, using simulation:', e.message);
      this.denied = true;
      this.simulating = true;
    }
  }

  _detectLoop() {
    if (!this.ready || !this.faceLandmarker) return;
    const now = performance.now();
    const results = this.faceLandmarker.detectForVideo(this.video, now);
    if (results.faceLandmarks && results.faceLandmarks.length > 0) {
      this._classifyGaze(results.faceLandmarks[0]);
      this.confidence = 1.0;
    } else {
      this.confidence = 0;
    }
    requestAnimationFrame(() => this._detectLoop());
  }

  _classifyGaze(landmarks) {
    // Iris landmarks: left eye iris center=468, right eye iris center=473
    // Left eye corners: 33 (outer), 133 (inner)
    // Right eye corners: 362 (outer), 263 (inner)
    const lIris = landmarks[468];
    const lOuter = landmarks[33];
    const lInner = landmarks[133];

    if (!lIris || !lOuter || !lInner) return;

    const eyeWidth = Math.abs(lInner.x - lOuter.x);
    if (eyeWidth < 0.01) return;

    const eyeCenterX = (lOuter.x + lInner.x) / 2;
    const eyeCenterY = (lOuter.y + lInner.y) / 2;

    const deviationX = Math.abs(lIris.x - eyeCenterX) / eyeWidth;
    const deviationY = (lIris.y - eyeCenterY) / eyeWidth;

    if (deviationY > 0.15) {
      this.zone = 'down';
    } else if (deviationX > 0.12) {
      this.zone = 'away';
    } else {
      this.zone = 'at_me';
    }
  }

  // Simulated gaze cycling when webcam is denied
  tickSimulation(dt) {
    if (!this.simulating) return;
    this.simTimer += dt;
    const cycle = this.simTimer % 8;
    if (cycle < 4) this.zone = 'at_me';
    else if (cycle < 6) this.zone = 'away';
    else this.zone = 'at_me';
  }

  getZone() {
    return this.zone;
  }

  getConfidence() {
    return this.confidence;
  }

  isActive() {
    return this.ready && !this.denied;
  }
}
