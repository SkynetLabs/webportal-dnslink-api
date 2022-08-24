const dns = require("node:dns").promises;
const LRU = require("lru-cache");

class ResolutionError extends Error {}

const dnsCache = new LRU({
  max: Number(process.env.DNSLINK_CACHE_SIZE ?? 5000), // defaults to max 5000 cached items
  ttl: Number(process.env.DNSLINK_CACHE_TIME ?? 1000 * 60 * 5), // defaults to 5 minutes time to live
});

async function dnsResolveTxt(domain) {
  if (dnsCache.has(domain)) {
    return dnsCache.get(domain);
  }

  try {
    const addresses = await dns.resolveTxt(domain);

    // only cache successful resolutions
    dnsCache.set(domain, addresses);

    return addresses;
  } catch (error) {
    // if domain name isn't configured with a TXT record, raise an error
    if (error.code === "ENOTFOUND") {
      throw new ResolutionError(`ENOTFOUND: ${domain} TXT record doesn't exist`);
    }

    // if domain name could not be resolved, raise an error
    if (error.code === "ENODATA") {
      throw new ResolutionError(`ENODATA: ${domain} dns lookup returned no data`);
    }

    // if TXT record resolution fails for any other reason, raise an error
    throw new ResolutionError(`Failed to fetch ${domain} TXT record: ${error.message}`);
  }
}

module.exports = { dnsResolveTxt, ResolutionError };
