/* 
 * Copyright 2014 Fulup Ar Foll.
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

'use strict';

var util        = require("util");
var async       = require('async');
var Debug       = require("./_Debug");
var TrackerCmd  = require("../adapters/CobanSmsCmds");

// In GeoGate development env we use local modules
var GGsmsc; if  (process.env.GEOGATE === 'dev') {
    GGsmsc  = require ("../../smsc/ApiExport");
} else {
    GGsmsc = require('ggsmsc');
}


// SmsControl constructor
function SmsControl (config) {

    this.smsc= new GGsmsc.Client (config);     // connect onto gammu SMSgateway

    this.uid   = 'SmsControl://' + config.smsc;
    this.smsid = 0;  // counter use to track SMS flow

    // inherit debug level from config
    this.debug= config.debug;

}

// import debug method
SmsControl.prototype.Debug = Debug;

SmsControl.prototype.ListCommand = function (callback) {
    for (var slot in TrackerCmd ) {
        callback (slot, TrackerCmd [slot][2]);
    }
};

// this routine format command before pushing to sms queue
SmsControl.prototype.ParseCommand = function (smscmd, callback) {
    var cmd = smscmd.cmd [1];
    var ack = smscmd.cmd [0];

    // scan command & replace %arg%
    for (var slot in smscmd.args) {
       var patern= '%' + slot + '%';
       cmd= cmd.replace(patern, smscmd.args[slot]);
    }

    smscmd.ack= ack; // should we wait for ACK ?

    // check some substitution patterns mismatch
    if (cmd.search ('%') > 0) {
        var error = 'Hoop: Missing arguments cmd=' + cmd;
        this.Debug (1, error);
        callback ({status: -3, err: error});
        return (null);
    }

    // finalize SMS to be sent
    smscmd.msg = cmd;
    smscmd.id  = this.smsid++;

    return (smscmd);
};

// this routine format command before pushing to sms queue
SmsControl.prototype.SendCommand = function (callback, smscmd) {
    var smsparsed = this.ParseCommand(smscmd, callback);
    if (smsparsed === null) {
        return (null);
    } else {
        return (new GGsmsc.Request(this.smsc, callback, smsparsed));
    }
};

// this routine format command before pushing to sms queue
SmsControl.prototype.SendText = function (callback, smscmd) {
    smscmd.id  = this.smsid++;
   return (new GGsmsc.Request(this.smsc, callback, smscmd));
};


// process a batch file
SmsControl.prototype.ProcessBatch = function (callback, phonenumber, password, smscmds) {
    var smsbatch=[];
    var error= 0;

    // add phone number to each smsrqt
    for (var slot in smscmds) {
        var smscmd = smscmds [slot];
        var cmd   = TrackerCmd[smscmd.cmd.toUpperCase()];
        if (cmd === undefined) {
            this.Debug (0, "Unknow command:%s",smscmd.cmd);
            error ++;
        } else {
            smscmd.cmd = cmd;
            smscmd.phone = phonenumber;
            smscmd.args ['pwd'] = password;
            var smsparsed = this.ParseCommand(smscmd, callback);
            if (smsparsed !== null) {
                smsbatch.push(smsparsed);
            } else {
                error++;
            }
        }
    }

    // send batch to smsc
    if (error === 0) {
        new GGsmsc.Batch(this.smsc, callback, smsbatch);
    } else {
        callback ({status: -4, err: "Error Parsing cmds"})
    }
};

// Minimal Unit Testing
function TestSmsControl (config, phonenumber, password) {

    // Batch callback for acknowledgement
    function BatchCB (response) {
        console.log ("### Batch SMS CallBack --> Status=%j", response);

        if (response.status === 0 || response.status === -4) {
              console.log ("SMS Batch Test done");
              setTimeout (process.exit, 1000);
        }
    }


    // application callback for acknowledgement
    function ResponseCB (response) {
        console.log ("### Single SMS CallBack --> Status=%j", response);

        if (response.status === 0) {
            var batch = require('../sample/SmsCommand-batch');
            smscontrol.ProcessBatch (BatchCB, phonenumber, password, batch);
        }

        if (response.status < 0) {
              console.log ("Single SMS Test Fail");
              setTimeout (process.exit, 1000);
        }
    }

    var smsrqt =
    {  phone   : phonenumber               // warning phone number should be a string not a number
        , cmd  : TrackerCmd.CHECK_DEVID  // should send LOAD123456 to phonenumber
        , args : {pwd: password}        // replace %pwd% in _TrackerCmd.js
    };

    var smscontrol = new SmsControl(config);

    var status = smscontrol.SendCommand(ResponseCB, smsrqt);
    if (status === null) {
        console.log ("*** Hoops SendCommand fail");
    }

}

// if started as a main and not as module, then process test.
if (process.argv[1] === __filename) {

    var config = require('../config/_SmsConfig');
    new TestSmsControl(config, process.env.GSM407 , process.env.GSMPWD);
}

module.exports = SmsControl; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/

