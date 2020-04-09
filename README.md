# ArcGIS Online Feature Serivce Layers to GeoJSON

A simple script to download all layers from an ArcGIS Online Feature Service to GeoJSON.

> Inspired by this blog post - https://blog.cartong.org/2019/03/29/harvesting-large-quantity-data-from-arcgis-rest-services-using-tool/

```JavaScript
const cache = require("./lib/featureServiceToGeoJSON.js")

const urls = [
  "https://services9.arcgis.com/featureSerivceID/arcgis/rest/services/featureServiceName/FeatureServer/"
];

cache(urls[0])
```

## Possible Improvements

- [ ] Add the possibility to use a token for restricted services.
- [ ] Add the ability to add query parameters.
- [ ] Add an option to choose export format (JSON or GeoJSON)