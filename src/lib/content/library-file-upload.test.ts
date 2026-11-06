import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ client: vi.fn(), upload: vi.fn(), register: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: mocks.client }));
vi.mock("@/actions/library-attachments", () => ({ registerLibraryFile: mocks.register }));
import { uploadLibraryFile } from "./library-file-upload";
const item = { id: "70000000-0000-4000-8000-000000000001", file: new File(["Source text"], "notes.txt", { type: "text/plain" }) };
beforeEach(() => { vi.resetAllMocks(); mocks.client.mockReturnValue({ storage: { from: () => ({ upload: mocks.upload }) } }); mocks.upload.mockResolvedValue({ error: null }); });
describe("library upload retries", () => {
  it("retries registration without uploading a second file", async () => {
    mocks.register.mockResolvedValueOnce({ ok: false, error: "Concurrent change" }).mockResolvedValueOnce({ ok: true });
    const first = await uploadLibraryFile("org", "asset", item);
    expect(first.ok).toBe(false); expect(first.path).toBeTruthy();
    expect(await uploadLibraryFile("org", "asset", { ...item, path: first.path })).toMatchObject({ ok: true });
    expect(mocks.upload).toHaveBeenCalledTimes(1); expect(mocks.register).toHaveBeenCalledTimes(2);
    expect(mocks.upload).toHaveBeenCalledWith(first.path, item.file, { contentType: "text/plain", upsert: false });
  });
  it("does not register a failed or rejected upload", async () => {
    mocks.upload.mockResolvedValue({ error: { message: "offline" } });
    expect(await uploadLibraryFile("org", "asset", item)).toMatchObject({ ok: false });
    expect(mocks.register).not.toHaveBeenCalled();
    expect(await uploadLibraryFile("org", "asset", { ...item, file: new File(["x"], "run.exe", { type: "application/octet-stream" }) })).toMatchObject({ ok: false });
    expect(mocks.upload).toHaveBeenCalledTimes(1);
  });
});
