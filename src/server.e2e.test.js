const fetch = require("node-fetch");
const { Server } = require("./server");
const { Resolver, ResolutionError } = require("./resolver");

describe("End-to-end tests", () => {
  const app = new Server();

  beforeAll(() => {
    app.start(1235);
  });

  afterAll(() => {
    app.server.close();
  });

  /**
   * This section of tests is performed on actual, live domains (these are not mocked).
   */
  it("no-dns-link.skynetlabs.io - no dnslink entry", async () => {
    const response = await fetch("http://0.0.0.0:1235/dnslink/no-dns-link.skynetlabs.io");
    expect(response.status).toBe(400);
    expect(response.headers.get("content-type")).toEqual("text/plain; charset=utf-8");
    expect(await response.text()).toEqual("ENOTFOUND: _dnslink.no-dns-link.skynetlabs.io TXT record doesn't exist");
  });

  it("dns-link.skynetlabs.io - dnslink entry correct with valid skylink", async () => {
    const response = await fetch("http://0.0.0.0:1235/dnslink/dns-link.skynetlabs.io");
    const expectedResponse = {
      skylink: "MABdWWku6YETM2zooGCjQi26Rs4a6Hb74q26i-vMMcximQ",
    };

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expectedResponse);
  });

  it("sponsored-dns-link.skynetlabs.io - dnslink entry correct with valid skylink and sponsor key", async () => {
    const response = await fetch("http://0.0.0.0:1235/dnslink/sponsored-dns-link.skynetlabs.io");
    const expectedResponse = {
      skylink: "MABdWWku6YETM2zooGCjQi26Rs4a6Hb74q26i-vMMcximQ",
      sponsor: "JDCLOJIJ7NJRSN4QRD7EDFVNP7MPJ24O856D57NE3FV2PFBAT6T0",
    };

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(expectedResponse);
  });

  it("malformed-dns-link.skynetlabs.io - dns entry correct but skylink invalid", async () => {
    const response = await fetch("http://0.0.0.0:1235/dnslink/malformed-dns-link.skynetlabs.io");

    expect(response.status).toBe(400);
    expect(await response.text()).toMatch(
      /TXT record with skynet dnslink for _dnslink.malformed-dns-link.skynetlabs.io contains invalid skylink/
    );
  });
});
