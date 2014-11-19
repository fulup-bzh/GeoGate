GeoGate backend take care of storing Data to a database.

A backend should implements following methods
----------------------------------------------
    - CheckTablesExits [create DB table in case they are not present]
    - CreateDev        [create an entry for device in DB]
    - RemoveDev        [remove device entry in DB]

    - LoginDev         [verify device exist]
    - LogoutDev        [change logged status]

    - UpdatePosDev     [update device position in DB]
    - UpdateOdbDev     [update device ODB info]
    - UpdateAlarmDev   [update device Alarm info]

    - LookupDev        [return last xxx position of a given device]


Dummy Backend
--------------
This is a fake backend, that was built for development an demo. It does not store
anything on disk and only keep xxx last position in RAM. It is nevertheless the best
candidate to built/test a new adapter.


MySQL/MongoDB Schema
---------------------
    Anyone is free to implement its own schema. But provided MySql+Mongo backend use following tables/collections

    - All_Devices: for device authentication, this table/collection should at least hold a devid [mmsi/imei]
    - T_xxxxxxxxx: Per device Track table. xxxxxxx=devid
    - O_xxxxxxxxx: Same thing for OBD collected information
    - A_xxxxxxxxx: Same thing for Alarm

I find out easier to have many tables per devices, it allow to delete a full table when you remove a device.
And search PerDevice/PerDate are easier to implement. But this is only en example, and any developer should
feel free to implement its own backend/schema.


Note:
------
 -  those backend are not designed to take care of your WEB application, this is the why no smart "query" is implemented.
 -  Under nodejs Most DB requests are asynchronous. Never forget about it when designing your application.

Fulup