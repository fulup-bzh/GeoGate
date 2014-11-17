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

var GGsmsc= require('../ApiExport').Client;
var Debug = require('./_Debug');

// this object handle sms transaction. SmsRequest call application callback
// with a status [1=send to phone, -1=fail to send] [2=ack received, -2 ack not received]
function SmsRequest (smsc, appcb, smscmd) {
    var self=this; // nodejs is still a bad language
    this.debug = smsc.debug;
    this.retry = 0;

    // this method is called when DelById is executed
    function DelByIdCB (err) {
        self.Debug (9,"DelCallBack err=%s", err);
    }

    // this method is called by MySql when sms.GetFrom return
    function CheckDevAckCB(err, results) {
        self.retry ++; // retry counter for ACK
        self.Debug (6, "CheckDevAckCB Phone=%s Retry=%d/%d Result=%j", smscmd.phone, self.retry, smsc.opts.retry, results);
        // ack no received
        if (results.length === 0) {
            if (self.retry <= smsc.opts.retry) {
                setTimeout (function() {CheckDevAck ();}, smsc.opts.delay);
            } else {
                self.Debug (7, "CheckDevAckCB Ack Abandoned MaxRetry=%s", smsc.opts.retry);
                appcb ({status: -2, smsid: smscmd.id});
            }
        } else {
            // we may have more than one responses for a given command
            for (var slot in results) {
                var ack =
                { status: 2
                    , smsid: smscmd.id
                    , phone: smscmd.phone
                    , ack: results[slot].TextDecoded
                };
                // ACK received, delete it from inbox and send it to application
                self.Debug (6, "CheckDevAckCB Ack Received %j", ack);
                smsc.DelById (DelByIdCB, results[slot].Id);
                appcb({status: 2, smsid: smscmd.id, msg: ack});
            }
            appcb({status: 0});
        }
    }

    // this method check sms inbox table for OK ack from device
    function CheckDevAck() {
        self.Debug (3,"Waiting Acknowledgment Response %d/%d", self.retry, smsc.opts.retry);
        smsc.GetFrom (CheckDevAckCB, smscmd.phone)
    }

    // this function is call when MySql checked outbox
    function CheckOutboxCB(err, results) {
        var result = results[0];  // Query result is alway an array of response even when unique
        self.retry ++; // update retry counter
        // if message is still in queue retry
        self.Debug (6,"CheckOutboxCB Phone=%s Result=%j Retry=%d/%d", smscmd.phone, result, self.retry, smsc.opts.retry);
        if (result !== undefined) {
            // message is still in queue loop one more time
            if (self.retry <= smsc.opts.retry) {
                setTimeout (function() {CheckOutbox (result.ID);}, smsc.opts.delay);
            } else {
                // notify appcb that SMS failed and was deleted
                self.Debug (6,"CheckOutboxCB Fail SqlId=%s SMS=%j", result.ID, smscmd);
                smsc.DelById (DelByIdCB, result.ID);
                appcb ({status: -1, smsid: smscmd.id});

            }
        } else {
            // le message à été expédié
            self.Debug (6,"CheckOutboxCB OK SMS=%j", smscmd);
            appcb ({status: 1, smsid: smscmd.id});

            // if an acknowledgement is asked loop until we get it.
            if (smscmd.ack) {
                self.retry = 0; // reset retry counter for ack
                setTimeout (function() {CheckDevAck (smscmd);}, smsc.opts.delay);
            } else {
                  appcb ({status: 0});
            }
        }
    }

    // this function loop until SMS is effectively sent
    function CheckOutbox (insertId) {
        self.Debug (3,"Waiting Sent Confirmation  %d/%d", self.retry, smsc.opts.retry);
        smsc.CheckById (CheckOutboxCB, insertId)
    }

    // this function is called when MySql inserted SMS in outbox
    function SendToCB (err, result) {
        // check if sms was sent from output table
        self.Debug (7,"SendToCB SMS=%j result=%j err=%j", smscmd, result, err);
        if (err) {
            self.Debug (1, "Insert in MySql outbox refused %s", err);
            appcb ({status: -1, id: smscmd.id, error: err});
        } else {
            setTimeout (function() {CheckOutbox (result.insertId);}, smsc.opts.delay);
        }
    }
    this.Debug (2,"Queuing Phone=%s SMS=%s", smscmd.phone, smscmd.msg);
    smsc.SendTo (SendToCB, smscmd);
}

// import debug method
SmsRequest.prototype.Debug = Debug;

// Small Class for unit test
function TestSmsRequest (config, phonenumber) {

    function ResponseCB (status) {
        console.log ("### Testing CallBack --> Status=%j", status);
    }

    var MySmsRqt1 =  {
          phone   : phonenumber            // warning phone number should be a string not a number
        , ack     : true                   // wait for target to send back an acknowledgement response
        , msg     : "This is my Single Testing Message"
    };

    this.smsc= new GGsmsc (config);     // connect onto gammu SMSgateway
    new SmsRequest (this.smsc, ResponseCB, MySmsRqt1);
}

// if started as a main and not as module, then process test.
if (process.argv[1] === __filename) {

    // take local config and a phone from Linux bash env for test
    var config = require('../config/SampleConfig');
    new TestSmsRequest (config, process.env.GSM407);
}


module.exports = SmsRequest; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/