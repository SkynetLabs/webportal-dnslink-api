const fetch = require("node-fetch");
const { Server } = require("./server");
const { ResolutionError } = require("./dnsResolveTxt");

describe("Server", () => {
  const app = new Server();

  beforeAll(() => {
    app.start(1234);
  });

  afterAll(() => {
    app.server.close();
  });

  describe("/dnslink/:domainName route", () => {
    describe("when domain is configured with a skylink", () => {
      const configuredSkylink = "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA";

      beforeEach(() => {
        jest.spyOn(app.resolver, "validateRequest").mockImplementation(() => {});
        jest.spyOn(app.resolver, "resolve").mockResolvedValue({ skylink: configuredSkylink });
      });

      it("responds with json data", async () => {
        const response = await fetch("http://0.0.0.0:1234/dnslink/skynetlabs.com");

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          skylink: configuredSkylink,
        });
      });
    });

    describe("when domain is configured with a skylink and sponsor key", () => {
      const configuredSkylink = "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA";
      const configuredSponsorKey = "sponsor-key-1234";

      beforeEach(() => {
        jest.spyOn(app.resolver, "validateRequest").mockImplementation(() => {});
        jest.spyOn(app.resolver, "resolve").mockResolvedValue({
          skylink: configuredSkylink,
          sponsor: configuredSponsorKey,
        });
      });

      it("responds with json data", async () => {
        const response = await fetch("http://0.0.0.0:1234/dnslink/skynetlabs.com");

        expect(response.status).toBe(200);
        expect(await response.json()).toEqual({
          skylink: configuredSkylink,
          sponsor: configuredSponsorKey,
        });
      });
    });

    describe("when domain is not configured with a skylink ", () => {
      beforeEach(() => {
        jest.spyOn(app.resolver, "validateRequest").mockImplementation(() => {});
        jest
          .spyOn(app.resolver, "resolve")
          .mockRejectedValue(new ResolutionError("No TXT record found for fake-domain.com"));
      });

      it("responds with error", async () => {
        const response = await fetch("http://0.0.0.0:1234/dnslink/fake-domain.com");

        expect(response.status).toBe(400);
      });

      it("responds with text/plain content-type", async () => {
        const response = await fetch("http://0.0.0.0:1234/dnslink/fake-domain.com");

        expect(response.headers.get("content-type")).toEqual("text/plain; charset=utf-8");
      });
    });
  });
});
