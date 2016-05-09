GeoGate
========

GeoGate is an opensource GPS/AIS tracking server framework, that enable easy
integration of multiple GPS trackers in WEB applications. It provides data
acquisition drivers for typical tracker devices or phone's GPS apps.
It handle multiple database backend, and support GeoJSON, AIS & NMEA encoding/decoding.
It embed support for multiple classes of trackers, phone-apps, as well an NMEA & AIS simulator.

GeoGate-Server
==============

Is the component that support Tracker/GPS/AIS protocols. It receives packet from GPRS network
and write them on disk thought MySQL or MogoDB database backend.


Install
=======
    npm install ggserver

Config
=======
    Edit config/*** file to reflect your configuration

Command line
============
    * Tracker/GPS/AIS server
      - node bin/GeoGateServer.js --debug=3 --config=DummyBackend
      - telnet localhost 4000

    * Debug Tracker adapter
      - node bin/Tracker2Json.js  --adapter=Gps103Tk102 --port=1234  [wait for tracker incoming packet on localhost:1234]

    * Config Tracker by SMS [impose a working Gammu SMS gateway]
      - node bin/ConfigBySms.js  --phone=xxxxx --password=123456 --list # list all tracker SMS commands
      - node bin/ConfigBySms.js --debug=3 --phone=+33xxxxx --password=123456  --command=GPRS_URI --args='host:myhost port:myport'
      - node bin/ConfigBySms.js --debug=3 --phone=+33xxxxx --password=123456  --batch=sample/SmsCommand-batch.js

Online Demo
============
    http://breizhme.org/gpsdtracking/html/index.html

Api Development
===============
    var GGgateway = require("../lib/GG-Gateway").Gateway;

    var PortBase = 4000;
    var GeoGateConfig = {
        backend    : "MySqlDb",       // backend file ==> mysql-backend.js [default file]
        name       : "GpsdMySQL",     // friendly service name [default GeoGate]
        inactivity : 900,             // remove device from active list after xxxs inactivity [default 600s]
        debug      : 1,               // global debug level 0=none 9=everything

    "services"    :  {  debug: 4      // default debug level for services [can be overloaded by service]
        /*
            info     : 'a friendly name for your service'
            adapter  : 'xxxx for adapter file = ./adapter/xxxx-adapter.js'
            port     : 'tcp port for both service server & client mode'
            hostname : 'remote service provider hostname  [default localhost]'
            timeout  : 'reconnection timeout for consumer of remote service [default 120s]'
            devid     : 'as real nmea feed does not provide devid this is where user can provide a fake one'
            maxspeed : 'any thing faster is view as an invalid input [default=55m/s == 200km/h]
            mindist  : 'don't store data if device move less than xxxm [default 200m]'
            maxtime  : 'force data store every xxxxs even if device did not move [default 3600s]'
            debug    : 'allow to give a specific debug level this adapter default is [gateway.debug]'
        */

        , Telnet   : {info: "Telnet Console"  , adapter: "TelnetConsole" , port: PortBase +0}
        , Gps103   : {info: "Tk102 Gps103"    , adapter: "Gps103Tk102"   , port: PortBase +3n debug:6}
        , Celltrac : {info: "CellTrac Android", adapter: "GtcGprmcDroid" , port: PortBase +5}
        , AisTcp   : {info: "Ais Hub Feed"    , adapter: "AisTcpFeed"    , hostname: "geotobe.net" , remport:4001, timeout:60, mindist:500}
        , RemGps    : {info: "Gps Over Tcp"   , adapter: "NmeaTcpFeed"   , hostname: "geotobe.org" , remport:4001, timeout:60, mmsi:123456789, mindist:500}
       },

       "mysql": { // [should reflect your MySQL configuration]
            hostname: "10.10.100.101",   // MySql hostname
            basename: "gpsdtest",        // Basename base should exist
            username: "gpsdtest",        // MySql username
            password: "MyPasswd"         // MySql password
        }
    };

    // while it's not common you may chose to instantiate more than one gateway in a single process
    var gateway = new GGgateway (GeoGateConfig);

    // gateway emit 3 type of events, that you may chose or not to listen
    gateway.event.on("queue" ,EventHandlerQueue);
    gateway.event.on("accept",EventHandlerAccept);
    gateway.event.on("notice",EventHandlerError);