(function () {
    'use strict';

    // _all modules only reference dependencies
    angular.module('AppConfig', [])
    
            // Factory is a singleton and share its context within all instances.
            .factory('AppConfig', function (urlquery) {

                var myConfig = {
                    
                    paths: { // Warning paths should end with /
                        image : 'images/',
                        icons : '/icons/'
                    }
                };

                return myConfig;
            })

            // Factory is a singleton and share its context within all instances.
            .factory('AppCall', function ($http, AppConfig, $log) {
                var myCalls = {
                    get : function(plugin, action, query, callback) {
                        if (!query.token) query.token = AppConfig.session.token; // add token to provided query
                        $http.get('/api/' + plugin + '/' + action , {params: query}).then (callback, callback);
                    }

                };
                return myCalls;
            });
    
 
})();
