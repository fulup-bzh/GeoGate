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
 * DevSimulator simulate a GPS/AIS. It takes input from gpx route/track file.
 * It support OpenCPN/VisuGPX export format, and hopefully while not tested
 * many other GPX format may work.
 *
 * DevSimulator is a simple frontend to lib/GpsSimulator. It parses command line
 * and handle network communication with client/server.
 * 
 * DevSimulator can either send its NMEA feed as a client, or server to consumer.
 *  - server: configure OpenCPN or other client to consume a network nmea feed on your selected port
 *  - client: send TCP feed to GpsdTrack nmea183 adapter or to linux gpsd daemon using tcp://locahost:xxxx
 *  
 * GpsAisSimulator generate intermediary points automatically. It takes each subsegment
 * of your route and track. Computes intermediary points depending on your selected
 * speed and tic. Sends nmea paquets at your selected tic rate. Stop at file end.
 * 
 * syntax:  node GpsAisSimulator --file=xxxxxx [--speed=xxx --tic=xxx --hostname=xxx --servermode --port=xxx ]
 *     --file=xxxx      exported route from OpenCPN or any other valid gpx file
 *     --speed=20       knts at witch fake tracker moves from one point to an other
 *     --tic=180        period in sec in between gps opts update
 *     --srvrmod        enter servermove [incompatible with connect]
 *     --hostname=xxx   if srvmod=false then provide hostname to connect onto
 *     --port=5000      port for either server or client connection [-1 === no network output]
 *     
 *     --debug=1        debuglevel from 0-9
 *     --dump=fileout   copy nmea messages out to fileout
 *     --loop=timeout   replay file infinetly after waiting timeout
 *     --proto=aivdm    with proto=aivdm you may set following extra arguments
 *     --shipname=xxxx
 *     --mmsi=xxxxx
 *     --lenght=xxxxx
 *     --width=xxxx
 * 
 * GPS> node ./bin/DevSimulator --gpxfile=./sample/gpx-file/opencpn-sample.gpx --srvmod --mmsi=0        --port=4001 --tic=2 --speed=10
 * AIS> node ./bin/DevSimulator --gpxfile=./sample/gpx-file/opencpn-sample.gpx --srvmod --mmsi=12345789 --port=4001 --tic=5
 * CLI> node ./bin/DevSimulator --gpxfile=./sample/gpx-file/opencpn-sample.gpx --srvmod --mmsi=12345789 --hostname=xxxx --port=yyy --tic=zz
 * HLP> node ./bin/DevSimulator --help
 * 
 * Use 'telnet localhost 4001' to check your messages. You may eventually decode AIS messages at http://www.maritec.co.za/aisvdmvdodecoding1.php
 * When everything fits your needs, point your application/navigator to your localhost:4001 or what ever your choose as tcpport
 * 
 * Note: you can generate GPX files with:
 *  - opencpn or any other navigation software
 *  - upload gpx file from most GPS devices
 *  - create oneline with http://www.visugpx.com/editgpx/
 *  - http://events.paudax.com/content/planning-your-diy-perm-route-google-maps
 */

var jison    = require("jison").Parser;

var GGsimulator; // if GeoGate development tree uses local modules
if  (process.env.GEOGATE !== 'dev') GGsimulator = require('ggsimulator');
    else GGsimulator = require("../ApiExport");

ParseArgs = function (command, args) {
   var cmdgrammar = {  
    "lex": {
        "rules" : [ ["\\s+" , "return 'BLK';"]
            ,['--gpxfile='  , "return 'GPX';"]
            ,['--speed='    , "return 'SPD';"]
            ,['--tic='      , "return 'TIC';"]
            ,['--proto='    , "return 'PRO';"]
            ,['--hostname=' , "return 'HOS';"]
            ,['--port='     , "return 'PRT';"]
            ,['--mmsi='     , "return 'IME';"]
            ,['--devid='     , "return 'IME';"]
            ,['--debug='    , "return 'DEB';"]
            ,['--length='   , "return 'LEN';"]
            ,['--width='    , "return 'WID';"]
            ,['--cargo='    , "return 'CAR';"]
            ,['--shipname=' , "return 'SHN';"]
            ,['--class='    , "return 'CLA';"]
            ,['--callsign=' , "return 'CAL';"]
            ,['--underway=' , "return 'WAY';"]
            ,['--srvmod='   , "return 'SRC';"]
            ,['--srvmod'    , "return 'SRV';"]
            ,['--verbose'   , "return 'VER';"]
            ,['--testparser', "return 'PAR';"]
            ,['--dumpfile=' , "return 'DUM';"]
            ,['--help'      , "return 'HLP';"]
            ,['--loopwait=' , "return 'LOP';"]
            ,['--randomize=', "return 'RAN';"]
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
           ,['GPX TEX'  ,"this.gpxfile=$2;"]
           ,['SPD TEX'  ,"this.sog=parseFloat($2);"]
           ,['TIC TEX'  ,"this.tic=parseInt($2);"]
           ,['PRO TEX'  ,"this.proto=$2;"]
           ,['HOS TEX'  ,"this.host=$2"]
           ,['PRT TEX'  ,"this.port=parseInt($2)"]
           ,['CAL TEX'  ,"this.callsign=$2"]
           ,['IME TEX'  ,"this.mmsi=parseInt($2)"]
           ,['CLA TEX'  ,"this.class=$2"]
           ,['DEB TEX'  ,"this.debug=$2"]
           ,['DUM TEX'  ,"this.dumpfile=$2"]
           ,['SHN TEX'  ,"this.shipname=$2"]
           ,['WID TEX'  ,"this.wid=parseInt($2)"]
           ,['LEN TEX'  ,"this.len=parseInt($2)"]
           ,['CAR TEX'  ,"this.cargo=parseInt($2)"]
           ,['WAY TEX'  ,"this.uway=parseInt($2)"]
           ,['SRC TEX'  ,"this.srvmod=JSON.parse($2)"]
           ,['LOP TEX'  ,"this.loopwait=parseInt($2*1000)"] // millisecond
           ,['RAN TEX'  ,"this.randomize=$2"]
           ,['VER'      ,"this.verbose=true"]
           ,['SRV'      ,"this.srvmod=true"]
           ,['PAR'      ,"this.testpar=true"]
           ,['HLP'      ,"this.help=true"]
           ]
    }};

    // instanciate command line parser
    var parser=new jison (cmdgrammar);
        var arguments= args.toString();
        this.opts = parser.parse (arguments);
   
    // get basename from command line
    var cmd= command.split ('/');
    var bin= cmd[cmd.length -1];

    // if help call then display help and exit
    if (this.opts.help)  {
        console.log ("----------------------------------------------------------------------------------------------------------");
        console.log ("## Client:  %s --gpxfile=./your-gpxfile.gpx [--proto=gprmc] [--speed=12] [--tic=2] \\",bin);
        console.log ("            [--srvmod | --hostname=localhost] [--port=5000] \\");
        console.log ("            [--dumpgpxfile=xxx] [--loopwait=timeout] [--debug=4]");
        console.log ("## Server:  %s --gpxfile=./your-gpxfile.gpx [--proto=aivdm]  [--speed=6]  [--tic=30] \\", bin);
        console.log ("            [--srvmod | --hostname=localhost] [port=5000] [--debug=4]\\");
        console.log ("            [--shipname=xxx] [--cargo=xxx] [--callsign=xxx] [--underway=xx] [--width=xxx] [--length=xxx]");
        console.log ("## Ex-Aivdm: node %s --gpxfile=../samples/gpx-files/Quiberon-BelleIle.gpx \\", bin);
        console.log ("            --speed=6 --tic=10 --srvmod --port=4001 --debug=4  --class=A --shipname=Simu-Fishing-Boat \\");
        console.log ("            --proto=aivdm --cargo=30 --callsign=FX1234 --underway=7 --width=45 --length=15");
        console.log ("## Ex-Gprmc: node %s --gpxfile=../samples/gpx-files/PortHalligen-Teniouse.gpx  \\", bin);
        console.log ("            --speed=12 --tic=2 --srvmod --port=4002 --debug=4 --proto=gprmc ");
        console.log ("----------------------------------------------------------------------------------------------------------");
        return(0);
    }
};

    // extract argss from command line
    var command= process.argv[1];
    if (process.argv.length < 3) {
        var cmd= command.split ('/');
        var bin= cmd[cmd.length -1];
        console.log ("Error: %s '--gpxfile=xx --port=yy' mandatory argements missing [try --help]",bin);
        process.exit (-1);
    }
    
    // try to parse command
    var parsing=new ParseArgs(command, process.argv.slice(2)); 
    
    // parsing failed ?
    if (parsing.error) {    
        process.exit (-1);
    }
    
    // user select --help exit silently
    if (! parsing.opts.help) {

        // note: depending on module they only use a subset of opts
        var simulator  = new GGsimulator.Simulator (parsing.opts);  // parse GPX route and compute position
        if (simulator.valid) {                              // if simulator fail exit now

            var dispatcher = new GGsimulator.Dispatcher(parsing.opts);  // dispatch message to tcp clients
            dispatcher.SetEncoder   (GGsimulator.NmeaAisEncoder);
            dispatcher.SetListener  (simulator);   // ask dispatcher to handle simulator position events
    }
    }
