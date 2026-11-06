import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({ admin: vi.fn(), access: vi.fn(), request: vi.fn(), fetch: vi.fn(), rpc: vi.fn(), download: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.admin }));
vi.mock("@/lib/crypto/secret-box", () => ({ decryptSecret: (s:string)=>s, encryptSecret: (s:string)=>s }));
vi.mock("./source-connections", () => ({ sourceAccess: mocks.access }));
vi.mock("./content-import", () => ({ youtubeRequest: mocks.request }));
import { youtubeDelivery, safeYouTubeSession, youtubeContentProblem, getYouTubeDelivery } from "./youtube-publishing";
const org="80000000-0000-4000-8000-000000000001", assetId="80000000-0000-4000-8000-000000000002", fileId="80000000-0000-4000-8000-000000000003";
const file = { id:fileId, path:`${org}/library/${assetId}/${fileId}/video.mp4`, name:"video.mp4", mime:"video/mp4" as const, size:6, createdAt:"2026-10-21T00:00:00Z" };
const session="https://www.googleapis.com/upload/youtube/v3/videos?upload_id=one";
beforeEach(()=>{ vi.resetAllMocks(); vi.stubGlobal("fetch",mocks.fetch); mocks.access.mockResolvedValue({accessToken:"access",accountId:"channel"}); mocks.rpc.mockResolvedValue({error:null}); mocks.download.mockResolvedValue({data:new Blob(["abcdef"])}); });
describe("YouTube delivery",()=>{
  it("does not mark processing or private videos published",()=>{
    expect(youtubeDelivery({id:"abcdefghijk",status:{uploadStatus:"uploaded",privacyStatus:"public"}}).status).toBe("queued");
    expect(youtubeDelivery({id:"abcdefghijk",status:{uploadStatus:"processed",privacyStatus:"private"}})).toMatchObject({status:"queued",error:expect.stringContaining("private")});
    expect(youtubeDelivery({id:"abcdefghijk",status:{uploadStatus:"processed",privacyStatus:"unlisted"}}).status).toBe("published");
    expect(youtubeDelivery({id:"abcdefghijk",status:{uploadStatus:"rejected"}}).status).toBe("failed");
  });
  it("retains the schedule until YouTube makes the video visible",()=>{expect(youtubeDelivery({id:"abcdefghijk",status:{uploadStatus:"processed",privacyStatus:"private",publishAt:"2026-12-01T00:00:00Z"}})).toMatchObject({status:"queued",scheduledFor:"2026-12-01T00:00:00Z"});});
  it.each(["http://www.googleapis.com/upload/youtube/v3/videos", "https://evil.example/upload/youtube/v3/videos", "https://www.googleapis.com/other", "https://www.googleapis.com:444/upload/youtube/v3/videos"])("rejects unsafe resumable session URLs: %s",url=>{expect(()=>safeYouTubeSession(url)).toThrow();});
  it("rejects unapproved file types and overlong descriptions",()=>{expect(youtubeContentProblem({title:"Event",body:"Copy",metadata:null},undefined)).toContain("attached");expect(youtubeContentProblem({title:"Event",body:"é".repeat(3000),metadata:null},file)).toContain("5,000 UTF-8");});
  it("checks the video belongs to the connected channel",async()=>{mocks.admin.mockReturnValue(databaseMock(()=>({data:{metadata:{publishing:{youtube_channel_id:"channel"}}}})));mocks.request.mockResolvedValue(new Response(JSON.stringify({items:[{id:"abcdefghijk",snippet:{channelId:"other"}}]})));await expect(getYouTubeDelivery(org,assetId,"abcdefghijk")).rejects.toThrow("connected YouTube channel");});
  it("blocks delivery after the workspace switches to another channel",async()=>{mocks.admin.mockReturnValue(databaseMock(()=>({data:{metadata:{publishing:{youtube_channel_id:"original-channel"}}}})));await expect(getYouTubeDelivery(org,assetId,"abcdefghijk")).rejects.toThrow("original YouTube channel");expect(mocks.request).not.toHaveBeenCalled();});
  it("resumes a saved upload from the provider-confirmed offset without creating another session",async()=>{
    const db=databaseMock(()=>({data:{id:assetId,title:"Event",body:"Copy",status:"scheduled",metadata:{library_files:[file],publishing:{provider:"youtube",publication_id:"request",youtube_session:session,youtube_file_id:fileId}}}}));mocks.admin.mockReturnValue({...db,rpc:mocks.rpc,storage:{from:()=>({download:mocks.download})}});
    mocks.fetch.mockResolvedValueOnce(new Response(null,{status:308,headers:{range:"bytes=0-2"}})).mockResolvedValueOnce(new Response(JSON.stringify({id:"abcdefghijk",status:{uploadStatus:"uploaded",privacyStatus:"unlisted"}})));
    expect((await getYouTubeDelivery(org,assetId)).status).toBe("queued");
    expect(mocks.fetch.mock.calls).toHaveLength(2); expect(mocks.fetch.mock.calls.every(([url])=>url===session)).toBe(true);
    expect(mocks.fetch.mock.calls[1][1].headers["Content-Range"]).toBe("bytes 3-5/6"); expect(new TextDecoder().decode(mocks.fetch.mock.calls[1][1].body)).toBe("def");
    expect(mocks.rpc).toHaveBeenCalledWith("check_content_release",{p_asset:assetId,p_organization:org});
    expect(db.queries.every(q=>q.filters.some(f=>f.column==="organization_id"&&f.value===org))).toBe(true);
  });
  it("blocks resuming an upload whose approvals are no longer valid",async()=>{const db=databaseMock(()=>({data:{status:"scheduled",metadata:{publishing:{provider:"youtube",youtube_session:session,youtube_file_id:fileId}}}}));mocks.admin.mockReturnValue({...db,rpc:mocks.rpc});mocks.rpc.mockResolvedValue({error:{message:"approval missing"}});await expect(getYouTubeDelivery(org,assetId)).rejects.toThrow("approval");expect(mocks.fetch).not.toHaveBeenCalled();});
});
