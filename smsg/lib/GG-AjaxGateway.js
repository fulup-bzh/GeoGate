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

process.env['TZ'] = 'UTC'; // Update gateway internal time to UTC

var util        = require("util");
var fs          = require('fs');
var path        = require('path');
var async       = require("async");
var http        = require("http");
var url         = require("url");


var EventEmitter    = require("events").EventEmitter;

var Debug      = require("./_Debug");
var AjaxBackend= require("./GG-AjaxBackend");
var SmsControl = require("./GG-SmsControl");
var SmsCmd     = require("../adapters/CobanSmsCmds");



function BatchRequest (gateway, query, response) {

    this.gateway  = gateway;
    this.query    = query;
    this.response = response;
    this.debug    = gateway.debug;  // inherit from gateway debug level
};

BatchRequest.prototype.CheckTrackerBySms = function (tracker, query) {
    var gateway  = this.gateway;
    var response = this.response;
    var self     = this;




}
BatchRequest.prototype.CheckTrackerBySms = function (tracker, query) {
    var gateway  = this.gateway;
    var response = this.response;
    var self     = this;

    function SmsBatchCB (data) {
        switch (data.status ) {
            case -1: gateway.Debug (2,"ConfigTrackerBySms -%d- Fail to Send SMS", data.smsid);
                break;
            case -2: gateway.Debug (2,"ConfigTrackerBySms -%d- Timeout waiting acknowledgement", data.smsid);
                break;
            case 1: gateway.Debug (2,"ConfigTrackerBySms  -%d- Message Sent", data.smsid);
                break;
            case 2: gateway.Debug (2,"ConfigTrackerBySms  -%d- Acknowledgement=[%s]", data.smsid, data.msg.ack);
                break;
            default:
                gateway.Debug (2,"ConfigTrackerBySms  -%d- status=[%s]", data.smsid, data.status);
        }
    }

    function RetreiveImeiCB (data) {
        switch (data.status ) {
            case -1:
                gateway.Debug (1,"CheckTrackerBySms SMS sent fail phone=[%s]", query.phonenum)
                response.writeHeader(400, {"Content-Type": "text/plain"});
                response.write(JSON.stringify ({status:'ERR', phonenum: query.phonenum}));
                response.end();
                break;

            case -2:
                gateway.Debug (2,"CheckTrackerBySms SMS timeout phone=[%s]", query.phonenum)
                response.writeHeader(200, {"Content-Type": "text/plain"});
                response.write(JSON.stringify ({status:'SNT', phonenum: query.phonenum}));
                response.end();
                break;
            case 1:
                gateway.Debug (3,"CheckTrackerBySms SMS sent phone=[%s]", query.phonenum)
                break;
            case 2:
                // return EMEI to application
                gateway.Debug (3,"CheckTrackerBySms SMS sent phone=[%s] Response=[%s]", query.phonenum, data.msg.ack)
                response.writeHeader(200, {"Content-Type": "text/plain"});
                response.write(JSON.stringify ({status:'ACK', phonenum: query.phonenum, imeinum: data.msg.ack}));
                response.end();

                // if operator is available try to configure the APN
                if (query.apn  != undefined) {

                    var smsbatch = [
                        // {cmd: 'GPRS_PROTO', args: {proto: "18"} }
                          {cmd: 'GPRS_APN', args: {apn: query.apn} }
                        , {cmd: 'GPRS_URI', args: {host: query.host, port: query.port}}
                        , {cmd: 'GPRS_MOD', args: {} }
                        , {cmd: 'OBD_MOD'    , args: {mod: '1'}}
                        , {cmd: 'GPRS_LESS'  , args: {} }
                        , {cmd: 'LOCALTIME'  , args: {zone:  '0'} }
                        , {cmd: 'TRACK_MANY' , args: {delay: '15m'} }
                        , {cmd: 'TRACK_DIST' , args: {dist:  '0300'} }
                        , {cmd: 'TRACK_ANGLE', args: {angle: '015'} }
                    ];
                    self.gateway.smsc.ProcessBatch(SmsBatchCB, query.phonenum, query.passwd, smsbatch);

                }
                break;
            default:
                gateway.Debug (2,"ConfigTrackerBySms  -%d- checkIEMEI status=[%s]", data.smsid, data.status);

        }
    };

    function SmsSentCB (data) {
        console.log ("SMS accepted data.status=" + data.status)
        switch (data.status ) {
            case -1:
            default:
                gateway.Debug (1,"CheckMobileBySms SMS sent fail phone=[%s]", query.phonenum)
                response.writeHeader(400, {"Content-Type": "text/plain"});
                response.write(JSON.stringify ({status:'ERR', phonenum: query.phonenum}));
                response.end();
                break;

            case 0:
                gateway.Debug (3,"CheckMobileBySms SMS sent phone=[%s]", query.phonenum)
                response.writeHeader(200, {"Content-Type": "text/plain"});
                response.write(JSON.stringify ({status:'ACK', phonenum: query.phonenum}));
                response.end();
            case 1:
            case 2:
        }
    };

    // warning call is done outside of calling object context
    if (tracker) {
        this.gateway.smsc.SendCommand(RetreiveImeiCB, {
            phone: query.phonenum,
            cmd: SmsCmd.CHECK_IMEI,
            args: {pwd: query.passwd}
        });
    } else {
        this.gateway.smsc.SendCommand(SmsSentCB, {
            phone: query.phonenum,
            cmd: SmsCmd.CHECK_SMS,
            args: {info: query.info}
        });
    }
}

BatchRequest.prototype.SendSmsText = function (nowait, query) {
    var gateway  = this.gateway;
    var response = this.response;
    var self     = this;

    function SmsSentCB (data) {
        console.log ("SMS accepted data.status=" + data.status)
        switch (data.status ) {
            case -1:
            default:
                gateway.Debug(1, "SendSmsText SMS sent fail phone=[%s] err=[%s]", query.phonenum, data.error)
                if (!query.nowait) {
                    response.writeHeader(400, {"Content-Type": "text/plain"});
                    response.write(JSON.stringify({status: 'ERR', phonenum: query.phonenum, info: data.error}));
                    response.end();
                }
                break;

            case 0:
                gateway.Debug (3,"SendSmsText SMS sent phone=[%s]", query.phonenum)
                if (!query.nowait) {
                    response.writeHeader(200, {"Content-Type": "text/plain"});
                    response.write(JSON.stringify({status: 'ACK', phonenum: query.phonenum}));
                    response.end();
                }
            case 1:
            case 2:
        }
    };

    this.gateway.smsc.SendText(SmsSentCB, {
        phone: query.phonenum,
        ack  : false,  // do not wait for a device reply
        msg  : query.smstext
    });

    // if no query->nowait return OK status immediately
    if (query.nowait) {
         response.writeHeader(200, {"Content-Type": "text/plain"});
         response.write(JSON.stringify({status: 'ACK', phonenum: query.phonenum}));
         response.end();
    }
}

BatchRequest.prototype.CheckAccessCode = function (sqlResponse) {

        // if access token is invalid stop here
        if (sqlResponse.token != this.query.token) {

            response.writeHeader(400, {"Content-Type": "text/plain"});
            response.write('ERR: Invalid IMEI/Token in Http Request');
            response.end();
            return;
        }

        // access token fit with EMEI let's move to next step
        // this.PushBatch();
};



// Import debug method
BatchRequest.prototype.Debug = Debug;

// Main user entry point to create gpstracking service
function AjaxGateway(opts) {

    // in HTTP mode they is not initial connection concept adapter as to handle data.
    function HttpRequest (request, response) {
        this.gateway.Debug(7, "Data=[%s]", request.url);

        var question=url.parse(request.url, true, true);
        var query=question.query;

        var batchRequest = new BatchRequest(this.gateway, query, response);
        var command = path.basename(question.pathname);
        var tracker = true;

        if (query.phonenum == undefined) {
            this.gateway.Debug (0,"Hoops phonenum undefined");
            response.writeHeader(400, {"Content-Type": "text/plain"});
            response.write('ERR: AjaxSMS check-phonenum missing phonenum=xxxxx');
            response.end();
            return;
        }

        switch (command)  {

            case "check-dev-mobile":
                tracker=false;
            case "check-dev-tracker": // http://geotobe.localnet/smsgateway/check-dev-tracker?phonenum=+33782849007&passwd=123456&apn=free&host=46.105.45.122&port=4010
                batchRequest.CheckTrackerBySms(tracker, query);
                break;

            case "send-sms-text":
                batchRequest.SendSmsText(tracker, query);
                break;

            case 'check-accesscode':
                this.backend.getByEmei(batchRequest.CheckAccessCode, query.imeinum);
                break;

            default:
                response.writeHeader(400, {"Content-Type": "text/plain"});
                response.write('ERR: AjaxSMS command: ['+ command + '] in Http Request');
                response.end();
        }

    }

    function TcpSvrListenOk () {
        this.gateway.Debug (1,"AjaxGateway [%s] listening", this.uid);
    }

    // Server fail to listen on port [probably busy]
    function TcpSvrListenFx (err) {
        this.gateway.Debug (0,"Hoop fail to listen err=%s", err);
        console.log ("### AjaxGateway process abort ###");
        process.exit (-1);
    }

    this.uid   = "AjaxGateway:" + opts.name;
    this.debug =  opts.debug;   

    // Compute some opts and provide some defaults
    this.opts            =
    { name:       opts.name || "smsg"
    , debug:      opts.debug || 1     // default 1
    , inactivity: opts.timeout || 60  // default 1mn
    };

    this.smsc = new SmsControl (opts.smsc);

    this.backend = new AjaxBackend (this, opts.userdb);

    this.Debug (1,"AjaxGateway Start: %s", opts.name );
    this.AjaxGateway           = http.createServer(HttpRequest);
    this.AjaxGateway.gateway   = this;
    this.AjaxGateway.backend   = this.backend;
    this.AjaxGateway.uid       = "AjaxGateway:" + opts.listenPort;
    this.AjaxGateway.listen(opts.listenPort, TcpSvrListenOk);
    this.AjaxGateway.on('error', TcpSvrListenFx);
};
AjaxGateway.prototype.Debug = Debug;


module.exports = AjaxGateway;