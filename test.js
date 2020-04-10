const cache = require("./lib/featureServiceToGeoJSON.js")

const urls = [
  "https://services9.arcgis.com/IUhP9plEzDTayUVC/arcgis/rest/services/Muskingum_County_Benchmarks/FeatureServer/",
  "https://services9.arcgis.com/IUhP9plEzDTayUVC/arcgis/rest/services/Water_System_View/FeatureServer/"
];

cache(urls[1], {folder: "test"})