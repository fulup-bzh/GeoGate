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
 */
var PortBase = 4000;

var GeoGateConfig = {
    backend    : "MySqlDb",         // backend file ==> mysql-backend.js [default file]
    name       : "GpsdMySQL",     // friendly service name [default Gpsd-Track]
    inactivity : 900,             // remove device from active list after xxxs inactivity [default 600s]
    debug      : 7,               // debug level 0=none 9=everything
    
    "services"    :  {  debug: 4
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

        // this controle console, you probably want it hyden behind your firewall
        , Telnet   : {info: "Telnet Console"  , adapter: "TelnetConsole" , port: PortBase +0}

        // Tracker devices are TCP servers & wait for clients to connect
        , Gps103   : {info: "Tk102 Gps103"    , adapter: "Gps103Tk102"   , port: PortBase +3}
        , Celltrac : {info: "CellTrac Android", adapter: "GtcGprmcDroid" , port: PortBase +5}
        // ,RemGps    : {info: "Gps Over Tcp"    , adapter: "NmeaTcpFeed"   , hostname: "geotobe.org"  , remport:4001, timeout:60, mmsi:123456789, mindist:500}
    },
	
  "mysql": { // [should reflect your MySQL configuration]
	hostname: "10.10.100.101",   // MySql hostname
    basename: "gpsdtest",        // Basename base should exist
	username: "gpsdtest",        // MySql username
    password: "MyPasswd"         // MySql password
    }
};

module.exports = GeoGateConfig;
