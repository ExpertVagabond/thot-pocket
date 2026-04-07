import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js';

const SKIN = new THREE.Color(0xd4a574);
const SKIN_DARK = new THREE.Color(0xb8896a);
const SCLERA = 0xf5f0eb;
const IRIS_COLOR = 0x4a6741;
const PUPIL_COLOR = 0x0a0a0a;
const LIP_COLOR = 0xb06860;

export class StylizedFace {
  constructor(scene) {
    this.group = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({
      color: SKIN,
      roughness: 0.55,
      metalness: 0.0,
    });

    // Head — sculpted using LatheGeometry for proper cranial profile
    const headProfile = [
      new THREE.Vector2(0, -1.1),       // chin point
      new THREE.Vector2(0.38, -1.0),    // chin width
      new THREE.Vector2(0.52, -0.85),   // jaw angle
      new THREE.Vector2(0.58, -0.6),    // lower jaw
      new THREE.Vector2(0.62, -0.3),    // mid cheek
      new THREE.Vector2(0.65, 0.0),     // cheekbone
      new THREE.Vector2(0.62, 0.2),     // temple
      new THREE.Vector2(0.58, 0.4),     // upper temple
      new THREE.Vector2(0.55, 0.6),     // forehead
      new THREE.Vector2(0.5, 0.8),      // upper forehead
      new THREE.Vector2(0.42, 0.95),    // crown approach
      new THREE.Vector2(0.3, 1.05),     // crown
      new THREE.Vector2(0.15, 1.1),     // top
      new THREE.Vector2(0, 1.12),       // apex
    ];
    const headGeo = new THREE.LatheGeometry(headProfile, 48);
    // Flatten the back of the head and push face forward
    const pos = headGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let z = pos.getZ(i);
      const y = pos.getY(i);
      // Push front out, flatten back
      if (z > 0) z *= 1.08;
      else z *= 0.85;
      // Narrow the jaw slightly
      if (y < -0.5) {
        const x = pos.getX(i);
        pos.setX(i, x * (0.85 + 0.15 * ((y + 1.1) / 0.6)));
      }
      pos.setZ(i, z);
    }
    headGeo.computeVertexNormals();
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.group.add(this.head);

    // Nose — proper bridge, tip, and nostrils
    this._buildNose(skinMat);

    // Cheekbones — subtle volume
    this._addCheekbone(-0.42, -0.08, 0.5, skinMat);
    this._addCheekbone(0.42, -0.08, 0.5, skinMat);

    // Brow ridge — prominent overhang above eyes
    this._buildBrowRidge(skinMat);

    // Eye sockets (darker recessed areas)
    const socketMat = new THREE.MeshStandardMaterial({
      color: SKIN_DARK,
      roughness: 0.7,
    });
    this._addSocket(-0.28, 0.12, 0.52, socketMat);
    this._addSocket(0.28, 0.12, 0.52, socketMat);

    // Eyes
    this.leftEyeGroup = this._createEye(-0.28, 0.12, 0.56);
    this.rightEyeGroup = this._createEye(0.28, 0.12, 0.56);
    this.group.add(this.leftEyeGroup.pivot);
    this.group.add(this.rightEyeGroup.pivot);

    // Eyebrows — thicker, more sculpted
    this._addBrow(-0.28, 0.32, 0.58, true);
    this._addBrow(0.28, 0.32, 0.58, false);

    // Mouth — proper lip geometry
    this._buildMouth();

    // Ears — simplified
    this._addEar(-0.63, 0.05, -0.05, skinMat, false);
    this._addEar(0.63, 0.05, -0.05, skinMat, true);

    // Subtle chin
    const chinGeo = new THREE.SphereGeometry(0.12, 16, 16);
    chinGeo.scale(1, 0.6, 0.8);
    const chin = new THREE.Mesh(chinGeo, skinMat);
    chin.position.set(0, -0.95, 0.45);
    this.group.add(chin);

    scene.add(this.group);
  }

  _buildNose(mat) {
    // Bridge
    const bridgeGeo = new THREE.CylinderGeometry(0.04, 0.06, 0.35, 8);
    const bridge = new THREE.Mesh(bridgeGeo, mat);
    bridge.position.set(0, 0.0, 0.6);
    bridge.rotation.x = -0.25;
    this.group.add(bridge);

    // Tip — rounded
    const tipGeo = new THREE.SphereGeometry(0.075, 16, 16);
    tipGeo.scale(1, 0.7, 1.1);
    const tip = new THREE.Mesh(tipGeo, mat);
    tip.position.set(0, -0.15, 0.7);
    this.group.add(tip);

    // Nostrils
    const nostrilMat = new THREE.MeshStandardMaterial({
      color: SKIN_DARK,
      roughness: 0.8,
    });
    [-0.04, 0.04].forEach(x => {
      const nGeo = new THREE.SphereGeometry(0.025, 8, 8);
      const n = new THREE.Mesh(nGeo, nostrilMat);
      n.position.set(x, -0.2, 0.68);
      this.group.add(n);
    });
  }

  _addCheekbone(x, y, z, mat) {
    const geo = new THREE.SphereGeometry(0.15, 16, 16);
    geo.scale(1.2, 0.6, 0.8);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
  }

  _buildBrowRidge(mat) {
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.48, 0.28, 0.48),
      new THREE.Vector3(-0.2, 0.35, 0.62),
      new THREE.Vector3(0.2, 0.35, 0.62),
      new THREE.Vector3(0.48, 0.28, 0.48),
    );
    const geo = new THREE.TubeGeometry(curve, 24, 0.04, 8, false);
    this.group.add(new THREE.Mesh(geo, mat));
  }

  _addSocket(x, y, z, mat) {
    const geo = new THREE.SphereGeometry(0.17, 20, 20);
    geo.scale(1.1, 0.9, 0.45);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    this.group.add(mesh);
  }

  _createEye(x, y, z) {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);

    // Eyeball group (rotates for gaze)
    const eyeGroup = new THREE.Group();

    // Sclera with slight glossiness
    const scleraGeo = new THREE.SphereGeometry(0.13, 32, 32);
    const scleraMat = new THREE.MeshPhysicalMaterial({
      color: SCLERA,
      roughness: 0.15,
      metalness: 0.0,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
    });
    const sclera = new THREE.Mesh(scleraGeo, scleraMat);
    eyeGroup.add(sclera);

    // Iris — concentric ring texture via canvas
    const irisCanvas = document.createElement('canvas');
    irisCanvas.width = 128;
    irisCanvas.height = 128;
    const ctx = irisCanvas.getContext('2d');
    const cx = 64, cy = 64;
    // Outer iris ring
    for (let r = 50; r > 5; r -= 2) {
      const hue = 90 + (r - 20) * 0.5;
      const lightness = 25 + (50 - r) * 0.6;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(${hue}, 35%, ${lightness}%)`;
      ctx.fill();
    }
    // Radial striations
    ctx.globalCompositeOperation = 'multiply';
    for (let a = 0; a < Math.PI * 2; a += 0.15) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * 50, cy + Math.sin(a) * 50);
      ctx.strokeStyle = 'rgba(40,60,30,0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    // Limbal ring (dark border)
    ctx.beginPath();
    ctx.arc(cx, cy, 50, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(20,15,10,0.6)';
    ctx.lineWidth = 3;
    ctx.stroke();

    const irisTex = new THREE.CanvasTexture(irisCanvas);
    const irisGeo = new THREE.CircleGeometry(0.065, 32);
    const irisMat = new THREE.MeshStandardMaterial({
      map: irisTex,
      roughness: 0.2,
      metalness: 0.1,
    });
    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.z = 0.127;
    eyeGroup.add(iris);

    // Pupil
    const pupilGeo = new THREE.CircleGeometry(0.028, 24);
    const pupilMat = new THREE.MeshBasicMaterial({ color: PUPIL_COLOR });
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.z = 0.1275;
    eyeGroup.add(pupil);

    // Corneal dome — clear bulge for wet look
    const corneaGeo = new THREE.SphereGeometry(0.068, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const corneaMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.08,
      roughness: 0.0,
      metalness: 0.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
    });
    const cornea = new THREE.Mesh(corneaGeo, corneaMat);
    cornea.rotation.x = -Math.PI / 2;
    cornea.position.z = 0.1;
    eyeGroup.add(cornea);

    // Specular highlight
    const hlGeo = new THREE.SphereGeometry(0.015, 10, 10);
    const hlMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });
    const hl = new THREE.Mesh(hlGeo, hlMat);
    hl.position.set(0.025, 0.025, 0.13);
    eyeGroup.add(hl);

    // Secondary highlight (smaller, lower)
    const hl2 = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 })
    );
    hl2.position.set(-0.015, -0.02, 0.13);
    eyeGroup.add(hl2);

    pivot.add(eyeGroup);

    // Upper eyelid — shaped shell that covers the top of the eye
    const upperLid = this._createLid(true);
    pivot.add(upperLid);

    // Lower eyelid
    const lowerLid = this._createLid(false);
    pivot.add(lowerLid);

    // Tear duct (inner corner pink)
    const tearMat = new THREE.MeshStandardMaterial({ color: 0xd49088, roughness: 0.6 });
    const tearGeo = new THREE.SphereGeometry(0.02, 8, 8);
    tearGeo.scale(0.6, 0.8, 0.5);
    const tear = new THREE.Mesh(tearGeo, tearMat);
    tear.position.set(x > 0 ? -0.11 : 0.11, -0.01, 0.08);
    pivot.add(tear);

    // Wet line (lacrimal fluid along lower lid)
    const wetCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.1, -0.06, 0.1),
      new THREE.Vector3(0, -0.075, 0.12),
      new THREE.Vector3(0.1, -0.06, 0.1)
    );
    const wetGeo = new THREE.TubeGeometry(wetCurve, 12, 0.004, 4, false);
    const wetMat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.25,
      roughness: 0.0,
      clearcoat: 1.0,
    });
    pivot.add(new THREE.Mesh(wetGeo, wetMat));

    return { pivot, eyeGroup, pupil, upperLid, sclera, lowerLid };
  }

  _createLid(isUpper) {
    // Create lid as a curved shell geometry
    const segments = 20;
    const rings = 6;
    const geo = new THREE.BufferGeometry();
    const verts = [];
    const indices = [];
    const normals = [];
    const radius = 0.145;

    for (let j = 0; j <= rings; j++) {
      const v = j / rings;
      const phiRange = isUpper ? 0.5 : 0.3;
      const phiStart = isUpper ? 0 : Math.PI * 0.5;
      const phi = phiStart + v * Math.PI * phiRange;

      for (let i = 0; i <= segments; i++) {
        const u = i / segments;
        const theta = -Math.PI * 0.45 + u * Math.PI * 0.9;
        const x = radius * Math.sin(phi) * Math.cos(theta);
        const y = isUpper
          ? radius * Math.cos(phi) * 0.85
          : -radius * Math.cos(phi) * 0.35;
        const z = radius * Math.sin(phi) * Math.sin(theta) * 0.6 + 0.04;
        verts.push(x, y, z);
        normals.push(0, 0, 1);
      }
    }

    for (let j = 0; j < rings; j++) {
      for (let i = 0; i < segments; i++) {
        const a = j * (segments + 1) + i;
        const b = a + segments + 1;
        indices.push(a, b, a + 1);
        indices.push(a + 1, b, b + 1);
      }
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: SKIN,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const lid = new THREE.Mesh(geo, mat);
    return lid;
  }

  _addBrow(x, y, z, isLeft) {
    const dir = isLeft ? 1 : -1;
    const curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(x - 0.16 * dir, y - 0.02, z - 0.02),
      new THREE.Vector3(x - 0.06 * dir, y + 0.05, z + 0.04),
      new THREE.Vector3(x + 0.06 * dir, y + 0.04, z + 0.03),
      new THREE.Vector3(x + 0.16 * dir, y - 0.03, z - 0.01),
    );
    const geo = new THREE.TubeGeometry(curve, 16, 0.022, 6, false);
    const mat = new THREE.MeshStandardMaterial({ color: 0x3a2a18, roughness: 0.9 });
    this.group.add(new THREE.Mesh(geo, mat));

    // Second pass for thickness
    const geo2 = new THREE.TubeGeometry(curve, 16, 0.016, 6, false);
    const brow2 = new THREE.Mesh(geo2, mat);
    brow2.position.y = 0.01;
    this.group.add(brow2);
  }

  _buildMouth() {
    const lipMat = new THREE.MeshStandardMaterial({
      color: LIP_COLOR,
      roughness: 0.4,
      metalness: 0.05,
    });

    // Upper lip
    const upperCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.16, -0.52, 0.6),
      new THREE.Vector3(-0.06, -0.48, 0.68),
      new THREE.Vector3(0.06, -0.48, 0.68),
      new THREE.Vector3(0.16, -0.52, 0.6),
    );
    const upperGeo = new THREE.TubeGeometry(upperCurve, 16, 0.022, 8, false);
    this.group.add(new THREE.Mesh(upperGeo, lipMat));

    // Cupid's bow
    const bowCurve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.04, -0.49, 0.67),
      new THREE.Vector3(0, -0.47, 0.69),
      new THREE.Vector3(0.04, -0.49, 0.67),
    );
    const bowGeo = new THREE.TubeGeometry(bowCurve, 8, 0.012, 6, false);
    this.group.add(new THREE.Mesh(bowGeo, lipMat));

    // Lower lip — fuller
    const lowerCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.14, -0.54, 0.6),
      new THREE.Vector3(-0.05, -0.58, 0.66),
      new THREE.Vector3(0.05, -0.58, 0.66),
      new THREE.Vector3(0.14, -0.54, 0.6),
    );
    const lowerGeo = new THREE.TubeGeometry(lowerCurve, 16, 0.028, 8, false);
    this.group.add(new THREE.Mesh(lowerGeo, lipMat));

    // Lip line (darker separation)
    const lineMat = new THREE.MeshStandardMaterial({ color: 0x6a3535, roughness: 0.6 });
    const lineCurve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(-0.14, -0.525, 0.62),
      new THREE.Vector3(-0.05, -0.52, 0.67),
      new THREE.Vector3(0.05, -0.52, 0.67),
      new THREE.Vector3(0.14, -0.525, 0.62),
    );
    const lineGeo = new THREE.TubeGeometry(lineCurve, 16, 0.006, 4, false);
    this.group.add(new THREE.Mesh(lineGeo, lineMat));
  }

  _addEar(x, y, z, mat, mirrored) {
    const earGroup = new THREE.Group();
    // Outer ear — torus slice
    const outerGeo = new THREE.TorusGeometry(0.1, 0.03, 8, 12, Math.PI);
    const outer = new THREE.Mesh(outerGeo, mat);
    outer.rotation.z = Math.PI / 2;
    outer.rotation.y = mirrored ? -0.3 : 0.3;
    earGroup.add(outer);

    // Lobe
    const lobeGeo = new THREE.SphereGeometry(0.04, 8, 8);
    lobeGeo.scale(0.8, 1.2, 0.6);
    const lobe = new THREE.Mesh(lobeGeo, mat);
    lobe.position.y = -0.1;
    earGroup.add(lobe);

    earGroup.position.set(x, y, z);
    earGroup.rotation.y = mirrored ? 0.2 : -0.2;
    this.group.add(earGroup);
  }

  // === Public API (same interface as before) ===

  setGaze(leftX, leftY, rightX, rightY) {
    const toRad = Math.PI / 180;
    const clamp = (v) => Math.max(-30, Math.min(30, v));
    this.leftEyeGroup.eyeGroup.rotation.y = clamp(leftX) * toRad;
    this.leftEyeGroup.eyeGroup.rotation.x = -clamp(leftY) * toRad;
    this.rightEyeGroup.eyeGroup.rotation.y = clamp(rightX) * toRad;
    this.rightEyeGroup.eyeGroup.rotation.x = -clamp(rightY) * toRad;
  }

  setPupilSize(diameter) {
    const s = 0.5 + ((diameter - 2) / 6) * 1.0;
    this.leftEyeGroup.pupil.scale.set(s, s, 1);
    this.rightEyeGroup.pupil.scale.set(s, s, 1);
  }

  setLidOpenness(value) {
    // Upper lid: rotate to close. 0=closed, 1=open.
    const angle = (1 - value) * 0.65;
    this.leftEyeGroup.upperLid.rotation.x = angle;
    this.rightEyeGroup.upperLid.rotation.x = angle;
  }

  setUpperLidOffset(value) {
    const offset = value * 0.015;
    this.leftEyeGroup.upperLid.position.y = offset;
    this.rightEyeGroup.upperLid.position.y = offset;
  }
}
