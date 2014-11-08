#!/usr/bin/env node

/* 
 * Copyright 2014 Fulup Ar Foll
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * This sample shows how to add an geojson to GGsimulator to output a GeoJson format
 */

'use strict';  // activate NodeJS strict mode

var GGsimulator; // if GeoGate development tree uses local modules
if  (process.env.HOSTNAME !== 'fulup-desktop') GGsimulator = require('ggsimulator');
else GGsimulator = require("../../ApiExport");

/*
 * Encoder receives position/statics info about vessel
 * Static={type:1, mmsi:xxx, shipname:xxx, ....}
 * Position={type:2, lon:xx, lat:xx, sog:xx, cog:xx}
 *
 * What ever Encoder returns, it going to be sent back to TCP client
 * socket.write function accept string or buffer
 *
 * GeoJson spec http://geojson.org/
 */
function GeoJsonEncoder (data) {
    var msg;

    switch (data.type)  {
        case 1: // Vessel static info (some value might be undefined)
           msg =
           { type: "Feature"
           , geometry:
              { type: "Statics"
              , callsign: data.callsign
              , class:  data.class
              , length: (data.dimB - data.dimA)
              , width:  (data.dimD - data.dimC)
              }
           , properties:
              { "mmsi": data.mmsi
              , 'name': data.shipname
              }
           };
           break;

        case 2: // Vessel Position report
            msg =
            { type: "Feature"
                , geometry:
            { type: "Point"
                , coordinates: [data.lat, data.lon]
                , sog: data.sog
                , cog: data.cog
            }
                , properties:
                { "mmsi": data.mmsi
                , 'name': data.name
                }
            };
            break;

        default: msg= null;
    }

    // Note that geojson SHOULD return a valid string/buffer and not an object
    return (JSON.stringify(msg));
}

/*
 * Define out boat characteristics, depending on your encoding target
 * only gpx-file and speed+tic might be necessary
 */
var MyBoat1 = // check http://catb.org/gpsd/AIVDM.html Ship/Status table codes
      { debug   : 4
      , gpxfile : '../gpx-file/opencpn-sample.gpx'
      , mmsi    : 123456789
      , shipname: "MyBoat"

      , speed   : 18    // speed in m/s  [5ms/s ~ 10 knts ~ 20km/h]
      , tic     : 3     // intermediary position computation rate in second

      , width   : 5.6   // in meter
      , length  : 35    // in meter
      , draught : 3.5   // in meter
      , cargo   : 36    // sailing boat check catb.org/gpsd/AIVDM.html for details
      };

 /*
  * Dispatcher is responsible for serving TCP client. Default mode is srvmod:false
  * in witch case it act as a client an connect onto a remote server. When svcmod:true
  * it waits for incoming connections and broadcast position to all of them in chosen format.
  */
var MyDispatcher =
      { debug   : 4                      // debug 0-9
      , srvmod  : true                   // move to false for client connect mode
      , host    : 'localhost'            // only useful in client connect mode
      , port    : 1234                   // tcp port for client to connect
      , dumpfile: "/tmp/simulator.dump"  // send a copy of outgoing packet to a dumpfile
      , proto   : 'MyGeoJsonFormat'      // chosen label in GGencoder registry for my method
      };

/*
 * Formatter is the encoder registry for positions output format methods.
 * User may add new encoder to builtin formatter existing encoders.
 */
var MyFormatter = { debug: 4 };

 // get geojson presenter registry and add myGeoJson method to existing defaults
 var formatter   = new GGsimulator.Formatter (MyFormatter);        // handle output message format
 formatter.AddEncoder   ('MyGeoJsonFormat', GeoJsonEncoder); // registry is a simple array label/method

 // instanciate one or multiple simulators to process one/many gpxfile(s)
 var simu1  = new GGsimulator.Simulator(MyBoat1);  // parse GPX route and compute position
  // simu2  = new GGsimulator.Simulator(MyBoat2);
  // simu3  = new GGsimulator.Simulator(MyBoat3);

 // Dispatcher serve positions messages to connected clients
 var dispatcher  = new GGsimulator.Dispatcher (MyDispatcher);  // dispatch message to tcp clients
     dispatcher.SetFormatter  (formatter);   // declare presentation encoders registry
     dispatcher.SetListener  (simu1);        // ask dispatcher to handle simulator position events
     //dispatcher.SetListener(simu2);
     //dispatcher.SetListener(simu3);

 console.log ("\n****** Test with 'Telnet localhost 1234' *****\n");