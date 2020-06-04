# ArcGIS Online Feature Serivce Layers to GeoJSON

**Work in progress, pull requests welcome!**

A simple script to download all layers from an ArcGIS Online Feature Service to GeoJSON. This works with ``OBJECTID`` or ``FID`` as the unique identifier field. More details on the background and functionality here - 

[https://www.getbounds.com/blog/exporting-agol-feature-services/](Exporting AGOL Feature Services)

> Inspired by this blog post - https://blog.cartong.org/2019/03/29/harvesting-large-quantity-data-from-arcgis-rest-services-using-tool/

```JavaScript
const cache = require('agol-cache')

const urls = [
  'https://services9.arcgis.com/featureSerivceID/arcgis/rest/services/featureServiceName/FeatureServer/'
];

cache(urls[0], {folder: 'geojson-cache'}) // setting the folder option is optional, default is geojson-cache in the root folder
```

## Possible Improvements

- [ ] Add the possibility to use a token for restricted services.
- [ ] Add the ability to add query parameters.
- [ ] Add an option to choose export format (JSON or GeoJSON)
