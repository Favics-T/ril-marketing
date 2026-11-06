export function formatAutomationResult(value: unknown): string {
  if (typeof value === "string") {
    try { return formatAutomationResult(JSON.parse(value)); }
    catch { return value; }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return "No additional details.";
  const result = value as Record<string, unknown>;
  for (const field of ["reason", "message"]) {
    if (typeof result[field] === "string" && result[field].trim()) return result[field];
  }
  const parts: string[] = [];
  for (const [field, singular, plural] of [
    ["generatedAssets", "content draft created", "content drafts created"],
    ["drafts_created", "content draft created", "content drafts created"],
    ["emailDrafts", "email draft created", "email drafts created"],
    ["landingPages", "landing page created", "landing pages created"],
    ["enrolled", "nurture enrolment", "nurture enrolments"],
  ]) {
    if (field === "drafts_created" && typeof result.generatedAssets === "number") continue;
    const count = result[field];
    if (typeof count === "number" && Number.isFinite(count)) parts.push(`${count} ${count === 1 ? singular : plural}`);
  }
  return parts.length ? `${parts.join(" · ")}.` : "No additional details.";
}
