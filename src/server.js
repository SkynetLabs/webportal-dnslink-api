const express = require("express");
const logger = require("./logger");
const { Resolver } = require("./resolver");

/**
 * Responsible for spinning up and configuring an ExpressJS instance.
 */
class Server {
  constructor() {
    this.app = express();
    this.resolver = new Resolver();
    this.configure();
  }

  /**
   * Configures routing
   */
  configure() {
    // domain is full name of the domain pointing at the server
    this.app.get("/dnslink/:name", async (req, res) => {
      const domainName = req.params.name;

      try {
        this.resolver.validateRequest(req);

        const { skylink, sponsor } = await this.resolver.resolve(domainName);

        res.json({ skylink, sponsor });
      } catch (error) {
        logger.error(error.message);
        // Set content-type to text/plain to prevent XSS attacks.
        res.status(400).contentType("text/plain; charset=utf-8").send(error.message);
      }
    });

    // domain is full name of the domain pointing at the server
    // encodedUri is base64 encoded uri string passed from nginx
    this.app.get("/dnslink/:name/:encodedUri", async (req, res) => {
      const domainName = req.params.name;

      try {
        this.resolver.validateRequest(req);

        const uri = Buffer.from(req.params.encodedUri, "base64").toString();
        const response = await this.resolver.resolve(domainName, uri);

        res.json(response);
      } catch (error) {
        logger.error(error.message);
        // Set content-type to text/plain to prevent XSS attacks.
        res.status(400).contentType("text/plain; charset=utf-8").send(error.message);
      }
    });
  }

  /**
   * Starts the HTTP server
   *
   * @param {number} port
   * @param {string} host
   */
  start(port, host = "0.0.0.0") {
    this.server = this.app.listen(port, host, (error) => {
      if (error) throw error;

      logger.info(`Server listening at http://${host}:${port}`);
    });
  }
}

module.exports = {
  Server,
};
