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
  filter: false //optional layer filter string,
  folder: 'geojson-cache', //optional, default is geojson-cache in the root folder
  prefix: 'agol_', //optional
  esriIdField: false //false or string, optional, the tool will attempt to determine this field automatially
  debug: false //optional, if true shows some more information
})
```
## .env file example

```JavaScript
TOKEN=validtokenstring
```

## Changelog

**Could use help in cleaning up error handling with node-fetch.**

### Version 0.6.1
 - added a filter option which will filter any layer that does not include the filter string

### Version 0.6.0
 - added the ability to download Map Services
 - now attempts to finds the ``esriFieldTypeOID`` field from the service definition
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