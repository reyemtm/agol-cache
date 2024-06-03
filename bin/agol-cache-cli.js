#!/usr/bin/env node
const cache = require("../lib/featureServiceToGeoJSON.js");
const supportedFormats = require("../lib/gdalVectorExtensions.js");
const service = process.argv[2];
const initGdalJs = require("gdal3.js/node");

if (!service) throw new Error("Please provide a service URL");

(async () => {
  const Gdal = await initGdalJs();
  const Formats = [];
  const formats = [];
  Object.values(Gdal.drivers.vector).forEach((driver) => {
    if (driver.isWritable) {
      formats.push(driver.shortName.toLowerCase());
      Formats.push(driver.shortName);
    }
  });
  // const formats = Object.keys(supportedFormats);
  let outputFormat = null;
  if (process.argv[3] && formats.includes(process.argv[3].toLowerCase())) {
    outputFormat = process.argv[3];
  }

  const token = process.argv[3] && !outputFormat ? process.argv[3] :
    process.argv[4] && outputFormat ? process.argv[4] : null;

  await cache.featureServiceToGeoJSON(
    service,
    {
      attachments: false, //whether or not to check the service for attachments
      debug: false, //debugging is now on be default, which just means it writes to a log file, and the console logger is off if silent is set to false
      esriIdField: null, //field to use for the esriIdField, used in the query parameters, if NULL it is determined by the service response
      filter: null, //string to filter layer names
      folder: "./export", //folder to write the log file and geojson cache, relative to working directory or absolute path
      format: "json", //json or GeoJSON - json downloads the raw Esri JSON format then converts to GeoJSON (BETA), try this if using the GeoJSON endpoint fails
      layerByLayer: true, //use await on each layer, slower but helpful for debugging
      prefix: "export_", //prefix to add to the start of layer names
      silent: false, //turn off viewing winston log messages and spinner "info" messages in the console
      timeout: 5000, //default is 5000, increase as needed
      token: token || null, //token to use for secured routes, taken from .env TOKEN variable
      fields: ["*"], //array of fields to use in the query params outField=
      steps: 1000, //number of features to request per query, default is 1000, max is 1000
      outputFormat: outputFormat || "geojson", //output format, default is geojson - see supportedFormats in lib/gdalVectorExtensions.js
    }
    // callback for getAttachments
  );
})();
