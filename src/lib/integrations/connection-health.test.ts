import { beforeEach, describe, expect, it, vi } from "vitest";
import { databaseMock } from "@/test/database-mock";
const mocks = vi.hoisted(() => ({admin:vi.fn(),model:vi.fn(),buffer:vi.fn(),bufferStatus:vi.fn(),wp:vi.fn(),wpVerify:vi.fn(),seo:vi.fn(),strapi:vi.fn(),strapiVerify:vi.fn(),google:vi.fn(),googleVerify:vi.fn(),resend:vi.fn(),sender:vi.fn()}));
vi.mock("@/lib/supabase/admin",()=>({createAdminClient:mocks.admin}));
vi.mock("@/lib/crypto/secret-box",()=>({decryptSecret:(value:string)=>value.startsWith("unreadable:")?"":value}));
vi.mock("@/lib/ai/connection-check",()=>({checkProviderModel:mocks.model}));
vi.mock("./buffer",()=>({getBufferChannels:mocks.buffer,getBufferStatus:mocks.bufferStatus}));
vi.mock("./wordpress",()=>({getWordPressConfig:mocks.wp,verifyWordPressConnection:mocks.wpVerify,verifyWordPressSeoPlugin:mocks.seo}));
vi.mock("./strapi",()=>({getStrapiConfig:mocks.strapi,verifyStrapiConnection:mocks.strapiVerify}));
vi.mock("./google-analytics",()=>({getGoogleAnalyticsConfig:mocks.google,verifyGoogleAnalyticsConnection:mocks.googleVerify}));
vi.mock("./resend",()=>({getResendConfig:mocks.resend,verifyResendSender:mocks.sender}));
vi.mock("./content-import",()=>({listNotionPages:async()=>({items:[]}),youtubeRequest:async()=>new Response(JSON.stringify({items:[{id:"channel"}]}))}));
import {inspectProviderConnections} from "./connection-health";
const keys=["ai","buffer","cms_wordpress","cms_strapi","google_analytics","email_resend","notion","youtube"];
function setup(rows:unknown[]=keys.map(key=>({key,status:"connected",config:{provider:"gemini",apiKey:"private-test-key",model:"gemini-3.8-flash"}}))) {
  const db=databaseMock(()=>({data:rows,error:null}));mocks.admin.mockReturnValue(db);return db;
}
beforeEach(()=>{
  vi.clearAllMocks();vi.stubEnv("AI_API_KEY","");vi.stubEnv("NEXT_PUBLIC_SITE_URL","https://marketing.example.org");setup();
  mocks.model.mockResolvedValue({ok:true});mocks.bufferStatus.mockResolvedValue({connected:true});
  mocks.buffer.mockResolvedValue([{isDisconnected:false,isLocked:false,isQueuePaused:false}]);
  mocks.wp.mockResolvedValue({siteUrl:"https://site.example"});mocks.wpVerify.mockResolvedValue({});mocks.seo.mockResolvedValue(undefined);
  mocks.strapi.mockResolvedValue({});mocks.strapiVerify.mockResolvedValue({});mocks.google.mockResolvedValue({});mocks.googleVerify.mockResolvedValue(true);
  mocks.resend.mockResolvedValue({apiKey:"private-key",fromEmail:"sender@example.org",webhookSecret:"saved-secret"});mocks.sender.mockResolvedValue({ok:true});
});
describe("provider health checks",()=>{
  it("reports missing setup instead of treating a saved flag as verification",async()=>{
    const db=setup([]);const result=await inspectProviderConnections("org");
    expect(result).toHaveLength(8);expect(result.every(row=>row.state==="needs_setup")).toBe(true);
    expect(mocks.model).not.toHaveBeenCalled();expect(mocks.sender).not.toHaveBeenCalled();
    expect(db.queries.every(q=>q.operation==="select")).toBe(true);
  });
  it("verifies all configured services without returning credentials",async()=>{
    const result=await inspectProviderConnections("org");expect(result.every(row=>row.state==="ready")).toBe(true);
    expect(JSON.stringify(result)).not.toContain("private-test-key");
    expect(mocks.wpVerify).toHaveBeenCalledOnce();expect(mocks.googleVerify).toHaveBeenCalledOnce();expect(mocks.sender).toHaveBeenCalledOnce();
  });
  it.each([["cms_wordpress","wpVerify"],["google_analytics","googleVerify"],["cms_strapi","strapiVerify"],["buffer","buffer"]] as const)("keeps other checks usable when %s fails",async(key,method)=>{
    mocks[method].mockRejectedValueOnce(new Error("remote error containing private-test-key"));
    const result=await inspectProviderConnections("org");expect(result.find(row=>row.key===key)?.state).toBe("needs_attention");
    expect(result.filter(row=>row.state==="ready")).toHaveLength(7);expect(JSON.stringify(result)).not.toContain("private-test-key");
  });
  it("does not accept empty or unusable Buffer channels as ready",async()=>{
    for(const channels of [[],[{isQueuePaused:true}],[{isLocked:true}],[{isDisconnected:true}]]) {
      mocks.buffer.mockResolvedValueOnce(channels);expect((await inspectProviderConnections("org")).find(row=>row.key==="buffer")?.state).toBe("needs_attention");
    }
  });
  it("shows a model-access rejection without making a generation call",async()=>{
    mocks.model.mockResolvedValueOnce({ok:false,error:"Model access denied"});
    expect((await inspectProviderConnections("org")).find(row=>row.key==="ai")).toMatchObject({state:"needs_attention",message:"Model access denied"});
  });
  it("requires readable credentials and sender verification",async()=>{
    mocks.wp.mockResolvedValueOnce(null);mocks.sender.mockResolvedValueOnce({ok:false,error:"Verify your sender domain"});
    const result=await inspectProviderConnections("org");expect(result.find(row=>row.key==="cms_wordpress")?.state).toBe("needs_attention");
    expect(result.find(row=>row.key==="email_resend")?.message).toBe("Verify your sender domain");
  });
  it("distinguishes sender access from missing delivery tracking setup",async()=>{
    mocks.resend.mockResolvedValueOnce({apiKey:"private-key",fromEmail:"sender@example.org",webhookSecret:""});
    expect((await inspectProviderConnections("org")).find(row=>row.key==="email_resend")).toMatchObject({state:"needs_attention",message:expect.stringContaining("webhook")});
  });
  it("fails clearly when workspace connections cannot be read",async()=>{
    mocks.admin.mockReturnValue(databaseMock(()=>({error:{message:"Unavailable"}})));
    await expect(inspectProviderConnections("org")).rejects.toThrow("Could not read your saved connections");
  });
  it("does not label local-only email delivery as ready",async()=>{
    vi.stubEnv("NEXT_PUBLIC_SITE_URL","http://localhost:3001");
    expect((await inspectProviderConnections("org")).find(row=>row.key==="email_resend")).toMatchObject({state:"needs_attention",message:expect.stringContaining("public HTTPS")});
  });
});
