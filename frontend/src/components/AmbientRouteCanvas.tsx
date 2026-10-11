import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface AmbientRouteCanvasProps {
  className?: string;
  isSearching?: boolean;
}

export const AmbientRouteCanvas: React.FC<AmbientRouteCanvasProps> = ({ className = '', isSearching = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isSearchingRef = useRef(isSearching);
  isSearchingRef.current = isSearching;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || 280;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    camera.position.z = 240;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);

    // Create interconnected transit node points
    const nodeCount = 42;
    const positions = new Float32Array(nodeCount * 3);
    const nodeData: Array<{ x: number; y: number; z: number; vx: number; vy: number; vz: number }> = [];

    for (let i = 0; i < nodeCount; i++) {
      const x = (Math.random() - 0.5) * 360;
      const y = (Math.random() - 0.5) * 140;
      const z = (Math.random() - 0.5) * 80;
      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      nodeData.push({
        x,
        y,
        z,
        vx: (Math.random() - 0.5) * 0.15,
        vy: (Math.random() - 0.5) * 0.12,
        vz: (Math.random() - 0.5) * 0.08,
      });
    }

    const nodeGeometry = new THREE.BufferGeometry();
    nodeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // Monochrome points: dark slate / dark zinc
    const nodeMaterial = new THREE.PointsMaterial({
      color: 0x18181b,
      size: 3.5,
      transparent: true,
      opacity: 0.75,
    });
    const pointsMesh = new THREE.Points(nodeGeometry, nodeMaterial);
    scene.add(pointsMesh);

    // Line segments for corridor links
    const maxLines = 120;
    const linePositions = new Float32Array(maxLines * 6);
    const lineColors = new Float32Array(maxLines * 6);
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
    lineGeometry.setAttribute('color', new THREE.BufferAttribute(lineColors, 3));

    const lineMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.NormalBlending,
    });
    const linesMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
    scene.add(linesMesh);

    // Mouse tracking for subtle parallax
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const nx = (e.clientX - rect.left) / width - 0.5;
      const ny = (e.clientY - rect.top) / height - 0.5;
      targetX = nx * 35;
      targetY = -ny * 25;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Resize handler
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    // Animation Loop
    let animId: number;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const speedMult = isSearchingRef.current ? 2.5 : 1.0;

      // Smooth camera interpolation toward mouse
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;
      camera.position.x = mouseX;
      camera.position.y = mouseY;
      camera.lookAt(0, 0, 0);

      // Update node positions
      const posAttr = nodeGeometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      for (let i = 0; i < nodeCount; i++) {
        const node = nodeData[i];
        node.x += node.vx * speedMult;
        node.y += node.vy * speedMult;
        node.z += node.vz * speedMult;

        // Bounce back within boundaries
        if (Math.abs(node.x) > 190) node.vx *= -1;
        if (Math.abs(node.y) > 80) node.vy *= -1;
        if (Math.abs(node.z) > 50) node.vz *= -1;

        posArray[i * 3] = node.x;
        posArray[i * 3 + 1] = node.y;
        posArray[i * 3 + 2] = node.z;
      }
      posAttr.needsUpdate = true;

      // Update connecting corridor lines based on distance
      let lineIndex = 0;
      const linePosAttr = lineGeometry.attributes.position as THREE.BufferAttribute;
      const lineColAttr = lineGeometry.attributes.color as THREE.BufferAttribute;
      const lPos = linePosAttr.array as Float32Array;
      const lCol = lineColAttr.array as Float32Array;

      const connectionDist = 75;

      for (let i = 0; i < nodeCount; i++) {
        for (let j = i + 1; j < nodeCount; j++) {
          if (lineIndex >= maxLines) break;

          const dx = nodeData[i].x - nodeData[j].x;
          const dy = nodeData[i].y - nodeData[j].y;
          const dz = nodeData[i].z - nodeData[j].z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < connectionDist) {
            const alpha = 1.0 - dist / connectionDist;
            const idx = lineIndex * 6;

            lPos[idx] = nodeData[i].x;
            lPos[idx + 1] = nodeData[i].y;
            lPos[idx + 2] = nodeData[i].z;
            lPos[idx + 3] = nodeData[j].x;
            lPos[idx + 4] = nodeData[j].y;
            lPos[idx + 5] = nodeData[j].z;

            // Minimalist grayscale line colors
            const cVal = 0.65 + alpha * 0.2;
            lCol[idx] = cVal;
            lCol[idx + 1] = cVal;
            lCol[idx + 2] = cVal;
            lCol[idx + 3] = cVal;
            lCol[idx + 4] = cVal;
            lCol[idx + 5] = cVal;

            lineIndex++;
          }
        }
      }

      lineGeometry.setDrawRange(0, lineIndex * 2);
      linePosAttr.needsUpdate = true;
      lineColAttr.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      nodeGeometry.dispose();
      nodeMaterial.dispose();
      lineGeometry.dispose();
      lineMaterial.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none select-none overflow-hidden ${className}`}
      aria-hidden="true"
    />
  );
};
