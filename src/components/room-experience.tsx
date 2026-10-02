"use client";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef, Component, type ReactNode } from "react";
import { Sparkles, ArrowUpRight } from "lucide-react";
import { Button } from "./ui/button";
const RoomCanvas = dynamic(() => import("./room-canvas"), {
  ssr: false,
  loading: () => <p className="room-loading">Opening your room…</p>,
});
const tasks = [
  {
    label: "Surfaces",
    text: "Dust and wipe reachable furniture and surfaces, with care for delicate finishes.",
  },
  {
    label: "Floors",
    text: "Vacuum rugs and carpets, then mop suitable hard floors using your equipment.",
  },
  {
    label: "The details",
    text: "Focus on the priorities you agree with your cleaner. What fits depends on the time booked.",
  },
];
class CanvasBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
export function StaticRoom() {
  return (
    <svg
      viewBox="0 0 600 370"
      role="img"
      aria-label="Illustration of a calm living room with a sofa, rug and side table"
    >
      <defs>
        <linearGradient id="roomWall" x2="0" y2="1">
          <stop stopColor="#e8e5dc" />
          <stop offset="1" stopColor="#f3efe7" />
        </linearGradient>
      </defs>
      <path d="M55 110 295 15 545 100 305 210Z" fill="url(#roomWall)" />
      <path d="M55 110v130l250 112V210Z" fill="#e7ded4" />
      <path d="M545 100v140L305 352V210Z" fill="#f5eee4" />
      <path d="M55 240 300 140 545 240 305 352Z" fill="#d7baa0" />
      <path d="m130 260 170-68 156 64-168 73Z" fill="#faf5eb" />
      <path d="m164 199 142-56 96 39v65l-142 57-96-40Z" fill="#efbccb" />
      <path
        d="m164 199 96 39 142-56"
        fill="none"
        stroke="#f6d5df"
        strokeWidth="12"
      />
      <path d="M260 238v66" stroke="#bc8b9d" strokeWidth="3" />
      <path
        d="m95 163 52-20v62l-52 20Z"
        fill="#bdd5d6"
        stroke="#fff"
        strokeWidth="9"
      />
      <path d="m385 285 64-25 25 10-64 25Z" fill="#1f4357" />
      <path
        d="M411 294v30m-26-39v27m64-52v28"
        stroke="#1f4357"
        strokeWidth="7"
      />
      <path d="m475 215 20-8 15 7-20 8Z" fill="#fff" />
      <path d="m479 214 10 28 16-6 3-24" fill="#faf7f0" />
      <path
        d="M493 214v-45m0 23-18-22m18 10 17-20"
        stroke="#557b61"
        strokeWidth="7"
      />
      <circle cx="475" cy="170" r="12" fill="#69896f" />
      <circle cx="510" cy="160" r="14" fill="#749179" />
      <circle cx="493" cy="170" r="13" fill="#4c7058" />
    </svg>
  );
}
export function RoomExperience() {
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(true);
  const [selected, setSelected] = useState(0);
  const [reduced, setReduced] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    change();
    media.addEventListener("change", change);
    const observer = new IntersectionObserver(([entry]) =>
      setVisible(entry.isIntersecting),
    );
    if (ref.current) observer.observe(ref.current);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", change);
    };
  }, []);
  function enable() {
    const canvas = document.createElement("canvas");
    if (canvas.getContext("webgl2") || canvas.getContext("webgl"))
      setActive(true);
  }
  return (
    <section className="room-section section" ref={ref}>
      <div className="room-stage">
        <div className="room-tag">
          <Sparkles size={16} />A closer look at the everyday
        </div>
        <CanvasBoundary fallback={<StaticRoom />}>
          {active && visible && !reduced ? (
            <RoomCanvas selected={selected} onSelect={setSelected} />
          ) : (
            <StaticRoom />
          )}
        </CanvasBoundary>
        {!active && (
          <Button variant="outline" onClick={enable} disabled={reduced}>
            Explore the room <ArrowUpRight size={16} />
          </Button>
        )}
        {reduced && (
          <small>Static view respects your reduced-motion preference.</small>
        )}
      </div>
      <div>
        <p className="eyebrow">Take a closer look</p>
        <h2>
          Explore the
          <br />
          little things.
        </h2>
        <p>
          From reachable surfaces to floors and your agreed priorities, explore
          some of the details in a regular domestic clean.
        </p>
        <div
          className="room-tabs"
          role="group"
          aria-label="Room cleaning tasks"
        >
          {tasks.map((task, i) => (
            <button
              key={task.label}
              aria-pressed={selected === i}
              onClick={() => setSelected(i)}
            >
              {String(i + 1).padStart(2, "0")} {task.label}
            </button>
          ))}
        </div>
        <p aria-live="polite" className="room-description">
          {tasks[selected].text}
        </p>
        <small>Illustrative room. Your checklist is agreed individually.</small>
      </div>
    </section>
  );
}
