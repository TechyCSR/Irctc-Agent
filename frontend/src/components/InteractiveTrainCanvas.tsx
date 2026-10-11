import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  Gauge,
  Camera,
  Volume2,
  Image as ImageIcon,
  X,
} from 'lucide-react';

interface InteractiveTrainCanvasProps {
  className?: string;
  isDark?: boolean;
}

type LiveryType = 'BLUE_WHITE' | 'SAFFRON_GREY';
type CameraView = 'ISOMETRIC' | 'TRACKSIDE' | 'CABIN' | 'PASSENGER';

// --- Procedural Canvas Texture Generators ---

/** Generates official circular Indian Railways red & gold medallion emblem */
const createIRMedallionTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, 256, 256);

  // Outer red circle
  ctx.beginPath();
  ctx.arc(128, 128, 118, 0, Math.PI * 2);
  ctx.fillStyle = '#b91c1c'; // Deep IR red
  ctx.fill();

  // Gold outer ring
  ctx.lineWidth = 8;
  ctx.strokeStyle = '#f59e0b'; // Gold
  ctx.stroke();

  // Inner ring
  ctx.beginPath();
  ctx.arc(128, 128, 90, 0, Math.PI * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#fbbf24';
  ctx.stroke();

  // Central wheel / chakra spokes
  ctx.strokeStyle = '#fbbf24';
  ctx.lineWidth = 3;
  for (let i = 0; i < 16; i++) {
    const angle = (i * Math.PI * 2) / 16;
    ctx.beginPath();
    ctx.moveTo(128, 128);
    ctx.lineTo(128 + Math.cos(angle) * 72, 128 + Math.sin(angle) * 72);
    ctx.stroke();
  }

  // Center hub
  ctx.beginPath();
  ctx.arc(128, 128, 20, 0, Math.PI * 2);
  ctx.fillStyle = '#f59e0b';
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
};

/** Generates amber digital LED matrix destination headboard display */
const createLEDDestinationTexture = (text: string): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Dark LED display background
  ctx.fillStyle = '#080808';
  ctx.fillRect(0, 0, 512, 96);

  // Amber LED glowing matrix text
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur = 10;
  ctx.fillStyle = '#fbbf24';
  ctx.font = 'bold 36px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 48);

  const tex = new THREE.CanvasTexture(canvas);
  return tex;
};

/** Generates side cab branding decals ("वंदे भारत EXPRESS" + Make In India Lion) */
const createCabDecalTexture = (): THREE.CanvasTexture => {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.clearRect(0, 0, 512, 160);

  // Make in India circle badge on left
  ctx.beginPath();
  ctx.arc(70, 80, 50, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.fill();
  ctx.strokeStyle = '#475569';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Lion silhouette representation
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('MAKE IN', 70, 70);
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('INDIA', 70, 94);

  // "वंदे भारत" text + speed swoosh
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.font = 'bold 44px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('वंदे भारत', 150, 68);

  ctx.font = 'bold 24px sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('EXPRESS', 154, 102);

  // Indian Tricolor Accent bar
  ctx.fillStyle = '#ff7700'; // Saffron
  ctx.fillRect(154, 116, 70, 5);
  ctx.fillStyle = '#ffffff'; // White
  ctx.fillRect(224, 116, 70, 5);
  ctx.fillStyle = '#138808'; // Green
  ctx.fillRect(294, 116, 70, 5);

  const tex = new THREE.CanvasTexture(canvas);
  tex.anisotropy = 8;
  return tex;
};

/** Procedural Web Audio twin-tone horn for Indian Railways (Train 18 / WAP-7) */
const playAuthenticTrainHorn = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Twin-tone pneumatic frequencies: ~311 Hz (D#4) + ~370 Hz (F#4)
    const freqs = [311.13, 369.99];

    freqs.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);

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

export const InteractiveTrainCanvas: React.FC<InteractiveTrainCanvasProps> = ({
  className = '',
  isDark = false, // Default is light mode
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [livery, setLivery] = useState<LiveryType>('BLUE_WHITE');
  const [cameraView, setCameraView] = useState<CameraView>('ISOMETRIC');
  const [speedSetting, setSpeedSetting] = useState<130 | 160 | 180>(160);
  const [showPhotoRefModal, setShowPhotoRefModal] = useState<boolean>(false);
  const [activePhotoTab, setActivePhotoTab] = useState<'BLUE' | 'SAFFRON'>('BLUE');

  const liveryRef = useRef(livery);
  const cameraViewRef = useRef(cameraView);
  const speedRef = useRef(speedSetting);

  useEffect(() => {
    liveryRef.current = livery;
  }, [livery]);

  useEffect(() => {
    cameraViewRef.current = cameraView;
  }, [cameraView]);

  useEffect(() => {
    speedRef.current = speedSetting;
  }, [speedSetting]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    const width = container.clientWidth || 920;
    const height = Math.max(container.clientHeight || 440, 420);

    // 1. Scene & Atmosphere
    const scene = new THREE.Scene();
    // Warm daylight fog in light mode, atmospheric night fog in dark mode
    scene.fog = new THREE.FogExp2(isDark ? 0x09090b : 0xf1f5f9, 0.0065);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.5, 900);
    camera.position.set(28, 20, 52);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDark ? 1.25 : 1.05;
    container.appendChild(renderer.domElement);

    // 2. Lighting Setup
    // Sun Key Light with soft directional shadows
    const sunLight = new THREE.DirectionalLight(0xfffdf7, isDark ? 1.6 : 2.8);
    sunLight.position.set(50, 75, 40);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 180;
    sunLight.shadow.camera.left = -40;
    sunLight.shadow.camera.right = 40;
    sunLight.shadow.camera.top = 40;
    sunLight.shadow.camera.bottom = -40;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Sky & Ambient fill
    const ambientLight = new THREE.AmbientLight(
      isDark ? 0x27272a : 0xe0e7ff,
      isDark ? 1.2 : 2.1
    );
    scene.add(ambientLight);

    // Soft ground bounce light
    const bounceLight = new THREE.DirectionalLight(
      isDark ? 0x18181b : 0xf8fafc,
      isDark ? 0.4 : 0.8
    );
    bounceLight.position.set(-30, -20, -30);
    scene.add(bounceLight);

    // 3. Procedural Shared Textures
    const medallionTex = createIRMedallionTexture();
    const destinationTex = createLEDDestinationTexture('20607 VANDE BHARAT EXP • NEW DELHI');
    const cabDecalTex = createCabDecalTexture();

    // 4. Dynamic Material Factory based on Livery
    const getMaterials = (liv: LiveryType) => {
      const isBlue = liv === 'BLUE_WHITE';

      return {
        // Main Train Body Shell: Pearl White (Classic) OR Saffron Orange (2024)
        body: new THREE.MeshStandardMaterial({
          color: isBlue ? 0xfbfcfe : 0xff6e14,
          roughness: 0.18,
          metalness: 0.1,
          bumpScale: 0.02,
        }),
        // Secondary Livery Accent: Royal Blue (Classic) OR Charcoal Slate (2024)
        accent: new THREE.MeshStandardMaterial({
          color: isBlue ? 0x092f87 : 0x2e3036,
          roughness: 0.22,
          metalness: 0.25,
        }),
        // Tertiary Speed Stripe: Saffron Orange in Blue mode, White in Saffron mode
        stripe: new THREE.MeshStandardMaterial({
          color: isBlue ? 0xff7700 : 0xffffff,
          roughness: 0.2,
          metalness: 0.2,
        }),
        // Aerodynamic Underbelly & Skirt
        skirt: new THREE.MeshStandardMaterial({
          color: 0x18181b,
          roughness: 0.4,
          metalness: 0.3,
        }),
        // Flush Tinted Panoramic Windows
        windowGlass: new THREE.MeshStandardMaterial({
          color: isDark ? 0x1e293b : 0x0f172a,
          roughness: 0.08,
          metalness: 0.85,
          emissive: 0xffedd5,
          emissiveIntensity: isDark ? 0.35 : 0.15,
        }),
        // Windshield Panoramic Tint Glass
        windshield: new THREE.MeshStandardMaterial({
          color: 0x090d16,
          roughness: 0.05,
          metalness: 0.92,
        }),
        // Headlight Reflector & LED
        headlight: new THREE.MeshStandardMaterial({
          color: 0xffffff,
          emissive: 0xffffff,
          emissiveIntensity: isDark ? 3.0 : 1.8,
          roughness: 0.1,
        }),
        // Red Tail Lamp Marker
        tailMarker: new THREE.MeshStandardMaterial({
          color: 0xef4444,
          emissive: 0xef4444,
          emissiveIntensity: 1.5,
          roughness: 0.2,
        }),
        // High-Speed Red Pantograph Frame
        pantograph: new THREE.MeshStandardMaterial({
          color: 0xdc2626, // IR safety red
          roughness: 0.35,
          metalness: 0.7,
        }),
        // Wheel & Bogie Cast Steel
        steelWheel: new THREE.MeshStandardMaterial({
          color: 0xd1d5db,
          roughness: 0.15,
          metalness: 0.95,
        }),
        bogieFrame: new THREE.MeshStandardMaterial({
          color: 0x27272a,
          roughness: 0.5,
          metalness: 0.6,
        }),
      };
    };

    let activeMaterials = getMaterials(liveryRef.current);

    // 5. Build Track Environment (Broad Gauge 1676mm, Concrete Sleepers, Ballast)
    const envGroup = new THREE.Group();

    // Ground Plane with subtle grid
    const groundMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x09090b : 0xf8fafc,
      roughness: 0.9,
    });
    const groundGeo = new THREE.PlaneGeometry(800, 320);
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.7;
    ground.receiveShadow = true;
    envGroup.add(ground);

    // Ballast Bed (Textured stone roadbed)
    const ballastGeo = new THREE.BoxGeometry(800, 0.75, 11);
    const ballastMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x1e2025 : 0x94a3b8,
      roughness: 0.95,
    });
    const ballast = new THREE.Mesh(ballastGeo, ballastMat);
    ballast.position.y = -0.35;
    ballast.receiveShadow = true;
    envGroup.add(ballast);

    // Dual Broad Gauge Continuous Steel Rails (Gauge ~3.4 units)
    const railMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.95,
      roughness: 0.12,
    });
    const railLength = 800;
    const railGeo = new THREE.BoxGeometry(railLength, 0.45, 0.28);

    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(0, 0.22, -1.7);
    leftRail.castShadow = true;
    leftRail.receiveShadow = true;
    envGroup.add(leftRail);

    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(0, 0.22, 1.7);
    rightRail.castShadow = true;
    rightRail.receiveShadow = true;
    envGroup.add(rightRail);

    // Indian Railways Concrete PSC-60 Sleepers with moving offset
    const sleeperCount = 200;
    const sleeperSpacing = 3.2;
    const sleepersGroup = new THREE.Group();

    const sleeperMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x27272a : 0xcbd5e1,
      roughness: 0.8,
      metalness: 0.1,
    });
    const clipMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.4,
      metalness: 0.8,
    });

    const singleSleeperGeo = new THREE.BoxGeometry(0.85, 0.38, 5.8);
    const clipGeo = new THREE.BoxGeometry(0.2, 0.15, 0.18);

    for (let i = 0; i < sleeperCount; i++) {
      const sleeperSub = new THREE.Group();
      const sMesh = new THREE.Mesh(singleSleeperGeo, sleeperMat);
      sMesh.receiveShadow = true;
      sleeperSub.add(sMesh);

      // Pandrol clips on left and right rail seats
      const clipL1 = new THREE.Mesh(clipGeo, clipMat);
      clipL1.position.set(0, 0.2, -1.9);
      sleeperSub.add(clipL1);

      const clipL2 = new THREE.Mesh(clipGeo, clipMat);
      clipL2.position.set(0, 0.2, -1.5);
      sleeperSub.add(clipL2);

      const clipR1 = new THREE.Mesh(clipGeo, clipMat);
      clipR1.position.set(0, 0.2, 1.5);
      sleeperSub.add(clipR1);

      const clipR2 = new THREE.Mesh(clipGeo, clipMat);
      clipR2.position.set(0, 0.2, 1.9);
      sleeperSub.add(clipR2);

      sleeperSub.position.x = (i - sleeperCount / 2) * sleeperSpacing;
      sleeperSub.position.y = 0.05;
      sleepersGroup.add(sleeperSub);
    }
    envGroup.add(sleepersGroup);

    // Indian Railways Track Milestone Post ("IR 60KG • PSC-6")
    const postGeo = new THREE.BoxGeometry(0.5, 2.2, 0.3);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    const post = new THREE.Mesh(postGeo, postMat);
    post.position.set(16, 1.1, -4.5);
    post.castShadow = true;
    envGroup.add(post);

    // 25 kV AC Overhead Catenary (OHE) Portal Masts
    const mastsGroup = new THREE.Group();
    const mastPoleGeo = new THREE.CylinderGeometry(0.18, 0.22, 15, 8);
    const mastArmGeo = new THREE.BoxGeometry(0.16, 0.16, 7.5);
    const mastMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.8,
      roughness: 0.35,
    });
    const insulatorMat = new THREE.MeshStandardMaterial({
      color: 0x78350f, // Brown ceramic insulator
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

      // Ceramic disc insulator
      const insulator = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.7, 8), insulatorMat);
      insulator.position.set(0, 13.6, 0);
      mastSub.add(insulator);

      // Railway Signal Light (Green / Amber)
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

    // Overhead Catenary & Contact Wires
    const wireMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8 });
    const catenaryWire = new THREE.Mesh(new THREE.BoxGeometry(railLength, 0.05, 0.05), wireMat);
    catenaryWire.position.set(0, 14.1, 0);
    envGroup.add(catenaryWire);

    const contactWire = new THREE.Mesh(new THREE.BoxGeometry(railLength, 0.06, 0.06), wireMat);
    contactWire.position.set(0, 13.2, 0);
    envGroup.add(contactWire);

    scene.add(envGroup);

    // 6. Build the Authentic Vande Bharat Rake (Engine + Passenger Coach)
    const trainRake = new THREE.Group();

    // Helper: Build Twin-Axle Fiat-SIG Bogie
    const buildBogie = () => {
      const bogie = new THREE.Group();

      // Main cast steel frame
      const frameGeo = new THREE.BoxGeometry(5.2, 0.45, 3.2);
      const frame = new THREE.Mesh(frameGeo, activeMaterials.bogieFrame);
      frame.position.y = 0.75;
      frame.castShadow = true;
      bogie.add(frame);

      // Two Wheelsets (Axles with tapered rail wheels)
      const wheelGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.35, 20);
      [-1.8, 1.8].forEach((xOff) => {
        // Steel axle bar
        const axleGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.6, 8);
        const axle = new THREE.Mesh(axleGeo, activeMaterials.bogieFrame);
        axle.rotation.x = Math.PI / 2;
        axle.position.set(xOff, 0.65, 0);
        bogie.add(axle);

        // Left & Right wheels
        const wheelL = new THREE.Mesh(wheelGeo, activeMaterials.steelWheel);
        wheelL.rotation.x = Math.PI / 2;
        wheelL.position.set(xOff, 0.65, -1.7);
        wheelL.castShadow = true;
        bogie.add(wheelL);

        const wheelR = new THREE.Mesh(wheelGeo, activeMaterials.steelWheel);
        wheelR.rotation.x = Math.PI / 2;
        wheelR.position.set(xOff, 0.65, 1.7);
        wheelR.castShadow = true;
        bogie.add(wheelR);

        // Secondary suspension coil spring
        const springGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.6, 8);
        const spring = new THREE.Mesh(springGeo, activeMaterials.bogieFrame);
        spring.position.set(xOff, 1.05, 1.6);
        bogie.add(spring);
        const spring2 = new THREE.Mesh(springGeo, activeMaterials.bogieFrame);
        spring2.position.set(xOff, 1.05, -1.6);
        bogie.add(spring2);
      });

      return bogie;
    };

    // Helper: Build Single-Arm High-Speed Pantograph (Mounted on Roof)
    const buildPantograph = () => {
      const panto = new THREE.Group();

      // Base frame on roof
      const baseGeo = new THREE.BoxGeometry(3.2, 0.25, 2.4);
      const base = new THREE.Mesh(baseGeo, activeMaterials.bogieFrame);
      base.position.y = 5.25;
      panto.add(base);

      // Lower articulated arm (Red steel)
      const lowerArmGeo = new THREE.CylinderGeometry(0.08, 0.08, 4.6, 8);
      const lowerArm = new THREE.Mesh(lowerArmGeo, activeMaterials.pantograph);
      lowerArm.position.set(-0.8, 7.2, 0);
      lowerArm.rotation.z = -0.55;
      panto.add(lowerArm);

      // Upper pushrod arm
      const upperArmGeo = new THREE.CylinderGeometry(0.06, 0.06, 4.4, 8);
      const upperArm = new THREE.Mesh(upperArmGeo, activeMaterials.pantograph);
      upperArm.position.set(0.6, 11.0, 0);
      upperArm.rotation.z = 0.5;
      panto.add(upperArm);

      // Carbon contact strip (collector pan touching wire at y = 13.2)
      const headGeo = new THREE.BoxGeometry(0.3, 0.15, 3.2);
      const head = new THREE.Mesh(headGeo, activeMaterials.bogieFrame);
      head.position.set(1.6, 13.2, 0);
      panto.add(head);

      return panto;
    };

    // A. Driving Trailer Coach (DTC) with Aerodynamic Bullet Nose & Cab
    const leadCoach = new THREE.Group();
    const coachLength = 26;
    const coachHeight = 4.6;
    const coachWidth = 4.3;

    // Main Body Box
    const bodyGeo = new THREE.BoxGeometry(coachLength, coachHeight, coachWidth);
    const leadBodyMesh = new THREE.Mesh(bodyGeo, activeMaterials.body);
    leadBodyMesh.position.set(0, coachHeight / 2 + 0.85, 0);
    leadBodyMesh.castShadow = true;
    leadBodyMesh.receiveShadow = true;
    leadCoach.add(leadBodyMesh);

    // Continuous Tinted Panoramic Passenger Window Ribbon
    const windowRibbonGeo = new THREE.BoxGeometry(coachLength - 6, 1.4, coachWidth + 0.08);
    const leadWindowMesh = new THREE.Mesh(windowRibbonGeo, activeMaterials.windowGlass);
    leadWindowMesh.position.set(-2, 3.4, 0);
    leadCoach.add(leadWindowMesh);

    // Accent Swoop Band along Window
    const accentBandGeo = new THREE.BoxGeometry(coachLength - 4, 0.45, coachWidth + 0.1);
    const leadAccentMesh = new THREE.Mesh(accentBandGeo, activeMaterials.accent);
    leadAccentMesh.position.set(-1, 2.3, 0);
    leadCoach.add(leadAccentMesh);

    // Speed Stripe
    const stripeGeo = new THREE.BoxGeometry(coachLength - 3, 0.15, coachWidth + 0.12);
    const leadStripeMesh = new THREE.Mesh(stripeGeo, activeMaterials.stripe);
    leadStripeMesh.position.set(-0.5, 2.0, 0);
    leadCoach.add(leadStripeMesh);

    // Lower aerodynamic skirts
    const skirtGeo = new THREE.BoxGeometry(coachLength, 0.65, coachWidth - 0.2);
    const skirtMesh = new THREE.Mesh(skirtGeo, activeMaterials.skirt);
    skirtMesh.position.set(0, 0.85, 0);
    leadCoach.add(skirtMesh);

    // Aerodynamic Sculpted Bullet Nose Cone
    const noseGroup = new THREE.Group();
    const noseLength = 6.2;

    // Curved Hood Wedge
    const hoodGeo = new THREE.ConeGeometry(2.35, noseLength, 12);
    const hoodMesh = new THREE.Mesh(hoodGeo, activeMaterials.body);
    hoodMesh.rotation.z = -Math.PI / 2;
    hoodMesh.scale.set(0.85, 1.0, 0.95);
    hoodMesh.position.set(coachLength / 2 + noseLength / 2 - 0.2, 3.0, 0);
    hoodMesh.castShadow = true;
    noseGroup.add(hoodMesh);

    // Aerodynamic rounded nose tip
    const noseTipGeo = new THREE.SphereGeometry(1.2, 16, 16);
    const noseTipMesh = new THREE.Mesh(noseTipGeo, activeMaterials.body);
    noseTipMesh.scale.set(1.4, 0.9, 1.0);
    noseTipMesh.position.set(coachLength / 2 + noseLength - 0.4, 2.4, 0);
    noseTipMesh.castShadow = true;
    noseGroup.add(noseTipMesh);

    // Official Indian Railways Red & Gold Medallion on Nose Tip
    const medalGeo = new THREE.CircleGeometry(0.5, 24);
    const medalMat = new THREE.MeshBasicMaterial({
      map: medallionTex,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const medallionMesh = new THREE.Mesh(medalGeo, medalMat);
    medallionMesh.rotation.y = Math.PI / 2;
    medallionMesh.position.set(coachLength / 2 + noseLength + 0.7, 2.4, 0);
    noseGroup.add(medallionMesh);

    // Raked Panoramic Driver Windshield Glass (38° Aerodynamic Angle)
    const windshieldGeo = new THREE.BoxGeometry(2.6, 1.7, 3.2);
    const windshieldMesh = new THREE.Mesh(windshieldGeo, activeMaterials.windshield);
    windshieldMesh.position.set(coachLength / 2 + 1.8, 3.9, 0);
    windshieldMesh.rotation.z = -0.48;
    noseGroup.add(windshieldMesh);

    // Glowing Amber LED Destination Display inside Windshield
    const destGeo = new THREE.PlaneGeometry(2.4, 0.45);
    const destMat = new THREE.MeshBasicMaterial({
      map: destinationTex,
      side: THREE.DoubleSide,
      transparent: true,
    });
    const destMesh = new THREE.Mesh(destGeo, destMat);
    destMesh.rotation.y = Math.PI / 2;
    destMesh.rotation.z = -0.48;
    destMesh.position.set(coachLength / 2 + 2.4, 4.3, 0);
    noseGroup.add(destMesh);

    // Dual Swept-back LED Projector Headlights (Left & Right Cheeks)
    const headlampPodGeo = new THREE.BoxGeometry(0.7, 0.4, 0.6);
    const hlLeft = new THREE.Mesh(headlampPodGeo, activeMaterials.headlight);
    hlLeft.position.set(coachLength / 2 + 3.4, 2.2, -1.65);
    hlLeft.rotation.y = 0.25;
    noseGroup.add(hlLeft);

    const hlRight = new THREE.Mesh(headlampPodGeo, activeMaterials.headlight);
    hlRight.position.set(coachLength / 2 + 3.4, 2.2, 1.65);
    hlRight.rotation.y = -0.25;
    noseGroup.add(hlRight);

    // Real High-Beam Projector Spotlight Illuminating Tracks Ahead
    const headlampSpot = new THREE.SpotLight(0xfff7e6, isDark ? 4.5 : 2.5);
    headlampSpot.position.set(coachLength / 2 + 4.5, 2.3, 0);
    const targetObj = new THREE.Object3D();
    targetObj.position.set(coachLength / 2 + 65, 0.3, 0);
    scene.add(targetObj);
    headlampSpot.target = targetObj;
    headlampSpot.angle = 0.42;
    headlampSpot.penumbra = 0.6;
    headlampSpot.distance = 110;
    headlampSpot.castShadow = true;
    leadCoach.add(headlampSpot);

    // Red Tail / Marker Lights
    const redMarkerGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const redMarkerL = new THREE.Mesh(redMarkerGeo, activeMaterials.tailMarker);
    redMarkerL.position.set(coachLength / 2 + 3.7, 1.9, -1.8);
    noseGroup.add(redMarkerL);

    const redMarkerR = new THREE.Mesh(redMarkerGeo, activeMaterials.tailMarker);
    redMarkerR.position.set(coachLength / 2 + 3.7, 1.9, 1.8);
    noseGroup.add(redMarkerR);

    // Driver Cab Side Decals ("वंदे भारत EXPRESS" + Make In India Lion)
    const decalPlaneGeo = new THREE.PlaneGeometry(3.8, 1.3);
    const decalMat = new THREE.MeshBasicMaterial({
      map: cabDecalTex,
      transparent: true,
      side: THREE.DoubleSide,
    });
    const decalRight = new THREE.Mesh(decalPlaneGeo, decalMat);
    decalRight.position.set(coachLength / 2 - 2.8, 3.4, 2.18);
    leadCoach.add(decalRight);

    const decalLeft = new THREE.Mesh(decalPlaneGeo, decalMat);
    decalLeft.position.set(coachLength / 2 - 2.8, 3.4, -2.18);
    decalLeft.rotation.y = Math.PI;
    leadCoach.add(decalLeft);

    leadCoach.add(noseGroup);

    // Bogies for Lead Coach
    const bogieFront = buildBogie();
    bogieFront.position.set(coachLength / 2 - 4.5, 0, 0);
    leadCoach.add(bogieFront);

    const bogieRear = buildBogie();
    bogieRear.position.set(-coachLength / 2 + 4.5, 0, 0);
    leadCoach.add(bogieRear);

    trainRake.add(leadCoach);

    // B. Inter-Coach Flexible Accordion Gangway (Vestibule Bellows)
    const vestibuleGeo = new THREE.BoxGeometry(1.6, 4.1, 3.8);
    const vestibuleMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.85,
      metalness: 0.1,
    });
    const vestibule = new THREE.Mesh(vestibuleGeo, vestibuleMat);
    vestibule.position.set(-coachLength / 2 - 0.8, coachHeight / 2 + 0.85, 0);
    trainRake.add(vestibule);

    // C. Trailing Passenger Coach (Motor Coach with Pantograph & Panoramic Windows)
    const trailCoach = new THREE.Group();
    const trailLength = 24;
    trailCoach.position.set(-coachLength / 2 - trailLength / 2 - 1.6, 0, 0);

    const trailBodyMesh = new THREE.Mesh(
      new THREE.BoxGeometry(trailLength, coachHeight, coachWidth),
      activeMaterials.body
    );
    trailBodyMesh.position.set(0, coachHeight / 2 + 0.85, 0);
    trailBodyMesh.castShadow = true;
    trailBodyMesh.receiveShadow = true;
    trailCoach.add(trailBodyMesh);

    // Continuous Panoramic Window Ribbon
    const trailWindowMesh = new THREE.Mesh(
      new THREE.BoxGeometry(trailLength - 1.5, 1.4, coachWidth + 0.08),
      activeMaterials.windowGlass
    );
    trailWindowMesh.position.set(0, 3.4, 0);
    trailCoach.add(trailWindowMesh);

    // Accent Stripe
    const trailAccentMesh = new THREE.Mesh(
      new THREE.BoxGeometry(trailLength, 0.45, coachWidth + 0.1),
      activeMaterials.accent
    );
    trailAccentMesh.position.set(0, 2.3, 0);
    trailCoach.add(trailAccentMesh);

    // Speed Stripe
    const trailStripeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(trailLength, 0.15, coachWidth + 0.12),
      activeMaterials.stripe
    );
    trailStripeMesh.position.set(0, 2.0, 0);
    trailCoach.add(trailStripeMesh);

    // Skirts
    const trailSkirtMesh = new THREE.Mesh(
      new THREE.BoxGeometry(trailLength, 0.65, coachWidth - 0.2),
      activeMaterials.skirt
    );
    trailSkirtMesh.position.set(0, 0.85, 0);
    trailCoach.add(trailSkirtMesh);

    // Aerodynamic Roof AC Shrouds
    const acGeo = new THREE.BoxGeometry(5.0, 0.55, 3.0);
    [-6, 6].forEach((xOff) => {
      const acMesh = new THREE.Mesh(acGeo, activeMaterials.skirt);
      acMesh.position.set(xOff, 5.35, 0);
      trailCoach.add(acMesh);
    });

    // Single-Arm High-Speed Pantograph on Roof
    const pantoMesh = buildPantograph();
    pantoMesh.position.set(0, 0, 0);
    trailCoach.add(pantoMesh);

    // Bogies for Trailing Coach
    const trailBogieF = buildBogie();
    trailBogieF.position.set(trailLength / 2 - 4.2, 0, 0);
    trailCoach.add(trailBogieF);

    const trailBogieR = buildBogie();
    trailBogieR.position.set(-trailLength / 2 + 4.2, 0, 0);
    trailCoach.add(trailBogieR);

    trainRake.add(trailCoach);

    // Position entire train slightly forward so lead cab is centered
    trainRake.position.set(-4, 0, 0);
    scene.add(trainRake);

    // 7. Dynamic Livery Updater Function
    const updateLivery = (newLiv: LiveryType) => {
      activeMaterials = getMaterials(newLiv);

      // Reassign materials to lead coach meshes
      leadBodyMesh.material = activeMaterials.body;
      hoodMesh.material = activeMaterials.body;
      noseTipMesh.material = activeMaterials.body;
      leadAccentMesh.material = activeMaterials.accent;
      leadStripeMesh.material = activeMaterials.stripe;
      leadWindowMesh.material = activeMaterials.windowGlass;

      // Reassign materials to trailing coach meshes
      trailBodyMesh.material = activeMaterials.body;
      trailAccentMesh.material = activeMaterials.accent;
      trailStripeMesh.material = activeMaterials.stripe;
      trailWindowMesh.material = activeMaterials.windowGlass;
    };

    // 8. Interaction & Cursor Parallax
    let mouseX = 0;
    let mouseY = 0;
    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      mouseX = x;
      mouseY = y;
    };
    container.addEventListener('mousemove', handleMouseMove);

    // 9. Animation Loop
    let clock = new THREE.Clock();
    let sleeperOffset = 0;
    let mastOffset = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Check for live livery updates from React state
      if (liveryRef.current !== (leadBodyMesh.material === activeMaterials.body ? liveryRef.current : '')) {
        updateLivery(liveryRef.current);
      }

      // Convert speed in km/h to 3D world units/sec
      const kmh = speedRef.current;
      const worldSpeed = kmh * 0.48; // calibrated visual speed

      // Move sleepers to create realistic motion illusion
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

      // Subtle high-speed rail vibration & aerodynamic pitch
      const time = clock.getElapsedTime();
      trainRake.position.y = Math.sin(time * 24) * 0.025;
      trainRake.rotation.z = Math.sin(time * 12) * 0.003;

      // Camera Position Interpolation based on View
      const view = cameraViewRef.current;
      let targetPos = new THREE.Vector3(26, 18, 48);
      let targetLookAt = new THREE.Vector3(4, 3, 0);

      if (view === 'ISOMETRIC') {
        // Orbit perspective with cursor parallax
        targetPos.set(24 + mouseX * 8, 18 + mouseY * 6, 46);
        targetLookAt.set(6, 3.5, 0);
      } else if (view === 'TRACKSIDE') {
        // Low-angle railfan angle
        targetPos.set(18 + mouseX * 4, 3.2 + mouseY * 2, 9.5);
        targetLookAt.set(12, 3.5, 0);
      } else if (view === 'CABIN') {
        // Front Chase / Driver View looking down the tracks
        targetPos.set(34, 4.6, 2.2 + mouseX * 3);
        targetLookAt.set(80, 2.5, 0);
      } else if (view === 'PASSENGER') {
        // Window Passenger Side View
        targetPos.set(-8 + mouseX * 5, 4.5, 8.5);
        targetLookAt.set(12, 4.0, 0);
      }

      camera.position.lerp(targetPos, 0.06);
      camera.lookAt(targetLookAt);

      renderer.render(scene, camera);
    };

    animate();

    // Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 920;
      const h = Math.max(container.clientHeight || 440, 420);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      renderer.dispose();
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isDark]);

  return (
    <div
      className={`relative w-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-gradient-to-b ${
        isDark
          ? 'from-zinc-950 via-zinc-900 to-zinc-950'
          : 'from-slate-100 via-white to-slate-100'
      } shadow-xl transition-all duration-300 ${className}`}
    >
      {/* Three.js Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-[430px] sm:h-[460px] cursor-grab active:cursor-grabbing"
      />

      {/* Top Header Overlay: Live Telemetry & Livery Badge */}
      <div className="absolute top-4 left-4 right-4 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Left: Indian Railways Flagship Badge & Speed HUD */}
        <div className="flex items-center gap-2.5 p-2 px-3 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/90 dark:border-zinc-800/90 shadow-md backdrop-blur-md pointer-events-auto">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-mono text-xs font-bold text-zinc-950 dark:text-white uppercase tracking-wider">
              VANDE BHARAT EXP (TRAIN 18)
            </span>
          </div>

          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-700" />

          {/* Speed Telemetry */}
          <div className="flex items-center gap-1.5 font-mono text-xs text-zinc-800 dark:text-zinc-200 font-bold">
            <Gauge className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span>{speedSetting} KM/H</span>
            <span className="text-[10px] text-zinc-400 font-normal">CRUISING</span>
          </div>
        </div>

        {/* Right: Livery Switcher & Reference Photo Peek Button */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Authentic IR Twin-Tone Horn Button */}
          <button
            type="button"
            onClick={playAuthenticTrainHorn}
            className="px-3 py-1.5 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="Sound Authentic Indian Railways Electric Loco Dual Horn"
          >
            <Volume2 className="w-3.5 h-3.5 text-amber-500" />
            <span className="hidden sm:inline">IR Horn</span>
          </button>

          {/* Real Photo Reference Button */}
          <button
            type="button"
            onClick={() => setShowPhotoRefModal(true)}
            className="px-3 py-1.5 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-400 dark:hover:border-zinc-600 text-zinc-800 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-sm transition active:scale-95"
            title="View Real Indian Train Photos & Comparison"
          >
            <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
            <span>Real Photo</span>
          </button>

          {/* Livery Selector (Classic Blue/White vs Saffron/Grey 2024) */}
          <div className="inline-flex items-center p-1 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-sm backdrop-blur-md">
            <button
              type="button"
              onClick={() => setLivery('BLUE_WHITE')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                livery === 'BLUE_WHITE'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="Classic Pearl White & Royal Blue Livery"
            >
              <span className="w-2 h-2 rounded-full bg-blue-400 inline-block" />
              <span>Classic Blue</span>
            </button>
            <button
              type="button"
              onClick={() => setLivery('SAFFRON_GREY')}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition flex items-center gap-1.5 ${
                livery === 'SAFFRON_GREY'
                  ? 'bg-orange-600 text-white shadow-sm'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="Tricolor Saffron & Charcoal Grey (2024 Livery)"
            >
              <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
              <span>Saffron 2024</span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Floating Bar: Camera Modes & Interactive Controls */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row items-center justify-between gap-3 pointer-events-none">
        {/* Left: Speed Selector */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-md backdrop-blur-md pointer-events-auto">
          <span className="text-[11px] font-mono font-bold text-zinc-400 px-2">SPEED:</span>
          {[130, 160, 180].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeedSetting(s as 130 | 160 | 180)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold transition ${
                speedSetting === s
                  ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white'
              }`}
            >
              {s} KM/H
            </button>
          ))}
        </div>

        {/* Right: Camera Angles Selector */}
        <div className="flex items-center gap-1 p-1 rounded-xl glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-md backdrop-blur-md pointer-events-auto">
          <span className="text-[11px] font-mono font-bold text-zinc-400 px-2 flex items-center gap-1">
            <Camera className="w-3 h-3" /> CAM:
          </span>
          {[
            { id: 'ISOMETRIC', label: 'Orbit 3D' },
            { id: 'TRACKSIDE', label: 'Trackside' },
            { id: 'CABIN', label: 'Driver Front' },
            { id: 'PASSENGER', label: 'Window View' },
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

      {/* Real Indian Train Reference Photo Modal */}
      {showPhotoRefModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in pointer-events-auto">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-blue-600" />
                <div>
                  <h3 className="text-sm font-bold font-mono text-zinc-950 dark:text-white">
                    Actual Indian Railways Train Reference
                  </h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    High-resolution photographs of Vande Bharat Express rakes used for our 3D replica.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowPhotoRefModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-950 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Photo Tabs */}
            <div className="flex items-center gap-2 px-4 pt-3 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
              <button
                type="button"
                onClick={() => setActivePhotoTab('BLUE')}
                className={`pb-2.5 px-3 text-xs font-mono font-bold border-b-2 transition ${
                  activePhotoTab === 'BLUE'
                    ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                1. Classic White & Royal Blue (Original Livery)
              </button>
              <button
                type="button"
                onClick={() => setActivePhotoTab('SAFFRON')}
                className={`pb-2.5 px-3 text-xs font-mono font-bold border-b-2 transition ${
                  activePhotoTab === 'SAFFRON'
                    ? 'border-orange-600 text-orange-600 dark:text-orange-400'
                    : 'border-transparent text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                2. Saffron Orange & Charcoal Grey (2024 Livery)
              </button>
            </div>

            {/* Modal Body with Actual Downloaded Image */}
            <div className="p-4 overflow-y-auto space-y-4">
              {activePhotoTab === 'BLUE' ? (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 aspect-video flex items-center justify-center">
                    <img
                      src="/images/train/vande-bharat-blue.jpg"
                      alt="Classic Blue & White Vande Bharat Express around Mumbai"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 text-[10px] font-mono text-white backdrop-blur-xs">
                      Vande Bharat Express • Mumbai Corridor Track
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                      <div className="text-[10px] text-zinc-400 uppercase">Max Speed</div>
                      <div className="font-bold text-zinc-900 dark:text-white">160 km/h (180 km/h Tested)</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                      <div className="text-[10px] text-zinc-400 uppercase">Track Gauge</div>
                      <div className="font-bold text-zinc-900 dark:text-white">1,676 mm Broad Gauge</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                      <div className="text-[10px] text-zinc-400 uppercase">Traction</div>
                      <div className="font-bold text-zinc-900 dark:text-white">25 kV AC 50 Hz OHE</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                      <div className="text-[10px] text-zinc-400 uppercase">Manufacturer</div>
                      <div className="font-bold text-zinc-900 dark:text-white">ICF Chennai, India</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="relative rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 aspect-video flex items-center justify-center">
                    <img
                      src="/images/train/vande-bharat-saffron.jpg"
                      alt="Saffron & Grey Vande Bharat Express at SMVT Bengaluru"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/70 text-[10px] font-mono text-white backdrop-blur-xs">
                      Vande Bharat 2.0 • Kalaburagi - SMVT Bengaluru
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                      <div className="text-[10px] text-zinc-400 uppercase">Livery</div>
                      <div className="font-bold text-zinc-900 dark:text-white">Tricolor Saffron & Grey</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                      <div className="text-[10px] text-zinc-400 uppercase">Cab Nose</div>
                      <div className="font-bold text-zinc-900 dark:text-white">3-Piece Modular Aerodynamic FRP</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                      <div className="text-[10px] text-zinc-400 uppercase">Suspension</div>
                      <div className="font-bold text-zinc-900 dark:text-white">Secondary Air Spring Bellows</div>
                    </div>
                    <div className="p-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
                      <div className="text-[10px] text-zinc-400 uppercase">Safety</div>
                      <div className="font-bold text-zinc-900 dark:text-white">KAVACH Automatic Train Protection</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center justify-between">
              <span className="text-[11px] font-mono text-zinc-500">
                Replica matches real proportions, OHE wiring, and broad gauge tracks.
              </span>
              <button
                type="button"
                onClick={() => {
                  setLivery(activePhotoTab === 'BLUE' ? 'BLUE_WHITE' : 'SAFFRON_GREY');
                  setShowPhotoRefModal(false);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 font-mono text-xs font-bold hover:bg-zinc-800 dark:hover:bg-zinc-200 transition"
              >
                Apply This Livery in 3D
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
