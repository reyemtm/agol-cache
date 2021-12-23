const cache = require("./lib/featureServiceToGeoJSON.js")
const queryAttachments = require("./lib/queryAttachments.js")

//NOTE the first URL will error out, so it provides a good test case.
const urls = [
  "https://partnerships.nationalmap.gov/arcgis/rest/services/USGSLidarProjects/MapServer/",
  "https://sampleserver6.arcgisonline.com/arcgis/rest/services/AGP/Hurricanes/MapServer",
  "https://sampleserver6.arcgisonline.com/arcgis/rest/services/AGP/USA/MapServer"
];

cache.featureServiceToGeoJSON(urls[2], {
  attachments: false, //whether or not to check the service for attachments
  debug: false, //debugging is now on be default, which just means it writes to a log file, and the console logger is off if silent is set to false 
  esriIdField: "", //field to use for the esriIdField, used in the query parameters, if NULL it is determined by the service response
  filter: "", //string to filter layer names
  folder: './geojson-cache', //folder to write the log file and geojson cache, relative to working directory or absolute path
  format: "json", //json or GeoJSON - json downloads the raw Esri JSON format then converts to GeoJSON (BETA), try this if using the GeoJSON endpoint fails
  layerByLayer: false, //use await on each layer, slower but helpful for debugging
  prefix: "test_", //prefix to add to the start of layer names
  silent: true, //turn off viewing winston log messages and spinner "info" messages in the console
  timeout: 2000, //default is 5000, increase as needed
  token: null //token to use for secured routes, taken from .env TOKEN variable
}, getAttachments);

function getAttachments(layers) {
  console.log("\nThe callback function has access to the layers object:\n");
  console.log(layers)
  process.exit()
  // queryAttachments("https://services9.arcgis.com/IUhP9plEzDTayUVC/ArcGIS/rest/services/Water_Utilities_View_II/FeatureServer/", "./geojson-cache")  
}