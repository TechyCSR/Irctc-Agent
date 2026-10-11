import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Camera,
  Volume2,
  RotateCcw,
} from 'lucide-react';

interface InteractiveTrainCanvasProps {
  className?: string;
  isDark?: boolean;
}

type CameraView = 'ORBIT' | 'TRACKSIDE' | 'CABIN' | 'PASSENGER';

/**
 * Authentic Dual-Tone Locomotive Horn (311 Hz + 370 Hz)
 * Procedural Web Audio API synthesis with realistic acoustic resonance
 */
const playLocomotiveHorn = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const freqs = [311.13, 369.99]; // Dual-tone D#4 / F#4

    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1600, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + 0.08);
      gain.gain.setValueAtTime(0.12, now + 0.65);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.25);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.3);
    });
  } catch (err) {
    console.error('Audio playback error:', err);
  }
};

/** Generates amber digital LED matrix destination display for train front */
const createLEDDestinationTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, 512, 96);

  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 8;
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 36px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('20607 EXPRESS • NON-STOP', 256, 48);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
};

export const InteractiveTrainCanvas: React.FC<InteractiveTrainCanvasProps> = ({
  className = '',
  isDark = false, // Default White / Light Mode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const [cameraView, setCameraView] = useState<CameraView>('PASSENGER');

  const cameraViewRef = useRef(cameraView);

  useEffect(() => {
    cameraViewRef.current = cameraView;
  }, [cameraView]);

  useEffect(() => {
    const mount = canvasMountRef.current;
    if (!mount) return;

    // Remove any previous canvas to prevent duplicate instances
    while (mount.firstChild) {
      mount.removeChild(mount.firstChild);
    }

    let animationFrameId: number;
    const width = mount.clientWidth || 896;
    const height = Math.max(mount.clientHeight || 350, 320);

    // 1. Scene & Atmosphere
    const scene = new THREE.Scene();
    // Soft sky gradient color
    scene.background = new THREE.Color(isDark ? 0x09090b : 0xe0f2fe); // Soft azure sky
    scene.fog = new THREE.FogExp2(isDark ? 0x09090b : 0xe0f2fe, 0.0045);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 1200);
    // Start directly at Window Passenger View looking past coaches
    camera.position.set(-22, 4.2, 7.2);
    camera.lookAt(12, 3.4, 0);

    const renderer = new THREE.WebGLRenderer({
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDark ? 1.25 : 1.1;
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    mount.appendChild(renderer.domElement);

    // 2. Radiant Sun & Lighting Setup
    // Sun position high in the background
    const sunPos = new THREE.Vector3(70, 55, -90);

    // Visible 3D Sun Sphere
    const sunGeo = new THREE.SphereGeometry(7, 24, 24);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xfffae5 });
    const sunMesh = new THREE.Mesh(sunGeo, sunMat);
    sunMesh.position.copy(sunPos);
    scene.add(sunMesh);

    // Glowing Sun Corona Halo
    const coronaGeo = new THREE.SphereGeometry(14, 24, 24);
    const coronaMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: isDark ? 0.2 : 0.45,
      blending: THREE.AdditiveBlending,
    });
    const coronaMesh = new THREE.Mesh(coronaGeo, coronaMat);
    coronaMesh.position.copy(sunPos);
    scene.add(coronaMesh);

    // Directional Sun Key Light casting crisp shadows
    const sunLight = new THREE.DirectionalLight(0xfff9e6, isDark ? 1.6 : 3.0);
    sunLight.position.copy(sunPos);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 20;
    sunLight.shadow.camera.far = 260;
    sunLight.shadow.camera.left = -60;
    sunLight.shadow.camera.right = 60;
    sunLight.shadow.camera.top = 45;
    sunLight.shadow.camera.bottom = -45;
    sunLight.shadow.bias = -0.0004;
    scene.add(sunLight);

    // Sky Ambient Fill (Light blue sky + warm ground bounce)
    const hemiLight = new THREE.HemisphereLight(
      isDark ? 0x27272a : 0xbae6fd, // Sky blue
      isDark ? 0x09090b : 0xdcfce7, // Soft green ground bounce
      isDark ? 1.2 : 1.9
    );
    scene.add(hemiLight);

    // 3. Materials Factory
    const bodyMat = new THREE.MeshPhysicalMaterial({
      color: isDark ? 0xf4f4f5 : 0xffffff,
      roughness: 0.16,
      metalness: 0.15,
      clearcoat: 1.0,
      clearcoatRoughness: 0.08,
    });

    const accentMat = new THREE.MeshPhysicalMaterial({
      color: 0x0b328c, // Royal Blue aerodynamic swoop
      roughness: 0.2,
      metalness: 0.25,
      clearcoat: 0.9,
    });

    const speedStripeMat = new THREE.MeshStandardMaterial({
      color: 0xff6e14, // Vibrant speed stripe
      roughness: 0.2,
      metalness: 0.2,
    });

    const skirtMat = new THREE.MeshStandardMaterial({
      color: 0x1f2328, // Dark undercarriage & skirt
      roughness: 0.5,
      metalness: 0.4,
    });

    const tintedGlassMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.05,
      metalness: 0.9,
      emissive: 0xffedd5,
      emissiveIntensity: isDark ? 0.35 : 0.15,
    });

    const windshieldGlassMat = new THREE.MeshStandardMaterial({
      color: 0x030712,
      roughness: 0.04,
      metalness: 0.95,
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: isDark ? 3.5 : 2.0,
      roughness: 0.1,
    });

    const tailMarkerMat = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });

    const pantoMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626, // Safety red pantograph
      roughness: 0.35,
      metalness: 0.75,
    });

    const railSteelMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.98,
      roughness: 0.1,
    });

    const sleeperMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x27272a : 0xcbd5e1,
      roughness: 0.85,
      metalness: 0.1,
    });

    const clipMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.35,
      metalness: 0.85,
    });

    const steelWheelMat = new THREE.MeshStandardMaterial({
      color: 0xd4d4d8,
      roughness: 0.1,
      metalness: 0.96,
    });

    const bogieFrameMat = new THREE.MeshStandardMaterial({
      color: 0x24272c,
      roughness: 0.5,
      metalness: 0.65,
    });

    // 4. Track Environment & Rolling Countryside Scenery
    const envGroup = new THREE.Group();

    // Grass Landscape Ground Plane
    const grassGeo = new THREE.PlaneGeometry(900, 360);
    const grassMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x141e16 : 0x86efac, // Vibrant landscape green
      roughness: 0.95,
    });
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.rotation.x = -Math.PI / 2;
    grass.position.y = -0.7;
    grass.receiveShadow = true;
    envGroup.add(grass);

    // Ballast Gravel Track Bed
    const ballastGeo = new THREE.BoxGeometry(900, 0.75, 11);
    const ballastMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x1e2025 : 0x94a3b8,
      roughness: 0.95,
    });
    const ballast = new THREE.Mesh(ballastGeo, ballastMat);
    ballast.position.y = -0.35;
    ballast.receiveShadow = true;
    envGroup.add(ballast);

    // Dual Continuous Broad Gauge Steel Rails (Gauge 3.4 units)
    const railLength = 900;
    const railGeo = new THREE.BoxGeometry(railLength, 0.45, 0.28);

    const leftRail = new THREE.Mesh(railGeo, railSteelMat);
    leftRail.position.set(0, 0.22, -1.7);
    leftRail.castShadow = true;
    leftRail.receiveShadow = true;
    envGroup.add(leftRail);

    const rightRail = new THREE.Mesh(railGeo, railSteelMat);
    rightRail.position.set(0, 0.22, 1.7);
    rightRail.castShadow = true;
    rightRail.receiveShadow = true;
    envGroup.add(rightRail);

    // Concrete PSC Sleepers Group with Moving Offset
    const sleeperCount = 220;
    const sleeperSpacing = 3.2;
    const sleepersGroup = new THREE.Group();

    const singleSleeperGeo = new THREE.BoxGeometry(0.85, 0.38, 5.8);
    const clipGeo = new THREE.BoxGeometry(0.2, 0.15, 0.18);

    for (let i = 0; i < sleeperCount; i++) {
      const sleeperSub = new THREE.Group();
      const sMesh = new THREE.Mesh(singleSleeperGeo, sleeperMat);
      sMesh.receiveShadow = true;
      sleeperSub.add(sMesh);

      [-1.9, -1.5, 1.5, 1.9].forEach((zOff) => {
        const clip = new THREE.Mesh(clipGeo, clipMat);
        clip.position.set(0, 0.2, zOff);
        sleeperSub.add(clip);
      });

      sleeperSub.position.x = (i - sleeperCount / 2) * sleeperSpacing;
      sleeperSub.position.y = 0.05;
      sleepersGroup.add(sleeperSub);
    }
    envGroup.add(sleepersGroup);

    // 5. Rolling Scenery Trees along Railway Corridor
    // - Far Trackside Trees: along the other side of the train (z = -8 to -12)
    // - Near Trackside Trees: along the window passenger side (z = 10 to 14)
    // - Distant Horizon Trees: deep scenic countryside background (z = -26 to -34)
    const treeTrunkGeo = new THREE.CylinderGeometry(0.25, 0.45, 3.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });

    // Distinct natural tree canopy materials
    const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x15803d, roughness: 0.8 }); // Emerald green
    const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.85 }); // Deep forest green
    const foliageMat3 = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.75 }); // Bright green

    // Helper to generate natural conifer or lush broadleaf trees
    const buildTree = (type: number, colorIdx: number): THREE.Group => {
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(treeTrunkGeo, trunkMat);
      trunk.position.y = 1.6;
      trunk.castShadow = true;
      tree.add(trunk);

      const fMat = colorIdx % 3 === 0 ? foliageMat1 : colorIdx % 3 === 1 ? foliageMat2 : foliageMat3;

      if (type === 0) {
        // Conical pine
        const cone1 = new THREE.Mesh(new THREE.ConeGeometry(2.2, 3.4, 7), fMat);
        cone1.position.y = 4.0;
        cone1.castShadow = true;
        tree.add(cone1);

        const cone2 = new THREE.Mesh(new THREE.ConeGeometry(1.7, 2.6, 7), fMat);
        cone2.position.y = 5.7;
        cone2.castShadow = true;
        tree.add(cone2);

        const cone3 = new THREE.Mesh(new THREE.ConeGeometry(1.1, 1.8, 7), fMat);
        cone3.position.y = 7.0;
        cone3.castShadow = true;
        tree.add(cone3);
      } else {
        // Lush broadleaf canopy
        const crownBase = new THREE.Mesh(new THREE.SphereGeometry(2.0, 8, 8), fMat);
        crownBase.position.y = 4.4;
        crownBase.scale.set(1.15, 0.9, 1.15);
        crownBase.castShadow = true;
        tree.add(crownBase);

        const crownTop = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 8), fMat);
        crownTop.position.set(0.2, 5.6, 0.1);
        crownTop.castShadow = true;
        tree.add(crownTop);
      }

      return tree;
    };

    // Row A: Far Trackside Trees (visible alongside the train on the far side)
    const sideTreesFarGroup = new THREE.Group();
    const treeCountFar = 24;
    const treeSpacingFar = 22;
    for (let i = 0; i < treeCountFar; i++) {
      const t = buildTree(i % 2, i);
      const zPos = -(8.5 + (i % 3) * 2.0);
      const xPos = (i - treeCountFar / 2) * treeSpacingFar;
      t.position.set(xPos, -0.7, zPos);
      const s = 0.9 + (i % 4) * 0.15;
      t.scale.set(s, s, s);
      sideTreesFarGroup.add(t);
    }
    envGroup.add(sideTreesFarGroup);

    // Row B: Near Trackside Trees (visible rushing past on the window/passenger side)
    const sideTreesNearGroup = new THREE.Group();
    const treeCountNear = 18;
    const treeSpacingNear = 28;
    for (let i = 0; i < treeCountNear; i++) {
      const t = buildTree((i + 1) % 2, i + 1);
      const zPos = 10.0 + (i % 3) * 1.8;
      const xPos = (i - treeCountNear / 2) * treeSpacingNear;
      t.position.set(xPos, -0.7, zPos);
      const s = 0.85 + (i % 3) * 0.12;
      t.scale.set(s, s, s);
      sideTreesNearGroup.add(t);
    }
    envGroup.add(sideTreesNearGroup);

    // Row C: Distant Horizon Trees (deep scenic countryside background)
    const distantTreesGroup = new THREE.Group();
    const treeCountDistant = 16;
    const treeSpacingDistant = 34;
    for (let i = 0; i < treeCountDistant; i++) {
      const t = buildTree(i % 2, i + 2);
      const zPos = -(26.0 + (i % 4) * 3.0);
      const xPos = (i - treeCountDistant / 2) * treeSpacingDistant;
      t.position.set(xPos, -0.7, zPos);
      const s = 1.15 + (i % 3) * 0.2;
      t.scale.set(s, s, s);
      distantTreesGroup.add(t);
    }
    envGroup.add(distantTreesGroup);

    // 25 kV AC Overhead Catenary (OHE) Lattice Masts
    const mastsGroup = new THREE.Group();
    const mastPoleGeo = new THREE.CylinderGeometry(0.18, 0.22, 15, 8);
    const mastArmGeo = new THREE.BoxGeometry(0.16, 0.16, 7.5);
    const mastMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.8,
      roughness: 0.35,
    });
    const insulatorMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.3,
    });

    const mastCount = 20;
    const mastSpacing = 36;
    for (let i = 0; i < mastCount; i++) {
      const mastSub = new THREE.Group();

      const pole = new THREE.Mesh(mastPoleGeo, mastMat);
      pole.position.set(0, 7.5, -4.6);
      pole.castShadow = true;
      mastSub.add(pole);

      const arm = new THREE.Mesh(mastArmGeo, mastMat);
      arm.position.set(0, 14.2, -1.8);
      mastSub.add(arm);

      // Ceramic insulator
      const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.7, 8), insulatorMat);
      insulator.position.set(0, 13.6, 0);
      mastSub.add(insulator);

      // Signal bulb
      const sigBulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.2, 8, 8),
        new THREE.MeshBasicMaterial({ color: i % 2 === 0 ? 0x10b981 : 0xf59e0b })
      );
      sigBulb.position.set(0, 13.9, 0.8);
      mastSub.add(sigBulb);

      mastSub.position.x = (i - mastCount / 2) * mastSpacing;
      mastsGroup.add(mastSub);
    }
    envGroup.add(mastsGroup);

    // Overhead Wires
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const catenaryWire = new THREE.Mesh(new THREE.BoxGeometry(railLength, 0.05, 0.05), wireMat);
    catenaryWire.position.set(0, 14.1, 0);
    envGroup.add(catenaryWire);

    const contactWire = new THREE.Mesh(new THREE.BoxGeometry(railLength, 0.06, 0.06), wireMat);
    contactWire.position.set(0, 13.2, 0);
    envGroup.add(contactWire);

    scene.add(envGroup);

    // 6. Build the 3-Compartment Modern Train with Visible Rolling Wheels
    const trainRake = new THREE.Group();

    // Wheel Meshes collection for dynamic rolling rotation
    const wheelMeshes: THREE.Mesh[] = [];

    // Helper: Build Twin-Axle Bogie with Visible Rail Wheels
    const buildBogie = () => {
      const bogie = new THREE.Group();

      // Bogie sideframes (Cast steel chassis)
      const frameL = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.4, 0.25), bogieFrameMat);
      frameL.position.set(0, 0.75, -1.85);
      frameL.castShadow = true;
      bogie.add(frameL);

      const frameR = new THREE.Mesh(new THREE.BoxGeometry(4.8, 0.4, 0.25), bogieFrameMat);
      frameR.position.set(0, 0.75, 1.85);
      frameR.castShadow = true;
      bogie.add(frameR);

      // Center crossmember
      const cross = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 3.6), bogieFrameMat);
      cross.position.set(0, 0.75, 0);
      bogie.add(cross);

      // Two Axles with Visible Tapered Steel Wheels Rolling on Rails
      const wheelGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.34, 24);
      [-1.6, 1.6].forEach((xOff) => {
        // Steel axle shaft
        const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 3.7, 8), bogieFrameMat);
        axle.rotation.x = Math.PI / 2;
        axle.position.set(xOff, 0.94, 0);
        bogie.add(axle);

        // Left Rail Wheel
        const wheelL = new THREE.Mesh(wheelGeo, steelWheelMat);
        wheelL.rotation.x = Math.PI / 2;
        wheelL.position.set(xOff, 0.94, -1.7);
        wheelL.castShadow = true;
        bogie.add(wheelL);
        wheelMeshes.push(wheelL);

        // Right Rail Wheel
        const wheelR = new THREE.Mesh(wheelGeo, steelWheelMat);
        wheelR.rotation.x = Math.PI / 2;
        wheelR.position.set(xOff, 0.94, 1.7);
        wheelR.castShadow = true;
        bogie.add(wheelR);
        wheelMeshes.push(wheelR);

        // Secondary suspension springs above axle boxes
        [-1.85, 1.85].forEach((zOff) => {
          const spring = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 8), bogieFrameMat);
          spring.position.set(xOff, 1.25, zOff);
          bogie.add(spring);
        });
      });

      return bogie;
    };

    // Helper: Build High-Speed Roof Pantograph
    const buildPantograph = () => {
      const panto = new THREE.Group();
      const base = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.25, 2.4), bogieFrameMat);
      base.position.y = 5.25;
      panto.add(base);

      const lowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 4.6, 8), pantoMat);
      lowerArm.position.set(-0.8, 7.2, 0);
      lowerArm.rotation.z = -0.55;
      panto.add(lowerArm);

      const upperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 4.4, 8), pantoMat);
      upperArm.position.set(0.6, 11.0, 0);
      upperArm.rotation.z = 0.5;
      panto.add(upperArm);

      const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 3.2), bogieFrameMat);
      head.position.set(1.6, 13.2, 0);
      panto.add(head);

      return panto;
    };

    // Helper: Build Standard Passenger Coach Body
    const buildPassengerCoach = (length: number, hasPantograph: boolean) => {
      const coach = new THREE.Group();
      const height = 4.4;
      const width = 4.2;

      // Main aerodynamic shell
      const body = new THREE.Mesh(new THREE.BoxGeometry(length, height, width), bodyMat);
      body.position.set(0, height / 2 + 1.0, 0);
      body.castShadow = true;
      body.receiveShadow = true;
      coach.add(body);

      // Continuous Panoramic Tinted Window Ribbon
      const windowRibbon = new THREE.Mesh(
        new THREE.BoxGeometry(length - 1.2, 1.35, width + 0.08),
        tintedGlassMat
      );
      windowRibbon.position.set(0, 3.3, 0);
      coach.add(windowRibbon);

      // Royal Blue Flank Accent Band
      const accentBand = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.45, width + 0.1),
        accentMat
      );
      accentBand.position.set(0, 2.2, 0);
      coach.add(accentBand);

      // Speed Stripe
      const speedStripe = new THREE.Mesh(
        new THREE.BoxGeometry(length, 0.14, width + 0.12),
        speedStripeMat
      );
      speedStripe.position.set(0, 1.9, 0);
      coach.add(speedStripe);

      // Lower Skirt with Arched Wheel Well Cutouts (Leaves wheels visible!)
      const skirt = new THREE.Mesh(new THREE.BoxGeometry(length, 0.55, width - 0.3), skirtMat);
      skirt.position.set(0, 1.0, 0);
      coach.add(skirt);

      // Aerodynamic Roof AC Shrouds
      [-5.5, 5.5].forEach((xOff) => {
        const ac = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.45, 2.8), skirtMat);
        ac.position.set(xOff, 5.4, 0);
        coach.add(ac);
      });

      if (hasPantograph) {
        const panto = buildPantograph();
        panto.position.set(0, 0, 0);
        coach.add(panto);
      }

      // Front & Rear Bogies with Visible Rolling Wheels
      const bogieF = buildBogie();
      bogieF.position.set(length / 2 - 3.8, 0, 0);
      coach.add(bogieF);

      const bogieR = buildBogie();
      bogieR.position.set(-length / 2 + 3.8, 0, 0);
      coach.add(bogieR);

      return coach;
    };

    // --- COMPARTMENT 1: Lead Locomotive / Driving Cab Car ---
    // Realistic flush aerodynamic raked front (NO awkward protruding bulbous nose)
    const leadCoach = new THREE.Group();
    const leadLength = 22;
    const coachHeight = 4.4;
    const coachWidth = 4.2;

    // Lead Body Shell
    const leadBody = new THREE.Mesh(
      new THREE.BoxGeometry(leadLength, coachHeight, coachWidth),
      bodyMat
    );
    leadBody.position.set(0, coachHeight / 2 + 1.0, 0);
    leadBody.castShadow = true;
    leadBody.receiveShadow = true;
    leadCoach.add(leadBody);

    // Integrated Aerodynamic Sloped Cab Front Face (Clean, flush wedge)
    const cabSlopeGeo = new THREE.BoxGeometry(3.6, coachHeight, coachWidth);
    const cabSlopeMesh = new THREE.Mesh(cabSlopeGeo, bodyMat);
    cabSlopeMesh.position.set(leadLength / 2 + 1.4, coachHeight / 2 + 0.95, 0);
    cabSlopeMesh.rotation.z = -0.32; // Aerodynamic rake angle
    cabSlopeMesh.castShadow = true;
    leadCoach.add(cabSlopeMesh);

    // Raked Panoramic Driver Windscreen (Flush into cab slope)
    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 1.6, coachWidth - 0.4),
      windshieldGlassMat
    );
    windshield.position.set(leadLength / 2 + 2.2, 3.8, 0);
    windshield.rotation.z = -0.42;
    leadCoach.add(windshield);

    // Digital LED Destination Headboard inside Windscreen
    const destTex = createLEDDestinationTexture();
    const destMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 0.42),
      new THREE.MeshBasicMaterial({ map: destTex, side: THREE.DoubleSide, transparent: true })
    );
    destMesh.rotation.y = Math.PI / 2;
    destMesh.rotation.z = -0.42;
    destMesh.position.set(leadLength / 2 + 2.6, 4.3, 0);
    leadCoach.add(destMesh);

    // Flush Twin Projector LED Headlights set into the front
    [-1.5, 1.5].forEach((zOff) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.35, 0.65), headlightMat);
      hl.position.set(leadLength / 2 + 2.7, 2.2, zOff);
      leadCoach.add(hl);

      const redMarker = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), tailMarkerMat);
      redMarker.position.set(leadLength / 2 + 2.9, 1.9, zOff > 0 ? 1.7 : -1.7);
      leadCoach.add(redMarker);
    });

    // Real High-Beam Projector Spotlight Illuminating the Tracks
    const headlampSpot = new THREE.SpotLight(0xfff7e6, isDark ? 4.5 : 2.5);
    headlampSpot.position.set(leadLength / 2 + 3.2, 2.3, 0);
    const targetObj = new THREE.Object3D();
    targetObj.position.set(leadLength / 2 + 65, 0.3, 0);
    scene.add(targetObj);
    headlampSpot.target = targetObj;
    headlampSpot.angle = 0.42;
    headlampSpot.penumbra = 0.6;
    headlampSpot.distance = 110;
    headlampSpot.castShadow = true;
    leadCoach.add(headlampSpot);

    // Lead Passenger Windows, Accent Stripes & Skirt
    const leadWindow = new THREE.Mesh(
      new THREE.BoxGeometry(leadLength - 6, 1.35, coachWidth + 0.08),
      tintedGlassMat
    );
    leadWindow.position.set(-2, 3.3, 0);
    leadCoach.add(leadWindow);

    const leadAccent = new THREE.Mesh(
      new THREE.BoxGeometry(leadLength - 3, 0.45, coachWidth + 0.1),
      accentMat
    );
    leadAccent.position.set(-1, 2.2, 0);
    leadCoach.add(leadAccent);

    const leadStripe = new THREE.Mesh(
      new THREE.BoxGeometry(leadLength - 2, 0.14, coachWidth + 0.12),
      speedStripeMat
    );
    leadStripe.position.set(-0.5, 1.9, 0);
    leadCoach.add(leadStripe);

    const leadSkirt = new THREE.Mesh(new THREE.BoxGeometry(leadLength, 0.55, coachWidth - 0.3), skirtMat);
    leadSkirt.position.set(0, 1.0, 0);
    leadCoach.add(leadSkirt);

    // Bogies with Visible Rolling Wheels for Lead Coach
    const bogieLeadF = buildBogie();
    bogieLeadF.position.set(leadLength / 2 - 3.8, 0, 0);
    leadCoach.add(bogieLeadF);

    const bogieLeadR = buildBogie();
    bogieLeadR.position.set(-leadLength / 2 + 3.8, 0, 0);
    leadCoach.add(bogieLeadR);

    trainRake.add(leadCoach);

    // --- COMPARTMENT 2: Middle Motor Coach (with Roof Pantograph) ---
    const middleLength = 20;
    const middleCoach = buildPassengerCoach(middleLength, true);
    const gangwayGap = 1.4;
    middleCoach.position.set(-leadLength / 2 - middleLength / 2 - gangwayGap, 0, 0);
    trainRake.add(middleCoach);

    // Inter-Coach Vestibule 1 (between Coach 1 & 2)
    const vestibule1 = new THREE.Mesh(
      new THREE.BoxGeometry(gangwayGap, 3.8, 3.6),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
    );
    vestibule1.position.set(-leadLength / 2 - gangwayGap / 2, coachHeight / 2 + 1.0, 0);
    trainRake.add(vestibule1);

    // --- COMPARTMENT 3: Rear Trailing Coach ---
    const rearLength = 20;
    const rearCoach = buildPassengerCoach(rearLength, false);
    rearCoach.position.set(
      -leadLength / 2 - middleLength - rearLength / 2 - gangwayGap * 2,
      0,
      0
    );
    trainRake.add(rearCoach);

    // Inter-Coach Vestibule 2 (between Coach 2 & 3)
    const vestibule2 = new THREE.Mesh(
      new THREE.BoxGeometry(gangwayGap, 3.8, 3.6),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 })
    );
    vestibule2.position.set(
      -leadLength / 2 - middleLength - gangwayGap * 1.5,
      coachHeight / 2 + 1.0,
      0
    );
    trainRake.add(vestibule2);

    // Position entire 3-compartment train centrally in view
    trainRake.position.set(10, 0, 0);
    scene.add(trainRake);

    // 7. Interaction & Mouse Parallax
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = mount.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseX = x;
      mouseY = y;
    };
    mount.addEventListener('mousemove', handleMouseMove);

    // 8. Motion Animation Loop (Constant smooth cruise speed: 145 km/h)
    let clock = new THREE.Clock();
    let sleeperOffset = 0;
    let mastOffset = 0;
    let sideTreesFarOffset = 0;
    let sideTreesNearOffset = 0;
    let distantTreesOffset = 0;
    const worldSpeed = 145 * 0.48; // Constant smooth cruise speed

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Skip render calculations when canvas container is hidden (e.g. on mobile screens)
      if (!mount || mount.clientWidth === 0 || mount.clientHeight === 0) {
        return;
      }

      const delta = clock.getDelta();

      // Move sleepers backward to create track motion
      sleeperOffset -= worldSpeed * delta;
      if (sleeperOffset < -sleeperSpacing) {
        sleeperOffset %= sleeperSpacing;
      }
      sleepersGroup.position.x = sleeperOffset;

      // Move catenary masts
      mastOffset -= worldSpeed * delta;
      if (mastOffset < -mastSpacing) {
        mastOffset %= mastSpacing;
      }
      mastsGroup.position.x = mastOffset;

      // Move far trackside trees along the train
      sideTreesFarOffset -= worldSpeed * delta;
      if (sideTreesFarOffset < -treeSpacingFar) {
        sideTreesFarOffset %= treeSpacingFar;
      }
      sideTreesFarGroup.position.x = sideTreesFarOffset;

      // Move near trackside trees rushing past the window view
      sideTreesNearOffset -= worldSpeed * delta;
      if (sideTreesNearOffset < -treeSpacingNear) {
        sideTreesNearOffset %= treeSpacingNear;
      }
      sideTreesNearGroup.position.x = sideTreesNearOffset;

      // Move distant horizon trees
      distantTreesOffset -= worldSpeed * delta;
      if (distantTreesOffset < -treeSpacingDistant) {
        distantTreesOffset %= treeSpacingDistant;
      }
      distantTreesGroup.position.x = distantTreesOffset;

      // Spin rail wheels realistically in sync with velocity
      const wheelRotDelta = (worldSpeed / 0.72) * delta;
      wheelMeshes.forEach((w) => {
        w.rotation.y += wheelRotDelta;
      });

      // Subtle high-speed rail pitch & suspension oscillation
      const time = clock.getElapsedTime();
      trainRake.position.y = Math.sin(time * 24) * 0.025;
      trainRake.rotation.z = Math.sin(time * 12) * 0.003;

      // Camera view positions & smooth lerp
      const view = cameraViewRef.current;
      let targetPos = new THREE.Vector3(-22, 4.2, 7.2);
      let targetLookAt = new THREE.Vector3(12, 3.4, 0);

      if (view === 'PASSENGER') {
        // Window Passenger Side View looking past coaches with trees rushing on side
        targetPos.set(-22 + mouseX * 3.5, 4.2 + mouseY * 1.5, 7.2);
        targetLookAt.set(12, 3.4, 0);
      } else if (view === 'ORBIT') {
        // Orbit perspective showing the full 3-compartment train, trees & sun
        targetPos.set(24 + mouseX * 8, 16 + mouseY * 6, 48);
        targetLookAt.set(-10, 3.2, 0);
      } else if (view === 'TRACKSIDE') {
        // Low-angle railfan angle right beside the rolling wheels
        targetPos.set(16 + mouseX * 4, 2.6 + mouseY * 2, 9.8);
        targetLookAt.set(-14, 3.2, 0);
      } else if (view === 'CABIN') {
        // Front Chase / Driver View looking down the rails into the sunny horizon
        targetPos.set(28, 4.8, 2.2 + mouseX * 2);
        targetLookAt.set(85, 2.5, 0);
      }

      camera.position.lerp(targetPos, 0.08);
      camera.lookAt(targetLookAt);

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!mount || mount.clientWidth === 0 || mount.clientHeight === 0) return;
      const w = mount.clientWidth;
      const h = Math.max(mount.clientHeight, 300);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      mount.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
      if (renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [isDark]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full rounded-2xl overflow-hidden border transition-all duration-300 shadow-xl ${
        isDark
          ? 'border-zinc-800 bg-zinc-950 text-white'
          : 'border-zinc-200/90 bg-gradient-to-b from-sky-50 via-white to-sky-50 text-zinc-900'
      } h-[340px] sm:h-[370px] ${className}`}
    >
      {/* 3D Canvas Mount Point */}
      <div
        ref={canvasMountRef}
        className="w-full h-full cursor-grab active:cursor-grabbing relative"
      />

      {/* Floating Minimal Controls: Camera View Angles, Horn & Reset */}
      <div className="absolute bottom-3.5 right-3.5 flex items-center gap-2 pointer-events-auto z-20">
        {/* Dual-Tone Locomotive Horn */}
        <button
          type="button"
          onClick={playLocomotiveHorn}
          className="px-3 py-1.5 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
          title="Sound Locomotive Dual-Tone Horn"
        >
          <Volume2 className="w-3.5 h-3.5 text-amber-500" />
          <span>Horn</span>
        </button>

        {/* Reset Camera View */}
        <button
          type="button"
          onClick={() => setCameraView('PASSENGER')}
          className="p-2 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:text-zinc-950 dark:hover:text-white shadow-sm transition active:scale-95"
          title="Reset to Window View"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>

        {/* Camera View Angles Selector */}
        <div className="flex items-center gap-1 p-1 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-md backdrop-blur-md">
          <span className="text-[11px] font-mono font-bold text-zinc-400 px-2 flex items-center gap-1">
            <Camera className="w-3 h-3" /> CAM:
          </span>
          {[
            { id: 'PASSENGER', label: 'Window View' },
            { id: 'ORBIT', label: 'Orbit 3D' },
            { id: 'TRACKSIDE', label: 'Trackside' },
            { id: 'CABIN', label: 'Driver Front' },
          ].map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCameraView(c.id as CameraView)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition ${
                cameraView === c.id
                  ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
