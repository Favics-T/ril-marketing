"use client";

import { useState } from "react";
import { ChannelIdentity } from "@/components/channel-identity";
import { ChannelMark, socialChannelKey } from "@/components/settings/channel-icons";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { channelLabel } from "@/lib/channels";

const EMPTY_OPTION = "__empty_channel__";

// Empty filter choices need a nonempty Radix value; submit the original value.
export function ChannelSelect({ options, name, id, value, defaultValue = "", onValueChange, placeholder = "Select a channel", disabled, required, className }: {
  options: ReadonlyArray<readonly [string, string]>;
  name?: string;
  id?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const [selected, setSelected] = useState(defaultValue);
  const current = value ?? selected;
  const hasEmptyOption = options.some(([key]) => key === "");
  const selectedLabel = options.find(([key]) => key === current)?.[1] ?? channelLabel(current);
  return <><Select name={hasEmptyOption ? undefined : name} value={current || (hasEmptyOption ? EMPTY_OPTION : "")} onValueChange={next => { const nextValue = next === EMPTY_OPTION ? "" : next; setSelected(nextValue); onValueChange?.(nextValue); }} disabled={disabled} required={required}>
    <SelectTrigger id={id} className={className} title={selectedLabel || placeholder}>
      <SelectValue placeholder={placeholder}>{current || hasEmptyOption ? socialChannelKey(current) ? <ChannelIdentity channel={current} /> : selectedLabel : undefined}</SelectValue>
    </SelectTrigger>
    <SelectContent><SelectGroup>{options.map(([key, label]) => <SelectItem key={key} value={key || EMPTY_OPTION} textValue={label}><span className="inline-flex items-center gap-2">{socialChannelKey(key) ? <ChannelMark service={key} className="size-4 shrink-0" /> : null}{label}</span></SelectItem>)}</SelectGroup></SelectContent>
  </Select>{hasEmptyOption && name ? <input type="hidden" name={name} value={current} disabled={disabled} /> : null}</>;
}
