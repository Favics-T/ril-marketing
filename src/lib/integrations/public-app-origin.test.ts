import {describe,expect,it} from "vitest";
import {publicAppOrigin} from "./public-app-origin";
describe("public application origin",()=>{
  it("accepts a public HTTPS origin",()=>expect(publicAppOrigin("https://marketing.example.org/")).toBe("https://marketing.example.org"));
  it.each([undefined,"not a URL","http://marketing.example.org","http://localhost:3001","https://localhost:3001","https://127.0.0.1","https://[::1]","https://app.local","https://app.example","https://app.test","https://marketing.example.org/path","https://user:pass@marketing.example.org","https://marketing.example.org?token=x"])("rejects an unusable email callback origin: %s",value=>expect(publicAppOrigin(value)).toBeNull());
});
