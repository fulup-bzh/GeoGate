/**
 * Created by fulup on 06/11/14.
 */

// Main Entry Point for GeoGate geojson Package

var GGencode=
   { AisDecode : require ('./lib/GG-AisDecode')
   , AisEncode : require ('./lib/GG-AisEncode')
   , NmeaDecode: require ('./lib/GG-NmeaDecode')
   , NmeaEncode: require ('./lib/GG-NmeaEncode')
   };

module.exports = GGencode; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/