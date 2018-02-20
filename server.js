"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express = require("express");
const config = require('node-yaml-config').load('./config.yaml')
const morgan = require("morgan"); // log requests to the console (express4)
const bodyParser = require("body-parser"); // pull information from HTML POST (express4)
const methodOverride = require("method-override"); // simulate DELETE and PUT (express4)
const routes = require("./routes");
const helmet = require("helmet");
const util = require('util')
const promise = require('bluebird');
const initOptions = {
    promiseLib: promise
}
const hstore = require('pg-hstore')();

const pgp = require('pg-promise')(initOptions);




class App {
    constructor(NODE_ENV = 'development', PORT = 3001) {
        /**
         * Setting environment for development|production
         */
        process.env.NODE_ENV = process.env.NODE_ENV || NODE_ENV;
        /**
         * Setting port number
         */
        process.env.PORT = process.env.PORT || String(PORT);

        /**
         * Create our app w/ express
         */
        this.app = express();
        /**
         * HELMET
         */
        this.app.use(helmet());

        if (process.env.NODE_ENV === 'development') {
            this.app.use(morgan('dev')); // log every request to the console
        }
        else {
            //this.app.use(compression());
        }
        this.app.use(bodyParser.urlencoded({ 'extended': true })); // parse application/x-www-form-urlencoded
        this.app.use(bodyParser.json()); // parse application/json
        this.app.use(methodOverride());

        this.db = pgp(config.pgconnection);

        var web3options = {
          debug: true,
          host: '/Users/fail/geth.ipc',
          // host: '/Users/fail/Library/ethereum/geth.ipc',
          ipc: false,
          personal: true,
          admin: true,
        }
        /**
         * Database
         */
        this.db.connect()
            .then(obj => {

                obj.done(); // success, release the connection;
            })
            .catch(error => {
                console.log('ERROR:', error.message || error);
            });



        /**
         * Setting routes
         */
        new routes.Routes(this.app);
        /**
         * START the server
         */
        this.server = this.app.listen(process.env.PORT, function () {
            console.log('The server is running in port localhost: ', process.env.PORT);
        });

        // display actual useful error messages
        this.app.use(function (err, req, res, next) {
            console.error(err.stack);
            res.status(500).send('Something broke!');
        });
    }
}
exports.App = App;
