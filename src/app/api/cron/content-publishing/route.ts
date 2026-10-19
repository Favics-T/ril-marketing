import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { processContentPublishingBatch } from "@/jobs/content-publishing";

export const maxDuration = 300;

async function run(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await processContentPublishingBatch();
    for (const path of ["/library", "/calendar", "/dashboard", "/publishing"]) revalidatePath(path);
    revalidatePath("/library/[id]", "page");
    return NextResponse.json({ ok: true, ...result });
  } catch { return NextResponse.json({ error: "Publishing status checks failed." }, { status: 500 }); }
}

export async function GET(request: Request) { return run(request); }
export async function POST(request: Request) { return run(request); }
