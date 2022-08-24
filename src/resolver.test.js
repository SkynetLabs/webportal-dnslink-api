const dns = require("node:dns").promises;
const crypto = require("crypto");
const {
  Resolver,
  InvalidRequestError,
  NoSkynetDNSLinksFoundError,
  MultipleSkylinksError,
  InvalidSkylinkError,
  MultipleSponsorKeyRecordsError,
} = require("./resolver");

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
  VALID_SPONSOR: [["skynet-sponsor-key=dummySponsorKey1"]],
  VALID_SKYLINK: [["dnslink=/skynet-ns/AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA"]],
};

describe("Resolver", () => {
  let resolver;

  // each function call resolves unique domain name to avoid cached results
  const resolve = (uri) => resolver.resolve(`${crypto.randomBytes(16).toString("hex")}.com`, uri);

  beforeEach(() => {
    resolver = new Resolver();
  });

  describe(".validateRequest", () => {
    const INVALID_DOMAINS = ["xyz", ".com", "invalid--domain.com"];
    const VALID_DOMAINS = ["skynetlabs.com", "siasky.net", "skynetlabs.io"];

    it.each(INVALID_DOMAINS)("throws for invalid domain (%s)", (domainName) => {
      expect(() => resolver.validateRequest({ params: { name: domainName, encodedUri: "" } })).toThrow(
        InvalidRequestError
      );
    });

    it.each(VALID_DOMAINS)("throws for invalid domain (%s)", (domainName) => {
      expect(() => resolver.validateRequest({ params: { name: domainName, encodedUri: "" } })).not.toThrow();
    });
  });

  describe(".resolve", () => {
    it("invokes dns.resolveTxt with proper params", async () => {
      jest.spyOn(dns, "resolveTxt").mockResolvedValue(FIXTURES.VALID_SKYLINK);

      resolver.resolve("skynetlabs.com");

      expect(dns.resolveTxt).toHaveBeenCalledWith("_dnslink.skynetlabs.com");
    });

    describe("when TXT records contain a valid skylink without sponsor", () => {
      beforeEach(() => {
        jest.spyOn(dns, "resolveTxt").mockResolvedValue(FIXTURES.VALID_SKYLINK);
      });

      it("returns skylink property", async () => {
        expect(await resolve()).toEqual({
          skylink: "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA",
        });
      });
    });

    describe("when TXT records contain a valid sponsor without skylink", () => {
      beforeEach(() => {
        jest.spyOn(dns, "resolveTxt").mockResolvedValue(FIXTURES.VALID_SPONSOR);
      });

      it("returns sponsor property", async () => {
        expect(await resolve()).toEqual({
          sponsor: "dummySponsorKey1",
        });
      });
    });

    describe("when uri is set", () => {
      beforeEach(() => {});

      describe("and there is no skylink in dnslink", () => {
        beforeEach(() => {
          jest.spyOn(dns, "resolveTxt").mockResolvedValue([[]]);
        });

        it("it should return valid skylink from uri", async () => {
          expect(await resolve("/AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA")).toEqual({
            path: "/",
            skylink: "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA",
          });
        });

        it("it should return valid skylink from uri with path if path is provided", async () => {
          expect(await resolve("/AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA/foo/bar")).toEqual({
            path: "/foo/bar",
            skylink: "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA",
          });
        });
      });

      describe("and there is a skylink in dnslink", () => {
        beforeEach(() => {
          jest.spyOn(dns, "resolveTxt").mockResolvedValue(FIXTURES.VALID_SKYLINK);
        });

        it("it should return valid skylink from dnslink and the skylink as a path", async () => {
          expect(await resolve("/AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSB")).toEqual({
            path: "/AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSB",
            skylink: "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA",
          });
        });

        it("it should return valid skylink from dnslink and the whole uri as a path", async () => {
          expect(await resolve("/AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSB/foo/bar")).toEqual({
            path: "/AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSB/foo/bar",
            skylink: "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA",
          });
        });
      });
    });

    describe("when TXT records contain a valid skylink with a single sponsor key", () => {
      beforeEach(() => {
        jest.spyOn(dns, "resolveTxt").mockResolvedValue(FIXTURES.VALID_SPONSORED_SKYLINK);
      });

      it("returns skylink and sponsor properties", async () => {
        expect(await resolve()).toEqual({
          skylink: "AQCYCPSmSMfmZjOKLX4zoYHHTNJQW2daVgZ2PTpkASFlSA",
          sponsor: "dummySponsorKey1",
        });
      });
    });

    describe("when no TXT records are configured", () => {
      beforeEach(() => {
        jest.spyOn(dns, "resolveTxt").mockResolvedValue([]);
      });

      it("throws NoSkynetDNSLinksFoundError", () => {
        expect(resolve()).rejects.toThrow(NoSkynetDNSLinksFoundError);
      });
    });

    describe("when TXT records are present, but none of them are skynet dnslinks", () => {
      beforeEach(() => {
        jest.spyOn(dns, "resolveTxt").mockResolvedValue(FIXTURES.NO_SKYNET_LINKS);
      });

      it("throws NoSkynetDNSLinksFoundError", () => {
        expect(resolve()).rejects.toThrow(NoSkynetDNSLinksFoundError);
      });
    });

    describe("when TXT records contain multiple skynet dnslinks", () => {
      beforeEach(() => {
        jest.spyOn(dns, "resolveTxt").mockResolvedValue(FIXTURES.MULTIPLE_SKYNET_LINKS);
      });

      it("throws MultipleSkylinksError", () => {
        expect(resolve()).rejects.toThrow(MultipleSkylinksError);
      });
    });

    describe("when TXT records contain a skynet dnslink with invalid skylink", () => {
      beforeEach(() => {
        jest.spyOn(dns, "resolveTxt").mockResolvedValue(FIXTURES.INVALID_SKYLINK);
      });

      it("throws InvalidSkylinkError", () => {
        expect(resolve()).rejects.toThrow(InvalidSkylinkError);
      });
    });

    describe("when TXT records contain multiple sponsor keys", () => {
      beforeEach(() => {
        jest.spyOn(dns, "resolveTxt").mockResolvedValue(FIXTURES.MULTIPLE_SPONSOR_KEY);
      });

      it("throws MultipleSponsorKeyRecordsError", () => {
        expect(resolve()).rejects.toThrow(MultipleSponsorKeyRecordsError);
      });
    });
  });
});
