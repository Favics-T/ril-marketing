import {beforeEach,describe,expect,it,vi} from "vitest";
const mocks=vi.hoisted(()=>({org:vi.fn(),role:vi.fn(),inspect:vi.fn()}));
vi.mock("@/lib/supabase/organization",()=>({requireOrganizationId:mocks.org}));
vi.mock("@/lib/audience/access",()=>({getUserRole:mocks.role}));
vi.mock("@/lib/integrations/connection-health",()=>({inspectProviderConnections:mocks.inspect}));
import {checkProviderConnections} from "./provider-health";
beforeEach(()=>{vi.clearAllMocks();mocks.org.mockResolvedValue("current-workspace");mocks.role.mockResolvedValue("owner");mocks.inspect.mockResolvedValue([]);});
describe("provider health authorization",()=>{
  it("only checks the authenticated workspace",async()=>{expect((await checkProviderConnections()).ok).toBe(true);expect(mocks.inspect).toHaveBeenCalledWith("current-workspace");});
  it.each(["member","leadership",null])("blocks provider credential checks for %s",async role=>{mocks.role.mockResolvedValueOnce(role);expect((await checkProviderConnections()).ok).toBe(false);expect(mocks.inspect).not.toHaveBeenCalled();});
  it("does not leak a server error to the browser",async()=>{mocks.inspect.mockRejectedValueOnce(new Error("private-key"));expect(await checkProviderConnections()).toMatchObject({ok:false,error:expect.not.stringContaining("private-key")});});
});
