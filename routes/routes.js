var request = require('superagent');
var Promise = require('bluebird');
var _ = require('underscore');
var moment = require('moment');
var config = require('../config');
var constants = require('../constants');
var months = constants.monthMap;
var mockData = require('../mock_data.json')

module.exports = function(router) {
  /**
   * validateRequest is intended to verify that request conforms to what is expected by the API
   * in this case, we are just making sure that valid month is passed as request param
   * @param  {Object} req is the request object
   * @return {Promise} Resolve with the req object if validation passes or an Error object if validation fails 
   */
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
  /**
   * fetchWeatherData makes a call to the Dark Sky API and fetches 24 hours of temp data for the day of interest
   * @param  {Number} lat is the lattitude of the location of interest
   * @param  {Number} long is the longitude of the location of interest
   * @param  {Date} time is the properly formatted time we want to query Dark Sky API with.
   * @return {Promise} temps is an array or resolved promises containing 24 hours of temperature data for our day of interest 
   */
  var fetchWeatherData = function(lat, long, time) {
    return new Promise(function(resolve, reject){
      request.get(config.data_sources.weather_api + '/' + lat + ',' + long + ','+ time + '?exclude=currently,minutely,daily,flags,alerts')
        .end(function(err, res){
          if(err) {
            //break out of promise chain if there is an error fetching data and send message to client
            throw err;
          }
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

  /**
   * mockFetch is a development method used to prevent from making calls to the Dark Sky api
   * An infinite loop in your client code could result in 1000 API calls (the free tier limit for the API) in a matter of seconds.
   * This of course did not happen to me :-) Ok maybe it did.
   * @return {Promise} resolves with temp data from mock_data.json
   */
  var mockFetch = function() {
    var temps = _.map(mockData.hourly.data, function(hourlyData){
      return {
        time: moment.unix(hourlyData.time).format(),
        temperature: hourlyData.temperature
      };
    });

    return Promise.resolve(temps);
  };

  /**
   * @param  {String} month is the month of interest. Provided as a param on request
   * @param  {Object} coordinates is the location of interest. Provided as query params on request or defaulting to PDX
   * @param  {Boolean} mock is an optional flag for dev purposes only. uses mockFetch if set to true
   * @return {Promise} promises is the array of temp data from asynchronous API request for each day of month
   */
  var getMonthlyTempsByDay = function(month, coordinates, mock) {
    var lat = coordinates.lat;
    var long = coordinates.long;
    var days = daysOfMonth(month); //these are actually timestamps for each day of the month that will be passed to Dark Sky API
    var promises = [];
    if(!mock) {
      _.each(days, function(day){
        promises.push(fetchWeatherData(lat, long, day));
      });
    } else {
      promises.push(mockFetch());
    }

    return Promise.all(promises);
  }

  /**
   * formatMonthlyTemps groups hourly weather data by day
   * {
   *    "Date": [{weatherobject}, .......],
   *    ....
   * }
   * @param  {Array} data is an array of weather data returned from getMonthlyTempsByDay (technically an array of arrays) 
   * @return {Object} groupedTempData is an object keyed by date with temp data array for that particular day
   */
  var formatMonthlyTemps = function(data) {
    var groupedTempData = _.groupBy(_.flatten(data), function(weatherObject){
      return moment(weatherObject.time).format("MM-DD-YYYY");
    });
    return groupedTempData;
  };  

  /**
   * daysOfMonth takes a month argument and returns an array of all the days in that month
   * @param  {String} month is the month of interest. Provided from req param
   * @return {Array} days is an array of all the days (time stamps) in the month of interest
   */
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

  /**
   * /weather/:month is the endpoint for fetching a months worth of hourly weather data by day
   */
  router.route('/weather/:month').get(function(req, res){
    var month = req.params.month; //default to current month?
    validateRequest(req)
      .then(function(req){
        //default to PDX Coordinates if not specified
        var location = {
          lat: req.query.lat || 45.5898,
          long: req.query.long || -122.5951
        };
        return getMonthlyTempsByDay(month, location, true);  
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