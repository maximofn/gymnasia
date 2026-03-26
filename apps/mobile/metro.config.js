const { getDefaultConfig } = require("expo/metro-config");
const fs = require("fs");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Dev-only middleware: persist store to a local JSON file so web data
// survives dev-server restarts and browser refreshes.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    return (req, res, next) => {
      const storePath = path.join(__dirname, ".dev-store.json");

      if (req.url === "/dev-store" && req.method === "GET") {
        try {
          if (fs.existsSync(storePath)) {
            const data = fs.readFileSync(storePath, "utf-8");
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.end(data);
          } else {
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.statusCode = 404;
            res.end("{}");
          }
        } catch {
          res.statusCode = 500;
          res.end("{}");
        }
        return;
      }

      if (req.url === "/dev-store" && req.method === "POST") {
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", () => {
          try {
            fs.writeFileSync(storePath, body, "utf-8");
            res.setHeader("Access-Control-Allow-Origin", "*");
            res.statusCode = 200;
            res.end("ok");
          } catch {
            res.statusCode = 500;
            res.end("error");
          }
        });
        return;
      }

      // Handle CORS preflight for /dev-store
      if (req.url === "/dev-store" && req.method === "OPTIONS") {
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type");
        res.statusCode = 204;
        res.end();
        return;
      }

      return middleware(req, res, next);
    };
  },
};

module.exports = config;
