const cache = require("./lib/featureServiceToGeoJSON.js")

const urls = [
  "https://services9.arcgis.com/IUhP9plEzDTayUVC/arcgis/rest/services/Water_System_View/FeatureServer/"
];

cache(urls[0])