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
 * PocVlm2Ais receive packet from qtVLM or OpenCPN,
 * is needed it encodes or decodes those AIS messages and compute vessel possition
 * it then send AIS position of any boat within a distance of XXNM (default 30NM)
 * 
 * Incomming Messages sample either AIS/JSON or NMEA GPRCM/GGA vessel position:
 * 
 * {"aistype":24,"mmsi":163994842,"part":0,"shipname":"maitai"}
 * {"aistype":24,"mmsi":163994842,"part":1,"callsign":"FG9196","cargo":95,"dimA":10,"dimB":2,"dimC":3,"dimD":3}
 * {"aistype":18,"mmsi":163994842,"lon":-4.3329008333333334,"lat":49.033095000000003,"cog":1300,"sog":160,"dsc":false,"accuracy":true,"second":1}
 * $GPRMC,225446.00,A,4916.45,N,12311.12,W,000.5,054.7,191194,020.3,E*68
 * $GPGGA,064036.289,4836.5375,N,00740.9373,E,1,04,3.2,200.2,M,,,,0000*0E
 *
 * Outgoing AIS message are send as !AIVDM on the same channel as the one sending vessel position in JSON/NMEA
 */

var GGgateway = require("../server/lib/GG-Gateway");

var PortBase = 4000;

var GeoGateConfig = {
    backend    : "Dummy",      // backend file ==> mysql-backend.js [default file]
    name       : "VlmOpc-Ais",   // friendly service name [default Gpsd-Track]
    inactivity : 900,          // remove device from active list after xxxs inactivity [default 600s]
    debug      : 1,            // debug level 0=none 9=everything

    "services"    :  {  debug: 1
        /*
         info     : 'a friendly name for your service'
         adapter  : 'xxxx for adapter file = ./adapter/xxxx-adapter.js'
         port     : 'tcp port for both service server & client mode'
         hostname : 'remote service provider hostname  [default localhost]'
         timeout  : 'reconnection timeout for consumer of remote service [default 120s]'
         devid     : 'as real nmea feed does not provide devid this is where user can provide a fake one'
         maxspeed : 'any thing faster is view as an invalid input [default=55m/s == 200km/h]
         mindist  : 'dont store data if device move less than xxxm [default 200m]'
         maxtime  : 'force data store every xxxxs even if device did not move [default 3600s]'
         debug    : 'allow to give a specific debug level this adapter default is [gateway.debug]'
         */

        // Tracker devices are TCP servers & wait for clients to connect
        , AisBzh : {info: "AIS BZH GPSd feed"   , adapter: "AisProxyNmea" , hostname: "sinagot.net", remport: 2947, debug:6}
        //, AisMed : {info: "AIS MED GPSd feed"   , adapter: "AisProxyNmea" , hostname: "sinagot.net", remport: 2948}
        , VlmOpc : {info: "OpenCPN qtVLM in/out", adapter: "VlmOpcAisSim" , port: PortBase+22, distance:30, debug:8}
    }
};

// instanciate a new Gateway Daemon
var gateway = new GGgateway (GeoGateConfig);