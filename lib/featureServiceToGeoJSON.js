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

  const featureServer = (!featureServiceUrl.includes("MapServer") && featureServiceUrl.includes("FeatureServer")) ? true : false;
  const mapServer = (featureServiceUrl.includes("MapServer") && !featureServiceUrl.includes("FeatureServer")) ? true : false;

  if (!mapServer && !featureServer) {
    throw new Error("Error, bad url formation");
  }

  const opts = {
    folder: (!options || !options.folder) ? "geojson-cache" : options.folder,
    prefix: (!options || !options.prefix) ? "" : options.prefix,
    token: (env && env.TOKEN) ? env.TOKEN : null,
    esriIdField: (!options || !options.esriIdField) ? false : options.esriIdField,
    debug: (options && options.debug) ? true : false
  }

  if (opts.debug) {
    console.log("\n", opts, "\n")
  }

  if (!fs.existsSync(opts.folder)) fs.mkdirSync(opts.folder)

  getFeatureService(featureServiceUrl, opts)
  .then(service => {
    // console.log(service)
    const layers = getLayers(service);

    if (opts.debug) {
      console.log("layers found:" , layers);
    }

    spinner.start('Processing')

    let total = layers.length

    layers.forEach(async l => {
      try {
        await getFeatures(`${featureServiceUrl}${l.id}/`, l.name, opts);
        total = total - 1;
        if (!total) {
          if (callback && isFunction(callback)) callback(layers)
        }
      }catch(error) {
        console.log(error)
      }
    })

  })
}

async function getFeatureService(serviceURL, options) {
  const url = (options && options.token) ? serviceURL + "/?token=" + options.token + "&f=json" : serviceURL + "/?f=json";
  let res, serviceDefinition;
  try {
    res = await fetch(url);
    serviceDefinition = await res.json();
  }catch(error) {
    serviceDefinition = error.message
  }
  return serviceDefinition
}

function getLayers(serviceDefinition) {
  let layers = [];

  serviceDefinition.layers.map(l => {
    if (!l.subLayerIds) {
      layers.push({
        id: l.id,
        name: convertName(l.name)
      })
    }
  })
  return layers;
}

function convertName(name) {
  return name.toLowerCase().replace(/ /g, '_').replace(/-/g, '_')
}

async function getFeatures(layerUrl, layerName, opts) {

  let idFieldObject = [];

  if (!opts.esriIdField) {
    try {
      const query = await fetch(`${layerUrl}/?f=pjson&token=${(opts.token) ? `${opts.token}` : ""}`);
      const queryRes = await query.json();
    
      if (!queryRes || !queryRes.fields || !queryRes.fields.length) {
        throw new Error("No fields found!")
      }
      idFieldObject = queryRes.fields.filter(f => {
        return f.type === "esriFieldTypeOID"
      })

      if (!idFieldObject.length) {
        throw new Error("No esriFieldTypeOID field found!")
      }
    }catch(error) {

      throw new Error(error.message)
    }
  }
  const idField = (!opts.esriIdField) ? idFieldObject[0].name.toLowerCase() : opts.esriIdField;

  let completed = false

  const max = 999;

  const features = [];
  const ids = {
    start: 0,
    end: max
  }

  while (!completed) {
    const geojson = await queryAGOL(layerUrl, idField, ids.start, ids.end, opts);

    if (!geojson.type) {
      throw new Error("Invalid GeoJSON found!\n", geojson)
    }

    if (!geojson || !geojson.features || !geojson.features.length) {
      completed = true;
    }

    geojson.features.map(f => {
      features.push(f)
    });

    ids.start = ids.start + max + 1;
    ids.end = ids.end + max;

  }

  const finalGeoJSON = {
    type: "FeatureCollection",
    features: features
  }

  if (!features.length) {
    spinner.warn(`Warning! 0 features found, skipping ${opts.prefix}${layerName}`);
  }else{
    fs.writeFileSync(`${opts.folder}/${opts.prefix}${layerName}.geojson`, JSON.stringify(finalGeoJSON))
    spinner.succeed(`Success! Wrote ${Number(finalGeoJSON.features.length)} features to ${opts.prefix}${layerName}.geojson`);
  }

}

async function queryAGOL(url, idField, start, end, opts) {
  const query = `${url}query?where=${idField}+between+${start}+and+${end}&outFields=*&f=geojson&token=${(opts.token) ? `${opts.token}` : ""}`;
  let data = {};
  try {
    const res = await fetch(query);
    data = await res.json()
  }catch(error) {
    throw new Error(error.message)
  }
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
