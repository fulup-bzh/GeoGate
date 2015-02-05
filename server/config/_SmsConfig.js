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
 * This is a small interface to send and receive Gammu MySql Backend
 */

'use strict';

var GammuConfig =
    { debug   : 3            // can be overloaded with --debug in cli
    , hostname: '10.10.11.1' // Gammu MySql hostname
    , username: 'smsd'       // Gammu MySql user
    , basename: 'smsd'
    , password: '123456'     // MySQL PWD

    , smsc    : '+33123456'  // your SMS gateway phone number
    , report  : true         // enforce delivery report when sending

    , delay   : 3000        // xx mseconds delay in between two check of outbox send sms table
    , retry   : 20          // number of retry before refusing removing outgoing sms MySql  queue
    };

module.exports = GammuConfig;