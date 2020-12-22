# ArcGIS Online Feature Serivce Layers to GeoJSON

**Work in progress, pull requests welcome!**

A simple script to download all layers from an ArcGIS Online Feature Service or Map Service to GeoJSON. The tool will attempt to identify the Esri OID field or one can be provided. More details on the background and functionality can be found in the link below.

> [Exporting AGOL Feature Services](https://www.getbounds.com/blog/exporting-agol-feature-services/)
Using NodeJS and Batches to Transform an ArcGIS Online Feature Service to GeoJSON

```JavaScript
const cache = require('agol-cache')

const urls = [
  'https://services9.arcgis.com/featureSerivceID/arcgis/rest/services/featureServiceName/FeatureServer/'
];

cache.featureServiceToGeoJSON(urls[0], {
    attachments: true, //wheher or not to check the service for attachments
    debug: true, //debugging is now on be default, which just means it writes to a log file, and the console if silent is set to false 
    esriIdField: "", //field to use for the esriIdField, used in the query parameters
    filter: "", //string to filter layer names
    folder: "geojson-cache", //folder to write the log file and geojson cache, relative to working directory or absolute path
    layerByLayer: false, //use await on each layer, helpful for debugging
    prefix: "", //prefix to add to the start of layer names
    silent: true, //turn off viewing log messages in the console, disabled if debug is set to false, however spinner is always on
    token: null //token to use for secured routes, taken from .env TOKEN variable
})
```
## .env file example

```JavaScript
TOKEN=validtokenstring
```

## Changelog

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

- [ ] Add the ability to add query parameters.
- [ ] Add an option to choose export format (JSON or GeoJSON)
- [x] Add the possibility to use a token for restricted services.