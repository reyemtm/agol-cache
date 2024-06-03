const initGdalJs = require("gdal3.js/node");
const { writeFileSync } = require("fs");
(async () => {
  const formats = [];
  const Gdal = await initGdalJs();
  Object.values(Gdal.drivers.vector).forEach((driver) => {
    if (driver.isWritable && driver.shortName !== "GeoJSON") {
      formats.push(driver.shortName.toLowerCase());
    }
  });
  formats.push("geojson");
  writeFileSync("./lib/formats.json", JSON.stringify(formats,0,2));
})();