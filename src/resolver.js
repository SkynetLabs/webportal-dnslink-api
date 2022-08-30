const isValidDomain = require("is-valid-domain");
const { convertSkylinkToBase64 } = require("skynet-js");
const { dnsResolveTxt } = require("./dnsResolveTxt");
const logger = require("./logger");

const dnslinkNamespace = "skynet-ns";
const sponsorNamespace = "skynet-sponsor-key";
const dnslinkRegExp = new RegExp(`^dnslink=/${dnslinkNamespace}/.+$`);
const sponsorRegExp = new RegExp(`^${sponsorNamespace}=[a-zA-Z0-9]+$`);
const skylinkMatcher = "[a-z0-9]{55}|[a-zA-Z0-9-_]{46}";
const dnslinkSkylinkRegExp = new RegExp(`^dnslink=/${dnslinkNamespace}/(${skylinkMatcher})`);
const uriSkylinkRegExp = new RegExp(`^/(?<skylink>${skylinkMatcher})(?<path>/.*)?`);
const hint = `valid example: dnslink=/${dnslinkNamespace}/3ACpC9Umme41zlWUgMQh1fw0sNwgWwyfDDhRQ9Sppz9hjQ`;

class InvalidRequestError extends Error {}
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
   * @param {string} domain Domain name to be checked for DNS link records.
   * @param {string} uri Optional uri string passed from the client.
   * @returns {Promise<ResolutionResult>}
   */
  async resolve(domain, uri) {
    const lookup = `_dnslink.${domain}`;
    const addresses = await dnsResolveTxt(lookup);

    /**
     * Domain has TXT records configured, but we need to filter out those that don't match our convention
     * specified by regular expressions above:
     *  - dnslink=/skynet-ns/<skylink>, or
     *  - dnslink=/skynet-sponsor-key/<sponsor-key>
     */
    const records = addresses.flat();
    const dnslinkSkylinks = records.filter((record) => dnslinkRegExp.test(record));
    const dnslinkSponsors = records.filter((record) => sponsorRegExp.test(record));

    // match a skylink from the uri to use when dnslink does not define one
    const matchSkylinkUri = uri ? uri.match(uriSkylinkRegExp) : null;

    // We currently only allow a single skylink to be tied to a domain name.
    // If there are more skylinks configured, raise an error.
    if (dnslinkSkylinks.length > 1) {
      throw new MultipleSkylinksError(
        `Multiple TXT records with valid skynet dnslink found for ${lookup}, only one allowed`
      );
    }

    // We currently only allow a single sponsor key to be configured with a given domain name.
    // If there are more, raise an error.
    if (dnslinkSponsors.length > 1) {
      throw new MultipleSponsorKeyRecordsError(
        `Multiple TXT records with valid sponsor key found for ${lookup}, only one allowed`
      );
    }

    // If there are no dnslink records configured with our namespaces, we raise an error.
    if (dnslinkSkylinks.length === 0 && dnslinkSponsors.length === 0 && matchSkylinkUri === null) {
      throw new NoSkynetDNSLinksFoundError(
        `TXT records for ${lookup} found but none of them contained valid skynet dnslink - ${hint}`
      );
    }

    // Prepare response object and default to uri as path if provided
    const response = { path: uri };

    if (dnslinkSkylinks.length === 1) {
      const [dnslink] = dnslinkSkylinks;
      const matchSkylink = dnslink.match(dnslinkSkylinkRegExp);

      // Verify if the configured skylink is valid.
      if (!matchSkylink) {
        throw new InvalidSkylinkError(
          `TXT record with skynet dnslink for ${lookup} contains invalid skylink - ${hint}`
        );
      }

      // Add skylink to response object
      response.skylink = matchSkylink[1];
    } else if (matchSkylinkUri) {
      response.skylink = matchSkylinkUri.groups.skylink;
      response.path = matchSkylinkUri.groups.path ?? "/";
    }

    // convert skylink to base64 if it is base32 encoded (55 characters long)
    if (response.skylink?.length === 55) {
      response.skylink = convertSkylinkToBase64(response.skylink);
    }

    if (dnslinkSponsors.length === 1) {
      // Extract just the key part from the record and add it to response object
      response.sponsor = dnslinkSponsors[0].substring(dnslinkSponsors[0].indexOf("=") + 1);
    }

    // Prepare logger message with skylink and sponsor key records if they exist
    const info = [`skylink: ${response.skylink}`, `sponsor: ${response.sponsor}`].filter(Boolean).join(" | ");

    // Log the response to the console
    logger.info(`${domain} => ${info}`);

    return response;
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
  NoSkynetDNSLinksFoundError,
  MultipleSkylinksError,
  InvalidSkylinkError,
  MultipleSponsorKeyRecordsError,
};
