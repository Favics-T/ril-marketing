import type { z } from "zod";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

/**
 * Pull the JSON object out of a model reply. Models sometimes wrap JSON in
 * a ```json fence or add a sentence around it even when told not to.
 */
export function extractJsonObject(text: string): ParseResult<unknown> {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) {
    return { ok: false, error: "The reply did not contain a JSON object." };
  }
  try {
    return { ok: true, value: JSON.parse(candidate.slice(start, end + 1)) };
  } catch (error) {
    return { ok: false, error: `The reply was not valid JSON (${error instanceof Error ? error.message : "parse error"}).` };
  }
}

/** Parse and validate a model reply; errors are phrased for a retry prompt. */
export function parseStructured<T>(schema: z.ZodType<T>, text: string): ParseResult<T> {
  const json = extractJsonObject(text);
  if (!json.ok) return json;
  const result = schema.safeParse(json.value);
  if (result.success) return { ok: true, value: result.data };
  const issues = result.error.issues
    .slice(0, 8)
    .map((issue) => `${issue.path.length ? issue.path.join(".") : "(root)"}: ${issue.message}`)
    .join("; ");
  return { ok: false, error: `The JSON did not match the required shape — ${issues}.` };
}
