import { describe, expect, it } from "vitest";
import {
  DEFAULT_SENSITIVITY_SETTINGS, awaitingSeniorSignoff, describeRoles, flagRefusal, readSensitivitySettings,
  seniorApprovalRefusal, seniorSignoffMessage, submitterOf, type SignoffCampaign,
} from "./sensitivity";

const campaign: SignoffCampaign = { status: "approved", created_by: "author", submitted_by: "submitter", approved_by: "approver", is_sensitive: true, sensitive_approved_by: null, metadata: {} };
const defaults = DEFAULT_SENSITIVITY_SETTINGS;

describe("workspace role settings", () => {
  it("defaults to reviewer roles for flagging and owner or admin for sign-off", () => {
    expect(readSensitivitySettings(null)).toEqual({ canFlagSensitive: ["owner", "admin", "marketing_manager", "leadership"], sensitiveApproverRoles: ["owner", "admin"] });
  });
  it("uses a workspace's own roles", () => {
    expect(readSensitivitySettings({ can_flag_sensitive: ["owner"], sensitive_approver_roles: ["leadership"] })).toEqual({ canFlagSensitive: ["owner"], sensitiveApproverRoles: ["leadership"] });
  });
  it("drops unknown roles and falls back when nothing valid is left", () => {
    expect(readSensitivitySettings({ can_flag_sensitive: ["owner", "intern"], sensitive_approver_roles: ["intern"] })).toEqual({ canFlagSensitive: ["owner"], sensitiveApproverRoles: defaults.sensitiveApproverRoles });
    expect(readSensitivitySettings({ can_flag_sensitive: "owner", sensitive_approver_roles: [] })).toEqual(defaults);
  });
});

describe("labels", () => {
  it("lists roles in plain words", () => {
    expect(describeRoles(["owner"])).toBe("owner");
    expect(describeRoles(["owner", "admin"])).toBe("owner or admin");
    expect(describeRoles(["owner", "marketing_manager", "leadership"])).toBe("owner, marketing manager or leadership");
  });
  it("names the configured approvers in the blocking message", () => {
    expect(seniorSignoffMessage({ ...defaults, sensitiveApproverRoles: ["leadership"] })).toMatch(/^Awaiting senior sign-off from leadership\./);
  });
  it("is awaiting sign-off only while sensitive and not yet signed off", () => {
    expect(awaitingSeniorSignoff(campaign)).toBe(true);
    expect(awaitingSeniorSignoff({ ...campaign, sensitive_approved_by: "senior" })).toBe(false);
    expect(awaitingSeniorSignoff({ ...campaign, is_sensitive: false })).toBe(false);
  });
  it("reads the submitter from the column, then legacy metadata", () => {
    expect(submitterOf({ submitted_by: "a", metadata: { submitted_by: "b" } })).toBe("a");
    expect(submitterOf({ submitted_by: null, metadata: { submitted_by: "b" } })).toBe("b");
    expect(submitterOf({ submitted_by: null, metadata: null })).toBeNull();
  });
});

describe("who may flag", () => {
  const unflagged: SignoffCampaign = { ...campaign, is_sensitive: false };
  it("allows a flagging role who didn't submit the campaign", () => {
    expect(flagRefusal(unflagged, { id: "approver", role: "marketing_manager" }, defaults)).toBeNull();
  });
  it.each(["author", "submitter"])("allows the %s to flag their own campaign", (id) => {
    expect(flagRefusal(unflagged, { id, role: "marketing_manager" }, defaults)).toBeNull();
  });
  it("refuses roles outside the setting, and a signed-out caller", () => {
    expect(flagRefusal(unflagged, { id: "x", role: "member" }, defaults)).toMatch(/^Only owner, admin, marketing manager or leadership roles can flag/);
    expect(flagRefusal(unflagged, { id: "x", role: null }, defaults)).toMatch(/^Only/);
    expect(flagRefusal(unflagged, { id: null, role: "owner" }, defaults)).toMatch(/Sign in/);
  });
  it("refuses a sent campaign", () => {
    expect(flagRefusal({ ...unflagged, status: "sent" }, { id: "x", role: "owner" }, defaults)).toMatch(/sent campaign/);
  });
});

describe("who may clear the flag", () => {
  it("allows a senior sign-off role outside the approval chain", () => {
    expect(flagRefusal(campaign, { id: "senior", role: "admin" }, defaults)).toBeNull();
  });
  it("refuses a flagging role that isn't a senior sign-off role", () => {
    expect(flagRefusal(campaign, { id: "senior", role: "marketing_manager" }, defaults)).toBe("Only owner or admin roles can clear the sensitive flag.");
    expect(flagRefusal(campaign, { id: "senior", role: "leadership" }, defaults)).toMatch(/^Only owner or admin/);
  });
  it.each(["author", "submitter", "approver"])("refuses the %s, even with a senior role", (id) => {
    expect(flagRefusal(campaign, { id, role: "owner" }, defaults)).toBe("The campaign's author, submitter and first approver can't clear the sensitive flag.");
  });
  it("follows the workspace's senior sign-off roles", () => {
    expect(flagRefusal(campaign, { id: "senior", role: "leadership" }, { ...defaults, sensitiveApproverRoles: ["leadership"] })).toBeNull();
    expect(flagRefusal(campaign, { id: "senior", role: "owner" }, { ...defaults, sensitiveApproverRoles: ["leadership"] })).toMatch(/^Only leadership/);
  });
  it("refuses a sent campaign", () => {
    expect(flagRefusal({ ...campaign, status: "sent" }, { id: "senior", role: "owner" }, defaults)).toMatch(/sent campaign/);
  });
});

describe("who may give the senior sign-off", () => {
  it("allows an approver role who is a fourth person", () => {
    expect(seniorApprovalRefusal(campaign, { id: "senior", role: "admin" }, defaults)).toBeNull();
    expect(seniorApprovalRefusal({ ...campaign, status: "paused" }, { id: "senior", role: "owner" }, defaults)).toBeNull();
  });
  it.each(["author", "submitter", "approver"])("refuses the %s", (id) => {
    expect(seniorApprovalRefusal(campaign, { id, role: "owner" }, defaults)).toMatch(/someone other than/);
  });
  it("refuses roles outside the setting", () => {
    expect(seniorApprovalRefusal(campaign, { id: "senior", role: "marketing_manager" }, defaults)).toMatch(/needs owner or admin/);
    expect(seniorApprovalRefusal(campaign, { id: "senior", role: "leadership" }, { ...defaults, sensitiveApproverRoles: ["leadership"] })).toBeNull();
  });
  it("needs a sensitive, first-approved campaign that isn't already signed off", () => {
    const actor = { id: "senior", role: "owner" };
    expect(seniorApprovalRefusal({ ...campaign, is_sensitive: false }, actor, defaults)).toMatch(/Only a sensitive/);
    expect(seniorApprovalRefusal({ ...campaign, status: "review", approved_by: null }, actor, defaults)).toMatch(/first approval/);
    expect(seniorApprovalRefusal({ ...campaign, sensitive_approved_by: "other" }, actor, defaults)).toMatch(/already/);
    expect(seniorApprovalRefusal(campaign, { id: null, role: "owner" }, defaults)).toMatch(/Sign in/);
  });
});
