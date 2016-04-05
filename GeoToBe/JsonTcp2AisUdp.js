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
 * JsonTcp2AisUdp receive packet from qtVLM AIS information in JSON,
 * it encode those AIS messages into binary AIS messages and then them
 * onto a UDP port for Gpsd to process them
 * 
 * Incomming Messages sample:
 * 
 * {"aistype":24,"mmsi":163994842,"part":0,"shipname":"maitai"}
 * {"aistype":24,"mmsi":163994842,"part":1,"callsign":"FG9196","cargo":95,"dimA":10,"dimB":2,"dimC":3,"dimD":3}
 * {"aistype":18,"mmsi":163994842,"lon":-4.3329008333333334,"lat":49.033095000000003,"cog":1300,"sog":160,"dsc":false,"accuracy":true,"second":1}
 *
 * Outgoing message are send in UDP and Gpsd is probably needed to process them
 *   gpsd -G -S 1234 -N udp://127.0.0.1:4023 (or what ever udp host/port you selected)
 *   gps2udp -j -d 1 localhost:1234
 *   opencpn with a connection to udp://localhost:4023
 *   Warning: gpsd may want 127.0.0.1 in place of 'localhost'
 *   
 * Send test messages with socat
 *   socat - TCP4:localhost:4022 </tmp/test.ais
 *   
 * Debug
 *   tcpdump -i lo -n -lnX  udp and port 4023  
 *   
 * Note: if debug > 3 then JsonAisProxy adapter send a copy of NMEA/AIS encoded messages  
 */

var GGgateway = require("../server/lib/GG-Gateway");

var PortBase = 4000;

var GeoGateConfig = {
    backend    : "Dummy",      // backend file ==> mysql-backend.js [default file]
    name       : "Json-Ais",   // friendly service name [default Gpsd-Track]
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
        , Json2Ais : {info: "Json AIS Proxy", adapter: "JsonAisProxy"   , port: PortBase+22, uport: PortBase+23, debug:9}
    }
};

// instanciate a new Gateway Daemon
var gateway = new GGgateway (GeoGateConfig);