/**
 * Created by fulup on 06/11/14.
 */

// Main Entry Point for GeoGate Simulator Package
var GGsimulator=
   { Simulator : require ('./lib/GG-Simulator')
   , Dispatcher: require ('./lib/GG-Dispatcher')
   , NmeaAisEncoder: require ('./lib/GG-NmeaAisEncoder')
   };

module.exports = GGsimulator; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
