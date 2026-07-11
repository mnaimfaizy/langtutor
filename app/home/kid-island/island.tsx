"use client";

import type { CSSProperties, ComponentType, SVGProps } from "react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

import { ActivityIcon, SettingsIcon, TrophyIcon } from "@/app/icons";
import type { Unit } from "@/lib/db";
import { currentUnit } from "@/lib/path/unit-progress";
import { cn } from "@/ui";
import { islandBackgroundId, kidIslandAssetUrl, type KidIslandAssetId } from "./assets";
import { KnockoutImage } from "./knockout-image";
import { playIslandSound } from "./sounds";
import { useKidIslandUnits } from "./use-kid-island-units";

type MapOrientation = "portrait" | "landscape";
type MapPosition = { x: number; y: number };

/**
 * Trail nodes live in clear center corridors that match the empty-terrain BG art:
 * portrait = top→bottom zigzag, landscape = left→right zigzag.
 */
const UNIT_POSITIONS: Record<MapOrientation, MapPosition[]> = {
  portrait: [
    { x: 50, y: 12 },
    { x: 28, y: 23 },
    { x: 68, y: 34 },
    { x: 32, y: 45 },
    { x: 66, y: 56 },
    { x: 34, y: 67 },
    { x: 64, y: 78 },
    { x: 50, y: 90 },
  ],
  landscape: [
    { x: 8, y: 52 },
    { x: 20, y: 38 },
    { x: 32, y: 58 },
    { x: 44, y: 36 },
    { x: 56, y: 58 },
    { x: 68, y: 38 },
    { x: 80, y: 56 },
    { x: 92, y: 42 },
  ],
};

/** Landmarks sit off the trail in beach/edge pockets — not on top of nodes. */
const LANDMARKS: Record<
  MapOrientation,
  { id: KidIslandAssetId; label: string; position: MapPosition; className: string }[]
> = {
  portrait: [
    {
      id: "sandcastle",
      label: "Picture Words",
      position: { x: 82, y: 18 },
      className: "w-20 opacity-95 sm:w-24",
    },
    {
      id: "monkey-palms",
      label: "Phonics Cove",
      position: { x: 16, y: 52 },
      className: "w-[5.5rem] opacity-95 sm:w-28",
    },
    {
      id: "pirate-wreck",
      label: "Action Bay",
      position: { x: 84, y: 72 },
      className: "w-[5.5rem] opacity-95 sm:w-28",
    },
  ],
  landscape: [
    {
      id: "sandcastle",
      label: "Picture Words",
      position: { x: 14, y: 18 },
      className: "w-24 opacity-95 xl:w-28",
    },
    {
      id: "monkey-palms",
      label: "Phonics Cove",
      position: { x: 50, y: 16 },
      className: "w-28 opacity-95 xl:w-32",
    },
    {
      id: "pirate-wreck",
      label: "Action Bay",
      position: { x: 78, y: 78 },
      className: "w-28 opacity-95 xl:w-32",
    },
  ],
};

const TRAIL_PATHS: Record<MapOrientation, string> = {
  portrait:
    "M50 12 C38 14 28 20 28 23 S55 28 68 34 S48 40 32 45 S55 50 66 56 S45 62 34 67 S55 72 64 78 S55 86 50 90",
  landscape:
    "M8 52 C12 42 16 38 20 38 S28 58 32 58 S38 34 44 36 S50 58 56 58 S62 36 68 38 S74 56 80 56 S88 40 92 42",
};

/** The kid-only Pre-A1 home (ADR 0016) — hands off to the standard path home at unit 0. */
export function KidIslandHome() {
  const { units, loading } = useKidIslandUnits();
  const [muted, setMuted] = useState(false);
  const [bgReady, setBgReady] = useState(false);
  const [bgFailed, setBgFailed] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const reduced = useReducedMotion() ?? false;
  const current = currentUnit(units);
  const done = units.filter((unit) => unit.status === "completed").length;

  useEffect(() => {
    const ids: KidIslandAssetId[] = [
      "island-bg-portrait",
      "island-bg-landscape",
      "chest-open",
      "chest-locked",
      "sandcastle",
      "pirate-wreck",
      "monkey-palms",
      "pip-aviator",
    ];
    for (const id of ids) void fetch(kidIslandAssetUrl(id)).catch(() => undefined);
  }, []);

  function selectUnit(unit: Unit) {
    setSelectedId(unit.id);
    playIslandSound("locked", muted);
  }

  const mapProps = {
    units,
    current,
    muted,
    reduced,
    selectedId,
    onBackgroundLoad: () => {
      setBgReady(true);
      setBgFailed(false);
    },
    onBackgroundError: () => setBgFailed(true),
    onSelectUnit: selectUnit,
  };

  return (
    <main
      data-testid="kid-island-home"
      className="relative flex-1 overflow-hidden bg-[#087ba9] text-[#442713]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#52d8ee_0%,#08a8d1_45%,#047cae_100%)]" />

      <header className="relative z-30 mx-auto w-full max-w-368 px-3 pt-3 sm:px-6 lg:px-8 lg:pt-4">
        <div className="grid items-start gap-2 lg:grid-cols-[minmax(18rem,1fr)_auto_minmax(18rem,1fr)] lg:gap-6">
          <div className="order-2 flex min-w-0 items-center gap-2 lg:order-1 lg:pt-10">
            <div className="flex max-w-sm min-w-0 flex-1 items-center gap-2 rounded-xl border-2 border-[#8b552f] bg-[#fff7dc]/95 p-2 pr-3 shadow-[0_4px_0_#8b552f,0_10px_24px_rgb(34_74_91/25%)]">
              <KnockoutImage
                src={kidIslandAssetUrl("pip-aviator")}
                alt="Pip"
                className="size-12 shrink-0 sm:size-14"
                threshold={240}
              />
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black tracking-[0.12em] text-[#267052] uppercase">
                  You are here
                </p>
                <p className="truncate text-sm font-black sm:text-base">
                  {current?.title ?? "Choose an adventure"}
                </p>
                <div
                  className="mt-1.5 h-2 overflow-hidden rounded-full border border-[#bf9665] bg-[#e9d9bc]"
                  role="progressbar"
                  aria-label="Island trail progress"
                  aria-valuemin={0}
                  aria-valuemax={units.length}
                  aria-valuenow={done}
                  aria-valuetext={`${done} of ${units.length} units completed`}
                >
                  <div
                    className="h-full rounded-full bg-[#70cf3c]"
                    style={{
                      width: `${units.length ? Math.round((done / units.length) * 100) : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          <h1
            className="order-1 text-center text-4xl font-black text-[#fff0bd] lg:order-2 lg:text-5xl xl:text-6xl"
            style={{
              textShadow:
                "0 3px 0 #87502d, 0 6px 0 rgba(255,255,255,.35), 0 10px 24px rgba(5,74,107,.45)",
            }}
          >
            Pip&apos;s Island
          </h1>

          <div className="order-3 flex justify-end gap-2 lg:pt-10">
            {current && current.status !== "locked" ? (
              <Link
                href={`/path/${current.id}`}
                onClick={() => playIslandSound("cheer", muted)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border-2 border-[#9d5b20] bg-[#ffc83d] px-4 py-2 text-sm font-black text-[#6c3515] shadow-[0_5px_0_#b7651f,0_10px_20px_rgb(69_65_24/22%)] transition-transform hover:-translate-y-0.5 active:translate-y-1 active:shadow-none sm:px-6 sm:text-base"
              >
                <span
                  className="flex size-6 items-center justify-center rounded-full bg-[#fff3b3]"
                  aria-hidden
                >
                  ▶
                </span>
                Play!
              </Link>
            ) : null}
            <button
              type="button"
              onClick={() => setMuted((value) => !value)}
              className="flex size-11 items-center justify-center rounded-full border-2 border-white/90 bg-[#43bce2] text-lg text-white shadow-[0_4px_0_#147fa7] active:translate-y-1 active:shadow-none"
              aria-pressed={muted}
              aria-label={muted ? "Unmute island sounds" : "Mute island sounds"}
            >
              {muted ? "🔇" : "🔊"}
            </button>
          </div>
        </div>

        {(loading || !bgReady || bgFailed) && (
          <p className="mt-2 text-center text-[10px] font-bold text-white/90">
            {bgFailed ? "Island artwork failed to load" : "Loading your island…"}
          </p>
        )}
      </header>

      <div className="relative z-10 mx-auto mt-2 w-full max-w-368 lg:-mt-12 lg:px-4">
        <div className="lg:hidden">
          <IslandMap orientation="portrait" {...mapProps} />
        </div>
        <div className="hidden lg:block">
          <IslandMap orientation="landscape" {...mapProps} />
        </div>
      </div>
    </main>
  );
}

interface IslandMapProps {
  orientation: MapOrientation;
  units: Unit[];
  current: Unit | null;
  muted: boolean;
  reduced: boolean;
  selectedId: number | null;
  onBackgroundLoad: () => void;
  onBackgroundError: () => void;
  onSelectUnit: (unit: Unit) => void;
}

function IslandMap({
  orientation,
  units,
  current,
  muted,
  reduced,
  selectedId,
  onBackgroundLoad,
  onBackgroundError,
  onSelectUnit,
}: IslandMapProps) {
  const portrait = orientation === "portrait";
  const positions = UNIT_POSITIONS[orientation];
  const bgId = islandBackgroundId(orientation);
  const trailPathRef = useRef<SVGPathElement>(null);
  const [tiles, setTiles] = useState<TrailTile[]>([]);

  useEffect(() => {
    const el = trailPathRef.current;
    if (!el) return;
    setTiles(sampleTrailTiles(el, portrait ? 3.1 : 2.6));
  }, [orientation, portrait]);

  return (
    <section
      className={cn(
        "relative isolate overflow-hidden rounded-[1.75rem] border-4 border-[#f0c48a] shadow-[0_12px_40px_rgb(2_59_84/35%)]",
        portrait ? "h-280 min-h-280 w-full" : "h-[min(44rem,calc(100svh-14.5rem))] min-h-80 w-full",
      )}
      aria-label={portrait ? "Pip's Island vertical trail" : "Pip's Island trail"}
    >
      {/* Ocean underplate so cover-crop edges never flash mismatched color */}
      <div className="pointer-events-none absolute inset-0 bg-[#11b6d5]" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={kidIslandAssetUrl(bgId)}
        alt=""
        className={cn(
          "pointer-events-none absolute inset-0 h-full w-full object-cover",
          portrait ? "object-[50%_45%]" : "object-[50%_55%]",
        )}
        // The bg was already prefetched via fetch() above, so by mount time the
        // browser may serve it from cache and never fire a fresh `load` event.
        // Check `.complete` on ref-attach too, or the "loading…" banner sticks forever.
        ref={(node) => {
          if (node?.complete && node.naturalWidth > 0) onBackgroundLoad();
        }}
        onLoad={onBackgroundLoad}
        onError={onBackgroundError}
        draggable={false}
      />
      {/* Soft grass wash under the trail corridor so stones sit in one material language */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background: portrait
            ? "radial-gradient(ellipse 55% 85% at 50% 50%, rgb(92 196 92 / 28%), transparent 70%)"
            : "radial-gradient(ellipse 90% 55% at 50% 50%, rgb(92 196 92 / 26%), transparent 72%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(255_255_255/10%),transparent_28%,rgb(0_95_125/14%))]" />

      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-0 z-10 size-full"
        aria-hidden
      >
        {/* Dirt groove — also the measurement source for tile placement below */}
        <path
          ref={trailPathRef}
          d={TRAIL_PATHS[orientation]}
          fill="none"
          stroke="rgb(90 58 28 / 45%)"
          strokeWidth={portrait ? 3.4 : 2.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Stone tiles, chained along the real curve so the path reads as a board-game trail */}
        {tiles.map((tile, i) => {
          const w = portrait ? 3.4 : 2.9;
          const h = w * 0.6;
          const tone = i % 3 === 0 ? "#e9dcae" : "#f5ecc7";
          return (
            <g key={i} transform={`translate(${tile.x} ${tile.y}) rotate(${tile.angle})`}>
              <rect
                x={-w / 2}
                y={-h / 2 + 0.45}
                width={w}
                height={h}
                rx={h / 2}
                fill="rgb(70 46 20 / 30%)"
              />
              <rect
                x={-w / 2}
                y={-h / 2}
                width={w}
                height={h}
                rx={h / 2}
                fill={tone}
                stroke="#c7a866"
                strokeWidth={0.22}
              />
            </g>
          );
        })}
      </svg>

      {LANDMARKS[orientation].map((landmark) => (
        <MapLandmark key={landmark.id} {...landmark} />
      ))}

      <ol className="absolute inset-0 z-20 list-none">
        {units.slice(0, positions.length).map((unit, index) => (
          <MapUnit
            key={unit.id}
            unit={unit}
            index={index}
            total={units.length}
            position={positions[index]!}
            current={unit.id === current?.id}
            muted={muted}
            reduced={reduced}
            selected={selectedId === unit.id}
            portrait={portrait}
            onSelect={onSelectUnit}
          />
        ))}
      </ol>

      <nav
        aria-label="Island shortcuts"
        className="absolute right-3 bottom-4 left-3 z-30 mx-auto flex max-w-3xl items-center justify-between gap-1 rounded-xl border-2 border-[#84502c] bg-[#9c5b2f]/95 p-1.5 shadow-[0_5px_0_#60371f,0_12px_24px_rgb(2_59_84/30%)] backdrop-blur-sm sm:right-6 sm:bottom-5 sm:left-6"
      >
        <div className="min-w-0 flex-1 rounded-lg bg-[#f6d27b] px-3 py-2 text-center font-black shadow-inner">
          My Island
        </div>
        <IslandShortcut
          href="/settings"
          label="Settings"
          icon={SettingsIcon}
          colorClassName="bg-[#f28a35] shadow-[0_3px_0_#9c4727]"
        />
        <IslandShortcut
          href="/collection"
          label="Collection"
          icon={TrophyIcon}
          colorClassName="bg-[#3f9bd6] shadow-[0_3px_0_#1f5e85]"
        />
        <IslandShortcut
          href="/diagnostics"
          label="Progress"
          icon={ActivityIcon}
          colorClassName="bg-[#5cb85c] shadow-[0_3px_0_#2f7a2f]"
        />
      </nav>
    </section>
  );
}

function MapLandmark({
  id,
  label,
  position,
  className,
}: {
  id: KidIslandAssetId;
  label: string;
  position: MapPosition;
  className: string;
}) {
  return (
    <div
      className="pointer-events-none absolute z-10 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={positionStyle(position)}
    >
      {/* Ground puddle so the sprite feels planted in the plate */}
      <span
        className="absolute top-[72%] left-1/2 h-3 w-[70%] -translate-x-1/2 rounded-[100%] bg-[#3d6b2e]/35 blur-[2px]"
        aria-hidden
      />
      <KnockoutImage
        src={kidIslandAssetUrl(id)}
        alt=""
        className={cn("relative h-auto drop-shadow-[0_8px_12px_rgb(20_60_40/35%)]", className)}
      />
      <span className="relative -mt-1 max-w-28 rounded-md border border-[#b77b49]/80 bg-[#fff0ce]/92 px-2 py-0.5 text-center text-[9px] leading-tight font-black shadow-md sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}

function MapUnit({
  unit,
  index,
  total,
  position,
  current,
  muted,
  reduced,
  selected,
  portrait,
  onSelect,
}: {
  unit: Unit;
  index: number;
  total: number;
  position: MapPosition;
  current: boolean;
  muted: boolean;
  reduced: boolean;
  selected: boolean;
  portrait: boolean;
  onSelect: (unit: Unit) => void;
}) {
  const locked = unit.status === "locked";
  const spriteId: KidIslandAssetId = locked ? "chest-locked" : "chest-open";
  const content = (
    <motion.div
      className="relative flex flex-col items-center"
      whileTap={locked ? { x: [0, -3, 3, 0] } : { scale: 0.94 }}
      animate={current && !reduced ? { y: [0, -5, 0] } : undefined}
      transition={current ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : undefined}
    >
      {/* Ground shadow so the chest reads as sitting on the path, not floating */}
      <span
        className="absolute top-[72%] left-1/2 h-3.5 w-14 -translate-x-1/2 rounded-[100%] bg-[#2f5a28]/40 blur-[1.5px] sm:w-16"
        aria-hidden
      />
      {current && (
        <>
          {/* Soft glow instead of a solid badge circle behind the current chest */}
          <span
            className="absolute top-1/2 left-1/2 -z-10 size-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#ffe17a]/70 blur-xl sm:size-24"
            aria-hidden
          />
          <KnockoutImage
            src={kidIslandAssetUrl("pip-aviator")}
            alt=""
            className="absolute -top-9 left-1/2 z-10 w-10 -translate-x-1/2 drop-shadow-lg sm:-top-11 sm:w-12"
          />
        </>
      )}
      <span className="relative flex items-center justify-center">
        <KnockoutImage
          src={kidIslandAssetUrl(spriteId)}
          alt=""
          className={cn(
            "h-auto w-14 drop-shadow-[0_6px_10px_rgb(20_60_40/40%)] sm:w-16",
            current && "w-18 sm:w-20",
            !portrait && "xl:w-20",
            locked && "opacity-85 grayscale-25",
            selected && "brightness-110",
          )}
        />
      </span>
      <span
        className={cn(
          "relative mt-1 max-w-28 rounded-md border-2 px-2 py-1 text-center text-[9px] leading-[1.08] font-black shadow-md sm:max-w-32 sm:text-[10px]",
          current
            ? "border-[#d6902b] bg-[#fff0b2]"
            : locked
              ? "border-[#b6a58e] bg-[#fff8e8]/95 text-[#67574c]"
              : "border-[#d29a55] bg-[#fff2d4]/95",
        )}
      >
        {unit.title}
      </span>
      {current && (
        <span className="relative mt-1 rounded-full border border-white/80 bg-[#37a6cb] px-2 py-0.5 text-[9px] font-black text-white shadow">
          {index + 1}/{total}
        </span>
      )}
    </motion.div>
  );

  return (
    <li className="absolute -translate-x-1/2 -translate-y-1/2" style={positionStyle(position)}>
      {locked ? (
        <button type="button" onClick={() => onSelect(unit)} aria-label={`${unit.title}: locked`}>
          {content}
        </button>
      ) : (
        <Link
          href={`/path/${unit.id}`}
          onClick={() => {
            playIslandSound("whoosh", muted);
          }}
          aria-label={`${unit.title}: ${unit.status}`}
        >
          {content}
        </Link>
      )}
    </li>
  );
}

function IslandShortcut({
  href,
  label,
  icon: Icon,
  colorClassName,
}: {
  href: string;
  label: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  colorClassName: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-lg border-2 border-white/60 text-white sm:h-10 sm:w-auto sm:gap-1.5 sm:px-3",
        colorClassName,
      )}
    >
      <Icon className="size-5" />
      <span className="hidden text-[10px] font-black sm:inline">{label}</span>
    </Link>
  );
}

function positionStyle(position: MapPosition): CSSProperties {
  return { left: `${position.x}%`, top: `${position.y}%` };
}

type TrailTile = { x: number; y: number; angle: number };

/**
 * Chains tiles along the *actual rendered curve* (not the straight polyline between
 * waypoints) so the stone path visually follows every bend, matching a board-game trail.
 */
function sampleTrailTiles(path: SVGPathElement, spacing: number): TrailTile[] {
  const length = path.getTotalLength();
  if (!length) return [];
  const count = Math.max(2, Math.round(length / spacing));
  const tiles: TrailTile[] = [];
  for (let i = 0; i <= count; i++) {
    const d = (length * i) / count;
    const p = path.getPointAtLength(d);
    const ahead = path.getPointAtLength(Math.min(length, d + 0.6));
    const angle = (Math.atan2(ahead.y - p.y, ahead.x - p.x) * 180) / Math.PI;
    tiles.push({ x: p.x, y: p.y, angle });
  }
  return tiles;
}
