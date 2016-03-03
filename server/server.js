'use strict';

var express = require('express');
var bodyparser = require('body-parser');
var morgan = require('morgan');

//Device Capturer
var device = require('express-device');

//LOGIN
var passport = require('passport');
var cookieParser = require('cookie-parser');
var jwt = require('express-jwt');

require('./env.js');
var JWT_SECRET = process.env.JWTSECRET;

//SUBROUTERS
var authRouter = require('./routers/authRouter.js');
var apiRouter = require('./routers/apiRouter.js');
var donationRouter = require('./routers/donationRouter.js');

//SERVER CONFIG
var port = process.env.PORT || 3000;
var app = express();

//CORS
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Credentials', true);
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

//MIDDLEWARE
app.use(morgan('combined'));
app.use(express.static(__dirname + '/../client/'));
app.use(bodyparser.json({ limit: '50mb' }));
app.use(bodyparser.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use(device.capture());
app.use(passport.initialize());
app.use(passport.session());

//SUBROUTERS
//Every request with the beginning endpoint of its assigned URL
//gets ran through the subrouter first
app.use('/', donationRouter);
app.use('/auth', authRouter);
app.use('/api', jwt({ secret: JWT_SECRET }), apiRouter);

//START SERVER
app.listen(port);
