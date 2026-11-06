// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { EmailDeliveryActions } from "./email-delivery-actions";

const mocks = vi.hoisted(() => ({ send: vi.fn(), queue: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/actions/email", () => ({ sendEmailCampaignBatch: mocks.send, queueEmailCampaign: mocks.queue }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.send.mockResolvedValue({ ok: true, message: "Batch sent." });
});
afterEach(cleanup);

describe("email delivery confirmation", () => {
  it("opens a named confirmation and never sends when cancelled", async () => {
    render(<EmailDeliveryActions campaignId="campaign-1" status="scheduled" hasRecipients />);
    fireEvent.click(screen.getByRole("button", { name: /Send next batch now/ }));
    const dialog = screen.getByRole("alertdialog", { name: "Send the next email batch?" });
    expect(dialog.textContent).toContain("Consent and suppression are checked again");
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.queue).not.toHaveBeenCalled();
  });

  it("dispatches only after the explicit Send batch action", async () => {
    render(<EmailDeliveryActions campaignId="campaign-2" status="scheduled" hasRecipients />);
    fireEvent.click(screen.getByRole("button", { name: /Send next batch now/ }));
    expect(mocks.send).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Send batch" }));
    await waitFor(() => expect(mocks.send).toHaveBeenCalledExactlyOnceWith("campaign-2"));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("status").textContent).toBe("Batch sent.");
  });
});
