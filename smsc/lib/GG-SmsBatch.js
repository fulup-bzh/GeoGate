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
 *
 * Provide control login on top of GammuMsq to check for Acknowledgement
 * reference: http://wammu.eu/docs/manual/smsd/tables.html
 */

var SmsRequest= require('./GG-SmsRequest');
var Debug = require('./_Debug');

// this method send a batch of SMS and call user CB with status=0 when finish
function SmsBatch (smsc, callback, smsarray) {
    var idx=0;

    // when message is processed move to next one otherwise call user applicationCB
    function InternalCB (data) {

        // [good or bad] let's notify user application
        if (data.status != 0) callback (data);

        // it's time to move to next message
        if (data.status <= 0) {
            if (++idx < smsarray.length) {
                new SmsRequest (smsc, InternalCB, smsarray [idx]);
            } else {
                callback ({status: 0});
            }
        }
    }

    // let's start by sending 1st SMS of the array
    new SmsRequest(smsc, InternalCB, smsarray [idx]);
}

// import debug method
TestSmsBatch.prototype.Debug = Debug;

// Small Class for unit test
function TestSmsBatch (config, phonenumber) {

    function ResponseCB (response) {
        console.log ("### Testing CallBack --> Response=%j", response);
        if (response.status ===0) process.exit();
    }

    var MySmsRqt1 =  {
          phone   : phonenumber            // warning phone number should be a string not a number
        , ack     : false                  // wait for target to send back an acknowledgement response
        , msg     : "This is my 1st Testing Message"
    };
    var MySmsRqt2 =  {
          phone   : phonenumber            // warning phone number should be a string not a number
        , ack     : false                  // wait for target to send back an acknowledgement response
        , msg     : "This is my 2nd Testing Message"
    };
    var MySmsRqt3 =  {
          phone   : phonenumber            // warning phone number should be a string not a number
        , ack     : false                  // wait for target to send back an acknowledgement response
        , msg     : "This is my 3rd Testing Message"
    };

    this.smsc= new GGsmsc.Client (config);     // connect onto gammu SMSgateway
    new SmsBatch   (this.smsc, ResponseCB, [MySmsRqt1,MySmsRqt2,MySmsRqt3]);
}

// if started as a main and not as module, then process test.
if (process.argv[1] === __filename) {

    // take local config and a phone from Linux bash env for test
    var config = require('../config/SampleConfig');
    new TestSmsBatch (config, process.env.GSMFULUP);
}


module.exports = SmsBatch; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/