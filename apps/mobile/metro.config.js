const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const {
  createDevStoreMiddleware,
  resolveDevStorePath,
} = require("./dev-store/middleware.cjs");

const config = getDefaultConfig(__dirname);

// Dev-only middleware: persist store to a local JSON file so web data
// survives dev-server restarts and browser refreshes.
config.server = {
  ...config.server,
  enhanceMiddleware: (middleware) => {
    const storePath = resolveDevStorePath(path.join(__dirname, ".dev-store.json"));
    const devStoreMiddleware = createDevStoreMiddleware({ storePath });
    return (req, res, next) => {
      return devStoreMiddleware(req, res, () => middleware(req, res, next));
    };
  },
};

module.exports = config;
