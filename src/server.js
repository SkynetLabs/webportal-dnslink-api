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
