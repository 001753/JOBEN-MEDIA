'use client';

import { useEffect, useRef } from 'react';

export default function AnimatedBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animId;
    let particles = [];
    const PARTICLE_COUNT = 65;
    const MAX_DIST = 130;
    const SPEED = 0.28;

    function isDark() {
      return document.documentElement.classList.contains('dark');
    }

    function resize() {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    }
    resize();

    function mkParticle() {
      return {
        x:  Math.random() * canvas.width,
        y:  Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * SPEED,
        vy: (Math.random() - 0.5) * SPEED,
        r:  Math.random() * 1.6 + 0.4,
      };
    }

    particles = Array.from({ length: PARTICLE_COUNT }, mkParticle);

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const dark = isDark();

      /* ── grid ── */
      const gridAlpha = dark ? 0.04 : 0.025;
      ctx.strokeStyle = dark
        ? `rgba(56,189,248,${gridAlpha})`
        : `rgba(100,116,139,${gridAlpha})`;
      ctx.lineWidth = 1;
      const gSize = 64;
      for (let x = 0; x < canvas.width; x += gSize) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gSize) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      /* ── lines ── */
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const d  = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST) {
            const alpha = (1 - d / MAX_DIST) * (dark ? 0.32 : 0.06);
            ctx.strokeStyle = dark
              ? `rgba(56,189,248,${alpha})`
              : `rgba(100,116,139,${alpha})`;
            ctx.lineWidth = 0.7;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      /* ── dots ── */
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = dark
          ? 'rgba(125,211,252,0.65)'
          : 'rgba(100,116,139,0.15)';
        ctx.fill();

        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
      }

      animId = requestAnimationFrame(draw);
    }

    draw();

    const onResize = () => {
      resize();
      particles = Array.from({ length: PARTICLE_COUNT }, mkParticle);
    };
    window.addEventListener('resize', onResize, { passive: true });

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0 tech-canvas"
      aria-hidden="true"
    />
  );
}
