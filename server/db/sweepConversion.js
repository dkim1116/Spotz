'use strict';
var fs = require('fs');
var https = require('https');
var parkingDb = require('./parking.js');

var polyline = require('polyline');

var geocoderProvider = 'google';
var httpAdapter = 'https';

require('./env.js');
var GOOGLE_MAPS_API_KEY = process.env.GOOGLEMAPSAPIKEY;

var extra = {
  apiKey: GOOGLE_MAPS_API_KEY,
  formatter: null,
};

require('node-geocoder')(geocoderProvider, httpAdapter, extra);

fs.readFile(__dirname + '/zoneData/berkeley/sweeping.json', 'utf8', function (err, data) {
  if (err) {throw err; }

  data = JSON.parse(data);

  var stepSize = 0.00002;

  var bumpIt = {
    N: {
      stepX:0,
      stepY:stepSize,
    },
    S: {
      stepX:0,
      stepY:-stepSize,
    },
    W: {
      stepX:-stepSize,
      stepY:0,
    },
    E: {
      stepX:stepSize,
      stepY:0,
    },
  };

  //loop through each data point
  var recursive = function (pointNr) {

    if (pointNr === data.length) {
      console.log('all done!');
      return;
    }

    var coordindates = [];
    var rule = {};
    var startTime;
    var endTime;
    var addressFrom;
    var addressTo;
    var url;

    console.log('parsing ', pointNr);

    addressFrom = data[pointNr]['Address From'];
    addressFrom += ' ' + data[pointNr]['Street Name'] + ' Berkeley, CA';

    addressTo = data[pointNr]['Address To'];
    addressTo += ' ' + data[pointNr]['Street Name'] + ' Berkeley, CA';

    url = 'https://maps.googleapis.com/maps/api/directions/json';
    url += '?origin=' + encodeURI(addressFrom);
    url += '&destination=' + encodeURI(addressTo);
    url += '&key=' + extra.apiKey;

    //get directions
    https.get(url, function (res) {
      //console.log('here are the directions', res.body);
      var allData = '';

      res.on('data', function (d) {
        allData += d.toString();
      });

      res.on('end', function () {
        allData =  JSON.parse(allData);

        if (allData.status !== 'OK') {
          console.log(JSON.stringify(allData));
          return;
        }

        allData.routes[0].legs[0].steps.forEach(function (r) {
          coordindates = polyline.decode(r.polyline.points);

          //SWAP COORDINATES AND ADJUST BASED ON N,S,E,W!
          coordindates.map(function (coordinate) {
            var swap = coordinate[0];
            coordinate[0] = coordinate[1] + bumpIt[data[pointNr].Side].stepX;
            coordinate[1] = swap + bumpIt[data[pointNr].Side].stepY;
          });

        });

        //store corrdinates in db
        //console.log(pointNr, JSON.stringify([{ coordinates: [coordindates] }]));
        parkingDb.savePermitZones([{ coordinates: [coordindates] }]).then(function (zone) {

          if (data[pointNr]['AM/PM'] === 'AM') {
            startTime = '08:00';
            endTime = '12:00';
          } else {
            startTime = '13:00';
            endTime = '17:00';
          }

          rule = {
            permitCode: 'sweep-' + data[pointNr].Rte + ' [' + data[pointNr].Side + ']',
            timeLimit: 0,
            days: data[pointNr]['Day of Month'],
            color: '255,0,0',
            startTime: startTime,
            endTime: endTime,
          };

          parkingDb.saveRule(zone.id, rule).then(function () {
            //recurse
            setTimeout(function () {
              recursive(pointNr + 1);
            }, 200);
          });
        });

      }); //end res.on('end')
    }); //end https.get
  };

  recursive(0);

});
