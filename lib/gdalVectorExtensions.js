const supportedFormats = {
  gpkg: '.gpkg',
  flatgeobuf: '.fgb',
  csv: '.csv',
  gpx: '.gpx',
  sqlite: '.sqlite',
  'mapinfo file': '.tab', //not tested - does not open directly in QGIS
  pgdump: '.sql', //not tested - does not open directly in QGIS
  pdf: '.pdf',
  geojsonseq: '.geojsonseq',
  dxf: '.dxf',
  // mbtiles: '.mbtiles', //not working
  kml: '.kml',
  'esri shapefile': '.shp',
  geojson: '.geojson',

}

module.exports = supportedFormats;

/*
CSV, DGN, DXF, ESRI Shapefile, FlatGeobuf, GML, GPKG, GPSBabel, GPX, GeoJSON, GeoJSONSeq, GeoRSS, Geoconcept, JML, KML, MBTiles, MVT, MapInfo File, MapML, Memory, ODS, OGR_GMT, PCIDSK, PDS4, S57, SQLite/Spatialite, VDV, VICAR, WAsP, XLSX
*/
