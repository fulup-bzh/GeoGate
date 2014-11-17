/**
 * Created by fulup on 06/11/14.
 */

// Main Entry Point for GeoGate gateway Package
var GGsmsc =
   { Client  : require ('./lib/GG-GammuMySql')
   , Request : require ('./lib/GG-SmsRequest.js')
   , Batch   : require ('./lib/GG-SmsBatch.js')
   };

module.exports = GGsmsc;
