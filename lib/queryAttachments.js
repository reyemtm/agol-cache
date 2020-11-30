const fs = require("fs");
const { default: fetch } = require("node-fetch");
const path = require("path");

module.exports = async function queryAttachments(serviceUrl, inFolder, outFolder) {
  const files = fs.readdirSync(path.join(inFolder));

  files.map(async f => {
    const geojson = JSON.parse(fs.readFileSync(path.join(inFolder, f)));
    let hasAttachments = false;
    const ids = [];

    for (let i = 0; i < geojson.features.length; i++) {
      let g = geojson.features[i]
      if (g.properties["ATTACHMENT"] && g.properties["ATTACHMENT"] === "Yes") {
        ids.push(g.properties["OBJECTID"]);
        hasAttachments = true
      }
    }

    const attachReq = serviceUrl + geojson.agolLayerId + `/queryAttachments?objectIds=${ids.join(",")}&f=json&returnUrl=true`;

    if (hasAttachments) {
      // console.log(attachReq)
      const req = await fetch(attachReq);
      const res = await req.json();

      geojson.features.map(g => {
        if (ids.includes(g.properties.OBJECTID)) {
          res.attachmentGroups.map(i => {
            if (i.parentObjectId == g.properties.OBJECTID) {
              // console.log(i.attachmentInfos[0].url);
              g.properties.img_url = i.attachmentInfos[0].url
            }
          });
        }
      })

      fs.writeFileSync(path.join(inFolder, f), JSON.stringify(geojson, 0,2))

    }
  });

}