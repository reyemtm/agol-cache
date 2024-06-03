const cache = require("./lib/featureServiceToGeoJSON.js");
// const queryAttachments = require("./lib/queryAttachments.js");
// const supportedFormats = require("./lib/gdalVectorExtensions.js");
const { existsSync, mkdirSync, rmSync } = require("fs");
const urls = ["https://sampleserver6.arcgisonline.com/arcgis/rest/services/AGP/USA/MapServer"];
// const formats = JSON.parse(require("fs").readFileSync("./lib/formats.json"));
const formats = ["GeoJSON", "gpkg"];

(async () => {
  if (!existsSync("./test")) {
    mkdirSync("./test");
  } else {
    rmSync("./test", { recursive: true });
    mkdirSync("./test");
  }
  for (let i = 0; i < formats.length; i++) {
    test("Testing " + formats[i], async () => {
      await cache.featureServiceToGeoJSON(
        urls[0],
        {
          attachments: false, //whether or not to check the service for attachments
          debug: true, //debugging is now on be default, which just means it writes to a log file, and the console logger is off if silent is set to false
          esriIdField: null, //field to use for the esriIdField, used in the query parameters, if NULL it is determined by the service response
          filter: "states", //string to filter layer names
          folder: "./test", //folder to write the log file and geojson cache, relative to working directory or absolute path
          format: "json", //json or GeoJSON - json downloads the raw Esri JSON format then converts to GeoJSON (BETA), try this if using the GeoJSON endpoint fails
          layerByLayer: true, //use await on each layer, slower but helpful for debugging and more reliable
          prefix: "export_", //prefix to add to the start of layer names
          silent: false, //turn off viewing winston log messages and spinner "info" messages in the console
          timeout: 5000, //default is 5000, increase as needed
          token: null, //token to use for secured routes, taken from .env TOKEN variable
          fields: ["*"], //array of fields to use in the query params outField=
          steps: 1000, //number of features to request per query, default is 1000, max is 1000
          outputFormat: formats[i], //output format, default is geojson - see supportedFormats in lib/gdalVectorExtensions.js
          parseDomains: false, //parse coded value domains and replace values with descriptions
        },
        () => {
          // expect(existsSync(`./test/export_highways${formats[formats[i].toLowerCase()]}`)).toBe(
          //   true
          // );
        }
      );
    });
  }
  // test("Total exports", () => {
  //   const files = require("fs").readdirSync("./test");
  //   expect(files.length).toBe(formats.length + 3);
  // });
  // for (let i = 0; i < formats.length; i++) {
  //   test("Testing " + formats[i], () => {
  //     expect(existsSync(`./test/export_highways${supportedFormats[formats[i].toLowerCase()]}`)).toBe(true);
  //   });
  // }
})();
