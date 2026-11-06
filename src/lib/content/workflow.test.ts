import { describe, expect, it } from "vitest";
import { contentApprovalRestriction, type ContentSignoff } from "./workflow";

const first: ContentSignoff = {
  id: "signoff", approval_revision: 1, tier: 1, reviewer_id: "reviewer",
  reviewer_name: "First reviewer", reviewer_role: "marketing_manager", note: null,
  created_at: "2026-11-06T12:00:00Z",
};
const context = {
  actorId: "reviewer", actorRole: "marketing_manager", authorId: "author",
  secondReviewerId: "senior", secondRequired: false, signoffs: [],
  reviewers: [{ id: "senior", name: "Senior reviewer", role: "owner" }],
};

describe("content approval eligibility guidance", () => {
  it("allows an independent reviewer to approve standard content", () => {
    expect(contentApprovalRestriction(context)).toBeNull();
  });
  it("blocks self-approval even for an owner", () => {
    expect(contentApprovalRestriction({ ...context, actorId: "author", actorRole: "owner" })).toContain("You created this content");
  });
  it("requires a signed-in reviewer role", () => {
    expect(contentApprovalRestriction({ ...context, actorId: null })).toContain("Sign in again");
    expect(contentApprovalRestriction({ ...context, actorRole: "member" })).toContain("Ask an owner");
    expect(contentApprovalRestriction({ ...context, actorRole: null })).toContain("Ask an owner");
  });
  it("does not offer the actor or author as the independent second reviewer", () => {
    expect(contentApprovalRestriction({ ...context, secondRequired: true, reviewers: [
      { id: "reviewer", name: "Self", role: "owner" },
      { id: "author", name: "Author", role: "admin" },
      { id: "member", name: "Member", role: "member" },
    ] })).toContain("A different owner, admin or leader is needed");
    expect(contentApprovalRestriction({ ...context, secondRequired: true })).toBeNull();
  });
  it("requires the named senior reviewer for the second decision", () => {
    expect(contentApprovalRestriction({ ...context, secondRequired: true, signoffs: [first] })).toContain("Your first approval is already recorded");
    expect(contentApprovalRestriction({ ...context, actorId: "other", actorRole: "owner", secondRequired: true, signoffs: [first] })).toContain("Only Senior reviewer");
    expect(contentApprovalRestriction({ ...context, actorId: "senior", actorRole: "marketing_manager", secondRequired: true, signoffs: [first] })).toContain("Only Senior reviewer");
    expect(contentApprovalRestriction({ ...context, actorId: "senior", actorRole: "owner", secondRequired: true, signoffs: [first] })).toBeNull();
  });
  it("does not mistake an existing standard sign-off for permission to approve again", () => {
    expect(contentApprovalRestriction({ ...context, actorId: "other", signoffs: [first] })).toContain("Refresh the page");
  });
});
