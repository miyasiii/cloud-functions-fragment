// import * as module from './ForceSimulationParameter.js';
const d3 = require('d3');
const ForceSimulationParameter = require('./ForceSimulationParameter.js');
module.exports = class ForceSimulationGraph{
  constructor() {
    this.forceProperties;
    this.graphData = { "nodes": [], "links": [] };
    this.forceSimulation = d3.forceSimulation()
      .force("link", d3.forceLink().id(d => d.id));
  }

  async loadProperties() {
    // const module = await import('./ForceSimulationParameter.js');
    // this.forceProperties = new module.ForceSimulationParameter();
    this.forceProperties = new ForceSimulationParameter();
  }

  add(nodesToAdd, linksToAdd){
    if (nodesToAdd) {
      for(let n=0; n<nodesToAdd.length; n++){
        this.graphData.nodes.push(nodesToAdd[n]);
      }
    }
    if (linksToAdd) {
      for(let l=0; l<linksToAdd.length; l++){
        this.graphData.links.push(linksToAdd[l]);
      }
    }
    
    this.update();
    this.forceSimulation.restart();
    this.forceSimulation.alpha(1);
    console.log("simulation start");
  }

  update() {
    let nodes = this.graphData.nodes;
    let links = this.graphData.links;

    this.forceSimulation.nodes(nodes);
    this.forceSimulation
      .force("charge", d3.forceManyBody().strength(this.forceProperties.manyBody.strength).distanceMin((this.forceProperties.manyBody.distanceMin)).distanceMax((this.forceProperties.manyBody.distanceMax)))
      .force("center", d3.forceCenter(this.forceProperties.center.x, this.forceProperties.center.y))
      .force("collide",d3.forceCollide().radius(this.forceProperties.manyBody.radius).strength(this.forceProperties.manyBody.strength).iterations(this.forceProperties.manyBody.iterations))
      .force("x", d3.forceX().strength(this.forceProperties.x.strength).x(this.forceProperties.x.x))
      .force("y", d3.forceY().strength(this.forceProperties.y.strength).y(this.forceProperties.y.y))
      .force("link").distance(this.forceProperties.link.distance).iterations(this.forceProperties.link.iterations).links(links)

    // this.forceSimulation.on("tick", () => this.ticked());
    // this.forceSimulation.on("end", () => this.tickEnded());
  }

  ticked(){
    console.log(this.forceSimulation.alpha());
  }

  tickEnded(){
    console.log("ended");
  }

  alpha(){
    return this.forceSimulation.alpha();
  }
}