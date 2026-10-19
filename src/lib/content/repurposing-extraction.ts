import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  analyzeAudioVideoWithConfiguredProvider,
  analyzeImageWithConfiguredProvider,
  completeWithConfiguredProvider,
} from "@/lib/ai/provider";
import {
  extractDocumentText,
  DOCUMENT_MIME_TYPES,
} from "@/lib/content/document-text";
import { loadActivitySourceMaterial } from "@/lib/content/source-material";
import { getActivity } from "@/lib/content/activities";
import { readPublicResource } from "@/lib/integrations/public-resource";
import {
  htmlSourceText,
  parseSourceAnalysis,
  SOURCE_EXTRACTION_SYSTEM,
  SOURCE_EXTRACTION_SHAPE,
  type RepurposingSource,
  type SourceAnalysis,
} from "./repurposing-source";

export async function extractRepurposingSource(
  source: RepurposingSource,
): Promise<SourceAnalysis> {
  let text = source.manual_summary.trim() || source.input_text.trim(),
    mime = "",
    bytes: Buffer | undefined;
  if (!source.manual_summary.trim()) {
    if (source.source_kind === "activity") {
      if (!source.activity_id) throw new Error("Choose a source activity.");
      const activity = await getActivity(
        source.organization_id,
        source.activity_id,
      );
      if (!activity) throw new Error("Activity not found in this workspace.");
      const { materials, warnings } = await loadActivitySourceMaterial(
        await createClient(),
        source.organization_id,
        activity.id,
      );
      text = [
        activity.title,
        activity.description,
        activity.outcomes,
        ...materials.map((m) => `${m.label}:\n${m.text}`),
        ...warnings.map((w) => `Source limitation: ${w}`),
      ]
        .filter(Boolean)
        .join("\n\n");
    } else if (source.source_kind === "url") {
      const resource = await readPublicResource(source.source_url || "");
      bytes = resource.bytes;
      mime = resource.mimeType;
      if (mime === "text/html") {
        text = htmlSourceText(bytes.toString("utf8"));
        bytes = undefined;
      }
    } else if (source.source_kind === "attachment") {
      const client = await createClient();
      const { data: file, error } = await client
        .from("activity_attachments")
        .select("storage_path,mime_type,byte_size,file_name")
        .eq("organization_id", source.organization_id)
        .eq("activity_id", source.activity_id)
        .eq("id", source.attachment_id)
        .maybeSingle();
      if (error || !file)
        throw new Error(
          "Choose a source file attached to this workspace’s activity.",
        );
      if (file.byte_size > 14 * 1024 * 1024)
        throw new Error(
          "This source exceeds 14 MB. Use a shorter file or paste its transcript.",
        );
      const { data, error: downloadError } = await client.storage
        .from("ril-activity-media")
        .download(file.storage_path);
      if (downloadError || !data)
        throw new Error("The private source file could not be read.");
      bytes = Buffer.from(await data.arrayBuffer());
      mime = file.mime_type;
    }
  }
  if (bytes) {
    if (bytes.length > 14 * 1024 * 1024)
      throw new Error(
        "This source exceeds 14 MB. Supply a shorter recording or a transcript.",
      );
    if (DOCUMENT_MIME_TYPES.has(mime)) {
      if (bytes.length > 8 * 1024 * 1024)
        throw new Error(
          "Documents must be under 8 MB. Split this file or paste its text.",
        );
      text = await extractDocumentText(mime, "source document", bytes);
    } else if (["image/jpeg", "image/png", "image/webp"].includes(mime)) {
      if (bytes.length > 8 * 1024 * 1024)
        throw new Error(
          "Images must be under 8 MB. Resize the image or provide a manual summary.",
        );
      const reply = await analyzeImageWithConfiguredProvider({
        organizationId: source.organization_id,
        mimeType: mime as "image/jpeg" | "image/png" | "image/webp",
        base64: bytes.toString("base64"),
        system: SOURCE_EXTRACTION_SYSTEM,
        prompt: SOURCE_EXTRACTION_SHAPE,
      });
      if (!reply)
        throw new Error(
          "Connect a vision-capable AI model, or provide a manual summary.",
        );
      return parseSourceAnalysis(reply.text);
    } else if (mime.startsWith("audio/") || mime.startsWith("video/")) {
      const reply = await analyzeAudioVideoWithConfiguredProvider({
        organizationId: source.organization_id,
        mimeType: mime,
        base64: bytes.toString("base64"),
        system: SOURCE_EXTRACTION_SYSTEM,
        prompt: SOURCE_EXTRACTION_SHAPE,
      });
      if (!reply)
        throw new Error(
          "Audio/video transcription needs a configured Gemini model. You can paste a transcript or manual summary instead.",
        );
      return parseSourceAnalysis(reply.text);
    } else
      throw new Error(
        "This URL or file does not contain a supported document, image, audio or video source. Paste its transcript or a manual summary.",
      );
  }
  if (text.length < 30)
    throw new Error(
      "There is too little source text. Provide at least 30 characters of transcript or a manual summary.",
    );
  text = text.slice(0, 50000);
  const reply = await completeWithConfiguredProvider(
    source.organization_id,
    SOURCE_EXTRACTION_SYSTEM,
    `${SOURCE_EXTRACTION_SHAPE}\nSource title: ${source.title}\nSOURCE DATA:\n${text}`,
    { maxTokens: 2800, timeoutMs: 60000, temperature: 0.1 },
  );
  if (!reply)
    throw new Error(
      "Connect an AI provider in Settings before generating drafts. Your source stays saved as an Idea.",
    );
  const analysis = parseSourceAnalysis(reply.text);
  return {
    ...analysis,
    transcript: text,
    quotes: analysis.quotes.filter((quote) => text.includes(quote)),
    keyMoments: analysis.keyMoments.filter((moment) =>
      text.includes(moment.time),
    ),
  };
}
