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
 * SendRecSms
 *    --phone=xxxx       // tracker phone number
 *    --send="xxxxx"     // message to send
 *    --rec              // receive message
 *    --list             // list queued messages [inbox & outbox]
 *    --verbose=1        // display incoming binary NMEA paquet
 *    --debug=xx         // debug level [0-9]
 *
 * Example:
 *     SendRecSms --phone=+33xxxxxxxx --send='This is my message'
 *     SendRecSms --list
 *     SendRecSms --rec --phone=+33xxxxx
 *
 */

'use strict';


var SmsControl = require('../lib/GG-SmsControl');
var SmsConfig  = require('../config/_SmsConfig');
var TrackerCmd = require('../lib/_TrackerCmd').SmsTo;
var path       = require('path');

var jison      = require("jison").Parser;
var Verbose    = false;

function Arguments (command, args) {
   var cmdgrammar = {  
    "lex": {
        "rules" : [ ["\\s+" , "return 'BLK';"]
            ,['--command='  , "return 'CMD';"]
            ,['--cmd='      , "return 'CMD';"]
            ,['--pwd='      , "return 'PWD';"]
            ,['--password=' , "return 'PWD';"]
            ,['--args='     , "return 'ARG';"]
            ,['--batch='    , "return 'FIL';"]
            ,['--phone='    , "return 'PHO';"]
            ,['--list'      , "return 'LST';"]
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
           ,['CMD TEX'  ,"this.cmd=$2"]
           ,['PWD TEX'  ,"this.pwd=$2"]
           ,['DEB TEX'  ,"this.debug=$2"]
           ,['ARG TEX'  ,"this.args=$2"]
           ,['FIL TEX'  ,"this.batch=$2"]
           ,['PHO TEX'  ,"this.phone=$2"]
           ,['LST'      ,"this.list=true"]
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

    // special args processing to include it directly on SmsRequest
    var args = this.opts.args;
    this.opts.args={pwd: this.opts.pwd};

    if (args !== undefined) {
        var values=  args.split(' ');
        for (var slot in values) {
             var val = values [slot].split (':');
             this.opts.args[val[0]] = val[1];
        }
    }

    // get basename from command line
    var cmd= command.split ('/');
    var bin= cmd[cmd.length -1];

    // if help call then display help and exit
    if (this.opts.help)  {
        console.log ("----------------------------------------------------------------------------------------------------------");
        console.log ("## Syntaxe:  %s [--debug=0/9]--phone=xxxx --password=xxxxxx --command=xxxx",bin);
        console.log ("## Syntaxe:  %s --list   # return avaliable commands",bin);
        console.log ("##");
        console.log ("## Examples:");
        console.log ("##     %s --debug=3 --phone=+33xxxxxxxxx --password=123456  --command=load ",bin);
        console.log ("##     %s --debug=3 --phone=+33xxxxxxxxx --password=123456  --batch=sample/SmsCommand-batch.js ",bin);
        console.log ("##     %s --debug=3 --phone=+33xxxxxxxxx --password=123456  --command=GPRS_APN --args= 'apn:xxxx'",bin);
        console.log ("##     %s --debug=3 --phone=+33xxxxxxxxx --password=123456  --command=GPRS_URI --args='host:xxxxx port:xxxx' ",bin);
        console.log ("----------------------------------------------------------------------------------------------------------");
        return(0);
    }
}


// #### Main Start #####
var command= process.argv[1];
if (process.argv.length < 3) {
    var cmd= command.split ('/');
    var bin= cmd[cmd.length -1];
    console.log ("\nError: %s '--cmd=xxx' mandatory argument missing [try --help]",bin);
    process.exit (-1);
}


// Minimal Unit Testing Method
function BatchResponseCB (data) {
    switch (data.status ) {
        case -1: console.log (" SMS -%d- Fail to Send SMS", data.smsid);
            break;
        case -2: console.log (" SMS -%d- Timeout waiting acknowledgement", data.smsid);
            break;
        case 1: console.log (" SMS -%d- Message Sent", data.smsid);
            break;
        case 2: console.log (" SMS -%d- Acknowledgement=[%s]", data.smsid, data.msg.ack);
            break;
        default:
    }
    // quit except if we wait for ack [leave some time to DB to close operation]
    if (data.status === 0) {
        console.log ('Last SMS from batch processed');
        setTimeout(process.exit, 1000);
    }
}

// Minimal Unit Testing Method
function SingleResponseCB (data) {
    switch (data.status ) {
        case -1: console.log (" SMS Fail to Send SMS");
            break;
        case -2: console.log (" SMS Timeout waiting acknowledgement");
            break;
        case 1: console.log (" SMS  Message Sent");
            break;
        case 2: console.log (" SMS  Acknowledgement=[%s]", data.msg.ack);
            break;
        default:
    }
    // quit except if we wait for ack [leave some time to DB to close operation]
    if (data.status <= 0)  setTimeout (process.exit, 1000);
}

// try to parse command
var cli=new Arguments(command, process.argv.slice(2));
    
// parsing failed ?
if (cli.error) process.exit (-1);

// expand verbose option at global level
if (cli.opts.verbose) Verbose = true;

// command line option may overload config file
if (cli.opts.debug !== undefined) SmsConfig.debug=cli.opts.debug;

// user select --help exit silently
if (! cli.opts.help) {

    if (cli.opts.phone === undefined) {
        console.log ("Hoops: Missing --phone=xxxxx");
        process.exit();
    }

    if (cli.opts.pwd === undefined) {
        console.log ("Hoops: Missing --password=xxxxx");
        process.exit();
    }

    var smscontrol = new SmsControl(SmsConfig);

    // list available command in driver
    if (cli.opts.list) {
        smscontrol.ListCommand(function(cmd, help){console.log ("[%s] %s", cmd, help)});
        process.exit();
    }

    // process batch file
    if (cli.opts.batch !== undefined) {
        var batch;
        var dirname = path.dirname (cli.opts.batch);
        var confname=  path.basename (cli.opts.batch, "-batch.js");
        try {
            batch = require(process.env.PWD + '/' + dirname + '/' + confname + "-batch.js");
        } catch (e) {
            console.log ("Hoop fail to require [%s] Error=[%s]", cli.opts.batch, e);
            process.exit();
        }

        smscontrol.ProcessBatch (BatchResponseCB, cli.opts.phone, cli.opts.pwd,  batch);
    } else {

        var smsrqt =
        {
            phone: cli.opts.phone              // warning phone number should be a string not a number
            , cmd: TrackerCmd[cli.opts.cmd.toUpperCase()], args: cli.opts.args              // replace %pwd% in _TrackerCmd.js
        };

        var status = smscontrol.SendCommand(SingleResponseCB, smsrqt);
        if (status === null) {
            console.log("*** Hoops Expanding Command %patern% failed");
            process.exit();
        }
    }
}

