const cache = require("./lib/featureServiceToGeoJSON.js");
const queryAttachments = require("./lib/queryAttachments.js");
const urls = [
  "https://sampleserver6.arcgisonline.com/arcgis/rest/services/AGP/USA/MapServer",
];
// async only works with layerByLayer: true
(async () => {
  const layers = await cache.featureServiceToGeoJSON(urls[0],
    {
      attachments: false, //whether or not to check the service for attachments
      debug: false, //debugging is now on be default, which just means it writes to a log file, and the console logger is off if silent is set to false
      esriIdField: null, //field to use for the esriIdField, used in the query parameters, if NULL it is determined by the service response
      // filter: "counties", //string to filter layer names
      folder: "./export", //folder to write the log file and geojson cache, relative to working directory or absolute path
      format: "json", //json or GeoJSON - json downloads the raw Esri JSON format then converts to GeoJSON (BETA), try this if using the GeoJSON endpoint fails
      layerByLayer: true, //use await on each layer, slower but helpful for debugging and more reliable
      prefix: "export_", //prefix to add to the start of layer names
      silent: false, //turn off viewing winston log messages and spinner "info" messages in the console
      timeout: 5000, //default is 5000, increase as needed
      token: null, //token to use for secured routes, taken from .env TOKEN variable
      fields: ["*"], //array of fields to use in the query params outField=
      steps: 1000, //number of features to request per query, default is 1000, max is 1000
    },
    // getAttachments
  );
  // console.log(layers);
})()

function getAttachments(layers) {
  console.log("\nThe callback function has access to the layers object:\n");
  console.log(layers);
  process.exit();
  // queryAttachments("https://services9.arcgis.com/IUhP9plEzDTayUVC/ArcGIS/rest/services/Water_Utilities_View_II/FeatureServer/", "./geojson-cache")
}
