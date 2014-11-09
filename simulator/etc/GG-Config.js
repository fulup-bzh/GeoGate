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
 * 
 * 
 */
'use strict';


var AppConfig =
    { GPX_DIR : "/../sample/aishub/"     //where to find GPX routes
    , SVC_POR : 4001                     // what ever please you
    , DBG_LEV : 1                        // from 0 to 9
    , AIS_TIC : 10                       // ais refresh status report rate
    , SCK_PSE : 500                      // wait 0.5s in between each message
    , FMT_OUT : "AIS"                    // Format output presentation: AIS,JSON,GEOJSON,CVS
};

module.exports = AppConfig; // http://openmymind.net/2012/2/3/Node-Require-and-Exports/
