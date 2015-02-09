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
 { LOGIN     : 1
 , TRACK     : 2
 , OBD       : 3
 , PING      : 4
 , HELPME    : 5 // help me,1409050559,1234,F,215931.000,A,4737.1058,N,00245.6524,W,0.00,0;"
 , HELPOFF   : 6 // Stop SOS: et,1010181049,00420777123456,F,094922.000,A,5004.5335,N,01426.7305,E,0.00,;"

 , BATLOW    :10 // low battery,0809231429,13554900601,F,062947.294,A,2234.4026,N,11354.3277,E,0.00,;"
 , SPEEDON   :11 // Speed on; ht,1010181032,00420777123456,F,093203.000,A,5004.5378,N,01426.7328,E,0.00,;"
 , STOCKAD   :12 // stockade,0809231429,13554900601,F,062947.294,A,2234.4026,N,11354.3277,E,0.00,;"
 , BATTERY   :13 
 , SENSOR    :14 // sensor alarm,1409070008,,F,160844.000,A,4737.0465,N,00245.6099,W,21.21,306.75"
 , TIMEZONE  :15 // TimeZone: it,141112230446,,F,110446.000,A,4737.1068,N,00245.6503,W,0.31,269.97,,1,0,0.0%,,

 , ALARMDOOR :20 // door alarm,1010181112,00420777123456,F,101216.000,A,5004.5502,N,01426.7268,E,0.00,;"
 , ALARMACC  :21 // acc alarm,1010181112,00420777123456,F,101256.000,A,5004.5485,N,01426.7260,E,0.00,;"
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
  , SET_SPEED_SMS:     25

  , ENGINE_OFF:        25
  , ENGINE_ON:         26

  , GET_SDCARD:        30
  , GET_PHOTO:         31

  , SET_ECOMOD:        40
  , SET_TIMEZONE:      41
  , GPRS_OFF:          42

  , HELP:              50
};

var SmsTracker=
 { CHECK_SMS   : [0,'Control: %info%'         , "On to verify that number accept SMS"]
 , FULL_RESET  : [1,'begin%pwd%'              , "WARNING: erase any device's stored config"]
 , ADMIN_PWD   : [1,'adminpassword13142324'   , "WARNING: full reset of device, will break any exiting configuration"]
 , CHECK_IMEI  : [1,'imei%pwd%'               , "return device DEVID"]
 , GPRS_APN    : [1,'apn%pwd% %apn%'          , "configure APN ex: APN123456 FREE"]
 , GPRS_URI    : [1,'adminip%pwd% %host% %port%'  , "configure WEB plateform ex: adminip123456 103.10.1.2 1234"]
 , GPRS_MOD    : [1,'gprs%pwd%'               , "Set GPRS Mode"]
 , CHECK_GRPS  : [1,'load%pwd%'               , "Check GPRS"]
 , PWD_CHANGE  : [1,'password%pwd% %newpwd%'  , 'Change password']
 , GPRS_LESS   : [1,'less gprs%pwd% ON'       , 'Less GPRS mod']
 , GPRS_FULL   : [1,'less gprs%pwd% OFF'      , 'Reset Full GPRS mod']
 , SMS_MOD     : [1,'sms%pwd%'                , "Set SMS Mode"]
 , LOCALTIME   : [1,'time zone%pwd% %zone%'   , "set localtime zone +0=UTC"]
 , ADMIN_SET   : [1,'admin%pwd% %phone%'      , "set admin phone: --cmd=admin_set --args='pwd:123456 phone:0033xxxxxxxxx'"]
 , ADMIN_OFF   : [1,'noadmin%pwd% %phone%'    , "remove phone from admin list"]

 , GPRS_PROTO  : [1,'protocol%pwd% %proto%'   , "set 12/18 OBD protocol: --cmd=gprs_proto --args:'pwd:123456 protocol:18'"]
 , OBD_STATUS  : [1,'obdmsg%pwd%'             , " Return ODB status information"]
 , OBD_MOD     : [1,'obdii%pwd% %mod%'        , " 0=no 2=with single tracking 1=with any tracking"]
 , OBD_MILEAGE : [1,'odo%pwd% %km%'           , " set initial mileage"]
 , OBD_TANK    : [1,'tank%pwd% %l%'           , " tank capacity in litters"]
 , OBD_SVC     : [1,'service%pwd% %day%d %km%', " service alarm after %day% or %km%"]

 , TRACK_ONE   : [0,'fix001s001n%pwd%'        , " single track location [SMS mode only] ex: [1,fix001s001n123456"]
 , TRACK_MANY  : [0,'fix%delay%***n%pwd%'     , " unlimited track location [SMS mode only] ex: [1,fix180s***n123456"]
 , TRACK_LIMIT : [0,'fix%delay%%replay%n%pwd%', " limited track --command=TRACK_LIMIT --args='delay:030s replay:005'"]
 , TRACK_DIST  : [1,'distance%pwd% %dist%'    , " Track on distance in meter ex: [1,distance123456 0300"]
 , TRACK_ANGLE : [1,'angle%pwd% %angle%'      , " Track on distance in meter ex: [1,angle123456 030"]
 , TRACK_OFF   : [1,'nofix%pwd%'              , " Stop AUTO track"]

 , DRIFT_ON    : [1,'nosuppress%pwd%'         , " reset DRIFT [default mode] on"]
 , DRIFT_OFF   : [1,'supress%pwd%'            , " unset DRIFT [tracker sends position even when AC is OFF and GPS not moving]"]
 , ADDRESS     : [1,'address%pwd%'            , " request address by SMS [working ???]"]

 , MOD_VOICE   : [1,'monitor%pwd%'            , " set monitor voice mode"]
 , MOD_TRACK   : [1,'tracker%pwd%'            , " reset to tracker mode"]

 , SAVSD_ON    : [1,'save%delay%***n%pwd%'    , " Save on SD every xxxs if GPRS is down"]
 , SAVSD_OFF   : [1,'clear%pwd%'              , " Stop saving on SD"]
 , LOAD_SD     : [1,'load%pwd% %date%'        , " Load from SD card"]

 , LOWBAT_ON   : [1,'lowbattery%pwd% on'      , " set alarm for low battery"]
 , LOWBAT_OFF  : [1,'lowbattery%pwd% off'     , " remove low battery alarm"]
 , EXTPOW_ON   : [1,'extpower%pwd% on'        , " set external battery alarm"]
 , EXTPOW_OFF  : [1,'extpower%pwd% off'       , " clear external battery alarm"]
 , GPSBLIND_ON : [1,'gpssignal%pwd% on'       , " alarm on lost of GPS signal"]
 , GPSBLIND_OFF: [1,'gpssignal%pwd% off'      , " clear alarm on lost of GPS signal [default]"]

 , MOVE_ON     : [1,'area%pwd% on'            , " set movement alarm ON"]
 , MOVE_OFF    : [1,'area%pwd% off'           , " clear movement alarm ON [default]"]
 , SPEED_ON    : [1,'speed%pwd% %km%'         , " set max speed alarm"]
 , SPEED_OFF   : [1,'nospeed%pwd%'            , " clear max speed alarm"]
 , ARM_ON      : [1,'arm%pwd%'                , " arm tracker alarm"]
 , ARM_OFF     : [1,'disarm%pwd%'             , " disarm tracker alar"]
 , SHOCK_LVL   : [1,'sensitivity%pwd% %level%', " set shock detection sensitivity level [1,2,3]"]
 , FORWARD     : [1,'forward%pwd% %phone%'    , " Forward alarm to this message"]
 , CHECK_STATUS: [1,'check%pwd%'              , " Tracker status"]
 , SLEEP_ON    : [1,'sleep%pwd% time'         , " sleep mode [GSM off wait for call]"]
 , SLEEP_SHOCK : [1,'sleep%pwd% shock'        , " sleep [GPS off]until shock is detected"]
 , SLEEP_DEEP  : [1,'sleep%pwd% deepshock'    , " deepsleep [GPS&GSM off] wait for shock"]
 , SLEEP_OFF   : [1,'sleep%pwd% off'          , " deepsleep [GPS&GSM off] wait for shock"]
 , AWAKE_ON    : [1,'schedule%pwd% %delay%'   , " awake and send possition every xxx ex: [1,schedule123456 1d"]
 , AWAKE_OFF   : [1,'noschedule%pwd%'         , " awake off"]
};

var TrackerCmd =
  { GetFrom: FromTracker
  , SendTo: ToTracker
  , SmsTo : SmsTracker
};

module.exports = TrackerCmd;
