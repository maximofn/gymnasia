const { withGradleProperties } = require("expo/config-plugins");

// AsyncStorage 2.x defaults to 6 MiB on Android. The main store, its recovery
// snapshot and the other local partitions share that quota. Increase the cap
// in generated native projects without replacing or migrating the database.
module.exports = function withAsyncStorageCapacity(config) {
  return withGradleProperties(config, (config) => {
    config.modResults = config.modResults.filter((item) =>
      item.type !== "property" || item.key !== "AsyncStorage_db_size_in_MB");
    config.modResults.push({
      type: "property",
      key: "AsyncStorage_db_size_in_MB",
      value: "64",
    });
    return config;
  });
};
