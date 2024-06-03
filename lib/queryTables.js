const fetch = require("fetch-retry")(require("node-fetch"), {
  retryOn: function (attempt, error, response) {
    if (attempt < 10 && error) {
      spinner.fail("Failed to fetch.");
      spinner.start();
      spinner.warn("Retry attempt " + (attempt + 1));
      logger.warn(`Retry attempt ${attempt + 1} ${JSON.stringify(error)}`);
      spinner.start();
      return true;
    }
    return false;
    // throw new Error("A fetch timeout error occurred!", attempt, error)
  },
});

const tableURL =
  "https://services2.arcgis.com/MlJ0G8iWUyC7jAmu/ArcGIS/rest/services/OhioStatewidePacels_full_view/FeatureServer";
(async () => {
  async function getFeatureService(serviceURL, opts) {
    const url =
      opts && opts.token
        ? serviceURL + "/?token=" + opts.token + "&f=json"
        : serviceURL + "?f=json";
    try {
      const res = await fetch(url, {
        timeout: opts && opts.timeout ? opts.timeout : 10000,
      });
      return await res.json();
    } catch (error) {
      error["function"] = "getFeatureService";
      console.error(error);
      return false;
    }
  }
  const service = await getFeatureService(tableURL);
  console.log(service);
})();
