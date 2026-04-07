import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const SKIN = 0xd4a574;
const SCLERA = 0xf5f0eb;
const IRIS_COLOR = 0x5c3a1e;
const PUPIL_COLOR = 0x0a0a0a;

export class StylizedFace {
  constructor(scene) {
    this.group = new THREE.Group();

    // Head — slightly elongated sphere
    const headGeo = new THREE.SphereGeometry(1, 48, 48);
    headGeo.scale(1, 1.15, 0.95);
    const headMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7, metalness: 0.0 });
    this.head = new THREE.Mesh(headGeo, headMat);
    this.group.add(this.head);

    // Eyes
    this.leftEyeGroup = this._createEye(-0.32, 0.15, 0.75);
    this.rightEyeGroup = this._createEye(0.32, 0.15, 0.75);
    this.group.add(this.leftEyeGroup.pivot);
    this.group.add(this.rightEyeGroup.pivot);

    // Mouth — subtle arc
    const mouthCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.2, -0.35, 0.88),
      new THREE.Vector3(0, -0.38, 0.92),
      new THREE.Vector3(0.2, -0.35, 0.88)
    );
    const mouthGeo = new THREE.TubeGeometry(mouthCurve, 16, 0.015, 8, false);
    const mouthMat = new THREE.MeshStandardMaterial({ color: 0x8b5e3c, roughness: 0.6 });
    this.group.add(new THREE.Mesh(mouthGeo, mouthMat));

    // Nose bridge — subtle bump
    const noseGeo = new THREE.SphereGeometry(0.08, 16, 16);
    noseGeo.scale(0.8, 1, 1.2);
    const nose = new THREE.Mesh(noseGeo, headMat);
    nose.position.set(0, -0.05, 0.92);
    this.group.add(nose);

    // Eyebrows
    this._addBrow(-0.32, 0.38, 0.78);
    this._addBrow(0.32, 0.38, 0.78);

    scene.add(this.group);
  }

  _createEye(x, y, z) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);

    // Socket indent
    const socketGeo = new THREE.SphereGeometry(0.18, 24, 24);
    const socketMat = new THREE.MeshStandardMaterial({ color: 0xb8956a, roughness: 0.8 });
    const socket = new THREE.Mesh(socketGeo, socketMat);
    socket.scale.set(1, 0.85, 0.5);
    pivot.add(socket);

    // Eyeball (rotates for gaze direction)
    const eyeGroup = new THREE.Group();

    const scleraGeo = new THREE.SphereGeometry(0.15, 24, 24);
    const scleraMat = new THREE.MeshStandardMaterial({ color: SCLERA, roughness: 0.3, metalness: 0.05 });
    const sclera = new THREE.Mesh(scleraGeo, scleraMat);
    eyeGroup.add(sclera);

    // Iris
    const irisGeo = new THREE.CircleGeometry(0.075, 32);
    const irisMat = new THREE.MeshStandardMaterial({ color: IRIS_COLOR, roughness: 0.4 });
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.z = 0.148;
    eyeGroup.add(iris);

    // Pupil (scales for dilation)
    const pupilGeo = new THREE.CircleGeometry(0.035, 24);
    const pupilMat = new THREE.MeshBasicMaterial({ color: PUPIL_COLOR });
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.z = 0.1485;
    eyeGroup.add(pupil);

    // Corneal highlight
    const hlGeo = new THREE.SphereGeometry(0.02, 12, 12);
    const hlMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 });
    const highlight = new THREE.Mesh(hlGeo, hlMat);
    highlight.position.set(0.03, 0.03, 0.15);
    eyeGroup.add(highlight);

    pivot.add(eyeGroup);

    // Upper eyelid
    const lidGeo = new THREE.SphereGeometry(0.17, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const lidMat = new THREE.MeshStandardMaterial({ color: SKIN, roughness: 0.7, side: THREE.DoubleSide });
    const upperLid = new THREE.Mesh(lidGeo, lidMat);
    upperLid.rotation.x = Math.PI;
    upperLid.position.z = 0.01;
    pivot.add(upperLid);

    // Lower eyelid (mostly static)
    const lowerLid = new THREE.Mesh(lidGeo.clone(), lidMat.clone());
    lowerLid.position.z = 0.01;
    lowerLid.scale.y = 0.3;
    pivot.add(lowerLid);

    return { pivot, eyeGroup, pupil, upperLid, sclera };
  }

  _addBrow(x, y, z) {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(x - 0.14, y, z),
      new THREE.Vector3(x, y + 0.04, z + 0.04),
      new THREE.Vector3(x + 0.14, y - 0.02, z)
    );
    const geo = new THREE.TubeGeometry(curve, 12, 0.018, 6, false);
    const mat = new THREE.MeshStandardMaterial({ color: 0x4a3520, roughness: 0.8 });
    this.group.add(new THREE.Mesh(geo, mat));
  }

  setGaze(leftX, leftY, rightX, rightY) {
    const toRad = Math.PI / 180;
    const clamp = (v) => Math.max(-30, Math.min(30, v));
    this.leftEyeGroup.eyeGroup.rotation.y = clamp(leftX) * toRad;
    this.leftEyeGroup.eyeGroup.rotation.x = -clamp(leftY) * toRad;
    this.rightEyeGroup.eyeGroup.rotation.y = clamp(rightX) * toRad;
    this.rightEyeGroup.eyeGroup.rotation.x = -clamp(rightY) * toRad;
  }

  setPupilSize(diameter) {
    // Map 2-8mm to scale 0.5-1.5
    const s = 0.5 + ((diameter - 2) / 6) * 1.0;
    this.leftEyeGroup.pupil.scale.set(s, s, 1);
    this.rightEyeGroup.pupil.scale.set(s, s, 1);
  }

  setLidOpenness(value) {
    // 0=closed, 1=open. Rotate upper lid to close.
    const angle = Math.PI + (1 - value) * 0.7;
    this.leftEyeGroup.upperLid.rotation.x = angle;
    this.rightEyeGroup.upperLid.rotation.x = angle;
  }

  setUpperLidOffset(value) {
    // Subtle vertical lid tracking with gaze
    const offset = value * 0.02;
    this.leftEyeGroup.upperLid.position.y = offset;
    this.rightEyeGroup.upperLid.position.y = offset;
  }
}
