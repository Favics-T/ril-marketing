import "server-only";
import {
  assertPublicWordPressHost,
  missingPublishCapabilities,
  requestWordPress,
  validateWordPressSiteUrl,
  verifyWordPressSeoPlugin,
  WordPressRequestError,
  type WordPressConfig,
  type WordPressSeoPlugin,
} from "@/lib/integrations/wordpress";

export type ConnectionCheckId = "address" | "rest" | "auth" | "capabilities" | "seo";
export type ConnectionCheckStatus = "pass" | "warn" | "fail" | "skip";
export type ConnectionCheck = { id: ConnectionCheckId; label: string; status: ConnectionCheckStatus; detail: string };

const LABELS: Record<ConnectionCheckId, string> = {
  address: "Site address",
  rest: "WordPress API",
  auth: "Login",
  capabilities: "Publishing permission",
  seo: "SEO plugin",
};

type SiteIndex = { name?: string; namespaces?: string[]; timezone_string?: string; gmt_offset?: number | string };
type Profile = { name?: string; roles?: string[]; capabilities?: Record<string, boolean> };

/** Human summary of the site's timezone setting, e.g. "Africa/Lagos" or "UTC+1". */
export function describeSiteTimezone(index: Pick<SiteIndex, "timezone_string" | "gmt_offset">) {
  if (index.timezone_string) return index.timezone_string;
  const offset = Number(index.gmt_offset ?? 0);
  if (!Number.isFinite(offset) || offset === 0) return "UTC";
  const hours = Math.trunc(Math.abs(offset));
  const minutes = Math.round((Math.abs(offset) - hours) * 60);
  return `UTC${offset < 0 ? "-" : "+"}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
}

function errorText(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

/** Why a request never got a response: timeout, a redirect we refuse to follow, or the network. */
function networkFailure(error: unknown) {
  if (error instanceof Error && error.name === "TimeoutError") return "The site didn't answer within 15 seconds.";
  const cause = error instanceof Error && error.cause instanceof Error ? error.cause.message : "";
  if (/redirect/i.test(cause)) return "The site redirected the request. Enter the address your site finally lands on (check https and www).";
  return "Couldn't reach the site. Check the address and that the site is online.";
}

function authFailure(error: unknown) {
  if (!(error instanceof WordPressRequestError)) return networkFailure(error);
  if (error.code === "rest_not_logged_in") {
    return "WordPress didn't receive the login details. Your host or a security plugin is removing the Authorization header before it reaches WordPress. Ask your host to pass it through (on Apache, add SetEnvIf Authorization \"(.*)\" HTTP_AUTHORIZATION=$1 to .htaccess).";
  }
  if (error.code === "application_passwords_disabled" || error.code === "application_passwords_disabled_for_user") {
    return "Application passwords are turned off on this site or for this user. A site admin or security plugin setting has to allow them.";
  }
  if (error.status === 401 || error.status === 403) {
    return "WordPress rejected the username or application password. Check the username, then create a new application password and paste it in.";
  }
  return errorText(error, "Couldn't check the login.");
}

/**
 * Run the connection checks in order without saving anything. A failed check
 * skips the ones after it, since they depend on it; a warning does not.
 */
export async function runWordPressConnectionTest(input: { siteUrl: string; username: string; applicationPassword: string; seoPlugin: WordPressSeoPlugin }) {
  const checks: ConnectionCheck[] = [];
  const add = (id: ConnectionCheckId, status: ConnectionCheckStatus, detail: string) => { checks.push({ id, label: LABELS[id], status, detail }); return status !== "fail"; };
  const finish = () => {
    for (const id of Object.keys(LABELS) as ConnectionCheckId[]) {
      if (!checks.some((check) => check.id === id)) checks.push({ id, label: LABELS[id], status: "skip", detail: "Not checked until the step above passes." });
    }
    return { ok: checks.every((check) => check.status !== "fail"), checks };
  };

  // 1. Address: public HTTPS URL whose host resolves only to public addresses.
  let config: WordPressConfig;
  try {
    config = { siteUrl: validateWordPressSiteUrl(input.siteUrl), username: input.username, applicationPassword: input.applicationPassword, seoPlugin: input.seoPlugin };
    await assertPublicWordPressHost(config.siteUrl);
  } catch (error) {
    const code = (error as { code?: string }).code;
    add("address", "fail", code === "ENOTFOUND" || code === "EAI_AGAIN" ? "That address doesn't exist. Check the spelling." : errorText(error, "Check the site address."));
    return finish();
  }
  add("address", "pass", config.siteUrl);

  // 2. REST API reachable without credentials, so a login problem can't hide here; reports the site timezone.
  try {
    const index = await requestWordPress<SiteIndex>(config, "", {}, "", false);
    if (!index.namespaces?.includes("wp/v2")) {
      add("rest", "fail", "The site answered, but not as a WordPress API. Check this is the WordPress address and that a security plugin isn't blocking /wp-json/.");
      return finish();
    }
    add("rest", "pass", `${index.name ? `${index.name} · ` : ""}site timezone ${describeSiteTimezone(index)}. Scheduled times are sent in UTC, so they're right whatever this is set to.`);
  } catch (error) {
    if (error instanceof WordPressRequestError && (error.status === 401 || error.status === 403)) {
      add("rest", "warn", "The API only answers logged-in requests, so the site timezone couldn't be read. Publishing can still work.");
    } else {
      add("rest", "fail", error instanceof WordPressRequestError
        ? `The WordPress API isn't available at /wp-json/ (HTTP ${error.status}). It may be turned off by a security plugin or the host.`
        : networkFailure(error));
      return finish();
    }
  }

  // 3. Login with the application password.
  let profile: Profile;
  try {
    profile = await requestWordPress<Profile>(config, "/users/me?context=edit");
  } catch (error) {
    add("auth", "fail", authFailure(error));
    return finish();
  }
  add("auth", "pass", `Signed in as ${profile.name || config.username}.`);

  // 4. The account can write and publish posts (scheduling needs publish_posts too).
  const missing = missingPublishCapabilities(profile.capabilities);
  if (missing.length) {
    const role = profile.roles?.[0];
    add("capabilities", "fail", `This account${role ? ` (${role})` : ""} can't ${missing.includes("edit_posts") ? "write" : "publish"} posts. Use an Author, Editor or Administrator account.`);
    return finish();
  }
  add("capabilities", "pass", "Can write, publish and schedule posts.");

  // 5. The chosen SEO plugin accepts our fields.
  if (config.seoPlugin === "none") {
    add("seo", "skip", "No SEO plugin selected. SEO titles and descriptions won't be sent.");
  } else {
    try {
      await verifyWordPressSeoPlugin(config);
      add("seo", "pass", config.seoPlugin === "yoast" ? "Yoast fields are writable." : "Rank Math is active.");
    } catch (error) {
      add("seo", "fail", errorText(error, "Couldn't check the SEO plugin."));
    }
  }
  return finish();
}
