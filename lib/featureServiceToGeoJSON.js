const fetch = require("node-fetch")
const fs = require("fs");
const ora = require('ora');
const env = require('dotenv').config().parsed;
const spinner = ora({
  spinner: "earth"
})

/**
 * 
 * @param {string} featureServiceUrl 
 * @param {object} options 
 * @param {function} callback 
 */
function featureServiceToGeoJSON(featureServiceUrl, options, callback) {
  if (featureServiceUrl.charAt(featureServiceUrl.length-1) != "/") featureServiceUrl = featureServiceUrl + "/";

  const opts = {
    folder: (!options || !options.folder) ? "geojson-cache" : options.folder,
    prefix: (!options || !options.prefix) ? "" : options.prefix,
    token: (env && env.TOKEN) ? env.TOKEN : null
  }

  console.log("\n", opts, "\n")

  if (!fs.existsSync(opts.folder)) fs.mkdirSync(opts.folder)

  getFeatureService(featureServiceUrl, opts)
  .then(service => {
    const layers = getLayers(service);

    console.log("layers found:" , layers);

    spinner.start('Processing')

    let total = layers.length

    layers.forEach(async l => {
      await getFeatures(`${featureServiceUrl}${l.id}/`, l.name, opts);
      total = total - 1;
      if (!total) {
        if (callback && isFunction(callback)) callback(layers)
      }
    });

  })
}

async function getFeatureService(serviceURL, options) {
  const url = (options && options.token) ? serviceURL + "/?token=" + options.token + "&f=json" : serviceURL + "/?f=json"
  const res = await fetch(url)
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

  let res = await fetch(`${layerUrl}query?outStatistics=${urlEncodedOID}&f=pjson&token=${(opts.token) ? `${opts.token}` : ""}`);

  let json = await res.json()

  // console.log(JSON.stringify(json))

  let idField = "objectid";

  if (!json.features) {
    res = await fetch(`${layerUrl}query?outStatistics=${urlEncodedFID}&f=pjson&token=${(opts.token) ? `${opts.token}` : ""}`)
    json = await res.json();
    idField = "fid"
  
    // console.log(JSON.stringify(json))
  
  }

  const count = json.features[0].attributes.max;

  const max = 999;

  const features = [];

  if (max >= count) {

    const geojson = await queryAGOL(layerUrl, idField, 0, 999, opts);
    fs.writeFileSync(`${opts.folder}/${opts.prefix}${layerName}.geojson`, JSON.stringify(geojson));
    spinner.succeed(`Success! Wrote ${count} features to ${opts.prefix}${layerName}.geojson`);
    // console.log("wrote", count, "features to", layerName + ".geojson");

  } else {
    const queryArray = [];
    const totalQueries = Math.ceil(Number(count / max));

//     console.log('\n', layerName, totalQueries, count)

    for (let i = 1; i <= totalQueries; i++) {
      let end = max * i
      let start = end - 999;
      queryArray.push({
        start: start,
        end: end - 1
      })
    }

//     console.log(queryArray)

    let progress = queryArray.length;

    for (let i = 0; i < queryArray.length; i++) {

      const q = queryArray[i];

      const geojson = await queryAGOL(layerUrl, idField, q.start, q.end, opts);

      geojson.features.map(f => {
        features.push(f)
      });

      progress = progress - 1;
      if (!progress) {
        let finalGeoJSON = {
          type: "FeatureCollection",
          features: features
        }
        fs.writeFileSync(`${opts.folder}/${opts.prefix}${layerName}.geojson`, JSON.stringify(finalGeoJSON))
        // console.log("wrote", count, "features to", layerName + ".geojson");
        spinner.succeed(`Success! Wrote ${Number(count)} features to ${opts.prefix}${layerName}.geojson`);

      }

    }

  }

}

async function queryAGOL(url, idField, start, end, opts) {
  const res = await fetch(`${url}query?where=${idField}+between+${start}+and+${end}&outFields=*&f=geojson&token=${(opts.token) ? `${opts.token}` : ""}`);
  const data = await res.json()
  return data;
}

/*stack overflow https://stackoverflow.com/questions/5999998/check-if-a-variable-is-of-function-type*/
function isFunction(fn) {
  return fn && {}.toString.call(fn) === '[object Function]';
}

module.exports = {
  featureServiceToGeoJSON,
  getFeatureService,
  getLayers
}
