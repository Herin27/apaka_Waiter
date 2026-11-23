import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ChefHat, Sparkles, Compass, BellRing } from 'lucide-react';
import { useSocket } from '../../api/socket';
import { cn } from '../../utils/cn';

const STATUS_VISUALS = {
  EMPTY: {
    label: 'Empty',
    fill: 'bg-zinc-800/90 border-zinc-600/70 text-zinc-300',
    chair: 'bg-zinc-700',
    glow: '',
  },
  SEATED: {
    label: 'Seated',
    fill: 'bg-sky-500/20 border-sky-400 text-sky-100',
    chair: 'bg-sky-400/70',
    glow: 'shadow-[0_0_20px_-4px_rgba(56,189,248,0.45)]',
  },
  ORDERING: {
    label: 'Ordering',
    fill: 'bg-purple-500/20 border-purple-400 text-purple-100',
    chair: 'bg-purple-400/70',
    glow: 'shadow-[0_0_20px_-4px_rgba(168,85,247,0.45)]',
  },
  WAITING: {
    label: 'Waiting',
    fill: 'bg-amber-500/25 border-amber-400 text-amber-100 animate-pulse',
    chair: 'bg-amber-400/80',
    glow: 'shadow-[0_0_24px_-4px_rgba(245,158,11,0.55)]',
  },
  PREPARING: {
    label: 'Preparing',
    fill: 'bg-accent/25 border-accent text-orange-100',
    chair: 'bg-accent/80',
    glow: 'shadow-orange-glow',
  },
  READY: {
    label: 'Ready',
    fill: 'bg-emerald-500/25 border-emerald-400 text-emerald-100 animate-pulse',
    chair: 'bg-emerald-400/85',
    glow: 'shadow-[0_0_26px_-4px_rgba(16,185,129,0.65)]',
  },
  NEEDS_BILL: {
    label: 'Needs Bill',
    fill: 'bg-red-500/25 border-red-400 text-red-100',
    chair: 'bg-red-400/80',
    glow: 'shadow-[0_0_24px_-4px_rgba(239,68,68,0.55)]',
  },
  NEEDS_HELP: {
    label: 'Needs Help',
    fill: 'bg-red-500/30 border-red-500 text-white ring-4 ring-red-500/60 animate-ping-slow',
    chair: 'bg-red-500',
    glow: 'shadow-[0_0_30px_-2px_rgba(239,68,68,0.8)]',
  },
};

// Normalize legacy grid coordinates (1..4) or percentage coordinates (0..100) into 0..100% floor space
export const normalizeTableCoords = (table, index = 0) => {
  const rawX = Number(table.x ?? 0);
  const rawY = Number(table.y ?? 0);

  if (rawX >= 0 && rawX <= 10 && rawY >= 0 && rawY <= 10) {
    const col = rawX > 0 ? rawX - 1 : index % 3;
    const row = rawY > 0 ? rawY - 1 : Math.floor(index / 3);
    const pctX = Math.min(88, Math.max(12, 22 + col * 28));
    const pctY = Math.min(86, Math.max(24, 34 + row * 28));
    return { xPct: pctX, yPct: pctY };
  }

  return {
    xPct: Math.min(92, Math.max(8, rawX)),
    yPct: Math.min(90, Math.max(22, rawY)),
  };
};

// Compute chair positions evenly around the table perimeter
function TableChairs({ seats = 4, shape = 'SQUARE', chairColorClass = 'bg-zinc-600' }) {
  const count = Math.min(12, Math.max(1, Number(seats || 4)));

  if (shape === 'ROUND') {
    return Array.from({ length: count }).map((_, i) => {
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
      const radiusPct = 62;
      const left = 50 + radiusPct * Math.cos(angle);
      const top = 50 + radiusPct * Math.sin(angle);
      return (
        <span
          key={i}
          style={{ left: `${left}%`, top: `${top}%` }}
          className={cn(
            'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full border border-black/40',
            chairColorClass
          )}
        />
      );
    });
  }

  // SQUARE or RECTANGLE: distribute chairs on top, bottom, left, right edges
  const positions = [];
  const topCount = Math.ceil(count / 2);
  const bottomCount = Math.floor(count / 2);

  for (let i = 0; i < topCount; i++) {
    const pct = ((i + 1) / (topCount + 1)) * 100;
    positions.push({ left: `${pct}%`, top: '-10px', horizontal: true });
  }
  for (let i = 0; i < bottomCount; i++) {
    const pct = ((i + 1) / (bottomCount + 1)) * 100;
    positions.push({ left: `${pct}%`, top: 'calc(100% + 10px)', horizontal: true });
  }

  return positions.map((pos, idx) => (
    <span
      key={idx}
      style={{ left: pos.left, top: pos.top }}
      className={cn(
        'pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded-full border border-black/40',
        pos.horizontal ? 'h-2 w-4' : 'h-4 w-2',
        chairColorClass
      )}
    />
  ));
}

export default function FloorMap({
  tables = [],
  onSelectTable,
  editable = false,
  selectedTableId = null,
  onMoveTable,
  enableSocket = true,
  className,
}) {
  const prefersReducedMotion = useReducedMotion();
  const stageRef = useRef(null);
  const [tiltEnabled, setTiltEnabled] = useState(true);
  const [draggingId, setDraggingId] = useState(null);

  // Active animated order paths: [{ id, tableId, xPct, yPct, direction: 'TO_KITCHEN'|'TO_TABLE', label }]
  const [activePaths, setActivePaths] = useState([]);

  const normalizedTables = useMemo(
    () =>
      tables.map((t, idx) => ({
        ...t,
        ...normalizeTableCoords(t, idx),
      })),
    [tables]
  );

  const triggerOrderBeam = (tableId, direction = 'TO_KITCHEN', label = '') => {
    const target = normalizedTables.find((t) => String(t._id) === String(tableId));
    if (!target) return;

    const beamId = `${tableId}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setActivePaths((prev) => [
      ...prev.slice(-6),
      {
        id: beamId,
        tableId: target._id,
        xPct: target.xPct,
        yPct: target.yPct,
        direction,
        label,
      },
    ]);

    setTimeout(() => {
      setActivePaths((prev) => prev.filter((p) => p.id !== beamId));
    }, 3400);
  };

  // Listen to live socket events to animate beams between Kitchen bar (50%, 9%) and Table (xPct, yPct)
  useSocket(
    'order:new',
    ({ order }) => {
      if (!order) return;
      const tId = order.tableId?._id || order.tableId;
      triggerOrderBeam(tId, 'TO_KITCHEN', order.orderNo);
    },
    { enabled: enableSocket }
  );

  useSocket(
    'order:updated',
    ({ order }) => {
      if (!order) return;
      const tId = order.tableId?._id || order.tableId;
      const dir = ['READY', 'SERVED'].includes(order.status) ? 'TO_TABLE' : 'TO_KITCHEN';
      triggerOrderBeam(tId, dir, order.orderNo);
    },
    { enabled: enableSocket }
  );

  useSocket(
    'call:new',
    ({ call }) => {
      if (!call) return;
      const tId = call.tableId?._id || call.tableId;
      triggerOrderBeam(tId, 'TO_KITCHEN', call.type);
    },
    { enabled: enableSocket }
  );

  // Drag-and-drop pointer handling for Floor Editor mode
  useEffect(() => {
    if (!editable || !draggingId) return;

    const handlePointerMove = (e) => {
      if (!stageRef.current) return;
      const rect = stageRef.current.getBoundingClientRect();
      const rawXPct = ((e.clientX - rect.left) / rect.width) * 100;
      const rawYPct = ((e.clientY - rect.top) / rect.height) * 100;

      // Snap to 4% grid & clamp below kitchen zone
      const snappedX = Math.min(92, Math.max(8, Math.round(rawXPct / 4) * 4));
      const snappedY = Math.min(90, Math.max(22, Math.round(rawYPct / 4) * 4));

      onMoveTable?.(draggingId, snappedX, snappedY);
    };

    const handlePointerUp = () => {
      setDraggingId(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [editable, draggingId, onMoveTable]);

  const use3DTilt = tiltEnabled && !editable && !prefersReducedMotion;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Legend & 3D Tilt Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-surface-1 border border-border-subtle px-4 py-2.5">
        <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-zinc-400">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-zinc-600" /> Empty
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-sky-400" /> Seated
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-purple-400" /> Ordering
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Waiting
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-accent" /> Preparing
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Ready
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Bill / Help
          </span>
        </div>

        {!editable && !prefersReducedMotion && (
          <button
            type="button"
            onClick={() => setTiltEnabled((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 border border-border-subtle px-3 py-1 text-xs font-semibold text-zinc-300 transition cursor-pointer"
          >
            <Compass className="h-3.5 w-3.5 text-accent" />
            {tiltEnabled ? '3D View: On' : '2D Flat View'}
          </button>
        )}
      </div>

      {/* Responsive Scrollable / Pinchable Floor Stage */}
      <div className="overflow-x-auto pb-2 floor-3d-stage">
        <div
          ref={stageRef}
          className={cn(
            'relative min-w-[640px] w-full aspect-[16/10] rounded-3xl bg-dotted-grid border border-border-strong shadow-card overflow-hidden select-none',
            use3DTilt ? 'floor-3d-plane' : 'floor-3d-plane-flat'
          )}
        >
          {/* Ambient radial glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-40 w-96 rounded-full bg-accent/15 blur-3xl"
          />

          {/* Top KITCHEN Zone Bar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 w-[72%] max-w-md rounded-2xl bg-surface-2/95 border border-accent/50 px-5 py-2.5 shadow-orange-glow flex items-center justify-center gap-2.5">
            <ChefHat className="h-4 w-4 text-accent" />
            <span className="text-xs font-black tracking-[0.22em] text-white uppercase">
              KITCHEN &amp; PASS COUNTER
            </span>
            <Sparkles className="h-3.5 w-3.5 text-accent" />
          </div>

          {/* SVG Overlay for Animated Order Paths (Kitchen <-> Table) */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="pointer-events-none absolute inset-0 h-full w-full z-10"
          >
            <defs>
              <filter id="beamGlow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="0.8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            <AnimatePresence>
              {activePaths.map((beam) => {
                const startX = beam.direction === 'TO_KITCHEN' ? beam.xPct : 50;
                const startY = beam.direction === 'TO_KITCHEN' ? beam.yPct : 10;
                const endX = beam.direction === 'TO_KITCHEN' ? 50 : beam.xPct;
                const endY = beam.direction === 'TO_KITCHEN' ? 10 : beam.yPct;

                return (
                  <g key={beam.id}>
                    <motion.line
                      x1={startX}
                      y1={startY}
                      x2={endX}
                      y2={endY}
                      stroke="#E8591A"
                      strokeWidth="0.55"
                      strokeDasharray="1.5 1"
                      filter="url(#beamGlow)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: [0, 1, 1, 0] }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 3.2, ease: 'easeInOut' }}
                    />

                    {!prefersReducedMotion && (
                      <motion.circle
                        r="1.15"
                        fill="#FFFFFF"
                        filter="url(#beamGlow)"
                        initial={{ cx: startX, cy: startY, opacity: 0 }}
                        animate={{
                          cx: [startX, endX],
                          cy: [startY, endY],
                          opacity: [0, 1, 1, 0],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: 1,
                          ease: 'easeInOut',
                        }}
                      />
                    )}
                  </g>
                );
              })}
            </AnimatePresence>
          </svg>

          {/* Rendered Table Nodes */}
          {normalizedTables.map((table) => {
            const visual = STATUS_VISUALS[table.status] || STATUS_VISUALS.EMPTY;
            const isSelected = String(selectedTableId) === String(table._id);
            const isRound = table.shape === 'ROUND';
            const isRect = table.shape === 'RECTANGLE';

            return (
              <div
                key={table._id}
                style={{
                  left: `${table.xPct}%`,
                  top: `${table.yPct}%`,
                }}
                onPointerDown={(e) => {
                  if (editable) {
                    e.stopPropagation();
                    setDraggingId(table._id);
                  }
                }}
                onClick={() => onSelectTable?.(table)}
                className={cn(
                  'absolute -translate-x-1/2 -translate-y-1/2 z-20 transition-shadow',
                  editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                )}
              >
                <div
                  className={cn(
                    'relative flex flex-col items-center justify-center border-2 transition-transform hover:scale-105',
                    isRound
                      ? 'h-20 w-20 rounded-full'
                      : isRect
                      ? 'h-20 w-28 rounded-2xl'
                      : 'h-20 w-20 rounded-2xl',
                    visual.fill,
                    visual.glow,
                    isSelected && 'ring-4 ring-accent border-white scale-105'
                  )}
                >
                  {/* Chairs drawn around table according to seat count */}
                  <TableChairs
                    seats={table.seats}
                    shape={table.shape}
                    chairColorClass={visual.chair}
                  />

                  {table.status === 'NEEDS_HELP' && (
                    <BellRing className="h-3.5 w-3.5 text-red-300 animate-bounce mb-0.5" />
                  )}

                  <span className="text-sm font-black tracking-tight leading-none">
                    {table.name}
                  </span>
                  <span className="mt-1 text-[9px] font-bold uppercase tracking-wider opacity-90">
                    {visual.label}
                  </span>
                  <span className="text-[9px] opacity-70">{table.seats}p</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
