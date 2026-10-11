import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Gauge, Sparkles } from 'lucide-react';

interface InteractiveTrainCanvasProps {
  className?: string;
  isDark?: boolean;
}

export const InteractiveTrainCanvas: React.FC<InteractiveTrainCanvasProps> = ({
  className = '',
  isDark = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [cameraMode, setCameraMode] = useState<'ISOMETRIC' | 'TRACKSIDE' | 'CABIN'>('ISOMETRIC');
  const [speed, setSpeed] = useState<number>(145);
  const cameraModeRef = useRef(cameraMode);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
  }, [cameraMode]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animationFrameId: number;
    const width = container.clientWidth || 900;
    const height = Math.max(container.clientHeight || 420, 380);

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(isDark ? 0x09090b : 0xf4f4f5, 0.007);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 800);
    camera.position.set(28, 22, 50);

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
    renderer.toneMappingExposure = isDark ? 1.2 : 1.0;
    container.appendChild(renderer.domElement);

    // 2. Lighting
    const ambientLight = new THREE.AmbientLight(
      isDark ? 0x27272a : 0xe4e4e7,
      isDark ? 1.4 : 2.0
    );
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, isDark ? 1.8 : 2.5);
    dirLight.position.set(40, 60, 30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    // 3. Materials
    const trainBodyMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x18181b : 0xe4e4e7,
      roughness: 0.3,
      metalness: 0.8,
    });

    const trainStripeMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0xf4f4f5 : 0x09090b,
      roughness: 0.2,
      metalness: 0.9,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x38bdf8 : 0x0284c7,
      roughness: 0.1,
      metalness: 0.9,
      emissive: isDark ? 0x0369a1 : 0x0284c7,
      emissiveIntensity: 0.4,
    });

    const windowGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfef08a,
      emissive: 0xfef08a,
      emissiveIntensity: isDark ? 0.9 : 0.5,
      roughness: 0.3,
    });

    const headlightMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.5,
      roughness: 0.1,
    });

    const railMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x71717a : 0x52525b,
      metalness: 0.9,
      roughness: 0.2,
    });

    const sleeperMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x27272a : 0xa1a1aa,
      roughness: 0.8,
      metalness: 0.1,
    });

    const groundMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x09090b : 0xf4f4f5,
      roughness: 0.9,
    });

    // 4. Ground Grid & Ballast Bed
    const groundGeo = new THREE.PlaneGeometry(600, 300);
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.6;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Ballast gravel track bed
    const ballastGeo = new THREE.BoxGeometry(600, 0.6, 9);
    const ballastMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x18181b : 0xd4d4d8,
      roughness: 0.95,
    });
    const ballast = new THREE.Mesh(ballastGeo, ballastMat);
    ballast.position.y = -0.3;
    ballast.rotation.y = 0;
    scene.add(ballast);

    // 5. Procedural Rails (Continuous left and right steel tracks)
    const railLength = 600;
    const railGeo = new THREE.BoxGeometry(railLength, 0.4, 0.3);

    const leftRail = new THREE.Mesh(railGeo, railMat);
    leftRail.position.set(0, 0.2, -2.1);
    leftRail.castShadow = true;
    scene.add(leftRail);

    const rightRail = new THREE.Mesh(railGeo, railMat);
    rightRail.position.set(0, 0.2, 2.1);
    rightRail.castShadow = true;
    scene.add(rightRail);

    // Sleepers (Ties) group with moving offset
    const sleeperCount = 180;
    const sleeperSpacing = 3.2;
    const sleepersGroup = new THREE.Group();

    const singleSleeperGeo = new THREE.BoxGeometry(0.8, 0.35, 6.2);
    for (let i = 0; i < sleeperCount; i++) {
      const sleeper = new THREE.Mesh(singleSleeperGeo, sleeperMat);
      sleeper.position.x = (i - sleeperCount / 2) * sleeperSpacing;
      sleeper.position.y = 0.05;
      sleeper.receiveShadow = true;
      sleepersGroup.add(sleeper);
    }
    scene.add(sleepersGroup);

    // Overhead Electrification (OHE) Catenary Masts
    const mastsGroup = new THREE.Group();
    const mastGeo = new THREE.CylinderGeometry(0.2, 0.25, 14, 8);
    const armGeo = new THREE.BoxGeometry(0.2, 0.2, 8);
    const mastMat = new THREE.MeshStandardMaterial({
      color: isDark ? 0x3f3f46 : 0x71717a,
      metalness: 0.8,
      roughness: 0.4,
    });

    const mastCount = 18;
    const mastSpacing = 32;
    for (let i = 0; i < mastCount; i++) {
      const mastSub = new THREE.Group();
      const pole = new THREE.Mesh(mastGeo, mastMat);
      pole.position.set(0, 7, -4.8);
      pole.castShadow = true;
      mastSub.add(pole);

      const arm = new THREE.Mesh(armGeo, mastMat);
      arm.position.set(0, 13.2, -1.8);
      mastSub.add(arm);

      // Signal light on mast
      const sigLightGeo = new THREE.SphereGeometry(0.25, 8, 8);
      const sigLightMat = new THREE.MeshBasicMaterial({
        color: i % 3 === 0 ? 0x10b981 : 0x38bdf8,
      });
      const sigLight = new THREE.Mesh(sigLightGeo, sigLightMat);
      sigLight.position.set(0, 12.8, 1.2);
      mastSub.add(sigLight);

      mastSub.position.x = (i - mastCount / 2) * mastSpacing;
      mastsGroup.add(mastSub);
    }
    scene.add(mastsGroup);

    // Overhead power wire line
    const wireGeo = new THREE.BoxGeometry(railLength, 0.08, 0.08);
    const wireMat = new THREE.MeshBasicMaterial({ color: 0xa1a1aa });
    const wire = new THREE.Mesh(wireGeo, wireMat);
    wire.position.set(0, 13.1, 0);
    scene.add(wire);

    // 6. Build the 3D High-Speed Train
    const trainGroup = new THREE.Group();

    // Helper: Build Coach
    const createCoach = (isEngine: boolean) => {
      const coach = new THREE.Group();
      const length = isEngine ? 22 : 20;
      const height = 4.8;
      const width = 4.2;

      // Main aerodynamic shell
      const bodyGeo = new THREE.BoxGeometry(length, height, width);
      const body = new THREE.Mesh(bodyGeo, trainBodyMat);
      body.position.y = height / 2 + 0.9;
      body.castShadow = true;
      coach.add(body);

      // Accent stripe running across sides
      const stripeGeo = new THREE.BoxGeometry(length + 0.05, 0.5, width + 0.05);
      const stripe = new THREE.Mesh(stripeGeo, trainStripeMat);
      stripe.position.y = 2.4;
      coach.add(stripe);

      // Aerodynamic Tapered Nose for Engine
      if (isEngine) {
        const noseGeo = new THREE.ConeGeometry(2.3, 5.5, 4);
        const nose = new THREE.Mesh(noseGeo, trainBodyMat);
        nose.rotation.z = -Math.PI / 2;
        nose.rotation.y = Math.PI / 4;
        nose.position.set(length / 2 + 2.5, height / 2 + 0.8, 0);
        nose.scale.set(0.9, 1.1, 0.9);
        nose.castShadow = true;
        coach.add(nose);

        // Windshield visor
        const shieldGeo = new THREE.BoxGeometry(1.8, 1.4, 2.6);
        const windshield = new THREE.Mesh(shieldGeo, glassMat);
        windshield.position.set(length / 2 + 1.2, height / 2 + 1.6, 0);
        windshield.rotation.z = -0.3;
        coach.add(windshield);

        // High-Intensity Headlights
        const leftHeadlight = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12), headlightMat);
        leftHeadlight.rotation.z = Math.PI / 2;
        leftHeadlight.position.set(length / 2 + 4.2, 2.2, -0.9);
        coach.add(leftHeadlight);

        const rightHeadlight = leftHeadlight.clone();
        rightHeadlight.position.set(length / 2 + 4.2, 2.2, 0.9);
        coach.add(rightHeadlight);

        // Center High Beam
        const topHeadlight = leftHeadlight.clone();
        topHeadlight.position.set(length / 2 + 3.4, 3.8, 0);
        coach.add(topHeadlight);

        // Volumetric Headlight Cone Light
        const spotLight = new THREE.SpotLight(0xfffbeb, 4, 120, Math.PI / 6, 0.5);
        spotLight.position.set(length / 2 + 4.5, 2.8, 0);
        spotLight.target.position.set(length / 2 + 60, 0, 0);
        coach.add(spotLight);
        coach.add(spotLight.target);

        // Roof Pantograph (Electric current collector)
        const pantoGroup = new THREE.Group();
        const arm1 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), mastMat);
        arm1.rotation.z = 0.55;
        arm1.position.set(-3, 0.8, 0);
        pantoGroup.add(arm1);

        const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.8, 0.12), mastMat);
        arm2.rotation.z = -0.55;
        arm2.position.set(-1.8, 1.6, 0);
        pantoGroup.add(arm2);

        const collectorBar = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 2.4), headlightMat);
        collectorBar.position.set(-1.8, 2.5, 0);
        pantoGroup.add(collectorBar);

        pantoGroup.position.set(0, height + 0.9, 0);
        coach.add(pantoGroup);
      }

      // Passenger Glowing Windows along both flanks
      const windowCount = isEngine ? 4 : 7;
      const winSpacing = 2.4;
      const startX = -(windowCount * winSpacing) / 2 + (isEngine ? -2 : 0);

      for (let w = 0; w < windowCount; w++) {
        const winX = startX + w * winSpacing;
        const winGeo = new THREE.PlaneGeometry(1.4, 0.9);

        // Left side window
        const winLeft = new THREE.Mesh(winGeo, windowGlowMat);
        winLeft.position.set(winX, 3.8, 2.11);
        coach.add(winLeft);

        // Right side window
        const winRight = new THREE.Mesh(winGeo, windowGlowMat);
        winRight.position.set(winX, 3.8, -2.11);
        winRight.rotation.y = Math.PI;
        coach.add(winRight);
      }

      // Wheel Bogies (Underbody trucks)
      const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.35, 16);
      const wheelMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.9 });
      const bogiePositions = [-(length / 2 - 3.5), length / 2 - 3.5];

      bogiePositions.forEach((bx) => {
        const bogieFrame = new THREE.Mesh(new THREE.BoxGeometry(4.2, 0.5, 3.8), wheelMat);
        bogieFrame.position.set(bx, 0.7, 0);
        coach.add(bogieFrame);

        [-1.3, 1.3].forEach((wx) => {
          // Left Wheel
          const wl = new THREE.Mesh(wheelGeo, wheelMat);
          wl.rotation.x = Math.PI / 2;
          wl.position.set(bx + wx, 0.55, 1.85);
          coach.add(wl);

          // Right Wheel
          const wr = new THREE.Mesh(wheelGeo, wheelMat);
          wr.rotation.x = Math.PI / 2;
          wr.position.set(bx + wx, 0.55, -1.85);
          coach.add(wr);
        });
      });

      return coach;
    };

    // Engine + Coach 1 + Coach 2
    const engine = createCoach(true);
    engine.position.x = 24;
    trainGroup.add(engine);

    const coach1 = createCoach(false);
    coach1.position.x = 1.5;
    trainGroup.add(coach1);

    const coach2 = createCoach(false);
    coach2.position.x = -20.5;
    trainGroup.add(coach2);

    // Accordion connectors between cars
    const bellowsMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.9 });
    const bellows1 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.8, 3.6), bellowsMat);
    bellows1.position.set(12.75, 3.2, 0);
    trainGroup.add(bellows1);

    const bellows2 = new THREE.Mesh(new THREE.BoxGeometry(2.0, 3.8, 3.6), bellowsMat);
    bellows2.position.set(-9.25, 3.2, 0);
    trainGroup.add(bellows2);

    scene.add(trainGroup);

    // 7. Track Sparks / Speed Streak Particles
    const sparkCount = 65;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPositions = new Float32Array(sparkCount * 3);
    const sparkData: Array<{ x: number; y: number; z: number; speed: number }> = [];

    for (let i = 0; i < sparkCount; i++) {
      const x = -30 - Math.random() * 80;
      const y = Math.random() * 5.5 + 0.3;
      const z = (Math.random() - 0.5) * 8.5;
      sparkPositions[i * 3] = x;
      sparkPositions[i * 3 + 1] = y;
      sparkPositions[i * 3 + 2] = z;
      sparkData.push({ x, y, z, speed: 1.5 + Math.random() * 2.5 });
    }
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPositions, 3));

    const sparkMat = new THREE.PointsMaterial({
      color: isDark ? 0x38bdf8 : 0x0284c7,
      size: 1.8,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
    });
    const sparks = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparks);

    // 8. Mouse Tracking for Dynamic Interactive Camera Parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetCameraX = camera.position.x;
    let targetCameraY = camera.position.y;
    let targetCameraZ = camera.position.z;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / width - 0.5;
      const ny = (e.clientY - rect.top) / height - 0.5;
      mouseX = nx * 14;
      mouseY = -ny * 8;
    };

    container.addEventListener('mousemove', handleMouseMove);

    // Window Resize Handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // 9. Animation Loop
    let clock = new THREE.Clock();
    let speedOffset = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();
      const time = clock.getElapsedTime();

      // Infinite conveyor motion of sleepers & masts
      const travelSpeed = 48.0; // units per second
      speedOffset += travelSpeed * delta;

      // Move sleepers backward to create illusion of high forward velocity
      sleepersGroup.position.x = -(speedOffset % sleeperSpacing);

      // Move masts backward
      mastsGroup.position.x = -(speedOffset % mastSpacing);

      // Train subtle aerodynamic suspension oscillation
      trainGroup.position.y = Math.sin(time * 14) * 0.04;
      trainGroup.rotation.z = Math.sin(time * 7) * 0.003;
      trainGroup.rotation.y = Math.sin(time * 4) * 0.002;

      // Animate sparks / speed streaks
      const posAttr = sparkGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < sparkCount; i++) {
        sparkData[i].x -= sparkData[i].speed * (travelSpeed * delta * 0.8);
        if (sparkData[i].x < -140) {
          sparkData[i].x = 35 + Math.random() * 5;
          sparkData[i].y = Math.random() * 5.0 + 0.3;
          sparkData[i].z = (Math.random() - 0.5) * 6.5;
        }
        posAttr.setXYZ(i, sparkData[i].x, sparkData[i].y, sparkData[i].z);
      }
      posAttr.needsUpdate = true;

      // Dynamic Camera Modes
      const mode = cameraModeRef.current;
      if (mode === 'ISOMETRIC') {
        targetCameraX = 28 + mouseX;
        targetCameraY = 22 + mouseY;
        targetCameraZ = 50;
        camera.lookAt(8, 3.5, 0);
      } else if (mode === 'TRACKSIDE') {
        targetCameraX = 42 + mouseX * 0.8;
        targetCameraY = 4.2 + mouseY * 0.4;
        targetCameraZ = 16;
        camera.lookAt(12, 3.8, 0);
      } else if (mode === 'CABIN') {
        targetCameraX = 52 + mouseX * 0.4;
        targetCameraY = 7.5 + mouseY * 0.3;
        targetCameraZ = 4.5;
        camera.lookAt(80, 2, 0);
      }

      // Smooth camera interpolation
      camera.position.x += (targetCameraX - camera.position.x) * 0.05;
      camera.position.y += (targetCameraY - camera.position.y) * 0.05;
      camera.position.z += (targetCameraZ - camera.position.z) * 0.05;

      renderer.render(scene, camera);
    };

    animate();

    // Speed fluctuation for realism
    const speedInterval = setInterval(() => {
      setSpeed(140 + Math.floor(Math.sin(Date.now() / 2000) * 12 + Math.random() * 8));
    }, 1200);

    return () => {
      clearInterval(speedInterval);
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      container.removeEventListener('mousemove', handleMouseMove);
      if (renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      groundGeo.dispose();
      ballastGeo.dispose();
      railGeo.dispose();
      singleSleeperGeo.dispose();
      mastGeo.dispose();
      armGeo.dispose();
      wireGeo.dispose();
      sparkGeo.dispose();
    };
  }, [isDark]);

  return (
    <div className={`relative w-full rounded-2xl overflow-hidden glass-card border border-zinc-200/90 dark:border-zinc-800/90 bg-white/70 dark:bg-zinc-950/80 shadow-2xl ${className}`}>
      {/* Three.js Canvas Container */}
      <div
        ref={containerRef}
        className="w-full h-[360px] sm:h-[440px] cursor-grab active:cursor-grabbing"
      />

      {/* Floating Futuristic HUD Telemetry Overlay */}
      <div className="absolute top-4 left-4 right-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 pointer-events-none">
        {/* Train Identification Badge */}
        <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 text-xs font-mono shadow-md backdrop-blur-md">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          <span className="font-bold text-zinc-950 dark:text-white">VANDE BHARAT EXPRESS</span>
          <span className="text-zinc-400 dark:text-zinc-500">&bull;</span>
          <span className="text-zinc-600 dark:text-zinc-400">PATROL ROUTE 12002</span>
        </div>

        {/* Telemetry Status Gauges & Mode Selectors */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* Live Speed Gauge */}
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 text-xs font-mono shadow-md backdrop-blur-md">
            <Gauge className="w-3.5 h-3.5 text-zinc-500 dark:text-zinc-400" />
            <span className="font-bold text-zinc-950 dark:text-white">{speed} KM/H</span>
            <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400">CRUISING</span>
          </div>

          {/* Camera View Selector Buttons */}
          <div className="inline-flex items-center p-1 rounded-full glass-card bg-white/90 dark:bg-zinc-900/90 border border-zinc-200/80 dark:border-zinc-800/80 shadow-md backdrop-blur-md">
            <button
              type="button"
              onClick={() => setCameraMode('ISOMETRIC')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold transition ${
                cameraMode === 'ISOMETRIC'
                  ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="Isometric Tracking Camera"
            >
              Orbit
            </button>
            <button
              type="button"
              onClick={() => setCameraMode('TRACKSIDE')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold transition ${
                cameraMode === 'TRACKSIDE'
                  ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="Trackside Speed Camera"
            >
              Trackside
            </button>
            <button
              type="button"
              onClick={() => setCameraMode('CABIN')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-mono font-bold transition ${
                cameraMode === 'CABIN'
                  ? 'bg-zinc-950 dark:bg-white text-white dark:text-zinc-950 shadow-2xs'
                  : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
              }`}
              title="Driver Forward View"
            >
              Chase
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Dispatch Callout Bar */}
      <div className="absolute bottom-4 left-4 right-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3.5 rounded-xl glass-card bg-white/80 dark:bg-zinc-900/80 border border-zinc-200/80 dark:border-zinc-800/80 shadow-lg backdrop-blur-md pointer-events-none">
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="p-1.5 rounded-lg bg-zinc-950 dark:bg-white text-white dark:text-zinc-950">
            <Sparkles className="w-3.5 h-3.5" />
          </span>
          <div>
            <div className="font-bold text-zinc-950 dark:text-white">
              Railway Network Ready for Dispatch
            </div>
            <div className="text-[11px] text-zinc-500 dark:text-zinc-400">
              Select origin and destination stations above to compute confirmed routes, split berths & corridor layovers.
            </div>
          </div>
        </div>

        <div className="text-[11px] font-mono text-zinc-400 dark:text-zinc-500 sm:text-right shrink-0">
          Interactive 3D • Move cursor to look around
        </div>
      </div>
    </div>
  );
};
