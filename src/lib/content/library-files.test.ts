import { describe, expect, it } from "vitest";
import { libraryFiles, libraryPathMatches, libraryFileProblem, linkedActivityIds } from "./library-files";
const org = "90000000-0000-4000-8000-000000000001", asset = "90000000-0000-4000-8000-000000000002", id = "90000000-0000-4000-8000-000000000003";
const file = { id, path: `${org}/library/${asset}/${id}/notes.txt`, name: "notes.txt", mime: "text/plain", size: 100, createdAt: "2026-10-21T10:00:00Z" };
describe("library attachment boundaries", () => {
  it("accepts only the exact workspace, item and upload path", () => {
    expect(libraryPathMatches(file.path, org, asset)).toBe(true);
    for (const path of [file.path.replace(org, asset), file.path.replace(asset, id), file.path + "/other", file.path.replace("notes.txt", "../notes.txt"), file.path.replace(id, "invalid")]) expect(libraryPathMatches(path, org, asset)).toBe(false);
  });
  it("filters corrupt or foreign file references without hiding valid attachments", () => {
    expect(libraryFiles({ library_files: [file, { ...file, path: file.path.replace(org, asset) }, { ...file, size: -1 }] }, org, asset)).toEqual([file]);
  });
  it("keeps removed files recoverable but excludes them from current source choices", () => {
    const removed = { ...file, removedAt: "2026-10-21T11:00:00Z" };
    expect(libraryFiles({ library_files: [removed] }, org, asset)).toEqual([]);
    expect(libraryFiles({ library_files: [removed] }, org, asset, true)).toEqual([removed]);
  });
  it("accepts a text extension without a browser MIME type and rejects empty, huge or executable files", () => {
    expect(libraryFileProblem({ name: "notes.md", type: "", size: 100 })).toBeNull();
    for (const file of [{ name: "notes.txt", type: "text/plain", size: 0 }, { name: "large.mp4", type: "video/mp4", size: 104857601 }, { name: "run.exe", type: "application/octet-stream", size: 100 }]) expect(libraryFileProblem(file)).not.toBeNull();
  });
  it("keeps activity references unique and rejects malformed identifiers", () => {
    expect(linkedActivityIds({ linked_activity_ids: [org, org, "foreign,id", null] })).toEqual([org]);
  });
});
