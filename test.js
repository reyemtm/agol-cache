const cache = require("./lib/featureServiceToGeoJSON.js")

const urls = [
  "https://services9.arcgis.com/IUhP9plEzDTayUVC/arcgis/rest/services/Muskingum_County_Benchmarks/FeatureServer/"
];

cache(urls[0])