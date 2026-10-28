import { describe, expect, it } from "vitest";
import {
  activityRecordKey, conflictFieldKey, conflictFieldLabel, openConflicts, parseImageDate, pinnedResolutions, recordUpdateFor, resolutionMatches,
  type ConflictResolution,
} from "./image-conflicts";

const activity = { title: "Testing", event_date: "2099-05-01", description: null, speakers: [], partners: [], registration_url: null };
const resolution = (overrides: Partial<ConflictResolution> = {}): ConflictResolution => ({
  field: "eventName", key: "eventName", value: "DEMO DAY", recordValue: "Testing", choice: "image", recordKey: activityRecordKey(activity), ...overrides,
});

describe("conflictFieldKey", () => {
  it("reads the model's field names as one fixed key", () => {
    expect(conflictFieldKey("eventName")).toBe("eventName");
    expect(conflictFieldKey("Event name")).toBe("eventName");
    expect(conflictFieldKey("title")).toBe("eventName");
    expect(conflictFieldKey("Event date")).toBe("date");
    expect(conflictFieldKey("Location")).toBe("venue");
    expect(conflictFieldKey("Registration link")).toBe("registration");
    expect(conflictFieldKey("sponsors")).toBe("partners");
    expect(conflictFieldKey("Dress code")).toBe("other");
  });
  it("labels fixed fields in plain words and keeps the model's label otherwise", () => {
    expect(conflictFieldLabel("eventName")).toBe("Event name");
    expect(conflictFieldLabel("Dress code")).toBe("Dress code");
  });
});

describe("resolutions", () => {
  it("settle a conflict on the same field, however the model names it", () => {
    expect(resolutionMatches(resolution(), { field: "Event name" })).toBe(true);
    expect(resolutionMatches(resolution(), { field: "date" })).toBe(false);
  });
  it("match fields outside the fixed list by their label only", () => {
    const other = resolution({ field: "Dress code", key: "other" });
    expect(resolutionMatches(other, { field: "dress code" })).toBe(true);
    expect(resolutionMatches(other, { field: "Hashtag" })).toBe(false);
  });
  it("leave only conflicts without a choice open", () => {
    const conflicts = [{ field: "eventName", onImage: "DEMO DAY", activityRecord: "Testing" }, { field: "date", onImage: "2 May", activityRecord: "1 May" }];
    expect(openConflicts({ onImageText: { conflicts }, resolutions: [resolution()] })).toEqual([conflicts[1]]);
    expect(openConflicts({ onImageText: { conflicts } })).toEqual(conflicts);
  });
  it("stay pinned only while the activity record is unchanged", () => {
    const saved = [resolution()];
    expect(pinnedResolutions(saved, activityRecordKey(activity))).toEqual(saved);
    expect(pinnedResolutions(saved, activityRecordKey({ ...activity, title: "Pitch Night" }))).toEqual([]);
    expect(pinnedResolutions(undefined, activityRecordKey(activity))).toEqual([]);
    expect(pinnedResolutions([{ field: "eventName" }], activityRecordKey(activity))).toEqual([]);
  });
  it("fingerprint the record by the fields a conflict can be about", () => {
    expect(activityRecordKey(activity)).toBe(activityRecordKey({ ...activity }));
    expect(activityRecordKey({ ...activity, event_date: "2099-05-01T00:00:00+00:00" })).toBe(activityRecordKey(activity));
    expect(activityRecordKey({ ...activity, registration_url: "https://ril.example" })).not.toBe(activityRecordKey(activity));
  });
});

describe("parseImageDate", () => {
  it("reads full dates written with a month name or as ISO", () => {
    expect(parseImageDate("Sat 24th October 2026")).toBe("2026-10-24");
    expect(parseImageDate("October 24, 2026 · 10am")).toBe("2026-10-24");
    expect(parseImageDate("24 Oct. 2026")).toBe("2026-10-24");
    expect(parseImageDate("2026-10-24")).toBe("2026-10-24");
  });
  it("refuses dates without a year, numeric dates that read two ways, and impossible dates", () => {
    expect(parseImageDate("24 October")).toBeNull();
    expect(parseImageDate("10/11/2026")).toBeNull();
    expect(parseImageDate("30 February 2026")).toBeNull();
  });
});

describe("recordUpdateFor", () => {
  const conflict = (field: string, onImage: string) => ({ field, onImage, activityRecord: "x" });
  it("writes the event name to the title", () => {
    expect(recordUpdateFor(conflict("eventName", "DEMO DAY"))).toEqual({ column: "title", value: "DEMO DAY" });
  });
  it("writes a full date as the event date", () => {
    expect(recordUpdateFor(conflict("date", "Sat 2 May 2099"))).toEqual({ column: "event_date", value: "2099-05-02" });
    expect(recordUpdateFor(conflict("date", "2 May"))).toBeNull();
  });
  it("writes a web link as the registration link", () => {
    expect(recordUpdateFor(conflict("registration", "https://ril.ng/demo"))).toEqual({ column: "registration_url", value: "https://ril.ng/demo" });
    expect(recordUpdateFor(conflict("registration", "ril.ng/demo"))).toEqual({ column: "registration_url", value: "https://ril.ng/demo" });
    expect(recordUpdateFor(conflict("registration", "Register now"))).toBeNull();
  });
  it("writes nothing for fields the record lacks, or for unclear text", () => {
    expect(recordUpdateFor(conflict("venue", "Lagos Tech Hub"))).toBeNull();
    expect(recordUpdateFor(conflict("speakers", "Ada Obi"))).toBeNull();
    expect(recordUpdateFor(conflict("eventName", "DEMO D[unclear]"))).toBeNull();
  });
});
