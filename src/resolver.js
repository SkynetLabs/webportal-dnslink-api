const dns = require("dns");
const isValidDomain = require("is-valid-domain");

const logger = require("./logger");

const dnslinkNamespace = "skynet-ns";
const sponsorNamespace = "skynet-sponsor-key";
const dnslinkRegExp = new RegExp(`^dnslink=/${dnslinkNamespace}/.+$`);
const sponsorRegExp = new RegExp(`^${sponsorNamespace}=[a-zA-Z0-9]+$`);
const dnslinkSkylinkRegExp = new RegExp(`^dnslink=/${dnslinkNamespace}/([a-zA-Z0-9_-]{46}|[a-z0-9]{55})`);
const hint = `valid example: dnslink=/${dnslinkNamespace}/3ACpC9Umme41zlWUgMQh1fw0sNwgWwyfDDhRQ9Sppz9hjQ`;

class Resolver {
  async resolve(domainName) {
    const lookup = `_dnslink.${domainName}`;

    return new Promise((resolve) => {
      dns.resolveTxt(lookup, (error, addresses) => {
        if (error) {
          if (error.code === "ENOTFOUND") {
            throw new ResolutionError(`ENOTFOUND: ${lookup} TXT record doesn't exist`);
          }

          if (error.code === "ENODATA") {
            throw new ResolutionError(`ENODATA: ${lookup} dns lookup returned no data`);
          }

          throw new ResolutionError(`Failed to fetch ${lookup} TXT record: ${error.message}`);
        }

        if (addresses.length === 0) {
          throw new ResolutionError(`No TXT record found for ${lookup}`);
        }

        const records = addresses.flat();
        const dnslinks = records.filter((record) => dnslinkRegExp.test(record));

        if (dnslinks.length === 0) {
          throw new NoSkynetDNSLinksFoundError(
            `TXT records for ${lookup} found but none of them contained valid skynet dnslink - ${hint}`
          );
        }

        if (dnslinks.length > 1) {
          throw new MultipleSkylinksError(
            `Multiple TXT records with valid skynet dnslink found for ${lookup}, only one allowed`
          );
        }

        const [dnslink] = dnslinks;
        const matchSkylink = dnslink.match(dnslinkSkylinkRegExp);

        if (!matchSkylink) {
          throw new InvalidSkylinkError(
            `TXT record with skynet dnslink for ${lookup} contains invalid skylink - ${hint}`
          );
        }

        const skylink = matchSkylink[1];

        // check if _dnslink records contain skynet-sponsor-key entries
        const sponsors = records.filter((record) => sponsorRegExp.test(record));

        if (sponsors.length > 1) {
          throw new MultipleSponsorKeyRecordsError(
            `Multiple TXT records with valid sponsor key found for ${lookup}, only one allowed`
          );
        }

        if (sponsors.length === 1) {
          // extract just the key part from the record
          const sponsor = sponsors[0].substring(sponsors[0].indexOf("=") + 1);

          logger.info(`${domainName} => ${skylink} | sponsor: ${sponsor}`);

          return resolve({ skylink, sponsor });
        }

        logger.info(`${domainName} => ${skylink}`);

        return resolve({ skylink });
      });
    });
  }

  validateRequest(req) {
    if (!isValidDomain(req.params.name)) {
      throw new InvalidRequestError(`${req.params.name} is not a valid domain`);
    }
  }
}

class InvalidRequestError extends Error {}
class ResolutionError extends Error {}
class NoSkynetDNSLinksFoundError extends Error {}
class MultipleSkylinksError extends Error {}
class InvalidSkylinkError extends Error {}
class MultipleSponsorKeyRecordsError extends Error {}

module.exports = {
  Resolver,
  InvalidRequestError,
  ResolutionError,
  NoSkynetDNSLinksFoundError,
  MultipleSkylinksError,
  InvalidSkylinkError,
  MultipleSponsorKeyRecordsError,
};
