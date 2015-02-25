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

var AjaxGateway= require("../lib/GG-AjaxGateway");

var config =  { debug : 3
        , name : 'Ajax2Sms'
        , listenPort: '8088'

    ,smsc : { debug   : 3  // can be overloaded with --debug in cli
        , hostname: '10.10.11.1' // Gammu MySql hostname
        , username: 'smsd'       // Gammu MySql user
        , basename: 'smsd'
        , password: '!GizKoz'

        , smsc    : '+33123456'  // your SMS gateway phone number
        , report  : true         // enforce delivery report when sending

        , delay   : 3500        // xx mseconds delay in between two check of outbox send sms table
        , retry   : 25          // number of retry before refusing removing outgoing sms MySql  queue
    }

    ,userdb : { debug   : 5  // can be overloaded with --debug in cli
        , hostname: 'localhost'
        , username: 'geotobe'
        , basename: 'geotobe'
        , password: '!GizKoz'
    }

};

new AjaxGateway (config);
