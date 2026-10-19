import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RepurposingSource } from "./repurposing-source";
const mocks = vi.hoisted(() => ({
  client: vi.fn(),
  text: vi.fn(),
  media: vi.fn(),
  image: vi.fn(),
  resource: vi.fn(),
  document: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/ai/provider", () => ({
  completeWithConfiguredProvider: mocks.text,
  analyzeAudioVideoWithConfiguredProvider: mocks.media,
  analyzeImageWithConfiguredProvider: mocks.image,
}));
vi.mock("@/lib/integrations/public-resource", () => ({
  readPublicResource: mocks.resource,
}));
vi.mock("@/lib/content/document-text", () => ({
  extractDocumentText: mocks.document,
  DOCUMENT_MIME_TYPES: new Set(["application/pdf", "text/plain"]),
}));
import { extractRepurposingSource } from "./repurposing-extraction";
import { htmlSourceText, parseSourceAnalysis } from "./repurposing-source";
const source = {
  organization_id: "org",
  source_kind: "transcript",
  title: "Recording",
  input_text:
    "00:10 Speaker: We built a prototype.\n00:30 Speaker: Test it with a customer.",
  manual_summary: "",
} as RepurposingSource;
beforeEach(() => vi.clearAllMocks());
describe("grounded source extraction", () => {
  it("keeps verbatim source text, discards invented quotes and preserves only supplied timestamps", async () => {
    mocks.text.mockResolvedValue({
      text: JSON.stringify({
        summary: "An account of prototype testing.",
        quotes: ["We built a prototype.", "Invented quote"],
        keyMoments: [
          { time: "00:10", note: "Prototype" },
          { time: "99:00", note: "Made up" },
        ],
      }),
    });
    expect(await extractRepurposingSource(source)).toMatchObject({
      transcript: source.input_text,
      quotes: ["We built a prototype."],
      keyMoments: [{ time: "00:10", note: "Prototype" }],
    });
  });
  it("offers manual recovery when no transcription model is connected", async () => {
    mocks.resource.mockResolvedValue({
      bytes: Buffer.from("recording"),
      mimeType: "video/mp4",
    });
    mocks.media.mockResolvedValue(null);
    await expect(
      extractRepurposingSource({
        ...source,
        source_kind: "url",
        source_url: "https://ril.org/source.mp4",
        input_text: "",
      }),
    ).rejects.toThrow("manual summary");
    expect(mocks.text).not.toHaveBeenCalled();
  });
  it("uses a manual summary without downloading or reopening a failed media source", async () => {
    mocks.text.mockResolvedValue({
      text: JSON.stringify({
        summary: "A complete manual summary of the event.",
      }),
    });
    await extractRepurposingSource({
      ...source,
      source_kind: "url",
      manual_summary:
        "Supported manually supplied source facts about this community event.",
    });
    expect(mocks.resource).not.toHaveBeenCalled();
    expect(mocks.media).not.toHaveBeenCalled();
    expect(mocks.text).toHaveBeenCalledTimes(1);
  });
  it("bounds document extraction and does not silently send oversized PDFs to AI", async () => {
    mocks.resource.mockResolvedValue({
      bytes: Buffer.alloc(9 * 1024 * 1024),
      mimeType: "application/pdf",
    });
    await expect(
      extractRepurposingSource({ ...source, source_kind: "url" }),
    ).rejects.toThrow("under 8 MB");
    expect(mocks.document).not.toHaveBeenCalled();
    expect(mocks.text).not.toHaveBeenCalled();
  });
  it("reports malformed analysis as recoverable instead of treating it as valid content", () => {
    expect(() => parseSourceAnalysis("plain text")).toThrow("manual summary");
    expect(() => parseSourceAnalysis('{"summary":')).toThrow();
    expect(() => parseSourceAnalysis('{"summary":"ok"}')).toThrow(
      "required format",
    );
  });
  it("extracts article text without navigation, scripts or unsupported entities", () => {
    expect(
      htmlSourceText(
        "<nav>Menu</nav><script>steal()</script><main>Work &amp; learning &#x1F44B;</main><footer>Links</footer>",
      ),
    ).toBe("Work & learning 👋");
  });
});
