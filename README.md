# weather-api
Fetch weather data from [Dark Sky API](https://darksky.net/dev/).  This server is intended to be used with [weather-report](https://github.com/jstiehl/weather-report) client app.

#Running App
To run the app

1. Clone this repo locally.
2. Navigate to the root directory of the project on your local machine.
3. Run `npm install` to install dependencies
4. In order to use the Dark Sky API, you need an API key that you receive by signing up for their service via their [website](https://darksky.net/dev/). Once you have this API Key you will need create a `.env` file in the root directory of this project on your local machine and add the following environment variable `API_KEY=YOURAPIKEYHERE`to the .env file.
5. Server can then be started by running `node server.js` in the command line at the root of the project directory.
