# ArcGIS Online Feature Service Layers to GeoJSON

```bash
npx agol2geojson serviceURL TOKEN
```

The `npx` script will download all features to an `export` folder in the current directory and prefix all files with `export_`. All other config options are set to their defaults.

---

Download all layers from an ArcGIS Online Feature Service or Map Service to GeoJSON. The tool will attempt to identify the Esri OID field or one can be provided. More details on the background and functionality can be found in the link below.

> [Exporting AGOL Feature Services](https://www.getbounds.com/blog/exporting-agol-feature-services/)
Using NodeJS and Batches to Transform an ArcGIS Online Feature Service to GeoJSON

```JavaScript
const cache = require('agol-cache')

const url = 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/ArcGIS/rest/services/NTF_Members_and_NR_Listings/FeatureServer/'

//can use async/aawit with layerByLayer: true

cache.featureServiceToGeoJSON(url, { 
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
  token: null //token to use for secured routes, taken from .env TOKEN variable,
  steps: 1000 //number of features queried on each request
}, (layers) => {
  // console.log('output ' + layers.length + ' layers')
});
```
## .env file example

```JavaScript
TOKEN=validtokenstring
```

## Changelog

### Version 1.2.0

- Added `npx` functionality:
- Added a decoder for coded domains based on the layer config `field.domain.codedValues` field.

```
npx agol2geojson serviceURL TOKEN
```

### Version 1.1.0
 - Added a function `getAllServices.js` that writes `agol-services.json` and `agol-services.csv` to the root folder containing all services for the given endpoint.
 - This function is a work in progress.

```JavaScript
const { getAllServices } = require("./lib/getAllServices.js")

const config =   {
  debug: true,
  silent: true,
  timeout: 5000,
  token: ''
};

getAllServices('https://sampleserver6.arcgisonline.com/arcgis/rest/services', config)
```
### Version 1.1.9
- Added `steps` option to limit the amount of features queried on each fetch request, which defaults to 1000. Lower this number if you get timeouts from the REST service.

### Version 1.0.2
 - Added an option to query the `json` endpoint and convert the data to GeoJSON once downloaded
 - Added small tweaks to the spinner options

### Version 1.0.0
 - Added a `config.timeout` option to set the fetch timeout
 - Added support for large GeoJSON objects thanks a pull request from [@jwoyame](https://github.com/jwoyame)
 - Fixed a bug where not all the features would download due to large gaps in the sequential `esriIdField`

### Version 0.9.0
 - `fetch` added back with additional `fetch-retry` dependency
 - timeout errors were issues on the Esri side and have been resolved
 - timeouts and attempts are set internally (5 second timeout, 5 attempts), adjust in the raw code as needed

### Version 0.7.0
 - `fetch` replaced with `axios` and `retry-axios` due to timeout errors
 - fixed an issue where not all the features were downloaded

### Version 0.6.1
 - added a filter option which will filter any layer that does not include the filter string

### Version 0.6.0
 - added the ability to download Map Services
 - now attempts to find the ``esriFieldTypeOID`` field from the service definition
 - shortened the code to just keep querying the service at 1000 feature intervals until no more features are returned

### Version 0.5.0 
 - added an option to add a token in an environment variable
 - fixed a bug where if the folder did not exist the script would error out

### Version 0.3.0
 - fixed an error where some features were downloaded twice
 - fixed an error where some features were not downloaded
 - added the ability to add a prefix to the downloaded files

## Missing Features Needing External Work via Pull Requests

- [ ] Working on the drawingInfo - renderer.
- [ ] Add the ability to add query parameters.
- [ ] Add an option to choose export format (JSON or GeoJSON)
- [x] Add the possibility to use a token for restricted services.

## Helpful Commands

```bash
ogr2ogr -f GPKG outfile.gpkg infile.geojson 
```

```bash
ogr2ogr -f MVT -dsco MINZOOM=10 -dsco MAXZOOM=14 target.mbtiles output/infile.geojson
```