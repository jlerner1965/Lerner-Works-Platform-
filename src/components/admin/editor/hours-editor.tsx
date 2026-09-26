"use client";

import { useId } from "react";
import { weekdayKeys, type HoursException, type HoursInterval, type WeeklyHours } from "@/modules/common";
import { inputClass } from "@/components/admin/ui";

const dayLabels: Record<(typeof weekdayKeys)[number], string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

export function emptyWeek(): WeeklyHours {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

function IntervalRow({ interval, onChange, onRemove, label }: { interval: HoursInterval; onChange: (i: HoursInterval) => void; onRemove: () => void; label: string }) {
  const id = useId();
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <label htmlFor={`${id}-open`} className="sr-only">{label} opens</label>
      <input id={`${id}-open`} type="time" value={interval.open} onChange={(e) => onChange({ ...interval, open: e.target.value })} className={`${inputClass} w-32`} />
      <span aria-hidden="true">to</span>
      <label htmlFor={`${id}-close`} className="sr-only">{label} closes</label>
      <input id={`${id}-close`} type="time" value={interval.close} onChange={(e) => onChange({ ...interval, close: e.target.value })} className={`${inputClass} w-32`} />
      <label className="flex items-center gap-1 text-xs">
        <input type="checkbox" checked={interval.closesNextDay} onChange={(e) => onChange({ ...interval, closesNextDay: e.target.checked })} /> closes next day
      </label>
      <button type="button" onClick={onRemove} className="text-xs text-danger underline">Remove</button>
    </div>
  );
}

export function WeeklyHoursEditor({ value, onChange, error }: { value: WeeklyHours; onChange: (v: WeeklyHours) => void; error?: string }) {
  return (
    <div className="space-y-2">
      {weekdayKeys.map((day) => (
        <div key={day} className="grid gap-1 rounded border border-line p-2 sm:grid-cols-[7rem_1fr]">
          <p className="text-sm font-medium">{dayLabels[day]}</p>
          <div className="space-y-1">
            {value[day].length === 0 ? <p className="text-xs text-ink-subtle">Closed</p> : null}
            {value[day].map((iv, i) => (
              <IntervalRow
                key={i}
                label={dayLabels[day]}
                interval={iv}
                onChange={(next) => onChange({ ...value, [day]: value[day].map((x, j) => (j === i ? next : x)) })}
                onRemove={() => onChange({ ...value, [day]: value[day].filter((_, j) => j !== i) })}
              />
            ))}
            {value[day].length < 4 ? (
              <button type="button" className="text-xs text-action underline" onClick={() => onChange({ ...value, [day]: [...value[day], { open: "09:00", close: "17:00", closesNextDay: false }] })}>
                Add interval
              </button>
            ) : null}
          </div>
        </div>
      ))}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}

export function ExceptionsEditor({ value, onChange }: { value: HoursException[]; onChange: (v: HoursException[]) => void }) {
  return (
    <div className="space-y-2">
      {value.length === 0 ? <p className="text-xs text-ink-subtle">No date exceptions. Add holidays or temporary changes; an exception overrides the weekly hours for that date.</p> : null}
      {value.map((ex, i) => (
        <div key={i} className="rounded border border-line p-2 text-sm">
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col text-xs">Date<input type="date" value={ex.date} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, date: e.target.value } : x)))} className={`${inputClass} w-40`} /></label>
            <label className="flex min-w-40 flex-1 flex-col text-xs">Label<input value={ex.label} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} className={inputClass} placeholder="e.g. Thanksgiving" /></label>
            <label className="flex items-center gap-1 pb-2 text-xs"><input type="checkbox" checked={ex.closed} onChange={(e) => onChange(value.map((x, j) => (j === i ? { ...x, closed: e.target.checked } : x)))} /> Closed all day</label>
            <button type="button" className="pb-2 text-xs text-danger underline" onClick={() => onChange(value.filter((_, j) => j !== i))}>Remove</button>
          </div>
          {!ex.closed ? (
            <div className="mt-2 space-y-1">
              {ex.intervals.map((iv, k) => (
                <IntervalRow key={k} label={ex.label || ex.date} interval={iv} onChange={(next) => onChange(value.map((x, j) => (j === i ? { ...x, intervals: x.intervals.map((y, m) => (m === k ? next : y)) } : x)))} onRemove={() => onChange(value.map((x, j) => (j === i ? { ...x, intervals: x.intervals.filter((_, m) => m !== k) } : x)))} />
              ))}
              <button type="button" className="text-xs text-action underline" onClick={() => onChange(value.map((x, j) => (j === i ? { ...x, intervals: [...x.intervals, { open: "10:00", close: "16:00", closesNextDay: false }] } : x)))}>Add interval</button>
            </div>
          ) : null}
        </div>
      ))}
      <button type="button" className="text-xs text-action underline" onClick={() => onChange([...value, { date: "", label: "", closed: true, intervals: [] }])}>Add date exception</button>
    </div>
  );
}
