'use client';

export default function TechGrid() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden" aria-hidden="true">
      {/* radial glow top-right */}
      <div className="absolute -top-40 -right-40 w-[700px] h-[700px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)' }} />
      {/* radial glow bottom-left */}
      <div className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.06) 0%, transparent 70%)' }} />
      {/* center accent */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[400px]"
        style={{ background: 'radial-gradient(ellipse, rgba(6,182,212,0.04) 0%, transparent 65%)' }} />
    </div>
  );
}
