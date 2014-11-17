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
 * Tracker2Json is a small debug tool. It wait on a given TCP port for incoming connection.
 * Transforms received packet with a given adapter and display result on console.
 * 
 * ConfigTracker
 *    --phone=xxxx       // tracker phone number
 *    --verbose=1        // display incoming binary NMEA paquet
 *    --debug=xx         // debug level [0-9]
 *
 * Examples:
 *     ConfigTracker --phone=+33xxxxxxxx --command='GPRS_APN:103.10.10.1:1234'
 *
 */

'use strict';

var GammuSms= require('../ApiExport').Client;
var jison   = require("jison").Parser;
var path    = require('path');

var Verbose  = false;

function Arguments (command, args) {
   var cmdgrammar = {  
    "lex": {
        "rules" : [ ["\\s+" , "return 'BLK';"]
            ,['--getfrom='  , "return 'GET';"]
            ,['--getall'    , "return 'LST';"]
            ,['--sendto='   , "return 'SND';"]
            ,['--delbyid='  , "return 'DEL';"]
            ,['--limit='    , "return 'LIM';"]
            ,['--config='   , "return 'CNF';"]
            ,['--msg='      , "return 'MSG';"]
            ,['--message='  , "return 'MSG';"]
            ,['--debug='    , "return 'DEB';"]
            ,['--verbose'   , "return 'VER';"]
            ,['--help'      , "return 'HLP';"]
            ,[','           , "/* ignore */ "]
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
           ,['GET TEX'  ,"this.action='getfrom'; this.phone=$2"]
           ,['SND TEX'  ,"this.action='sendto';  this.phone=$2"]
           ,['DEL TEX'  ,"this.action='delbyid'; this.debug=$2"]
           ,['LST'      ,"this.action='getall'"]

           ,['MSG TEX'  ,"this.msg=$2"]
           ,['CNF TEX'  ,"this.config=$2"]
           ,['LIM TEX'  ,"this.limit=$2"]
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
    
    // get basename from command line
    var cmd= command.split ('/');
    var bin= cmd[cmd.length -1];

    // if help call then display help and exit
    if (this.opts.help)  {
        console.log ("----------------------------------------------------------------------------------------------------------");
        console.log ("## Syntax:  %s --config=xxx --help [--debug=0-9]",bin);
        console.log ("##");
        console.log ("##    %s --config=SampleConfig --getall",bin);
        console.log ("##    %s --config=SampleConfig --getfrom=+33123456789 --limit=1",bin);
        console.log ("##    %s --config=SampleConfig --delbyid=1",bin);
        console.log ("##    %s --config=SampleConfig --sendto=+33123456789 --msg='this is my 1st Gammy message'",bin);
        console.log ("----------------------------------------------------------------------------------------------------------");
    }
}


function DisplayResult (message) {
    var count=1;

    for (var sms in message) {
        console.log("-%d- Inbox SMS=%j", count++, message[sms]);
    }
    process.exit();
}

// #### Main Start #####
var command= process.argv[1];
if (process.argv.length < 4) {
    var cmd= command.split ('/');
    var bin= cmd[cmd.length -1];
    console.log ("\nError: %s '--config=xxx --listall' mandatory argument missing [try --help]",bin);
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
    var config;
    try {
        var dirname = __dirname  + "/../config/";
        var confname=  path.basename (cli.opts.config, ".js");
        config = require(dirname + confname + ".js");
    } catch (e) {
        console.log ("Hoop fail to require [%s] Error=[%s]", cli.opts.config, e);
        process.exit();
    }

    // command line option may overload config file
    if (cli.opts.debug !== undefined) config.debug=cli.opts.debug;
    if (cli.opts.limit !== undefined) config.limit=cli.opts.limit;

    var gammu = new GammuSms (config);

    switch (cli.opts.action) {
        case 'getall':
            gammu.GetAll (DisplayResult);
            break;
        case 'getfrom': // --getfrom=phonenumber
            gammu.GetFrom (DisplayResult, cli.opts.phone);
            break;
        case 'delbyid': // --delbyid=SMSid
            gammu.DelById (DisplayResult, this.cli.smsid);  // delete by ID
            break;
        case 'sendto': // --sendto=phonenumber --msg=xxxxxxxx
            var sms = {phone:  cli.opts.phone, msg: cli.opts.msg};
            gammu.SendTo (DisplayResult, sms);
            break;
        default:
             console.log ("\nHoops unknown option=[%s] check --help]", cli.opts.action);
             process.exit();
    }
}
 

