var request = require('superagent');
var Promise = require('bluebird');
var _ = require('underscore');
var moment = require('moment');
var config = require('../config');
var constants = require('../constants');
var months = constants.monthMap;

module.exports = function(router) {
  var validateRequest = function(req){
    var validRequest = true;
    var month = req.params.month;

    if(!months[month]){
      validRequest = false;
    }

    if(!validRequest) {
      return Promise.reject(new Error("Invalid Request"));
    }

    return Promise.resolve(req);
  };

  var fetchWeatherData = function(lat, long, time) {
    return new Promise(function(resolve, reject){
      request.get(config.data_sources.weather_api + '/' + lat + ',' + long + ','+ time + '?exclude=currently,minutely,daily,flags,alerts')
        .end(function(err, res){
          var temps = _.map(res.body.hourly.data, function(hourlyData){
            return {
              time: moment.unix(hourlyData.time).format(),
              temperature: hourlyData.temperature
            };
          });
          resolve(temps);
        });
    });
  };

  //need to figure out the times for each day of the month of provided
  //asynchronously make API request by calling getWeatherData for days of the month
  var getMonthlyTempsByDay = function(month, coordinates) {
    var lat = coordinates.lat;
    var long = coordinates.long;
    var days = daysOfMonth(month); //these are actually timestamps for each day of the month that will be passed to Dark Sky API
    var promises = [];
    _.each(days, function(day){
      promises.push(fetchWeatherData(lat, long, day));
    });

    return Promise.all(promises);
  }

  //format data in order to send back to client
  var formatMonthlyTemps = function(data) {
    var groupedArray = _.groupBy(_.flatten(data), function(weatherObject){
      return moment(weatherObject.time).format("MM-DD-YYYY");
    });
    return groupedArray;
  };  

  var daysOfMonth = function(month){
    var currentMonth = moment().month();
    var requestedMonth = moment().month(month).month();
    var startOfMonth = moment().month(month).startOf('month');
    var endOfMonth = moment().month(month).endOf('month');
    //Only interested in historical data not in predictions
    if(currentMonth < requestedMonth){
      startOfMonth = startOfMonth.subtract(1, 'years');
      endOfMonth = endOfMonth.subtract(1, 'years');
    }

    var days = [];
    for(var i = startOfMonth; i < endOfMonth; i.add(1, 'd')) {
      days.push(i.format());
    }
    return days;
  };

  //fetch a months worth of hourly data
  //required params are lat, long and time (this is the start day for month of interest)
  router.route('/weather/:month').get(function(req, res){
    var month = req.params.month; //default to current month?
    validateRequest(req)
      .then(function(req){
        //default to PDX Coordinates if not specified?
        var location = {
          lat: req.query.lat || 45.5898,
          long: req.query.long || -122.5951
        };
        console.log(month);
        return getMonthlyTempsByDay(month, location)  
      })
      .then(formatMonthlyTemps)
      .then(function(data){
        var monthData = {};
        monthData[month] = data;
        res.send({status: 200, data: monthData});
      })
      .catch(function(e){
        var error = {
          message: e.message
        };
        error.status = 500;
        res.send(error);
      });
  });

  return router
};