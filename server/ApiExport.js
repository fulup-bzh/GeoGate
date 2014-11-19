/**
 * Created by fulup on 06/11/14.
 */

// Main Entry Point for GeoGate gateway Package
var GGserver=
   { Gateway    : require ('./lib/GG-Gateway')
   , Controller : require ('./lib/GG-Controller')
   , SmsControl : require ('./lib/GG-SmsControl')
   };

module.exports = GGserver; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
