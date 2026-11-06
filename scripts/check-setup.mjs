const production = process.argv.includes("--production");
let failures = 0;
function report(name, ok, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? `: ${detail}` : ""}`);
  if (!ok) failures++;
}

for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
  report(key, Boolean(process.env[key]) && !/your[-_]|change-me/i.test(process.env[key]));
}
for (const key of ["CRON_SECRET", "AI_CONFIG_SECRET", "EMAIL_UNSUBSCRIBE_SECRET"]) {
  report(key, (process.env[key]?.length ?? 0) >= 32 && !/your[-_]|change-me/i.test(process.env[key]), "requires a stable secret of at least 32 characters");
}
try {
  const url = new URL(process.env.NEXT_PUBLIC_SITE_URL);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  report("Public site origin", !url.username && !url.password && url.pathname === "/" && !url.search && !url.hash && (production ? url.protocol === "https:" && !local : url.protocol === "https:" || url.protocol === "http:" && local), production ? "must be a public HTTPS origin" : "local or public origin");
} catch {
  report("Public site origin", false, "set NEXT_PUBLIC_SITE_URL");
}

if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  const tables = ["organizations", "organization_members", "activities", "activity_attachments", "activity_media_analyses", "content_assets", "asset_approvals", "ai_generations", "publications", "audience_segments", "audience_insights", "campaigns", "leads", "landing_pages", "tasks", "integrations", "automation_settings", "automation_events", "email_campaigns", "email_campaign_deliveries", "nurture_settings", "nurture_sequences", "nurture_steps", "nurture_enrollments"];
  await Promise.all(tables.map(async table => {
    try {
      const url = new URL(`/rest/v1/${table}?select=*&limit=0`, process.env.NEXT_PUBLIC_SUPABASE_URL);
      const response = await fetch(url, {
        headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}` },
        signal: AbortSignal.timeout(15_000),
      });
      report(`Database ${table}`, response.ok, response.ok ? "reachable" : `HTTP ${response.status}; check credentials and migrations`);
    } catch {
      report(`Database ${table}`, false, "connection failed");
    }
  }));
}
console.log("Provider sending and publishing require separately verified credentials; this check does not send email or publish content.");
process.exitCode = failures ? 1 : 0;
