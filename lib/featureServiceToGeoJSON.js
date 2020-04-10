const fetch = require("node-fetch")
const fs = require("fs");
const ora = require('ora');
const spinner = ora({
  spinner: "earth"
})

module.exports = function featureServiceToGeoJSON(featureServiceUrl, options) {
  if (featureServiceUrl.charAt(featureServiceUrl.length-1) != "/") featureServiceUrl = featureServiceUrl + "/";

  let opts = (!options || !options.folder) ? {
    folder: "geojson-cache"
  } : options;

  // console.group(opts);

  getFeatureService(featureServiceUrl)
  .then(service => {
    const layers = getLayers(service);

    console.log("layers found:" , layers)

    spinner.start('Processing')

    layers.map(l => {
      getFeatures(`${featureServiceUrl}${l.id}/`, l.name, opts);
    });

  })
}

async function getFeatureService(serviceURL) {
  const res = await fetch(serviceURL + "/?f=json")
  const serviceDefinition = await res.json();
  return serviceDefinition;
}

function getLayers(serviceDefinition) {
  let layers = [];

  serviceDefinition.layers.map(l => {
    layers.push({
      id: l.id,
      name: convertName(l.name)
    })
  })
  return layers;
}

function convertName(name) {
  return name.toLowerCase().replace(/ /g, '_').replace(/-/g, '_')
}

async function getFeatures(layerUrl, layerName, opts) {

  const statisticsOID = [
    { "statisticType": "min", "onStatisticField": "objectid", "outStatisticFieldName": "min" },
    { "statisticType": "max", "onStatisticField": "objectid", "outStatisticFieldName": "max" }
  ]

  const statisticsFID = [
    { "statisticType": "min", "onStatisticField": "fid", "outStatisticFieldName": "min" },
    { "statisticType": "max", "onStatisticField": "fid", "outStatisticFieldName": "max" }
  ]

  const urlEncodedOID = encodeURI(JSON.stringify(statisticsOID));
  const urlEncodedFID = encodeURI(JSON.stringify(statisticsFID))

  let res = await fetch(`${layerUrl}query?outStatistics=${urlEncodedOID}&f=pjson`);

  let json = await res.json()

  // console.log(JSON.stringify(json))

  let idField = "objectid";

  if (!json.features) {
    res = await fetch(`${layerUrl}query?outStatistics=${urlEncodedFID}&f=pjson`)
    json = await res.json();
    idField = "fid"
  
    // console.log(JSON.stringify(json))
  
  }

  const count = json.features[0].attributes.max;

  // console.log(count)

  const max = 999;

  const features = [];

  if (max >= count) {

    const geojson = await queryAGOL(layerUrl, idField, 0, 999);
    fs.writeFileSync(`${opts.folder}/${layerName}.geojson`, JSON.stringify(geojson));
    spinner.succeed(`Success! Wrote ${count} features to ${layerName}.geojson`);
    // console.log("wrote", count, "features to", layerName + ".geojson");

  } else {
    const queryArray = [];
    const totalQueries = (Number(count / max)).toFixed(0);

    for (let i = 1; i <= totalQueries; i++) {
      const end = max * i
      const start = end - 999;
      queryArray.push({
        start: start,
        end: end
      })
    }


    let progress = queryArray.length;

    for (let i = 0; i < queryArray.length; i++) {

      const q = queryArray[i];

      const geojson = await queryAGOL(layerUrl, idField, q.start, q.end);

      geojson.features.map(f => {
        features.push(f)
      });

      progress = progress - 1;
      if (!progress) {
        let finalGeoJSON = {
          type: "FeatureCollection",
          features: features
        }
        fs.writeFileSync(`${opts.folder}/${layerName}.geojson`, JSON.stringify(finalGeoJSON))
        // console.log("wrote", count, "features to", layerName + ".geojson");
        spinner.succeed(`Success! Wrote ${Number(count)} features to ${layerName}.geojson`);

      }

    }

  }

}

async function queryAGOL(url, idField, start, end) {
  const res = await fetch(`${url}query?where=${idField}+between+${start}+and+${end}&outFields=*&f=geojson`);
  const data = await res.json()
  return data;
}