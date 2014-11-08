/**
 * Created by fulup on 06/11/14.
 */

// Main Entry Point for GeoGate Simulator Package
var GGsimulator=
   { Simulator : require ('./lib/GG-Simulator')
   , Formatter : require ('./lib/GG-Formatter')
   , Dispatcher: require ('./lib/GG-Dispatcher')
   };

module.exports = GGsimulator; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
