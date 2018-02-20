"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const util = require('util')
const promise = require('bluebird')
const config = require('node-yaml-config').load('./config.yaml')
const initOptions = {
    promiseLib: promise
}
const hstore = require('pg-hstore')();
 const web3options = {
  debug: true,
  // host: '/Users/fail/geth.ipc',
  host: config.ipcpath,
  ipc: true,
  personal: true,
  admin: true,
}
const Web3 = require('web3');
const web3 = new Web3();
// web3.setProvider(new web3.providers.HttpProvider('http://127.0.0.1:7545'));
// web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
const net = require('net')
web3.setProvider(new web3.providers.IpcProvider(web3options.host, net))
var async = require('async');

web3.eth = promise.promisifyAll(web3.eth);
const pgp = require('pg-promise')(initOptions);
const db =  pgp(config.pgconnection);


const promisify = (inner) =>
  new Promise((resolve, reject) =>
    inner((err, res) => {
      if (err) { reject(err) }

      resolve(res);
    })
  )


class Setting {


    async getTokenContract(token_address, token_abi) {

      return await web3.eth.contract(JSON.parse(token_abi)).at(token_address)

    }

    async token_contract() {

      let token_contract = await this.getTokenContract(this.settings.token_address, this.settings.token_abi)
      return token_contract
    }

    constructor(app) {
      this.app = app;

      this.app.use( (req, res, next) => {

        let settings = ''
        db.one("select options from settings")
          .then(function(data) {
             return hstore.parse(data.options);
          })
          .then((s) => {
            return web3.eth.contract(JSON.parse(s.token_abi)).at(s.token_address)
          })
          .then(async(contract) => {
            if (contract === undefined) {
              throw "Contract is undefined"
            } else {
              this.app.locals.contract = contract
              this.app.locals.coinbase = await promisify(cb => web3.eth.getCoinbase(cb))
              next()
            }
          })
          .catch((err) => {
            console.log(err.message);
          })


      })
  }
}

exports.Setting = Setting;
