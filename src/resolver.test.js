const dns = require("dns");
const { hasUncaughtExceptionCaptureCallback } = require("process");
const {
  Resolver,
  InvalidRequestError,
  ResolutionError,
  NoSkynetDNSLinksFoundError,
  MultipleSkylinksError,
  InvalidSkylinkError,
  MultipleSponsorKeyRecordsError,
} = require("./resolver");

jest.mock("dns");

const FIXTURES = {
  NO_SKYNET_LINKS: [["dnslink=/dummy-namespace/abcd-1234"]],
  MULTIPLE_SKYNET_LINKS: [
    ["dnslink=/skynet-ns/AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA"],
    ["dnslink=/skynet-ns/AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSB"],
  ],
  INVALID_SKYLINK: [["dnslink=/skynet-ns/broken-skylink"]],
  MULTIPLE_SPONSOR_KEY: [
    ["dnslink=/skynet-ns/AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA"],
    ["skynet-sponsor-key=dummySponsorKey1"],
    ["skynet-sponsor-key=dummySponsorKey2"],
  ],
  VALID_SPONSORED_SKYLINK: [
    ["dnslink=/skynet-ns/AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA"],
    ["skynet-sponsor-key=dummySponsorKey1"],
  ],
  VALID_SKYLINK: [["dnslink=/skynet-ns/AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA"]],
};

const mockedDnsResolveTxt = (error, addresses) => (lookup, callback) => callback(error, addresses);

describe("Resolver", () => {
  let resolver;

  const resolve = () => resolver.resolve("dummy-domain.com");

  beforeEach(() => {
    resolver = new Resolver();
  });

  describe(".validateRequest", () => {
    const INVALID_DOMAINS = ["xyz", ".com", "invalid--domain.com"];
    const VALID_DOMAINS = ["skynetlabs.com", "siasky.net", "skynetlabs.io"];

    it.each(INVALID_DOMAINS)("throws for invalid domain (%s)", (domainName) => {
      expect(() => resolver.validateRequest({ params: { name: domainName } })).toThrow(InvalidRequestError);
    });

    it.each(VALID_DOMAINS)("throws for invalid domain (%s)", (domainName) => {
      expect(() => resolver.validateRequest({ params: { name: domainName } })).not.toThrow();
    });
  });

  describe(".resolve", () => {
    it("invokes dns.resolveTxt with proper params", async () => {
      dns.resolveTxt.mockImplementationOnce(() => {});
      resolver.resolve("skynetlabs.com");

      expect(dns.resolveTxt).toHaveBeenCalledWith("_dnslink.skynetlabs.com", expect.any(Function));
    });

    describe("when TXT records contain a valid skylink", () => {
      beforeEach(() => {
        dns.resolveTxt.mockImplementationOnce(mockedDnsResolveTxt(null, FIXTURES.VALID_SKYLINK));
      });

      it("returns skylink and sponsor properties", async () => {
        expect(await resolve()).toEqual({
          skylink: "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA",
        });
      });
    });

    describe("when TXT records contain a valid skylink with a single sponsor key", () => {
      beforeEach(() => {
        dns.resolveTxt.mockImplementationOnce(mockedDnsResolveTxt(null, FIXTURES.VALID_SPONSORED_SKYLINK));
      });

      it("returns skylink and sponsor properties", async () => {
        expect(await resolve()).toEqual({
          skylink: "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA",
          sponsor: "dummySponsorKey1",
        });
      });
    });

    describe("when TXT records are present, but none of them are skynet dnslinks", () => {
      beforeEach(() => {
        dns.resolveTxt.mockImplementationOnce(mockedDnsResolveTxt(null, FIXTURES.NO_SKYNET_LINKS));
      });

      it("throws NoSkynetDNSLinksFoundError", () => {
        expect(resolve()).rejects.toThrow(NoSkynetDNSLinksFoundError);
      });
    });

    describe("when TXT records contain multiple skynet dnslinks", () => {
      beforeEach(() => {
        dns.resolveTxt.mockImplementationOnce(mockedDnsResolveTxt(null, FIXTURES.MULTIPLE_SKYNET_LINKS));
      });

      it("throws MultipleSkylinksError", () => {
        expect(resolve()).rejects.toThrow(MultipleSkylinksError);
      });
    });

    describe("when TXT records contain a skynet dnslink with invalid skylink", () => {
      beforeEach(() => {
        dns.resolveTxt.mockImplementationOnce(mockedDnsResolveTxt(null, FIXTURES.INVALID_SKYLINK));
      });

      it("throws InvalidSkylinkError", () => {
        expect(resolve()).rejects.toThrow(InvalidSkylinkError);
      });
    });

    describe("when TXT records contain multiple sponsor keys", () => {
      beforeEach(() => {
        dns.resolveTxt.mockImplementationOnce(mockedDnsResolveTxt(null, FIXTURES.MULTIPLE_SPONSOR_KEY));
      });

      it("throws MultipleSponsorKeyRecordsError", () => {
        expect(resolve()).rejects.toThrow(MultipleSponsorKeyRecordsError);
      });
    });

    describe("when no records are configured", () => {
      beforeEach(() => {
        dns.resolveTxt.mockImplementationOnce(mockedDnsResolveTxt(null, []));
      });

      it("throws ResolutionError", () => {
        expect(resolve()).rejects.toThrow(ResolutionError);
      });
    });

    describe("when TXT record is not found", () => {
      beforeEach(() => {
        dns.resolveTxt.mockImplementationOnce(mockedDnsResolveTxt({ code: "ENOTFOUND" }));
      });

      it("throws ResolutionError", () => {
        expect(resolve()).rejects.toThrow(ResolutionError);
      });
    });

    describe("when lookup returns no data", () => {
      beforeEach(() => {
        dns.resolveTxt.mockImplementationOnce(mockedDnsResolveTxt({ code: "ENODATA" }));
      });

      it("throws ResolutionError", () => {
        expect(resolve()).rejects.toThrow(ResolutionError);
      });
    });

    describe("when lookup returns an error", () => {
      beforeEach(() => {
        dns.resolveTxt.mockImplementationOnce(
          mockedDnsResolveTxt({ code: "any other error", message: "dummy message" })
        );
      });

      it("throws ResolutionError", () => {
        expect(resolve()).rejects.toThrow(ResolutionError);
      });
    });
  });
});
