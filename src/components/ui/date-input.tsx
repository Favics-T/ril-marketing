"use client";

import * as React from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { enGB } from "date-fns/locale";
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function dayValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export const DateInput = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(function DateInput(
  { value, defaultValue, type = "date", className, onChange, onKeyDown, disabled, readOnly, ...props }, forwardedRef
) {
  const input = React.useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = React.useState(String(defaultValue ?? ""));
  const current = String(value ?? localValue);
  const selected = current ? new Date(`${current.slice(0, 10)}T12:00:00`) : undefined;
  const validSelected = selected && !Number.isNaN(selected.getTime()) ? selected : undefined;
  const [month, setMonth] = React.useState(validSelected ?? new Date());
  const [open, setOpen] = React.useState(false);
  const [label, setLabel] = React.useState(props["aria-label"] ?? "date");
  const datetime = type === "datetime-local";
  React.useImperativeHandle(forwardedRef, () => input.current!, []);
  React.useEffect(() => {
    const element = input.current;
    setLabel(props["aria-label"] ?? element?.labels?.[0]?.textContent?.trim() ?? "date");
    const reset = (event: Event) => queueMicrotask(() => {
      if (!event.defaultPrevented) { setLocalValue(String(defaultValue ?? "")); setOpen(false); }
    });
    const form = element?.form;
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [defaultValue, props["aria-label"]]);

  function update(next: string) {
    const element = input.current;
    if (!element) return;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(element, next);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    setLocalValue(next);
  }
  function pick(date: Date | undefined) {
    update(date ? `${dayValue(date)}${datetime ? `T${current.split("T")[1] || "09:00"}` : ""}` : "");
    if (!datetime) setOpen(false);
  }
  const before = props.min ? new Date(`${String(props.min).slice(0, 10)}T00:00:00`) : undefined;
  const after = props.max ? new Date(`${String(props.max).slice(0, 10)}T23:59:59`) : undefined;
  const today = new Date();
  const todayDisabled = Boolean((before && today < before) || (after && today > after));

  function changeOpen(next: boolean) {
    if (next) {
      const text = input.current?.value ?? current;
      setLocalValue(text);
      const date = text ? new Date(`${text.slice(0, 10)}T12:00:00`) : new Date();
      setMonth(Number.isNaN(date.getTime()) ? new Date() : date);
    }
    setOpen(next);
  }
  return <Popover open={open} onOpenChange={changeOpen}>
    <PopoverAnchor asChild><div className="date-field">
      <input {...props} type={type} ref={input} value={value} defaultValue={defaultValue} disabled={disabled} readOnly={readOnly}
        className={cn(className, "date-field-input")}
        onChange={event => { setLocalValue(event.target.value); onChange?.(event); }}
        onKeyDown={event => {
          onKeyDown?.(event);
          if (!event.defaultPrevented && !disabled && !readOnly && (event.key === "F4" || (event.altKey && event.key === "ArrowDown"))) { event.preventDefault(); changeOpen(true); }
        }} />
      <PopoverTrigger asChild>
        <button type="button" className="date-field-trigger" disabled={disabled || readOnly} aria-label={`Choose ${label}`}><CalendarDays aria-hidden="true" /></button>
      </PopoverTrigger>
    </div></PopoverAnchor>
    <PopoverContent data-workspace-portal="" className="date-picker-panel" align="start" collisionPadding={12} aria-label={`Choose ${label}`}>
      <DayPicker className="ril-calendar" locale={enGB} mode="single" selected={validSelected} onSelect={pick} month={month} onMonthChange={setMonth}
        captionLayout="dropdown" startMonth={before ?? new Date(1900, 0)} endMonth={after ?? new Date(2100, 11)}
        showOutsideDays fixedWeeks autoFocus disabled={[...(before ? [{ before }] : []), ...(after ? [{ after }] : [])]}
        components={{ Chevron: ({ orientation, className: iconClass }) => {
          const Icon = orientation === "left" ? ChevronLeft : orientation === "right" ? ChevronRight : ChevronDown;
          return <Icon className={iconClass} aria-hidden="true" />;
        } }} />
      {datetime ? <label className="date-picker-time">Local time<input type="time" aria-label="Local time" value={current.split("T")[1]?.slice(0, 5) || "09:00"} onChange={event => update(`${current.slice(0, 10) || dayValue(validSelected ?? today)}T${event.target.value || "09:00"}`)} onBlur={event => { if (event.target.value) update(`${current.slice(0, 10) || dayValue(validSelected ?? today)}T${event.target.value}`); }} /></label> : null}
      <div className="date-picker-footer">
        <button type="button" onClick={() => { update(""); setOpen(false); }} disabled={!current}>Clear</button>
        <button type="button" onClick={() => { setMonth(today); pick(today); }} disabled={todayDisabled}>Today</button>
        {datetime ? <button type="button" onClick={() => setOpen(false)}>Done</button> : null}
      </div>
    </PopoverContent>
  </Popover>;
});
