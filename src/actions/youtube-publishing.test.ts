import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(()=>({org:vi.fn(),reviewer:vi.fn(),client:vi.fn(),claim:vi.fn(),save:vi.fn(),uncertain:vi.fn(),upload:vi.fn(),access:vi.fn()}));
vi.mock("next/cache",()=>({revalidatePath:vi.fn()}));
vi.mock("@/lib/supabase/organization",()=>({requireOrganizationId:mocks.org}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
vi.mock("@/lib/audience/access",()=>({requireReviewer:mocks.reviewer}));
vi.mock("@/lib/content/publishing",()=>({claimPublication:mocks.claim,saveDelivery:mocks.save,noteUncertainDelivery:mocks.uncertain}));
vi.mock("@/lib/integrations/source-connections",()=>({sourceAccess:mocks.access}));
vi.mock("@/lib/integrations/youtube-publishing",async original=>({...await original<typeof import("@/lib/integrations/youtube-publishing")>(),startYouTubeUpload:mocks.upload}));
import { publishYouTubeAsset } from "./youtube-publishing";
import { DeliveryRejected } from "@/lib/integrations/delivery-error";
const org="80000000-0000-4000-8000-000000000001",id="80000000-0000-4000-8000-000000000002",fileId="80000000-0000-4000-8000-000000000003";
const asset={id,title:"Event",body:"Approved description",status:"approved",platform:"youtube",channel:"youtube",updated_at:"version",metadata:{library_files:[{id:fileId,path:`${org}/library/${id}/${fileId}/video.mp4`,name:"video.mp4",mime:"video/mp4",size:100,createdAt:"2026-10-21T00:00:00Z"}]}};
function setup(override={}){const db=databaseMock(()=>({data:{...asset,...override}}));mocks.client.mockResolvedValue({...db,auth:{getUser:async()=>({data:{user:{id:"reviewer"}}})}});return db;}
function form(){const fd=new FormData();fd.set("file_id",fileId);fd.set("privacy","unlisted");fd.set("updated_at","version");return fd;}
beforeEach(()=>{vi.resetAllMocks();mocks.org.mockResolvedValue(org);mocks.access.mockResolvedValue({accountId:"channel"});mocks.claim.mockResolvedValue("request");mocks.upload.mockResolvedValue({id:"abcdefghijk",status:"queued"});setup();});
describe("approved YouTube uploads",()=>{
  it.each([{status:"editing"},{status:"review"},{updated_at:"new-version"},{platform:"instagram",channel:"instagram"},{metadata:{library_files:[]}}])("rejects unavailable or changed content before reserving or sending: %j",async override=>{setup(override);expect((await publishYouTubeAsset(id,form())).ok).toBe(false);expect(mocks.claim).not.toHaveBeenCalled();expect(mocks.upload).not.toHaveBeenCalled();});
  it("requires reviewer permission",async()=>{mocks.reviewer.mockRejectedValue(new Error("Reviewer required"));expect((await publishYouTubeAsset(id,form())).ok).toBe(false);expect(mocks.client).not.toHaveBeenCalled();});
  it("reserves approved content before starting an upload and stores its delivery receipt",async()=>{const db=setup();expect((await publishYouTubeAsset(id,form())).ok).toBe(true);expect(mocks.claim).toHaveBeenCalledWith(org,expect.objectContaining({status:"approved"}),"youtube","reviewer",undefined,"channel");expect(mocks.claim.mock.invocationCallOrder[0]).toBeLessThan(mocks.upload.mock.invocationCallOrder[0]);expect(mocks.save).toHaveBeenCalledWith(org,"request",id,{id:"abcdefghijk",status:"queued"});expect(db.queries[0].filters).toContainEqual({method:"eq",column:"organization_id",value:org});});
  it("keeps an uncertain upload reserved instead of returning content to Approved",async()=>{mocks.upload.mockRejectedValue(new Error("Timed out"));expect((await publishYouTubeAsset(id,form())).ok).toBe(false);expect(mocks.uncertain).toHaveBeenCalled();expect(mocks.save).not.toHaveBeenCalled();});
  it("returns a definite rejected request to Approved through the existing failure recorder",async()=>{mocks.upload.mockRejectedValue(new DeliveryRejected("Denied before upload"));await publishYouTubeAsset(id,form());expect(mocks.save).toHaveBeenCalledWith(org,"request",id,expect.objectContaining({status:"failed"}));expect(mocks.uncertain).not.toHaveBeenCalled();});
  it("refuses a scheduled unlisted upload before calling YouTube",async()=>{const fd=form();fd.set("scheduled_for",new Date(Date.now()+86400000).toISOString());expect((await publishYouTubeAsset(id,fd)).ok).toBe(false);expect(mocks.upload).not.toHaveBeenCalled();});
});
