const express = require("express");
const { Resolver } = require("./resolver");

class Server {
  constructor() {
    this.app = express();
    this.resolver = new Resolver();
    this.configure();
  }

  configure() {
    this.app.get("/dnslink/:name", async (req, res) => {
      const domainName = req.params.name;

      try {
        this.resolver.validateRequest(req);

        const { skylink, sponsor } = await this.resolver.resolve(domainName);

        res.json({ skylink, sponsor });
      } catch (error) {
        res.status(400).send(error.message);
      }
    });
  }

  start(port, host) {
    this.server = this.app.listen(port, (host = "0.0.0.0"), (error) => {
      if (error) throw error;

      console.info(`Server listening at http://${host}:${port}`);
    });
  }
}

module.exports = {
  Server,
};
