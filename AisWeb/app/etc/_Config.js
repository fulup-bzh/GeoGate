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

var fs = require('fs');

function Config () {
   'use strict';
   var values=[];
   var extention='-l4a.js';
   var conf;

   // Configs file path last one supersead first one.
   var files= [__dirname + "/AppDefaults.js", "/etc/default/noderc"+ extention, process.env.NODERC, process.env.HOME + "/.noderc"+ extention , __dirname +"/../../.noderc.js" ];

   // Parse any existing files within config list & merge them
   for (var idx in files) { 
      if (files[idx]) {
        //console.log ("files=", files[idx]);  
        if (fs.existsSync (files[idx])) conf=require (files[idx]);
        for (var i in conf) values[i] = conf[i];
      }     
   }
   
 // set path to search for node_module within parent directory
 process.env.NODE_PATH= process.env.NODE_PATH + '../node_modules';
   
 // console.log ("values=", values);
 return values;
}

module.exports = Config();
