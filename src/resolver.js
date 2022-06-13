const dns = require("dns");
const isValidDomain = require("is-valid-domain");

const logger = require("./logger");

const dnslinkNamespace = "skynet-ns";
const sponsorNamespace = "skynet-sponsor-key";
const dnslinkRegExp = new RegExp(`^dnslink=/${dnslinkNamespace}/.+$`);
const sponsorRegExp = new RegExp(`^${sponsorNamespace}=[a-zA-Z0-9]+$`);
const dnslinkSkylinkRegExp = new RegExp(`^dnslink=/${dnslinkNamespace}/([a-zA-Z0-9_-]{46}|[a-z0-9]{55})`);
const hint = `valid example: dnslink=/${dnslinkNamespace}/3ACpC9Umme41zlWUgMQh1fw0sNwgWwyfDDhRQ9Sppz9hjQ`;

class InvalidRequestError extends Error {}
class ResolutionError extends Error {}
class NoSkynetDNSLinksFoundError extends Error {}
class MultipleSkylinksError extends Error {}
class InvalidSkylinkError extends Error {}
class MultipleSponsorKeyRecordsError extends Error {}

/**
 * Resolver class is responsible for validating the requested domain names
 * and decoding TXT records for them, as long as they exist.
 */
class Resolver {
  /**
   * Looks up and parses TXT records for a requested domain.
   *
   * If a given domain name is configured with TXT records that follow a specific
   * convention, this method will extract this data.
   *
   * @typedef {Object} ResolutionResult
   * @property {boolean} skylink - The skylink configured for the given domain.
   * @property {boolean} [sponsor] - Sponsor key configured for the given domain (if any).
   *
   * @param {string} domainName Domain name to be checked for DNS link records.
   * @returns {Promise<ResolutionResult>}
   */
  async resolve(domainName) {
    const lookup = `_dnslink.${domainName}`;

    return new Promise((resolve, reject) => {
      dns.resolveTxt(lookup, (error, addresses) => {
        if (error) {
          // If domain name isn't configured with a TXT record, raise an error
          if (error.code === "ENOTFOUND") {
            return reject(new ResolutionError(`ENOTFOUND: ${lookup} TXT record doesn't exist`));
          }

          // If domain name could not be resolved, raise an error
          if (error.code === "ENODATA") {
            return reject(new ResolutionError(`ENODATA: ${lookup} dns lookup returned no data`));
          }

          // If TXT record resolution fails for any other reason, raise an error
          return reject(new ResolutionError(`Failed to fetch ${lookup} TXT record: ${error.message}`));
        }

        // The domain name is successfully resolved, but it's not necessarily configured with any TXT records.
        // Let's validate that before proceeding.
        if (addresses.length === 0) {
          return reject(new ResolutionError(`No TXT record found for ${lookup}`));
        }

        /**
         * Domain has TXT records configured, but we need to filter out those that don't match our convention
         * specified by regular expressions above:
         *  - dnslink=/skynet-ns/<skylink>, or
         *  - dnslink=/skynet-sponsor-key/<sponsor-key>
         */
        const records = addresses.flat();
        const dnslinks = records.filter((record) => dnslinkRegExp.test(record));

        // If there are no dnslink records configured with our namespaces, we raise an error.
        if (dnslinks.length === 0) {
          return reject(
            new NoSkynetDNSLinksFoundError(
              `TXT records for ${lookup} found but none of them contained valid skynet dnslink - ${hint}`
            )
          );
        }

        // We currently only allow a single skylink to be tied to a domain name.
        // If there are more skylinks configured, raise an error.
        if (dnslinks.length > 1) {
          return reject(
            new MultipleSkylinksError(
              `Multiple TXT records with valid skynet dnslink found for ${lookup}, only one allowed`
            )
          );
        }

        const [dnslink] = dnslinks;
        const matchSkylink = dnslink.match(dnslinkSkylinkRegExp);

        // Verify if the configured skylink is valid.
        if (!matchSkylink) {
          return reject(
            new InvalidSkylinkError(`TXT record with skynet dnslink for ${lookup} contains invalid skylink - ${hint}`)
          );
        }

        const skylink = matchSkylink[1];

        // Check if _dnslink records contain skynet-sponsor-key entries
        const sponsors = records.filter((record) => sponsorRegExp.test(record));

        // We currently only allow a single sponsor key to be configured with a given domain name.
        // If there are more, raise an error.
        if (sponsors.length > 1) {
          return reject(
            new MultipleSponsorKeyRecordsError(
              `Multiple TXT records with valid sponsor key found for ${lookup}, only one allowed`
            )
          );
        }

        if (sponsors.length === 1) {
          // Extract just the key part from the record
          const sponsor = sponsors[0].substring(sponsors[0].indexOf("=") + 1);

          logger.info(`${domainName} => ${skylink} | sponsor: ${sponsor}`);

          return resolve({ skylink, sponsor });
        }

        logger.info(`${domainName} => ${skylink}`);

        return resolve({ skylink });
      });
    });
  }

  /**
   * Validates the incoming request by checking if the domain name being looked up is valid.
   * @param {Request} req
   * @throws {InvalidRequestError}
   */
  validateRequest(req) {
    // NOTE: this only checks if the domain name is RFC1035-compliant,
    // not if the domain can actually exist on the Internet.
    // For example, "weird.domain" is valid in this context, but will raise
    // an exception later in the process when we try to actually resolve it.
    if (!isValidDomain(req.params.name)) {
      throw new InvalidRequestError(`${req.params.name} is not a valid domain`);
    }
  }
}

module.exports = {
  Resolver,
  InvalidRequestError,
  ResolutionError,
  NoSkynetDNSLinksFoundError,
  MultipleSkylinksError,
  InvalidSkylinkError,
  MultipleSponsorKeyRecordsError,
};
