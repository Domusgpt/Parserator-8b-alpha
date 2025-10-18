'use client';

import { useEffect, useRef } from 'react';

type VisualizerProps = {
  className?: string;
};

type Node = {
  id: string;
  x: number;
  y: number;
  label: string;
  accent: string;
};

type Edge = {
  from: string;
  to: string;
  emphasis?: number;
};

type Pulse = {
  edgeIndex: number;
  progress: number;
  speed: number;
  trail: number;
  hue: number;
};

type Spark = {
  x: number;
  y: number;
  radius: number;
  delay: number;
};

export function ParseratorVisualizer({ className }: VisualizerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    const nodes: Node[] = [
      { id: 'ingest', x: 0.16, y: 0.24, label: 'Architect Intake', accent: 'rgba(56,189,248,1)' },
      { id: 'plan', x: 0.34, y: 0.52, label: 'Plan Cache', accent: 'rgba(59,130,246,1)' },
      { id: 'resolver', x: 0.5, y: 0.28, label: 'Resolver Stack', accent: 'rgba(129,140,248,1)' },
      { id: 'extractor', x: 0.72, y: 0.36, label: 'Extractor Heuristics', accent: 'rgba(165,243,252,1)' },
      { id: 'telemetry', x: 0.52, y: 0.7, label: 'Telemetry Stream', accent: 'rgba(34,211,238,1)' },
      { id: 'json', x: 0.84, y: 0.68, label: 'JSON Output', accent: 'rgba(45,212,191,1)' }
    ];

    const edges: Edge[] = [
      { from: 'ingest', to: 'resolver', emphasis: 1.2 },
      { from: 'plan', to: 'resolver', emphasis: 0.7 },
      { from: 'resolver', to: 'extractor', emphasis: 1.3 },
      { from: 'extractor', to: 'json', emphasis: 1.1 },
      { from: 'resolver', to: 'telemetry', emphasis: 0.9 },
      { from: 'telemetry', to: 'json', emphasis: 0.8 },
      { from: 'plan', to: 'telemetry', emphasis: 0.6 }
    ];

    const nodeMap = new Map(nodes.map((node) => [node.id, node]));

    const stars: Spark[] = Array.from({ length: 42 }, () => ({
      x: Math.random(),
      y: Math.random(),
      radius: Math.random() * 1.4 + 0.3,
      delay: Math.random() * 6000
    }));

    const pulses: Pulse[] = Array.from({ length: edges.length * 2 }, (_, index) => ({
      edgeIndex: index % edges.length,
      progress: Math.random(),
      speed: 0.18 + Math.random() * 0.22,
      trail: 0.12 + Math.random() * 0.2,
      hue: 180 + Math.random() * 60
    }));

    let animationFrame: number | undefined;
    let running = false;
    let lastTimestamp = 0;
    let deviceRatio = 1;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      deviceRatio = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
      canvas.width = rect.width * deviceRatio;
      canvas.height = rect.height * deviceRatio;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(deviceRatio, 0, 0, deviceRatio, 0, 0);
    };

    resize();

    let resizeObserver: ResizeObserver | undefined;
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
    }

    const drawBackground = (width: number, height: number, now: number) => {
      const gradient = ctx.createLinearGradient(0, 0, width, height);
      gradient.addColorStop(0, 'rgba(8, 16, 34, 0.92)');
      gradient.addColorStop(0.4, 'rgba(9, 21, 44, 0.88)');
      gradient.addColorStop(1, 'rgba(6, 12, 28, 0.96)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      ctx.save();
      ctx.globalAlpha = 0.6;
      stars.forEach((star, index) => {
        const alpha = 0.35 + Math.sin((now + star.delay + index * 150) / 900) * 0.15;
        ctx.globalAlpha = alpha;
        const x = star.x * width;
        const y = star.y * height;
        const radius = star.radius;
        const radial = ctx.createRadialGradient(x, y, radius * 0.1, x, y, radius);
        radial.addColorStop(0, 'rgba(56,189,248,0.8)');
        radial.addColorStop(1, 'rgba(15,23,42,0.05)');
        ctx.fillStyle = radial;
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.restore();
    };

    const getControlPoint = (startX: number, startY: number, endX: number, endY: number, canvasHeight: number) => {
      const lift = Math.max(canvasHeight * 0.08, 26);
      const verticalDelta = endY - startY;
      const adjust = verticalDelta * 0.25;
      return {
        x: (startX + endX) / 2,
        y: startY - lift + adjust
      };
    };

    const drawEdges = (width: number, height: number) => {
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      edges.forEach((edge) => {
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) {
          return;
        }
        const startX = from.x * width;
        const startY = from.y * height;
        const endX = to.x * width;
        const endY = to.y * height;
        const control = getControlPoint(startX, startY, endX, endY, height);
        const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
        gradient.addColorStop(0, 'rgba(56,189,248,0.08)');
        gradient.addColorStop(0.5, 'rgba(96,165,250,0.35)');
        gradient.addColorStop(1, 'rgba(34,211,238,0.08)');
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2.2 * (edge.emphasis ?? 1);
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.quadraticCurveTo(control.x, control.y, endX, endY);
        ctx.stroke();
      });
      ctx.restore();
    };

    const drawNodes = (width: number, height: number, now: number) => {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.font = '600 12px "Inter", system-ui, -apple-system, BlinkMacSystemFont';
      nodes.forEach((node, index) => {
        const x = node.x * width;
        const y = node.y * height;
        const pulse = 6 + Math.sin(now / 500 + index) * 2;
        const glowRadius = 18 + Math.sin(now / 900 + index) * 3;

        const baseGradient = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        baseGradient.addColorStop(0, `${node.accent.replace('1)', '0.6)')}`);
        baseGradient.addColorStop(1, 'rgba(15,23,42,0.02)');
        ctx.fillStyle = baseGradient;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        const nodeFill = node.accent.replace('1)', '0.85)');
        ctx.fillStyle = nodeFill;
        ctx.beginPath();
        ctx.arc(x, y, 12 + pulse * 0.25, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(226, 232, 240, 0.85)';
        ctx.fillText(node.label, x, y + 32);
      });
      ctx.restore();
    };

    const drawPulses = (width: number, height: number, delta: number) => {
      ctx.save();
      pulses.forEach((pulse) => {
        const edge = edges[pulse.edgeIndex];
        const from = nodeMap.get(edge.from);
        const to = nodeMap.get(edge.to);
        if (!from || !to) {
          return;
        }
        pulse.progress += delta * pulse.speed;
        if (pulse.progress > 1) {
          pulse.progress = pulse.progress - 1;
          pulse.edgeIndex = Math.floor(Math.random() * edges.length);
          pulse.speed = 0.16 + Math.random() * 0.25;
          pulse.trail = 0.12 + Math.random() * 0.18;
          pulse.hue = 180 + Math.random() * 60;
        }

        const startX = from.x * width;
        const startY = from.y * height;
        const endX = to.x * width;
        const endY = to.y * height;

        const control = getControlPoint(startX, startY, endX, endY, height);

        const t = pulse.progress;
        const invT = 1 - t;
        const x = invT * invT * startX + 2 * invT * t * control.x + t * t * endX;
        const y = invT * invT * startY + 2 * invT * t * control.y + t * t * endY;

        const tailT = Math.max(t - pulse.trail, 0);
        const invTail = 1 - tailT;
        const tailX = invTail * invTail * startX + 2 * invTail * tailT * control.x + tailT * tailT * endX;
        const tailY = invTail * invTail * startY + 2 * invTail * tailT * control.y + tailT * tailT * endY;

        const color = `hsla(${pulse.hue}, 88%, 72%, 0.85)`;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.6;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.shadowBlur = 18;
        ctx.shadowColor = color;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      });
      ctx.restore();
    };

    const render = (timestamp: number) => {
      if (!running) {
        return;
      }
      const width = canvas.width / deviceRatio;
      const height = canvas.height / deviceRatio;
      const delta = Math.min((timestamp - lastTimestamp) / 1000, 0.045);
      lastTimestamp = timestamp;

      ctx.clearRect(0, 0, width, height);
      drawBackground(width, height, timestamp);
      drawEdges(width, height);
      drawNodes(width, height, timestamp);
      drawPulses(width, height, delta);

      animationFrame = requestAnimationFrame(render);
    };

    const start = () => {
      if (!running) {
        running = true;
        lastTimestamp = performance.now();
        animationFrame = requestAnimationFrame(render);
      }
    };

    const stop = () => {
      running = false;
      if (animationFrame !== undefined) {
        cancelAnimationFrame(animationFrame);
      }
    };

    let intersectionObserver: IntersectionObserver | undefined;
    if (typeof IntersectionObserver !== 'undefined') {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry.isIntersecting) {
            start();
          } else {
            stop();
          }
        },
        { threshold: 0.2 }
      );
      intersectionObserver.observe(container);
    } else {
      start();
    }

    start();

    return () => {
      stop();
      intersectionObserver?.disconnect();
      resizeObserver?.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={`relative h-full w-full overflow-hidden ${className ?? ''}`}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-hidden="true" />
    </div>
  );
}

export default ParseratorVisualizer;
