const fs = require("fs");
const { default: fetch } = require("node-fetch");
const path = require("path");

/**
 * This is a quick fix to add the first attachment url of a feature service to the geojson properties. It is a custom solution and would likely take some work to become a universal tool as many of the values are hard-coded - see comments below.
 * @param {String} serviceUrl 
 * @param {String} inFolder folder of GeoJSON files to loop through
 * @param {String} outFolder unused folder to store downloaded attachments
 */

module.exports = async function queryAttachments(serviceUrl, inFolder, outFolder) {
  const files = fs.readdirSync(path.join(inFolder));

  files.map(async f => {
    const geojson = JSON.parse(fs.readFileSync(path.join(inFolder, f)));
    let hasAttachments = false;
    const ids = [];

    for (let i = 0; i < geojson.features.length; i++) {
      let g = geojson.features[i]

      //TODO IS THE ATTACHMENT FIELD ALWAYS CALLED ATTACHMENT AND IS IT ALWAYS YES NO
      if (g.properties["ATTACHMENT"] && g.properties["ATTACHMENT"] === "Yes") {
        ids.push(g.properties["OBJECTID"]);
        hasAttachments = true
      }
    }

    //TODO THIS IS HARD CODED TO USE OBJECTID
    const attachReq = serviceUrl + geojson.agolLayerId + `/queryAttachments?objectIds=${ids.join(",")}&f=json&returnUrl=true`;

    if (hasAttachments) {
      const req = await fetch(attachReq);
      const res = await req.json();

      geojson.features.map(g => {
        if (ids.includes(g.properties.OBJECTID)) {
          res.attachmentGroups.map(i => {

            //TODO IS THE ATTACHMENT JSON STRUCTURE ALWAYS THE SAME
            if (i.parentObjectId == g.properties.OBJECTID) {
              if (i.attachmentInfos[0]) {
                let a = i.attachmentInfos[0]
                if (a.name && a.url) {
                  g.properties.img_url = a.url + "/" + encodeURI(a.name)
                }
              }
            }
          });
        }
      })

      fs.writeFileSync(path.join(inFolder, f), JSON.stringify(geojson, 0,2))

    }
  });

}