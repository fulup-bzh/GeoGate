GeoGate-SmsClient
==================

SmsClient supports SMS interface with Gammu SMS gateway.
It is used for tracker initial configuration by SMS. This module
leverage MySQL Gammy backend to exchange with the gateway.

In order to use this module, you need a working Gammy SMS gateway
configure with MySQL backend. For details check http://fr.wammu.eu/smsd/

Install
=======

       npm install ggsmsc
       cd node_modules/ggsmsc/

Command line
=============
       # Standalone send/receive SMS
       node ./bin/SendRecSms.js --config=config/SampleConfig.js --getall
       node ./bin/SendRecSms.js --config=config/SampleConfig.js --getfrom=+33619921323 --limit=1
       node ./bin/SendRecSms.js --config=config/SampleConfig.js --sendto=+33xxxxxxx --msg='ceci est un message de test'

Raw API Usage
==============
       var GGsmsc = require("ggsmsc").Client;
       
       var SmscConfig =
           { debug   : 1            // can be overloaded with --debug in cli
           , hostname: '10.10.11.1' // Gammu MySql config
           , username: 'smsd'  
           , basename: 'smsd'
           , password: '123456'
       
           , smsc    : '+33xxxxxxx'  // your SMS gateway phone number
           , report  : true          // enforce delivery report when sending
           };

       function DisplayCallback (message) {
           var count=1;
           for (var sms in message) {
               console.log("-%d- Inbox SMS=%j", count++, message[sms]);
           }
       }

       var smsc = new GGsmsc (SmscConfig);
       simulator.event.on("position",MyEventHandler4Position);   // GPS position report
       simulator.event.on("static"  ,MyEventHandler4Statics);    // AIS static data report

       smsc.GetAll  (DisplayCallBack);
       smsc.GetFrom (DisplayCallBack, '+xxPhonexxxNumberxxx');
       smsc.DelById (this.cli.smsid);
       smsc.CheckById (this.cli.smsid);
       smsc.SendTo  (DisplayCallBack, {phone: '+xxPhonexxxNumberxxx', 'This is my message'});

Api with Acknowledgement
=========================

       var GammuConfig =
           { debug   : 1            // can be overloaded with --debug in cli
           , hostname: '10.10.11.1' // Gammu MySql hostname
           , username: 'smsd'       // MySql user
           , basename: 'smsd'       // MySql base
           , password: '123456'     // MySql password

           , smsc    : '+33123456'  // your SMS gateway phone number
           , report  : true         // enforce delivery report when sending [not an application acknowledgement]

           , delay   : 4000         // xx mseconds delay in between two check of outbox send sms table
           , retry   : 10           // number of retry before refusing removing waiting sms from Gammu output queue
           };

       function TestSmsRequest (config, phonenumber) {

           function ResponseCB (data) {
                switch (data.status ) {
                    case -1: console.log ("Id=%s Fail to Send SMS", data.smsid)
                        break;
                    case -2: console.log ("Id=%s Timeout waiting acknowledgement", data.smsid);
                        break;
                    case 1: console.log ("Id=%s Message Sent", data.smsid);
                        break;
                    case 2: console.log ("Id=%s Ack Received [%s]", data.smsid, data.msg);
                        break;
                    case 0: console.log ("Id=%s SMS sent complete status OK", data.smsid);
                        break;
                }
           };

           var MySmsRqt =  {
                 phone   : '+33............'      // warning phone number should be a string not a number
               , ack     : true                   // wait for target to send back an acknowledgement response
               , msg     : "This is my Test Message"
           };

           smsc= new GGsmsc (config);    // connect gammu SMS gateway
           new SmsRequest (smsc, ResponseCB, MySmsRqt); // send SMS and Request ACK in ResponseCB
       }


       new TestSmsRequest (GammuConfig, process.env.GSMFULUP);

API SMS Batch
==============

        function ResponseCB (response) {
            console.log ("### Testing CallBack --> Response=%j", response);
            if (response.status ===0) process.exit();
        };

        var MySmsRqt1 =  {
              phone   : phonenumber            // warning phone number should be a string not a number
            , ack     : false                  // don't wait for target to send back an acknowledgement response
            , msg     : "This is my 1st Testing Message"
        };
        var MySmsRqt2 =  {
              phone   : phonenumber            // warning phone number should be a string not a number
            , ack     : false                  // don'twait for target to send back an acknowledgement response
            , msg     : "This is my 2nd Testing Message"
        };
        var MySmsRqt3 =  {
              phone   : phonenumber            // warning phone number should be a string not a number
            , ack     : false                  // don't wait for target to send back an acknowledgement response
            , msg     : "This is my 3rd Testing Message"
        };

        this.smsc= new GGsms.Client (config);     // connect onto gammu SMSgateway
        new SmsBatch   (this.smsc, ResponseCB, [MySmsRqt1,MySmsRqt2,MySmsRqt3]);
