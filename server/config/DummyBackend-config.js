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
 *
 */

'use strict';
var PortBase = 4000;
var GeoGateConfig =
    {backend    : "Dummy"         // backend file ==> Dummy-backend.js 
    ,name       : "DummyDemo" // friendly service name [default Gpsd-Track]
    ,rootdir    : "http://breizhme.org/geogate/" // dummy backend return device url image after fake authentication
    ,inactivity : 900             // remove device from active list after xxxs inactivity [default 600s]
    ,sockpause  : 250             // delay in ms in beetween each reply data [0=nowait]
    ,storesize  : 50              // size of postition/device kept in ram for "db search" command
    ,debug      : 1               // debug level 0=none 9=everything
    
    ,"services"    :    // WARNING: NO service network port SHALL conflict
        /*
            info     : 'a friendly name for your service'
            adapter  : 'xxxx for adapter file = ./adapter/xxxx-adapter.js'
            port     : 'tcp port for both service server'
            hostname : 'remote service provider hostname  [default localhost]'
            remport : 'remote tcp feed port'
            timeout  : 'reconnection timeout for consumer of remote service [default 120s]'
            devid     : 'as standard nmea feed does not provide devid this is where user can provide a fake one'
            maxspeed : 'any thing faster is view as an invalid input [default=55m/s == 200km/h]
            mindist  : 'dont store data if device move less than xxxm [default 200m]'
            maxtime  : 'force data store every xxxxs even if device did not move [default 3600s]'
            debug    : 'allow to give a specific debug level this adapter default is global [gateway.debug]'
        
            Note: computation of small distance in beetween two points is fast but approximative.
                  Be carefull to check you do not miss data, especially if tic is small. In case
                  of doubt increase speed and reduce min dist. You can also set debug hight enough
                  to see event on ignoring data because of distance/speed computation.
        */
        // this controle console, you probably want it hyden behind your firewall
        { debug    : 4
        , Telnet   : {info: "Telnet Console"  , adapter: "TelnetConsole" , port: PortBase}
        , Httpd    : {info: "Minimalist HTTPd", adapter: "HttpAjax"      , port:PortBase +80, debug:5}
        , WebSock  : {info: "Websock service" , adapter: "WebSockTraffic", port:PortBase +81, debug:5}
         
        // following apaters are TCP servers and wait for clients to connect
        , Gps103   : {info: "Tk102 Gps103"    , adapter: "Gps103Tk102"   , port:PortBase + 3, debug:6}

        // phone applications typically some form of OpenGPRMC
        , Celltrac : {info: "CellTrac Android", adapter: "GtcGprmcDroid" , port:PortBase + 20, debug:5} // OpenGPRMC

        // new adapters are clients [probably for test load generation only]
        ,AisTcp   : {info: "Ais Hub Feed"    , adapter: "AisTcpFeed"    , hostname: "geotobe.net"  , remport:4001, timeout:60, mindist:500}
        ,RemGps   : {info: "Gps Over Tcp"    , adapter: "NmeaTcpFeed"   , hostname: "geotobe.net"  , remport:4001, timeout:60, mmsi:123456789, mindist:500}
    }
};

module.exports = GeoGateConfig;