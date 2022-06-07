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
        res.status(400).contentType("text/plain; charset=utf-8").send(error.message);
      }
    });
  }

  start(port, host = "0.0.0.0") {
    this.server = this.app.listen(port, host, (error) => {
      if (error) throw error;

      console.info(`Server listening at http://${host}:${port}`);
    });
  }
}

module.exports = {
  Server,
};
