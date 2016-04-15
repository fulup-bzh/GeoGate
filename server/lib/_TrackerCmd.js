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

var FromTracker =
 { TRACK     : 0
 , LOGIN     : 1
 , PING      : 2
 , OBD       : 3
 , TMPLOG    : 4

 , HELPME    : 5 // help me,1409050559,1234,F,215931.000,A,4737.1058,N,00245.6524,W,0.00,0;"
 , HELPOFF   : 6 // Stop SOS: et,1010181049,00420777123456,F,094922.000,A,5004.5335,N,01426.7305,E,0.00,;"

 , BATLOW    :10 // low battery,0809231429,13554900601,F,062947.294,A,2234.4026,N,11354.3277,E,0.00,;"
 , SPEEDON   :11 // Speed on; ht,1010181032,00420777123456,F,093203.000,A,5004.5378,N,01426.7328,E,0.00,;"
 , ALARMSPEED:12 // Alarm speed; speed,150301163002,,F,163002.000,A,4739.6799,N,00252.3197,W,55.70,280.89,,1,0,0.0%,,"
 , STOCKAD   :13 // stockade,0809231429,13554900601,F,062947.294,A,2234.4026,N,11354.3277,E,0.00,;"

 , BATTERY   :15
 , SENSOR    :16 // sensor alarm,1409070008,,F,160844.000,A,4737.0465,N,00245.6099,W,21.21,306.75"
 , TIMEZONE  :17 // TimeZone: it,141112230446,,F,110446.000,A,4737.1068,N,00245.6503,W,0.31,269.97,,1,0,0.0%,,

 , ALARMDOOR :20 // door alarm,1010181112,00420777123456,F,101216.000,A,5004.5502,N,01426.7268,E,0.00,;"
 , ALARMACC  :21 // ac alarm,1010181112,00420777123456,F,101256.000,A,5004.5485,N,01426.7260,E,0.00,;"
 , ALARMON   :22 // Turn alarm: gt,1010181046,00420777123456,F,094657.000,A,5004.5251,N,01426.7298,E,0.00,;

 , PARKOFF   :30 // Park off: mt,1010181029,00420777123456,F,092913.000,A,5004.5392,N,01426.7344,E,0.00,;"
 , PARKON    :31 // Park On: lt,1010181025,00420777123456,F,092548.000,A,5004.5399,N,01426.7352,E,0.00,;"
 , ENGINEOFF :32 // Stop Engine: jt,1010181051,00420777123456,F,095123.000,A,5004.5234,N,01426.7295,E,0.00,;"
 , ENGINEON  :33 // Resume Engine: kt,1010181052,00420777123456,F,095256.000,A,5004.5635,N,01426.7346,E,0.58,;"
 };

var ToTracker =
  { LOGIN:              1
  , LOGOUT:             2
  , WELLCOME:           3

  , GET_TRACK:         10
  , GET_OBD:           11
  , SET_TRACK_BY_TIME: 12
  , SET_BY_DISTANCE:   13
  , STOP_TRACK:        14

  , STOP_SOS:          20
  , ALARM_ON:          21
  , ALARM_OFF:         22
  , GEOFENCE:          23
  , SET_MOVE_ALARM:    24
  , SET_SPEED_ALARM:   25

  , ENGINE_OFF:        25
  , ENGINE_ON:         26

  , GET_SDCARD:        30
  , GET_PHOTO:         31

  , SET_ECOMOD:        40
  , SET_TIMEZONE:      41
  , GPRS_OFF:          42

  , HELP:              50
};


var TrackerCmd =
  { GetFrom: FromTracker
  , SendTo: ToTracker
};

module.exports = TrackerCmd;
