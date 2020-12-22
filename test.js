const cache = require("./lib/featureServiceToGeoJSON.js")
const queryAttachments = require("./lib/queryAttachments.js")

const urls = [
  "https://utility.arcgis.com/usrsvcs/servers/76f8f4bd06084d4d9ad4efed1db30590/rest/services/zanesville_utility/MapServer/",
  "https://services9.arcgis.com/IUhP9plEzDTayUVC/arcgis/rest/services/Muskingum_County_Benchmarks/FeatureServer/",
  "https://services9.arcgis.com/IUhP9plEzDTayUVC/arcgis/rest/services/Water_Utilities_View_II/FeatureServer/",
  "https://services9.arcgis.com/IUhP9plEzDTayUVC/arcgis/rest/services/Water_Utilities/FeatureServer/",
  "https://services9.arcgis.com/IUhP9plEzDTayUVC/arcgis/rest/services/Zanesville_Brownfield_Map_WFL1/FeatureServer/"
];

cache.featureServiceToGeoJSON(urls[2], {
  attachments: true, //wheher or not to check the service for attachments, overridden by leaving esriIdField blank
  debug: true, //debugging is now on be default, which just means it writes to a log file, and the console if silent is set to false 
  esriIdField: "", //field to use for the esriIdField, used in the query parameters
  filter: "", //string to filter layer names
  folder: "geojson-cache", //folder to write the log file and geojson cache, relative to working directory or absolute path
  layerByLayer: false, //use await on each layer, helpful for debugging
  prefix: "", //prefix to add to the start of layer names
  silent: true, //turn off viewing log messages in the console, disabled if debug is set to false, however spinner is always on
  token: null //token to use for secured routes, taken from .env TOKEN variable
}, getAttachments);

function getAttachments() {
  console.log("Attempting to query attachments.");
  process.exit()
  // queryAttachments("https://services9.arcgis.com/IUhP9plEzDTayUVC/ArcGIS/rest/services/Water_Utilities_View_II/FeatureServer/", "./geojson-cache")  
}