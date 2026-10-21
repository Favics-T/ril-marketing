import { describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";

const mocks = vi.hoisted(() => ({ client: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
import { getBrandGuidance } from "./knowledge";
import { imageBrandQuery } from "@/lib/ai/image-analysis-v2";

const entries = [
  { category: "brand_voice", title: "Voice", content: "Warm, direct and practical." },
  { category: "program", title: "Lagos Tech Hub partnership", content: "Always credit Lagos Tech Hub as co-host." },
  { category: "approved_message", title: "Speaker bios", content: "Ada Obi leads the founder curriculum." },
  { category: "program", title: "Coding bootcamp", content: "A separate twelve-week course." },
];

const activity = { title: "Pitch Day", description: null, outcomes: null, eventDate: null, speakers: ["Ada Obi"], partners: ["Lagos Tech Hub"], registrationUrl: null };

async function guidanceFor(query: string) {
  mocks.client.mockResolvedValue(databaseMock(() => ({ data: entries, error: null })));
  return getBrandGuidance("org", query);
}

describe("brand knowledge for image analysis", () => {
  it("pulls in entries that match the activity's partners and speakers", async () => {
    const guidance = await guidanceFor(imageBrandQuery({ activity, campaign: null, audience: null }));
    expect(guidance).toEqual(expect.arrayContaining([
      expect.stringMatching(/^Lagos Tech Hub partnership:/),
      expect.stringMatching(/^Speaker bios:/),
      "Voice: Warm, direct and practical.",
    ]));
    expect(guidance.some((text) => text.startsWith("Coding bootcamp"))).toBe(false);
  });
  it("misses them when only the title is searched, as before", async () => {
    const guidance = await guidanceFor("Pitch Day");
    expect(guidance).toEqual(["Voice: Warm, direct and practical."]);
  });
  it("matches by campaign name too", async () => {
    const guidance = await guidanceFor(imageBrandQuery({ activity: { ...activity, speakers: [], partners: [] }, campaign: { name: "Bootcamp", objective: null }, audience: null }));
    expect(guidance.some((text) => text.startsWith("Coding bootcamp"))).toBe(true);
  });
});
