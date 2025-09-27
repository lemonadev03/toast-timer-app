"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const DEFAULT_DURATION_SECONDS = 2 * 60;

function formatTime(totalSeconds: number) {
  const sign = totalSeconds < 0 ? "-" : "";
  const absSeconds = Math.abs(totalSeconds);
  const minutes = Math.floor(absSeconds / 60);
  const seconds = absSeconds % 60;

  return `${sign}${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatDurationLabel(seconds: number) {
  const absSeconds = Math.max(0, seconds);
  const minutes = Math.floor(absSeconds / 60);
  const remainder = absSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

type ColorKey = "emerald" | "yellow" | "orange" | "red";

type ColorTheme = {
  name: string;
  swatch: string;
  ring: string;
  background: string;
  baseText: string;
  timer: string;
  labelTone: string;
  button: string;
  rowBg: string;
  rowBorder: string;
};

const COLOR_PRESETS: Record<ColorKey, ColorTheme> = {
  emerald: {
    name: "Emerald",
    swatch: "bg-emerald-500",
    ring: "ring-emerald-200",
    background: "bg-emerald-500",
    baseText: "text-emerald-50",
    timer: "text-white",
    labelTone: "text-emerald-100/80",
    button: "bg-emerald-400/40 text-emerald-50 hover:bg-emerald-400/60 border border-emerald-50/40",
    rowBg: "bg-emerald-50",
    rowBorder: "border-emerald-200",
  },
  yellow: {
    name: "Yellow",
    swatch: "bg-yellow-400",
    ring: "ring-yellow-200",
    background: "bg-yellow-400",
    baseText: "text-slate-950",
    timer: "text-slate-950",
    labelTone: "text-slate-900/70",
    button: "bg-white/30 text-slate-950 hover:bg-white/40 border border-slate-900/20",
    rowBg: "bg-yellow-50",
    rowBorder: "border-yellow-200",
  },
  orange: {
    name: "Orange",
    swatch: "bg-orange-500",
    ring: "ring-orange-200",
    background: "bg-orange-500",
    baseText: "text-orange-50",
    timer: "text-white",
    labelTone: "text-orange-100/80",
    button: "bg-orange-400/50 text-orange-50 hover:bg-orange-400/70 border border-orange-50/40",
    rowBg: "bg-orange-50",
    rowBorder: "border-orange-200",
  },
  red: {
    name: "Red",
    swatch: "bg-red-600",
    ring: "ring-red-200",
    background: "bg-red-600",
    baseText: "text-red-50",
    timer: "text-white",
    labelTone: "text-red-100/80",
    button: "bg-red-500/50 text-red-50 hover:bg-red-500/70 border border-red-50/40",
    rowBg: "bg-red-50",
    rowBorder: "border-red-200",
  },
};

const COLOR_OPTIONS = (Object.entries(COLOR_PRESETS) as Array<[ColorKey, ColorTheme]>).map(
  ([key, value]) => ({
    key,
    name: value.name,
    swatch: value.swatch,
    ring: value.ring,
  }),
);

type StageConfig = {
  id: string;
  minSeconds: number;
  color: ColorKey;
};

type OvertimeConfig = {
  label: string;
  color: ColorKey;
};

const DEFAULT_SEGMENTS: StageConfig[] = [
  {
    id: "green",
    minSeconds: 61,
    color: "emerald",
  },
  {
    id: "yellow",
    minSeconds: 31,
    color: "yellow",
  },
  {
    id: "orange",
    minSeconds: 0,
    color: "orange",
  },
];

const DEFAULT_OVERTIME: OvertimeConfig = {
  label: "Overtime",
  color: "red",
};

const CONFIG_STORAGE_KEY = "timer-config";

const SORT_SEGMENTS = (segments: StageConfig[]) =>
  [...segments].sort((a, b) => b.minSeconds - a.minSeconds);

function describeSegment(sorted: StageConfig[], index: number) {
  const current = sorted[index];
  if (!current) {
    return "";
  }

  const prev = index > 0 ? sorted[index - 1] : undefined;

  if (current.minSeconds <= 0) {
    if (prev) {
      return `< ${formatDurationLabel(prev.minSeconds)}`;
    }
    return "00:00";
  }

  if (!prev) {
    return `≥ ${formatDurationLabel(current.minSeconds)}`;
  }

  const upperBound = prev.minSeconds - 1;

  if (upperBound < current.minSeconds) {
    return `≥ ${formatDurationLabel(current.minSeconds)}`;
  }

  return `≥ ${formatDurationLabel(current.minSeconds)}`;
}

function getActivePalette(
  secondsRemaining: number,
  segments: StageConfig[],
  overtime: OvertimeConfig,
) {
  if (secondsRemaining < 0) {
    const theme = COLOR_PRESETS[overtime.color];
    return {
      label: overtime.label,
      theme,
    };
  }

  const sorted = segments.length ? SORT_SEGMENTS(segments) : DEFAULT_SEGMENTS;
  let matchIndex = sorted.findIndex((segment) => secondsRemaining >= segment.minSeconds);
  if (matchIndex === -1) {
    matchIndex = sorted.length - 1;
  }
  const chosen = sorted[matchIndex];
  const theme = COLOR_PRESETS[chosen.color];
  const label = describeSegment(sorted, matchIndex);

  return {
    label,
    theme,
  };
}

function generateId() {
  return `segment-${Math.random().toString(36).slice(2, 10)}`;
}

export default function Home() {
  const [initialDuration, setInitialDuration] = useState(DEFAULT_DURATION_SECONDS);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_DURATION_SECONDS);
  const [isRunning, setIsRunning] = useState(false);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [shouldHideOnResume, setShouldHideOnResume] = useState(false);
  const [areControlsDimmed, setAreControlsDimmed] = useState(false);
  const [minutesInput, setMinutesInput] = useState("2");
  const [secondsInput, setSecondsInput] = useState("0");
  const [inputError, setInputError] = useState<string | null>(null);
  const [isTimerHidden, setIsTimerHidden] = useState(false);
  const [hideOnStart, setHideOnStart] = useState(true);
  const [segments, setSegments] = useState<StageConfig[]>(DEFAULT_SEGMENTS);
  const [overtime, setOvertime] = useState<OvertimeConfig>(DEFAULT_OVERTIME);
  const dimTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const stored = window.localStorage.getItem(CONFIG_STORAGE_KEY);
    if (!stored) {
      return;
    }

    try {
      const parsed = JSON.parse(stored) as { minutes?: number; seconds?: number };
      const minutesValue = Number(parsed.minutes);
      const secondsValue = Number(parsed.seconds);

      if (Number.isNaN(minutesValue) || minutesValue < 0) {
        return;
      }

      if (Number.isNaN(secondsValue) || secondsValue < 0 || secondsValue > 59) {
        return;
      }

      const minutes = Math.floor(minutesValue);
      const seconds = Math.floor(secondsValue);
      const totalSeconds = minutes * 60 + seconds;

      if (totalSeconds <= 0) {
        return;
      }

      setMinutesInput(String(minutes));
      setSecondsInput(String(seconds));
      setInitialDuration(totalSeconds);
      setTimeLeft(totalSeconds);
    } catch (error) {
      console.error("Failed to parse stored timer configuration", error);
    }
  }, []);

  useEffect(() => {
    if (!isRunning) {
      return;
    }

    const tick = window.setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => {
      window.clearInterval(tick);
    };
  }, [isRunning]);

  const sortedSegments = useMemo(() => SORT_SEGMENTS(segments), [segments]);
  const palette = useMemo(
    () => getActivePalette(timeLeft, sortedSegments, overtime),
    [timeLeft, sortedSegments, overtime],
  );
  const formatted = useMemo(() => formatTime(timeLeft), [timeLeft]);
  const overtimeTheme = COLOR_PRESETS[overtime.color];

  const resetDimControls = useCallback(() => {
    if (!isSessionActive || !isRunning) {
      setAreControlsDimmed(false);
      if (dimTimeoutRef.current !== null) {
        window.clearTimeout(dimTimeoutRef.current);
        dimTimeoutRef.current = null;
      }
      return;
    }

    setAreControlsDimmed(false);
    if (dimTimeoutRef.current !== null) {
      window.clearTimeout(dimTimeoutRef.current);
    }

    dimTimeoutRef.current = window.setTimeout(() => {
      setAreControlsDimmed(true);
    }, 3000);
  }, [isRunning, isSessionActive]);

  useEffect(() => {
    if (!isSessionActive || !isRunning) {
      setAreControlsDimmed(false);
      if (dimTimeoutRef.current !== null) {
        window.clearTimeout(dimTimeoutRef.current);
        dimTimeoutRef.current = null;
      }
      return;
    }

    resetDimControls();

    const handlePointerActivity = () => {
      resetDimControls();
    };

    window.addEventListener("mousemove", handlePointerActivity, { passive: true });
    window.addEventListener("touchstart", handlePointerActivity, { passive: true });

    return () => {
      if (dimTimeoutRef.current !== null) {
        window.clearTimeout(dimTimeoutRef.current);
        dimTimeoutRef.current = null;
      }
      window.removeEventListener("mousemove", handlePointerActivity);
      window.removeEventListener("touchstart", handlePointerActivity);
    };
  }, [isRunning, isSessionActive, resetDimControls]);

  const startSession = () => {
    setIsSessionActive(true);
    setShouldHideOnResume(false);
    setAreControlsDimmed(false);
    setIsRunning(true);
    setIsTimerHidden(hideOnStart);
  };

  const toggleRunState = () => {
    setIsRunning((prev) => {
      if (prev) {
        setShouldHideOnResume(isTimerHidden);
        if (isTimerHidden) {
          setIsTimerHidden(false);
        }
        if (dimTimeoutRef.current !== null) {
          window.clearTimeout(dimTimeoutRef.current);
          dimTimeoutRef.current = null;
        }
        setAreControlsDimmed(false);
        return false;
      }

      if (shouldHideOnResume) {
        setIsTimerHidden(true);
      }
      setShouldHideOnResume(false);
      setAreControlsDimmed(false);
      if (dimTimeoutRef.current !== null) {
        window.clearTimeout(dimTimeoutRef.current);
        dimTimeoutRef.current = null;
      }
      return true;
    });
  };

  const handleReset = () => {
    setIsRunning(false);
    setIsSessionActive(false);
    setShouldHideOnResume(false);
    setAreControlsDimmed(false);
    setTimeLeft(initialDuration);
    setIsTimerHidden(false);
    if (dimTimeoutRef.current !== null) {
      window.clearTimeout(dimTimeoutRef.current);
      dimTimeoutRef.current = null;
    }
  };

  const handleApplyDuration = () => {
    const minutes = Number.parseInt(minutesInput, 10);
    const seconds = Number.parseInt(secondsInput, 10);

    if (Number.isNaN(minutes) || Number.isNaN(seconds)) {
      setInputError("Enter whole numbers for minutes and seconds.");
      return;
    }

    if (seconds < 0 || seconds > 59) {
      setInputError("Seconds must be between 0 and 59.");
      return;
    }

    const totalSeconds = minutes * 60 + seconds;

    if (totalSeconds <= 0) {
      setInputError("Duration must be more than zero seconds.");
      return;
    }

    setInputError(null);
    setInitialDuration(totalSeconds);
    setTimeLeft(totalSeconds);
    setIsRunning(false);
    setIsSessionActive(false);
    setShouldHideOnResume(false);
    setAreControlsDimmed(false);
    setIsTimerHidden(false);
    if (dimTimeoutRef.current !== null) {
      window.clearTimeout(dimTimeoutRef.current);
      dimTimeoutRef.current = null;
    }

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        CONFIG_STORAGE_KEY,
        JSON.stringify({ minutes, seconds }),
      );
    }
  };

  const handleKeySubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleApplyDuration();
  };

  const updateSegment = (id: string, patch: Partial<StageConfig>) => {
    setSegments((prev) => {
      const next = prev.map((segment) => (segment.id === id ? { ...segment, ...patch } : segment));
      return SORT_SEGMENTS(next);
    });
  };

  const updateSegmentMinutes = (id: string, rawValue: string) => {
    const parsedMinutes = Number.parseInt(rawValue, 10);
    const minutes = Number.isNaN(parsedMinutes) ? 0 : Math.max(0, parsedMinutes);

    setSegments((prev) => {
      const next = prev.map((segment) => {
        if (segment.id !== id || segment.minSeconds === 0) {
          return segment;
        }

        const seconds = segment.minSeconds % 60;
        return {
          ...segment,
          minSeconds: minutes * 60 + seconds,
        };
      });

      return SORT_SEGMENTS(next);
    });
  };

  const updateSegmentSeconds = (id: string, rawValue: string) => {
    const parsedSeconds = Number.parseInt(rawValue, 10);
    if (Number.isNaN(parsedSeconds)) {
      return;
    }

    const seconds = Math.min(59, Math.max(0, parsedSeconds));

    setSegments((prev) => {
      const next = prev.map((segment) => {
        if (segment.id !== id || segment.minSeconds === 0) {
          return segment;
        }

        const minutes = Math.floor(segment.minSeconds / 60);
        return {
          ...segment,
          minSeconds: minutes * 60 + seconds,
        };
      });

      return SORT_SEGMENTS(next);
    });
  };

  const removeSegment = (id: string) => {
    setSegments((prev) => prev.filter((segment) => segment.id !== id));
  };

  const addSegment = () => {
    setSegments((prev) => {
      const candidateMin = Math.max(1, Math.floor(initialDuration / (prev.length + 2)));
      const nextSegment: StageConfig = {
        id: generateId(),
        minSeconds: candidateMin,
        color: "emerald",
      };
      return SORT_SEGMENTS([...prev, nextSegment]);
    });
  };

  return (
    <main
      className={cn(
        "relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-10 transition-colors duration-500",
        palette.theme.background,
        palette.theme.baseText,
      )}
    >
      <div className="pointer-events-none absolute inset-0 opacity-10 [mask-image:radial-gradient(circle_at_center,black,transparent)]" />

      {isSessionActive ? (
        <div className="relative z-[1] flex w-full flex-1 items-center justify-center py-16">
          <div className="flex w-full items-center justify-center">
            {!isTimerHidden && (
              <span
                className={cn(
                  "font-mono font-semibold leading-none animate-fade-in-scale",
                  "text-[clamp(4rem,16vw,14rem)]",
                  palette.theme.timer,
                )}
              >
                {formatted}
              </span>
            )}
          </div>

          <div
            className={cn(
              "fixed bottom-8 left-8 z-[2] flex items-center gap-3 rounded-full border border-white/25 bg-black/30 px-4 py-3 shadow-lg backdrop-blur-sm transition-opacity duration-300",
              areControlsDimmed ? "opacity-25 animate-fade-out-soft" : "opacity-100 animate-fade-in-soft",
            )}
          >
            <Button
              size="sm"
              variant="secondary"
              className="transform bg-black/60 text-white transition-transform transition-colors duration-300 hover:-translate-y-1 hover:bg-black/80 focus-visible:-translate-y-1"
              onClick={() => setIsTimerHidden((prev) => !prev)}
            >
              {isTimerHidden ? "Show" : "Hide"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="transform bg-black/60 text-white transition-transform transition-colors duration-300 hover:-translate-y-1 hover:bg-black/80 focus-visible:-translate-y-1"
              onClick={toggleRunState}
            >
              {isRunning ? "Pause" : "Resume"}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="transform border-2 border-red-400 bg-red-500/10 text-red-50 transition-transform transition-colors duration-300 hover:-translate-y-1 hover:bg-red-500/20 focus-visible:-translate-y-1 focus-visible:ring-2 focus-visible:ring-red-300"
              onClick={handleReset}
            >
              Reset
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative z-[1] flex w-full max-w-6xl flex-col items-center gap-8 transition-all duration-500 lg:flex-row lg:items-stretch lg:justify-center">
          <section className="relative flex flex-1 min-w-[300px] flex-col gap-6 overflow-hidden rounded-3xl border border-white/25 bg-black/15 p-8 text-center lg:flex-[1.4] lg:min-w-[420px] lg:p-12">
            <div className="flex flex-1 items-center justify-center">
              {!isTimerHidden && (
                <span
                  className={cn(
                    "font-mono font-semibold leading-none animate-fade-in-scale",
                    "text-[clamp(4rem,16vw,14rem)]",
                    palette.theme.timer,
                  )}
                >
                  {formatted}
                </span>
              )}
            </div>

            <div className="flex w-full flex-col items-center gap-4 md:flex-row md:items-center md:justify-center md:gap-6">
              <Button
                size="lg"
                onClick={startSession}
                className="order-1 h-14 w-full max-w-sm transform rounded-full border-2 border-blue-400 bg-blue-500/20 text-lg font-semibold text-blue-50 shadow-lg transition-transform transition-colors duration-300 hover:-translate-y-1 hover:bg-blue-500/30 focus-visible:-translate-y-1 focus-visible:ring-2 focus-visible:ring-blue-300 animate-fade-in-scale"
              >
                Start
              </Button>
              <Button
                size="lg"
                variant="secondary"
                className="order-2 h-14 transform rounded-full border-2 border-red-400 bg-red-500/10 px-10 text-lg font-semibold text-red-50 transition-transform transition-colors duration-300 hover:-translate-y-1 hover:bg-red-500/20 focus-visible:-translate-y-1 focus-visible:ring-2 focus-visible:ring-red-300 md:ml-6 animate-fade-in-scale"
                onClick={handleReset}
              >
                Reset
              </Button>
            </div>
            <label className="flex items-center gap-2 text-sm font-medium text-white/90">
              <input
                type="checkbox"
                className="size-4 accent-white"
                checked={hideOnStart}
                onChange={(event) => setHideOnStart(event.target.checked)}
              />
              Hide timer on start
            </label>
          </section>

          <section className="w-full max-w-xl flex-1 rounded-3xl border border-white/35 bg-white/90 p-7 text-left text-slate-900 shadow-2xl backdrop-blur-md">
            <div className="flex h-full flex-col gap-5">
              <header className="flex flex-col gap-2">
                <h2 className="text-2xl font-semibold">Timer settings</h2>
                <p className="text-sm text-slate-600">
                  Configure the countdown, tweak colour stages, and choose the overtime palette without leaving this page.
                </p>
              </header>

              <form onSubmit={handleKeySubmit} className="grid gap-4 rounded-2xl bg-white p-5 sm:grid-cols-[repeat(3,minmax(0,1fr))]">
                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                  Minutes
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    value={minutesInput}
                    onChange={(event) => setMinutesInput(event.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="2"
                  />
                </label>
                <label className="flex flex-col gap-2 text-sm font-semibold text-slate-700">
                  Seconds
                  <Input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={59}
                    value={secondsInput}
                    onChange={(event) => setSecondsInput(event.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="0"
                  />
                </label>
                <div className="flex items-end">
                  <Button type="submit" className="w-full">
                    Apply
                  </Button>
                </div>
                {inputError && (
                  <p className="col-span-full text-sm font-medium text-red-600">{inputError}</p>
                )}
              </form>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-slate-900">Colour stages</h3>
                  <Button type="button" variant="outline" onClick={addSegment}>
                    Add stage
                  </Button>
                </div>
                <div className="space-y-3 overflow-x-hidden overflow-y-auto rounded-2xl bg-white/80 p-2 shadow-inner lg:max-h-[24rem]">
                  {sortedSegments.map((segment, index) => {
                    const isBaseStage = segment.minSeconds === 0;
                    const rangeLabel = describeSegment(sortedSegments, index);
                    const segmentTheme = COLOR_PRESETS[segment.color];

                    return (
                      <div
                        key={segment.id}
                        className={cn(
                          "flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border px-4 py-3 shadow-sm",
                          segmentTheme.rowBg,
                          segmentTheme.rowBorder,
                        )}
                      >
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time left</span>
                          <span>{rangeLabel}</span>
                        </div>
                        <div className="flex flex-1 flex-wrap items-center gap-4">
                          <div className="flex flex-col gap-1 text-sm font-medium uppercase tracking-wide text-slate-500">
                            <span>Threshold</span>
                            <div className="flex items-center gap-2 text-xs font-normal normal-case text-slate-600">
                              <Input
                                type="number"
                                min={0}
                                value={Math.floor(segment.minSeconds / 60)}
                                disabled={isBaseStage}
                                onChange={(event) => updateSegmentMinutes(segment.id, event.target.value)}
                                className="h-9 w-16 text-sm disabled:cursor-not-allowed"
                              />
                              <span className="text-xs font-medium text-slate-500">min</span>
                              <Input
                                type="number"
                                min={0}
                                max={59}
                                value={segment.minSeconds % 60}
                                disabled={isBaseStage}
                                onChange={(event) => updateSegmentSeconds(segment.id, event.target.value)}
                                className="h-9 w-16 text-sm disabled:cursor-not-allowed"
                              />
                              <span className="text-xs font-medium text-slate-500">sec</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colour</span>
                            <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap rounded-full bg-white/85 px-2 py-1 shadow-inner">
                              {COLOR_OPTIONS.map((option) => {
                                const isSelected = option.key === segment.color;

                                return (
                                  <button
                                    key={option.key}
                                    type="button"
                                    onClick={() => updateSegment(segment.id, { color: option.key })}
                                    className={cn(
                                      "size-8 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                                      option.swatch,
                                      option.ring,
                                      isSelected
                                        ? "border-black/70 ring-offset-white"
                                        : "border-white/70 opacity-80 hover:opacity-100",
                                    )}
                                    aria-label={`Use ${option.name} palette`}
                                  />
                                );
                              })}
                            </div>
                          </div>
                          {!isBaseStage && sortedSegments.length > 1 && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => removeSegment(segment.id)}
                              className="ml-auto text-slate-500 hover:text-red-500"
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div
                    className={cn(
                      "flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border px-4 py-3 shadow-sm",
                      overtimeTheme.rowBg,
                      overtimeTheme.rowBorder,
                    )}
                  >
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Overtime</span>
                      <Input
                        value={overtime.label}
                        onChange={(event) => setOvertime((prev) => ({ ...prev, label: event.target.value }))}
                        className="h-9 w-36 text-sm"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Colour</span>
                      <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap rounded-full bg-white/85 px-2 py-1 shadow-inner">
                        {COLOR_OPTIONS.map((option) => {
                          const isSelected = option.key === overtime.color;

                          return (
                            <button
                              key={option.key}
                              type="button"
                              onClick={() => setOvertime((prev) => ({ ...prev, color: option.key }))}
                              className={cn(
                                "size-8 rounded-full border-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                                option.swatch,
                                option.ring,
                                isSelected
                                  ? "border-black/70 ring-offset-white"
                                  : "border-white/70 opacity-80 hover:opacity-100",
                              )}
                              aria-label={`Use ${option.name} palette`}
                            />
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
