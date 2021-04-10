module.exports = class ForceSimulationParameter{
  constructor() {
    this._center = {
      x: 0,
      y: 0,
      strength: 1
    }

    this._collide = {
      radius: 1,
      strength: 1,
      iterations: 5
    }

    this._link = {
      distance: 30,
      // strength: 0.1,
      iterations: 5
    }

    this._manyBody = {
      strength: -30,
      theta: 0.5,
      distanceMin: 1,
      distanceMax: Infinity
    }

    this._x = {
      x:0,
      strength: 0.1
    }

    this._y = {
      y:0,
      strength: 0.1
    }

  }

  get center(){
    return this._center;
  }

  get collide(){
    return this._collide;
  }

  get link(){
    return this._link;
  }

  get manyBody(){
    return this._manyBody;
  }

  get x(){
    return this._x;
  }

  get y(){
    return this._y;
  }
}