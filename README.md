# ArcGIS Online Feature Serivce Layers to GeoJSON

**Work in progress, pull requests welcome!**

A simple script to download all layers from an ArcGIS Online Feature Service to GeoJSON. This works with ``OBJECTID`` or ``FID`` as the unique identifier field. More details on the background and functionality can be found in the link below.

> [Exporting AGOL Feature Services](https://www.getbounds.com/blog/exporting-agol-feature-services/)
Using NodeJS and Batches to Transform an ArcGIS Online Feature Service to GeoJSON

```JavaScript
const cache = require('agol-cache')

const urls = [
  'https://services9.arcgis.com/featureSerivceID/arcgis/rest/services/featureServiceName/FeatureServer/'
];

cache.featureServiceToGeoJSON(urls[0], {
  folder: 'geojson-cache',
  prefix: 'agol_'
}) // setting the folder option and prefix is optional, default is geojson-cache in the root folder
```

## Changelog

### Version 0.5.0 
 - added option to add a token in an environment variable
 - fixed a bug where if the folder did not exist the script would error out

#### .env file example

```JavaScript
TOKEN=validtokenstring
```

### Version 0.3.0
 - fixed an error where some features were downloaded twice
 - fixed an error where some features were not downloaded
 - adds the ability to add a prefix to the downloaded files

## Missing Features Needing External Work via Pull Requests

- [ ] Add the ability to add query parameters.
- [ ] Add an option to choose export format (JSON or GeoJSON)
- [x] Add the possibility to use a token for restricted services.