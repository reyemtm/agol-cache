const fs = require("fs");
const ora = require('ora');
const env = require('dotenv').config().parsed;
const rax = require('retry-axios');
const axios = require("axios")
rax.attach();

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
    attachments: (!options || !options.attachments) ? false : true,
    debug: (options && options.debug) ? true : false,
    esriIdField: (!options || !options.esriIdField) ? false : options.esriIdField,
    filter: (!options || !options.filter) ? false : options.filter,
    folder: (!options || !options.folder) ? "geojson-cache" : options.folder,
    prefix: (!options || !options.prefix) ? "" : options.prefix,
    token: (env && env.TOKEN) ? env.TOKEN : null,
    // layerByLayer: (!options || !options.layerByLayer) ? false : true
  }
  opts.layerByLayer = false;
  if (opts.debug) {
    console.log("\n", opts, "\n")
  }

  if (!fs.existsSync(opts.folder)) fs.mkdirSync(opts.folder)

  getFeatureService(featureServiceUrl, opts)
  .then(async service => {
    if (service.error) {
      console.log(service);
      return
    }
    const layers = getLayers(service);

    if (opts.debug) console.log("layers found:" , layers);

    spinner.start()

    let total = layers.length


    if (options.layerByLayer) {

      //layer by layer method, slower by could be useful for tracking down timeout errors
      for (let i = 0; i < layers.length; i++) {
        let l = layers[i];
        if (opts.filter) {
          if (!l.name.includes(opts.filter)) {
            total = total - 1;
            continue
          }
        }
        try {
          await getFeatures(`${featureServiceUrl}${l.id}/`, l.name, opts, l.id);
          total = total - 1;
        }catch(error) {
          if (opts.debug) console.log(error);
          total = total - 1;
          continue
        }
        if (!total) {
          if (callback && isFunction(callback)) {
            callback(layers)
          }else{
            throw new Error({Error: "callback is not a function"});
          }
        }
      }
    }else{
      layers.forEach(async l => {
        if (opts.filter) {
          if (!l.name.includes(opts.filter)) {
            total = total - 1;
            return
          }
        }
        try {
          await getFeatures(`${featureServiceUrl}${l.id}/`, l.name, opts, l.id);
          total = total - 1;
        }catch(error) {
          console.log({fn: "getFeatures", error})
          total = total - 1;
        }
        if (!total) {
          if (callback && isFunction(callback)) {
            callback(layers)
          }else{
            throw new Error({Error: "callback is not a function"});
          }
        }
      })
    }
  })
}

async function getFeatureService(serviceURL, options) {
  const url = (options && options.token) ? serviceURL + "/?token=" + options.token + "&f=json" : serviceURL + "?f=json";
  let res, serviceDefinition;
  try {
    res = await axios(url, {
      timeout: 10000
    });
    serviceDefinition = await res.data;
  }catch(error) {
    if (opts.debug) console.log({fn: "getFeaturesService", error})
    return serviceDefinition = {}
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

async function getFeatures(layerUrl, layerName, opts, id) {
  let idFieldObject = [];

  // let getAttachments = opts.attachments;
  if (!opts.esriIdField || opts.hasAttachments) {
    try {

      const query = await axios(`${layerUrl}?f=pjson&token=${(opts.token) ? `${opts.token}` : ""}`, {
        timeout: 10000
      });

      const queryRes = await query.data;

      if (!queryRes || !queryRes.fields || !queryRes.fields.length) {
        throw new Error("No fields found!")
      }

      if (!queryRes.hasAttachments) {
        getAttachments = false
      }

      idFieldObject = queryRes.fields.filter(f => {
        return f.type === "esriFieldTypeOID"
      })

      if (!idFieldObject.length) {
        throw new Error("No esriFieldTypeOID field found!")
      }
    }catch(error) {
      if (opts.debug) console.log({fn: "getFeatures", error})
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
    let geojson = {};
    try {
      geojson = await queryAGOL(layerUrl, idField, ids.start, ids.end, opts);
    }catch(error) {
      if (opts.debug) console.log(error)
      completed = true
    }

    if (!geojson || !geojson.features || !geojson.features.length) {
      completed = true;
    }

    if (geojson && geojson.features) {
      geojson.features.map(f => {
        features.push(f)
      });
    }

    ids.start = ids.start + max + 1;
    ids.end = ids.end + max + 1;

  }

  const finalGeoJSON = {
    type: "FeatureCollection",
    agolLayerId: id,
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
  // const queryNumber = Math.floor(start / 1000) + 1
  // if (opts.debug) console.log({queryNumber, start, url})
  
  const retryOptions = {
    retry: 5,
    noResponseRetries: 5,
    retryDelay: 100,
    backoffType: 'static',
    onRetryAttempt: err => {
      const cfg = rax.getConfig(err);
      console.log(`Retry attempt ${Number(cfg.currentRetryAttempt)}`);
    }
  }

  let data = {};
  try {
    const res = await axios({
      url: query, 
      timeout: 10000,
      raxConfig: retryOptions
    });
    data = await res.data;
  }catch(error) {
    if (opts.debug) console.log({fn: "queryAGOL", error})
    return data
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