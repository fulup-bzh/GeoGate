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

/*
 * HubSimulator simulate a GPS/AIS. It takes input from gpx route/track Directory
 * It support OpenCPN/VisuGPX export format, and hopefully while not tested
 * many other GPX format may work.
 *
 * HubSimulator is a simple frontend to lib/GpsSimulator. It parses command line
 * and handle network communication with client/server.
 * 
 * HubSimulator work in server mode, it waits for client to connect
 *  
 * syntax:  node GpsAisSimulator --dir=xxxxxx
 *     --gpxdir=xxxx    each *.gpx file will be implemented as a new vessel
 *     --port=1234      port for client to connect
 *     --loopwait=1     wait 1 second before replaying route [if 0 stop simulation at end of gpxfile]
 *     --verbose        print a copy of sent message to console
 *     --debug=1        debuglevel from 0-9
 *     --dump=fileout   copy nmea messages out to fileout
 *     
 *     example: node ./bin/HubSimulator.js --gpxdir=./sample/hub-route --port=5001
 *
 * Use 'telnet localhost 1234' to check your messages. You may eventually decode AIS messages at http://www.maritec.co.za/aisvdmvdodecoding1.php
 * When everything fits your needs, point your application/navigator to your localhost:1234 or what ever your choose as tcpport
 * 
 * Note: you can generate GPX files with:
 *  - opencpn or any other navigation software
 *  - upload gpx file from most GPS devices
 *  - create oneline with http://www.visugpx.com/editgpx/
 *  - http://events.paudax.com/content/planning-your-diy-perm-route-google-maps
 */

var jison    = require("jison").Parser;
var fs       = require('fs');
var path     = require('path');

var GGsimulator; // if GeoGate development tree uses local modules
if  (process.env.GEOGATE !== 'dev') GGsimulator = require('ggsimulator');
else GGsimulator = require("../ApiExport");

var FakeVesselStatics =  require("../lib/_FakeVesselStatics");

ParseArgs = function (command, args) {
    var cmdgrammar = {
        "lex": {
            "rules" : [ ["\\s+" , "return 'BLK';"]
                ,['--gpxdir='  ,  "return 'GPX';"]
                ,['--tic='      , "return 'TIC';"]
                ,['--port='     , "return 'PRT';"]
                ,['--debug='    , "return 'DEB';"]
                ,['--verbose'   , "return 'VER';"]
                ,['--dumpfile=' , "return 'DUM';"]
                ,['--help'      , "return 'HLP';"]
                ,['--loopwait=' , "return 'LOP';"]
                ,[':'           , "return 'SEP';"]
                ,[','           , "/* ignore */"]
                ,['([0-z)|[-]|[\\.]|[\\/])+'  , "return 'TEX';"]
                ,['$'           , "return 'EOL';"]
            ]
        },  // end Lex rules

        "bnf": { // WARNING: only one space in between TOKEN ex: "STOP EOF"
            'opts':  [
                ["OPTIONS EOL" , "return (this);"]
            ]
            ,'OPTIONS': [['OPTION', ""]
                ,['OPTION BLK', ""]
                ,['OPTIONS OPTION BLK', ""]
                ,['OPTIONS OPTION', ""]
            ]
            ,'OPTION' : [["EOL"      , "return (this);"]
                ,['GPX TEX'  ,"this.gpxdir=$2 + '/' ;"]
                ,['TIC TEX'  ,"this.tic=parseInt($2);"]
                ,['PRT TEX'  ,"this.port=parseInt($2)"]
                ,['DEB TEX'  ,"this.debug=$2"]
                ,['DUM TEX'  ,"this.dumpfile=$2"]
                ,['LOP TEX'  ,"this.loopwait=parseInt($2*1000)"] // millisecond
                ,['VER'      ,"this.verbose=true"]
                ,['HLP'      ,"this.help=true"]
            ]
        }};

    // instanciate command line parser
    var parser=new jison (cmdgrammar);

    this.opts = parser.parse (args.toString());
    
    // get basename from command line
    var cmd= command.split ('/');
    var bin= cmd[cmd.length -1];

    // if help call then display help and exit
    if (this.opts.help)  {
        console.log ("----------------------------------------------------------------------------------------------------------");
        console.log ("## %s --gpxdir=./xxx --port=1234 --verbose \\",bin);
        console.log ("## %s --gpxdir=./sample/hub-route --port=5001 \\",bin);
        console.log ("----------------------------------------------------------------------------------------------------------");
    }
};

// scan directory and extract all .gpx files
function ScanGpxDir (gpxdir) {
    var availableRoutes=[];
    var count=0;
    var routesDir = gpxdir;
    var directory = fs.readdirSync(routesDir);
    for (var i in directory) {
        var file = directory [i];
        var route  = path.basename (directory [i],".gpx");
        var name = routesDir + route + '.gpx';
        try {
            if (fs.statSync(name).isFile()) {
                count ++;
                availableRoutes [route] = name;
                console.log ("Found Gpx Route: " + route + " file: " + availableRoutes [route]);
            }
        } catch (err) {/* ignore errors */}
    }
    if (count < 3) {
        console.log ("Find only [%d] GPX file in [%s] please check your directory", count, parsing.opts.gpxdir);
        process.exit (-1);
    }
    return (availableRoutes);
}

// extract argss from command line
var command= process.argv[1];
if (process.argv.length < 3) {
    var cmd= command.split ('/');
    var bin= cmd[cmd.length -1];
    console.log ("Error: %s '--gpxdir=xx --port=yy' mandatory arguments missing [try --help]",bin);
    process.exit (-1);
}

// try to parse command
var parsing=new ParseArgs(command, process.argv.slice(2));

// parsing failed ?
if (parsing.error) {
    process.exit (-1);
}

// user select --help exit silently
if (parsing.opts.help) process.exit();

// set some defaults
if (parsing.opts.loopwait === undefined) parsing.opts.loopwait=1;
if (parsing.opts.srvmod   === undefined) parsing.opts.srvmod=true;
if (parsing.opts.debug    === undefined) parsing.opts.debug=1;

// Start simulator dispatcher in server mode with ais/nmea encoding
var dispatcher = new  GGsimulator.Dispatcher(parsing.opts);
dispatcher.SetEncoder(GGsimulator.NmeaAisEncoder);

// scan gpx directory file
for (var gpxfile in ScanGpxDir (parsing.opts.gpxdir)) {

    var ship = new FakeVesselStatics(gpxfile);  // built default from file name
    var opts =
            {gpxfile     : parsing.opts.gpxdir + gpxfile + '.gpx'
            , mmsi       : ship.Mmsi()
            , shipname   : ship.Shipname()
            , sog        : ship.Speed()
            , tic        : parsing.opts.tic
            , debug      : parsing.opts.debug
            , len        : ship.Len()
            , wid        : ship.Wid()
            , callsign   : ship.Callsign()
            , cargo      : ship.Cargo()
            , uway       : ship.Uway()
            , class      : ship.Class()
            , loopwait   : parsing.opts.loopwait
            };
    if (opts.mmsi === 0) opts.tic = 1;      // mmsi produce GPRMC paquet and need to have a quick tic for OpenCPN

    var simulator  = new GGsimulator.Simulator (opts);  // parse GPX route and compute position
    if (simulator.valid) dispatcher.SetListener(simulator);   // ask dispatcher to handle simulator position events
}
console.log ("\n **** Simulator waiting on tcp://%s:%s ****\n", process.env.HOSTNAME, parsing.opts.port);