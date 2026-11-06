import {beforeEach,describe,expect,it,vi} from "vitest";
import {databaseMock} from "@/test/database-mock";
const mocks=vi.hoisted(()=>({client:vi.fn()}));
vi.mock("@/lib/supabase/server",()=>({createClient:mocks.client}));
import {getActivity,listActivities} from "./activities";
beforeEach(()=>vi.clearAllMocks());
describe("combined Activity Hub and search",()=>{
  it("searches the three activity fields while retaining workspace isolation",async()=>{
    const db=databaseMock(()=>({data:[]}));mocks.client.mockResolvedValue(db);
    await listActivities("workspace-a","Founders");
    expect(db.queries[0].filters).toContainEqual({method:"eq",column:"organization_id",value:"workspace-a"});
    expect(db.queries[0].filters).toContainEqual({method:"or",column:"title.ilike.%Founders%,description.ilike.%Founders%,outcomes.ilike.%Founders%",value:undefined});
  });
  it("drops filter operators and bounds the search term without dropping the workspace filter",async()=>{
    const db=databaseMock(()=>({data:[]}));mocks.client.mockResolvedValue(db);
    await listActivities("workspace-a",'%_,*("Founders")\\');
    expect(db.queries[0].filters.find(filter=>filter.method==="or")?.column).toBe("title.ilike.%Founders%,description.ilike.%Founders%,outcomes.ilike.%Founders%");
    await listActivities("workspace-a","a".repeat(150));
    expect(db.queries[1].filters.find(filter=>filter.method==="or")?.column).toBe(["title","description","outcomes"].map(field=>`${field}.ilike.%${"a".repeat(100)}%`).join(","));
    expect(db.queries.every(query=>query.filters.some(filter=>filter.column==="organization_id"&&filter.value==="workspace-a"))).toBe(true);
  });
  it("keeps the original unfiltered list when the search is empty",async()=>{
    const db=databaseMock(()=>({data:[]}));mocks.client.mockResolvedValue(db);
    await listActivities("workspace-a","  ");
    expect(db.queries[0].filters.some(filter=>filter.method==="or")).toBe(false);
  });
  it("retains the merged campaign details when opening a searched activity",async()=>{
    const activity={id:"activity",campaign:{id:"campaign",name:"Program launch"}};
    const db=databaseMock(()=>({data:activity}));mocks.client.mockResolvedValue(db);
    expect(await getActivity("workspace-a","activity")).toEqual(activity);
    expect(db.queries[0].columns).toContain("campaign:campaigns(id, name)");
    expect(db.queries[0].filters).toEqual(expect.arrayContaining([{method:"eq",column:"organization_id",value:"workspace-a"},{method:"eq",column:"id",value:"activity"}]));
  });
});
