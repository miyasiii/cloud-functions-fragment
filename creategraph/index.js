const functions = require('firebase-functions');
const admin = require('firebase-admin');
const serviceAccount = require("./xxxx-firebase-adminsdk-xxxx-xxxx.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: "xxxx.appspot.com"
});

const FieldValue = admin.firestore.FieldValue;
const firestore = admin.firestore();

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const ForceSimulationGraph = require('./ForceSimulationGraph.js');

const scrapeRuntimeOpts = {
  timeoutSeconds: 300,
  memory: '1GB'
}

const simulationRuntimeOpts = {
  timeoutSeconds: 540,
  memory: '2GB'
}

exports.scraping = functions.runWith(scrapeRuntimeOpts).region('asia-northeast1').pubsub.schedule('every 15 minutes').onRun(async (context) => {
  let browser = await puppeteer.launch({headless: true, args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    // '-–disable-dev-shm-usage',
    '--disable-gpu',
    '--disable-software-rasterizer',
    // '--no-first-run',
    // '--no-zygote',
    // '--single-process',
  ]});
  
  let page = await browser.newPage();
  let navigationPromise = page.waitForNavigation()
  let targetUser = "";

  await firestore().collection("nodes").where("indexed", "==", false).limit(1).get()
  .then(function(querySnapshot) {
    querySnapshot.forEach(function(doc) {
      targetUser = doc.id;
    });
    console.log("targetUser:", targetUser);
  })
  .catch(function(error) {
    console.log("catch Error: ", error);
  });

  await firestore().collection('nodes').doc(targetUser).update({
    timestamp: FieldValue.serverTimestamp(),
    indexed: true
  });

  let page = 1;
  while(true){
    let url = `https://xxx.com/${targetUser}?page=${page.toString()}`;
    console.log("target page :", url);

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.setViewport({ width: 600, height: 800 })
    await page.waitFor(1000);
    await navigationPromise;

    var selector = "#main";
    var html = await page.$eval(selector, item => {
      return item.innerHTML;
    });
    const $ = await cheerio.load(html);

    if(!$('.list').find('.user').length){
      console.log("end of content");
      break;
    }

    await $('.list').each( async (index, element) => {
      let sourceUser = $(element).find('.user').find('a').attr('href').split("/").pop();

      await firestore().collection('nodes').doc(sourceUser).get()
      .then(async function(doc) {
        if (!doc.exists) {
          await firestore().collection('nodes').doc(sourceUser).set({
            timestamp: FieldValue.serverTimestamp(),
            indexed: false
          });
          // console.log(`add node: ${sourceUser}`);
        }
      })

      await firestore().collection('links').where("source", "==", sourceUser).where("target", "==", targetUser).limit(1).get()
      .then(async function (querySnapshot) {
        if(querySnapshot.size === 0){
          await firestore().collection('links').add({
            source: sourceUser,
            target: targetUser
          });
          // console.log(`add link: ${sourceUser} to ${targetUser}`);
        }
      });
    })

    page += 1;
  }

  return await browser.close();

});

// exports.updateMapping = functions.runWith(simulationRuntimeOpts).region('asia-northeast1').https.onRequest(async (req, res) => {
exports.updateMapping = functions.runWith(simulationRuntimeOpts).region('asia-northeast1').pubsub.schedule('0 0 * * *').timeZone('Asia/Tokyo').onRun(async (context) => {

  const bucket = admin.storage().bucket();
  const nodeFile = bucket.file('nodes');
  const linkFile = bucket.file('links');

  let links = [];
  let nodes = [];
  let forceGraph;

  const [ linkDocs, nodeDocs ] = await Promise.all([
    firestore().collection('links').get()
      .then(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
          links.push({source: doc.data().source, target: doc.data().target});
        })
      })
      .catch(function(error) {
        console.log("catch Error: ", error);
      }),
    firestore().collection('nodes').get()
      .then(function(querySnapshot) {
        querySnapshot.forEach(function(doc) {
          nodes.push({id: doc.id});
      });
    })
  ])
  console.log("nodes:", nodes.length);
  console.log("links:", links.length);

  forceGraph = new ForceSimulationGraph();
  await forceGraph.loadProperties();
  forceGraph.add(nodes, links);

  console.log("simulation start");
  return await new Promise(resolve => {
  var timer = setInterval(async ()=>{
    var alpha = forceGraph.alpha();
    console.log(alpha);
    if(alpha < 0.001){
      console.log("simulation ended");
      clearInterval(timer);
      
      archiveNodes = [];
      nodes.forEach((node) => {
        var count = links.filter(link => link.source.id === node.id).length;
        var sources = links.filter(link => link.source.id == node.id);

        var minDistance = Number.MAX_SAFE_INTEGER;
        for(let i=0; i < sources.length; i++){
          var found = nodes.find(node => node.id === sources[i].target.id);
          var distance = Math.sqrt(found.x**2 + found.y**2);
          if(distance < minDistance) minDistance = distance;
        }

        archiveNodes.push({
          id: node.id,
          index: node.index,
          x: node.x,
          y: node.y,
          size: count,
          sparse: minDistance
        });
      });
    
      var archiveNodesBuf = Buffer.from(JSON.stringify(archiveNodes));
      await nodeFile.save(archiveNodesBuf).then(function() {
        console.log("node saved");
      });
    
      archiveLinks = [];
      links.forEach((link) => {
        var sourceSize = archiveNodes.find((n) => n.id === link.source.id).size;
        var targetSize = archiveNodes.find((n) => n.id === link.target.id).size;

        var minDistance = Number.MAX_SAFE_INTEGER;
        var found1 = nodes.find(node => node.id === link.source.id);
        var found2 = nodes.find(node => node.id === link.target.id);
        var distance = Math.sqrt((found2.x - found1.x)**2 + (found2.y - found1.y)**2);
        if(distance < minDistance) minDistance = distance;

        archiveLinks.push({
          source: link.source.id,
          target: link.target.id,
          size: sourceSize + targetSize,
          sparse: minDistance
        });
      });
    
      var archiveLinksBuf = Buffer.from(JSON.stringify(archiveLinks));
      await linkFile.save(archiveLinksBuf).then(function() {
        console.log("link saved");
      });
      
      // res.json({result: `updateMapping ended`}); //https.onRequest

      // return null;//pubsub.schedule
      resolve();
    }


  }, 5000);
  });

});

