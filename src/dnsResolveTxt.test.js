const dns = require("node:dns").promises;
const crypto = require("crypto");
const { dnsResolveTxt } = require("./dnsResolveTxt");

const getRandomDomain = () => crypto.randomBytes(16).toString("hex") + ".com";

describe("dnsResolveTxt", () => {
  it("throws an error when record does not exist", async () => {
    const domain = getRandomDomain();

    jest.spyOn(dns, "resolveTxt").mockRejectedValueOnce(Object.assign(new Error(), { code: "ENOTFOUND" }));

    await expect(dnsResolveTxt(domain)).rejects.toEqual(new Error(`ENOTFOUND: ${domain} TXT record doesn't exist`));
  });

  it("throws an error when lookup returned no data", async () => {
    const domain = getRandomDomain();

    jest.spyOn(dns, "resolveTxt").mockRejectedValueOnce(Object.assign(new Error(), { code: "ENODATA" }));

    await expect(dnsResolveTxt(domain)).rejects.toEqual(new Error(`ENODATA: ${domain} dns lookup returned no data`));
  });

  it("throws an error when lookup was rejected with unhandled exception", async () => {
    const domain = getRandomDomain();
    const error = "server failure message";

    jest.spyOn(dns, "resolveTxt").mockRejectedValueOnce(new Error(error));

    await expect(dnsResolveTxt(domain)).rejects.toEqual(new Error(`Failed to fetch ${domain} TXT record: ${error}`));
  });

  it("returns resolved addresses on success", async () => {
    const domain = getRandomDomain();
    const adddresses = [["dummy-response"]];

    jest.spyOn(dns, "resolveTxt").mockReturnValueOnce(adddresses);

    await expect(dnsResolveTxt(domain)).resolves.toEqual(adddresses);
  });

  it("caches successfully resolved data", async () => {
    const domain = getRandomDomain();
    const adddresses = [["dummy-response"]];

    jest.spyOn(dns, "resolveTxt").mockReturnValue(adddresses);

    // resolve resolveTxt twice and expect the second call to be cached
    await expect(dnsResolveTxt(domain)).resolves.toEqual(adddresses);
    await expect(dnsResolveTxt(domain)).resolves.toEqual(adddresses);

    expect(dns.resolveTxt).toHaveBeenCalledTimes(1);
  });

  it("does not cache error resolutions", async () => {
    const domain = getRandomDomain();
    const error = "server failure message";

    jest.spyOn(dns, "resolveTxt").mockRejectedValue(new Error(error));

    // reject resolveTxt twice and expect the second call not to be cached
    await expect(dnsResolveTxt(domain)).rejects.toEqual(new Error(`Failed to fetch ${domain} TXT record: ${error}`));
    await expect(dnsResolveTxt(domain)).rejects.toEqual(new Error(`Failed to fetch ${domain} TXT record: ${error}`));

    expect(dns.resolveTxt).toHaveBeenCalledTimes(2);
  });
});
