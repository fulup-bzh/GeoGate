(function() {
  'use strict';
  
    function  ParseQueryString () {
      var qd = {};
      location.search.substr(1).split("&").forEach(function(item) {
          var k = item.split("=")[0];
          var v = decodeURIComponent(item.split("=")[1]); 
          if (k in qd) qd[k].push(v); else qd[k] = v;
      });
      return qd;
    }

  angular.module('@@APPNAME@@', [ // Warning: Appname should fit with gulpfile.js & index.html
    'ui.router',
    //'ngAnimate',

    //foundation
    'foundation',
    'foundation.dynamicRouting',
    //'foundation.dynamicRouting.animations',
    
    // external components
    'ui-notification',   
    
    // Application Components
    'AppConfig',
    'JQueryEmu',
    'MapViewModule'
  ])
    .value ('urlquery', ParseQueryString())
    .config(config)
    .run(run)
  ;

  config.$inject = ['$urlRouterProvider', '$locationProvider'];
  
  function config($urlProvider, $locationProvider, AppConfig) {
    $urlProvider.otherwise('/mapview');

    // https://docs.angularjs.org/error/$location/nobase
    $locationProvider.html5Mode(true).hashPrefix('!');
    
  }

  function run() {
    FastClick.attach(document.body);
  }
  
console.log ("opa=@@APPNAME@@ Loaded");
})();
