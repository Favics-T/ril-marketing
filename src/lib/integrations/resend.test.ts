import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {verifyResendSender} from "./resend";
const request=vi.fn();
beforeEach(()=>vi.stubGlobal("fetch",request));
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
describe("Resend sender connection",()=>{
  it("uses a read-only domain request to verify the sender without sending email",async()=>{
    request.mockResolvedValueOnce(Response.json({data:[{name:"example.org",status:"verified",capabilities:{sending:"enabled"}}]}));
    expect(await verifyResendSender("test-key","sender@example.org")).toEqual({ok:true});
    expect(request).toHaveBeenCalledWith("https://api.resend.com/domains",expect.objectContaining({redirect:"error",headers:{Authorization:"Bearer test-key"}}));
    expect(request).toHaveBeenCalledOnce();
  });
  it.each([400,401,403])("reports a useful connection error for HTTP %s",async status=>{
    request.mockResolvedValueOnce(Response.json({}, {status}));
    const result=await verifyResendSender("private-test-key","sender@example.org");
    expect(result.ok).toBe(false);expect(result.error).not.toContain("private-test-key");
    expect(result.error).toMatch(status===403?/domain access/:/current API key/);
  });
  it("does not accept an unverified or disabled sending domain",async()=>{
    request.mockResolvedValueOnce(Response.json({data:[{name:"example.org",status:"verified",capabilities:{sending:"disabled"}}]}));
    expect((await verifyResendSender("test-key","sender@example.org")).ok).toBe(false);
  });
});
