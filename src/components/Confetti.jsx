import { useEffect, useState } from "react";

const COLORS = ["#F58220", "#F0B26B", "#00A9CE", "#86efac", "#c084fc", "#fbbf24", "#ff6b6b", "#043B72"];

function rand(a, b) { return a + Math.random() * (b - a); }

export default function Confetti({ active }) {
  const [particles, setParticles] = useState([]);

  useEffect(() => {
    if (!active) { setParticles([]); return; }
    const ps = Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: rand(5, 95),
      color: COLORS[i % COLORS.length],
      delay: rand(0, 0.5),
      dur: rand(1.2, 2.5),
      rot: rand(0, 360),
      rotEnd: rand(360, 1080),
      size: rand(5, 10),
      shape: i % 4, // 0=square, 1=circle, 2=strip, 3=diamond
      drift: rand(-30, 30),
    }));
    setParticles(ps);
    const timer = setTimeout(() => setParticles([]), 3000);
    return () => clearTimeout(timer);
  }, [active]);

  if (particles.length === 0) return null;

  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 99999, overflow: "hidden" }}>
      {particles.map(p => {
        const isCircle = p.shape === 1;
        const isStrip = p.shape === 2;
        const isDiamond = p.shape === 3;
        return (
          <div key={p.id} style={{
            position: "absolute",
            left: `${p.x}%`,
            top: -20,
            width: isStrip ? 3 : p.size,
            height: isStrip ? p.size * 2.5 : isDiamond ? p.size : p.size,
            background: p.color,
            borderRadius: isCircle ? "50%" : isDiamond ? 1 : 2,
            transform: isDiamond ? `rotate(45deg)` : `rotate(${p.rot}deg)`,
            opacity: 0,
            animation: `confettiFall${p.id % 3} ${p.dur}s ease-in ${p.delay}s forwards`,
          }}>
            <style>{`
              @keyframes confettiFall${p.id % 3} {
                0% { opacity: 1; transform: translateY(0) translateX(0) rotate(${p.rot}deg) scale(1); }
                70% { opacity: 1; }
                100% { opacity: 0; transform: translateY(100vh) translateX(${p.drift}px) rotate(${p.rotEnd}deg) scale(0.4); }
              }
            `}</style>
          </div>
        );
      })}
    </div>
  );
}
