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
 * GeoGate Server listen to multiple Tracker/AIS/NMEA feed and store then on a backend
 * 
 * GeoGateServer
 *    --config=xxxx      // configuration file
 *    --verbose=1        // display incoming binary NMEA paquet
 *    --debug=xx         // debug level [0-9]
 *
 * Examples:
 *     GeoGateServer --config=./conf/DummyBackend.conf
 *
 */

'use strict';

var GGgateway = require("../lib/GG-Gateway");
var jison     = require("jison").Parser;

var availableConfigs = require("../lib/_ScanPlugin").Config();

var Verbose=false;

function Arguments (command, args) {
   var cmdgrammar = {  
    "lex": {
        "rules" : [ ["\\s+" , "return 'BLK';"]
            ,['--config=' , "return 'CON';"]
            ,['--debug='    , "return 'DEB';"]
            ,['--verbose'   , "return 'VER';"]
            ,['--help'      , "return 'HLP';"]
            ,[','           , "/* ignore */"]
            ,['[^,]+'       , "return 'TEX';"]
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
           ,['CON TEX'  ,"this.config=$2"]
           ,['DEB TEX'  ,"this.debug=$2"]
           ,['VER'      ,"this.verbose=true"]
           ,['HLP'      ,"this.help=true"]
           ]
    }};

    // instanciate command line parser
    var parser=new jison (cmdgrammar);
   
    try {this.opts = parser.parse (args.toString());}
     catch (err) {
        console.log ("Syntax error [please check --help] err=[%s]", err);
        this.error=true;
        return;
    }

    try {
        this.config  =  require(availableConfigs [this.opts.config]);
    } catch (err) {
        console.log ('\nInvalid config name : [%s] Error=%s', this.opts.config, err);
        console.log ("GeoGateServer aborted");
        process.exit();
    }

    // if help call then display help and exit
    if (this.opts.help)  {
        console.log ("----------------------------------------------------------------------------------------------------------");
        console.log ("## Syntaxe:  %s --config=xxxx [--verbose] \\",bin);
        console.log ("----------------------------------------------------------------------------------------------------------");
        return(0);
    }
};

// ----------- User Event Handler -----------------
function ListenEvents (server) {
    var count =0;  // Simple counter to make easier to follow message flow


    // Events from queued jobs
    function EventHandlerQueue (status, job){
        console.log ("#%d- Queue Status=%s DevId=%s Command=%s JobReq=%d Retry=%d", count, status, job.devId, job.command, job.request, job.retry);
    };
    // Events successful process by tracker adapter
    function EventHandlerAccept (device, data){
        console.log ("#%d- Action Devid:[%s] Name:[%s] Cmd:[%s] Lat:%d Lon:%d Speed=%d", count, device.devid, device.name, data.cmd, data.lat, data.lon, data.sog);
    };
    // Events on action refused by tracker adapter
    function EventHandlerError (status, info, id, msg){
        console.log ("#%d- Notice Info=%s Data=%s Id=%s Msg:%s", count, status, info, id, msg );
    };

    // let's use the same event handler for all gpsdTracker
    server.event.on("queue",EventHandlerQueue);
    server.event.on("accept",EventHandlerAccept);
    server.event.on("notice",EventHandlerError);
};

// #### Main Start #####
var config, configpath;

var command= process.argv[1];
if (process.argv.length < 3) {
    var cmd= command.split ('/');
    var bin= cmd[cmd.length -1];
    console.log ("\nError: %s '--config=xxx' mandatory argument missing [try --help]",bin);
    process.exit (-1);
}

// try to parse command
var cli=new Arguments(command, process.argv.slice(2));
    
// parsing failed ?
if (cli.error) process.exit (-1);

// expand verbose option at global level
if (cli.opts.verbose) Verbose = true;


// user select --help exit silently
if (! cli.opts.help) {

    // instanciate a new Gateway Daemon
    var gateway = new GGgateway (cli.config);

    // In verbose mode we listen & display gateway events
    if (cli.opts.verbose) ListenEvents (gateway);

}
 

