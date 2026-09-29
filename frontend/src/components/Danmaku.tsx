import { useEffect, useMemo, useRef, useState, type FormEvent, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, ChevronUp, Eye, EyeOff, Send, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import {
  formatDanmakuTime,
  mergeDanmaku,
  readDanmakuPreferences,
  writeDanmakuPreferences,
  type DanmakuItem,
  type DanmakuMode,
  type DanmakuPreferences,
  type DanmakuUser,
} from '../lib/danmaku';

const SCROLL_DURATION = 8;
const FIXED_DURATION = 4;
const COLORS = ['#FFFFFF', '#F43F5E', '#FACC15', '#4ADE80', '#38BDF8', '#C084FC'];
const SIZES = [18, 24, 32] as const;
const MODES: { value: DanmakuMode; label: string }[] = [
  { value: 'scroll', label: 'Scroll' },
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

interface DanmakuProps {
  videoId: string;
  user: DanmakuUser | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayWidth: number;
  overlayHeight: number;
  overlayHost: HTMLDivElement | null;
}

interface PositionedDanmaku {
  item: DanmakuItem;
  lane: number;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (typeof error !== 'object' || error === null) return fallback;
  const response = 'response' in error ? error.response : undefined;
  if (typeof response !== 'object' || response === null || !('data' in response)) return fallback;
  const data = response.data;
  if (typeof data !== 'object' || data === null) return fallback;
  if ('error' in data && typeof data.error === 'string') return data.error;
  if ('message' in data && typeof data.message === 'string') return data.message;
  return fallback;
}

function allocateLanes(items: DanmakuItem[], mode: DanmakuMode, laneCount: number, duration: number) {
  const laneAvailableAt = Array.from({ length: laneCount }, () => Number.NEGATIVE_INFINITY);
  const positioned: PositionedDanmaku[] = [];

  items
    .filter((item) => item.mode === mode)
    .sort((a, b) => a.time - b.time || a.createdAt.localeCompare(b.createdAt))
    .forEach((item) => {
      const lane = laneAvailableAt.findIndex((availableAt) => item.time >= availableAt);
      if (lane === -1) return;
      positioned.push({ item, lane });
      laneAvailableAt[lane] = item.time + duration;
    });

  return positioned;
}

function estimateTextWidth(text: string, fontSize: number) {
  const glyphUnits = Array.from(text).reduce((total, glyph) => {
    if (/\s/u.test(glyph)) return total + 0.35;
    if ((glyph.codePointAt(0) ?? 0) <= 0x7f) return total + 0.62;
    return total + 1;
  }, 0);
  return Math.max(80, glyphUnits * fontSize + 12);
}

function DanmakuOverlay({
  items,
  currentTime,
  width,
  height,
  preferences,
}: {
  items: DanmakuItem[];
  currentTime: number;
  width: number;
  height: number;
  preferences: DanmakuPreferences;
}) {
  const usableHeight = Math.max(48, height * 0.72);
  const laneHeight = 38;
  const totalLaneCount = Math.max(0, Math.floor(usableHeight / laneHeight));
  const fixedLaneCount = totalLaneCount >= 5 ? Math.min(2, Math.floor((totalLaneCount - 1) / 3)) : totalLaneCount >= 3 ? 1 : 0;
  const scrollLaneCount = Math.max(0, totalLaneCount - fixedLaneCount * 2);

  const positioned = useMemo(() => {
    return {
      scroll: allocateLanes(items, 'scroll', scrollLaneCount, SCROLL_DURATION),
      top: allocateLanes(items, 'top', fixedLaneCount, FIXED_DURATION),
      bottom: allocateLanes(items, 'bottom', fixedLaneCount, FIXED_DURATION),
    };
  }, [fixedLaneCount, items, scrollLaneCount]);

  const isActive = (item: DanmakuItem, duration: number) => item.time <= currentTime && currentTime < item.time + duration;
  const active = {
    scroll: positioned.scroll.filter(({ item }) => isActive(item, SCROLL_DURATION)),
    top: positioned.top.filter(({ item }) => isActive(item, FIXED_DURATION)),
    bottom: positioned.bottom.filter(({ item }) => isActive(item, FIXED_DURATION)),
  };

  if (!preferences.visible) return null;

  const textStyle = (item: DanmakuItem) => ({
    color: item.color,
    fontSize: `${item.size}px`,
    opacity: preferences.opacity,
    textShadow: '0 1px 2px #000, 1px 0 2px #000, -1px 0 2px #000',
  });

  return (
    <div
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
      data-testid="danmaku-overlay"
      aria-hidden="true"
    >
      {active.scroll.map(({ item, lane }) => {
        const progress = Math.min(1, Math.max(0, (currentTime - item.time) / SCROLL_DURATION));
        const estimatedWidth = estimateTextWidth(item.text, item.size);
        const x = width - progress * (width + estimatedWidth);
        return (
          <span
            key={item.id}
            data-danmaku-id={item.id}
            className="absolute left-0 whitespace-nowrap font-bold leading-none will-change-transform"
            style={{ ...textStyle(item), top: (fixedLaneCount + lane) * laneHeight + 10, transform: `translate3d(${x}px, 0, 0)` }}
          >
            {item.text}
          </span>
        );
      })}
      {active.top.map(({ item, lane }) => (
        <span
          key={item.id}
          data-danmaku-id={item.id}
          className="absolute left-1/2 max-w-[88%] -translate-x-1/2 truncate whitespace-nowrap text-center font-bold leading-none"
          style={{ ...textStyle(item), top: lane * laneHeight + 10 }}
        >
          {item.text}
        </span>
      ))}
      {active.bottom.map(({ item, lane }) => (
        <span
          key={item.id}
          data-danmaku-id={item.id}
          className="absolute left-1/2 max-w-[88%] -translate-x-1/2 truncate whitespace-nowrap text-center font-bold leading-none"
          style={{ ...textStyle(item), bottom: height * 0.28 + lane * laneHeight }}
        >
          {item.text}
        </span>
      ))}
    </div>
  );
}

export default function Danmaku({ videoId, user, videoRef, overlayWidth, overlayHeight, overlayHost }: DanmakuProps) {
  const [items, setItems] = useState<DanmakuItem[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [preferences, setPreferences] = useState(readDanmakuPreferences);
  const [text, setText] = useState('');
  const [mode, setMode] = useState<DanmakuMode>('scroll');
  const [color, setColor] = useState('#FFFFFF');
  const [size, setSize] = useState<(typeof SIZES)[number]>(24);
  const [pending, setPending] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [mutationError, setMutationError] = useState('');
  const [showList, setShowList] = useState(false);
  const requestSequence = useRef(0);
  const mutationRevision = useRef(0);

  useEffect(() => {
    let cancelled = false;

    const loadDanmaku = async (initial: boolean) => {
      const requestId = ++requestSequence.current;
      const startingRevision = mutationRevision.current;
      try {
        const response = await api.get<DanmakuItem[]>(`/danmaku/${videoId}`);
        if (cancelled || requestId !== requestSequence.current || startingRevision !== mutationRevision.current) return;
        setItems(mergeDanmaku([], response.data));
        setLoadError('');
      } catch (loadError) {
        if (!cancelled && initial) setLoadError(getErrorMessage(loadError, 'Could not load danmaku.'));
      }
    };

    setItems([]);
    setLoadError('');
    setMutationError('');
    void loadDanmaku(true);
    const poll = window.setInterval(() => void loadDanmaku(false), 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(poll);
    };
  }, [videoId]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      const nextTime = videoRef.current?.currentTime ?? 0;
      setCurrentTime((previous) => Math.abs(previous - nextTime) > 0.01 ? nextTime : previous);
      frame = window.requestAnimationFrame(update);
    };
    frame = window.requestAnimationFrame(update);
    return () => window.cancelAnimationFrame(frame);
  }, [videoRef]);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) {
      setCooldownSeconds(0);
      return;
    }
    const update = () => setCooldownSeconds(Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 200);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const updatePreferences = (next: DanmakuPreferences) => {
    setPreferences(next);
    writeDanmakuPreferences(next);
  };

  const sendDanmaku = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!user || !trimmed || pending || cooldownSeconds > 0) return;

    setPending(true);
    setMutationError('');
    try {
      const response = await api.post<DanmakuItem>(`/danmaku/${videoId}`, {
        text: trimmed,
        time: videoRef.current?.currentTime ?? 0,
        mode,
        color,
        size,
      });
      mutationRevision.current += 1;
      setItems((current) => mergeDanmaku(current, [response.data]));
      setText('');
      setCooldownUntil(Date.now() + 2_000);
    } catch (sendError) {
      setMutationError(getErrorMessage(sendError, 'Could not send danmaku.'));
    } finally {
      setPending(false);
    }
  };

  const deleteDanmaku = async (item: DanmakuItem) => {
    setMutationError('');
    try {
      await api.delete(`/danmaku/${item.id}`);
      mutationRevision.current += 1;
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
    } catch (deleteError) {
      setMutationError(getErrorMessage(deleteError, 'Could not delete danmaku.'));
    }
  };

  const seekTo = (time: number) => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = time;
    setCurrentTime(time);
  };

  const textLength = Array.from(text).length;

  return (
    <>
      {overlayHost && createPortal(
        <DanmakuOverlay
          items={items}
          currentTime={currentTime}
          width={overlayWidth}
          height={overlayHeight}
          preferences={preferences}
        />,
        overlayHost,
      )}

      <div className="mt-3 rounded-xl border border-white/10 bg-black/30 p-3" data-testid="danmaku-controls">
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs">
          <button
            type="button"
            onClick={() => updatePreferences({ ...preferences, visible: !preferences.visible })}
            className={`flex items-center gap-2 rounded-lg px-3 py-2 font-bold transition-colors ${preferences.visible ? 'bg-record text-white' : 'bg-white/5 text-slate-400'}`}
            aria-pressed={preferences.visible}
            aria-label={preferences.visible ? 'Hide Danmaku' : 'Show Danmaku'}
          >
            {preferences.visible ? <Eye size={15} /> : <EyeOff size={15} />}
            Danmaku / 弹幕
          </button>
          <label className="flex items-center gap-2 text-slate-400">
            Opacity
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.1"
              value={preferences.opacity}
              onChange={(event) => updatePreferences({ ...preferences, opacity: Number(event.target.value) })}
              className="w-24 accent-rose-600"
              aria-label="Danmaku opacity"
            />
          </label>
          <button
            type="button"
            onClick={() => setShowList((value) => !value)}
            className="ml-auto flex items-center gap-1 text-slate-400 hover:text-white"
            aria-expanded={showList}
          >
            {items.length} messages {showList ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        <form onSubmit={sendDanmaku} className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <input
              value={text}
              onChange={(event) => setText(Array.from(event.target.value).slice(0, 80).join(''))}
              disabled={!user || pending}
              placeholder={user ? 'Send a timed comment...' : 'Login to send danmaku...'}
              className="w-full rounded-lg border border-white/10 bg-onyx/70 px-3 py-2.5 pr-12 text-sm outline-none transition-colors focus:border-record disabled:opacity-50"
              aria-label="Danmaku message"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">{textLength}/80</span>
          </div>

          <select value={mode} onChange={(event) => setMode(event.target.value as DanmakuMode)} className="rounded-lg border border-white/10 bg-onyx px-2 py-2.5 text-xs" aria-label="Danmaku mode">
            {MODES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <select value={size} onChange={(event) => setSize(Number(event.target.value) as (typeof SIZES)[number])} className="rounded-lg border border-white/10 bg-onyx px-2 py-2.5 text-xs" aria-label="Danmaku font size">
            {SIZES.map((option) => <option key={option} value={option}>{option}px</option>)}
          </select>
          <div className="flex items-center gap-1" aria-label="Danmaku color">
            {COLORS.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setColor(option)}
                className={`h-6 w-6 rounded-full border-2 ${color === option ? 'border-record ring-2 ring-white/30' : 'border-white/20'}`}
                style={{ backgroundColor: option }}
                aria-label={`Use color ${option}`}
                aria-pressed={color === option}
              />
            ))}
          </div>

          {user ? (
            <button
              type="submit"
              disabled={!text.trim() || pending || cooldownSeconds > 0}
              className="flex items-center gap-2 rounded-lg bg-record px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={14} />
              {pending ? 'Sending' : cooldownSeconds > 0 ? `Wait ${cooldownSeconds}s` : 'Send'}
            </button>
          ) : (
            <Link to="/login" className="rounded-lg bg-record px-4 py-2.5 text-xs font-black uppercase tracking-wider text-white hover:bg-rose-700">Login</Link>
          )}
        </form>

        {(mutationError || loadError) && <p className="mt-2 text-xs text-rose-400" role="alert">{mutationError || loadError}</p>}

        {showList && (
          <div className="mt-3 max-h-64 overflow-y-auto border-t border-white/10 pt-2" data-testid="danmaku-list">
            {items.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-500">No danmaku yet.</p>
            ) : items.map((item) => (
              <div key={item.id} className="flex items-center gap-2 border-b border-white/5 py-2 text-xs last:border-0">
                <button type="button" onClick={() => seekTo(item.time)} className="shrink-0 font-mono text-record hover:text-white" aria-label={`Seek to ${formatDanmakuTime(item.time)}`}>
                  {formatDanmakuTime(item.time)}
                </button>
                <span className="min-w-0 flex-1 truncate text-slate-200">{item.text}</span>
                <span className="hidden shrink-0 text-slate-500 sm:inline">{item.user.username}</span>
                {(user?.isAdmin || user?.id === item.userId) && (
                  <button type="button" onClick={() => void deleteDanmaku(item)} className="shrink-0 text-slate-500 hover:text-record" aria-label={`Delete danmaku from ${item.user.username}`}>
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
