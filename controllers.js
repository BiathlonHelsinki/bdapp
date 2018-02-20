const promise = require('bluebird')
const initOptions = {
  promiseLib: promise
}
const hstore = require('pg-hstore')();

const util = require('util')
const config = require('node-yaml-config').load('./config.yaml')
const web3options = {
  debug: true,
  //host: '/Users/fail/geth.ipc',
  host: config.ipcpath,
  ipc: true,
  personal: true,
  admin: true,
}


const pgp = require('pg-promise')(initOptions);
const db =  pgp(config.pgconnection)

const Web3 = require('web3');
const web3 = new Web3();


// web3.setProvider(new web3.providers.HttpProvider('http://127.0.0.1:7545'));
// web3.setProvider(new web3.providers.HttpProvider('http://localhost:8545'));
const net = require('net')
web3.setProvider(new web3.providers.IpcProvider(web3options.host, net))
web3.eth = promise.promisifyAll(web3.eth);

const promisify = (inner) =>
  new Promise((resolve, reject) =>
    inner((err, res) => {
      if (err) { reject(err) }

      resolve(res);
    })
  )

function get_balance(account) {

  return new promise(function(resolve,reject) {
    web3.eth.getBalance(account,function(err,data){
      if(err !== null) return reject(err);
      resolve(web3.toWei(data, 'ether'));
    });
  });
}

function get_biathlon_balance(contract, account) {
  return new promise(function(resolve,reject) {
     contract.balanceOf(account, function(err,data){
        if(err !== null) return reject(err);
        resolve(data);
    });
  });
}

class Controllers {

  async getTokenContract(token_address, token_abi) {
    return await web3.eth.contract(JSON.parse(token_abi)).at(token_address)
  }

  async token_contract() {
    let token_contract = await this.getTokenContract(this.settings.token_address, this.settings.token_abi)
    return token_contract
  }


  constructor(app) {
    this.app = app;
  }

  routes() {

    // POST to /mint
    //
    // Create tokens (out of 'thin air' and put in account of user.
    // also insert into the postgres database
    // if successful, return the ethereum transaction hash
    this.app.route('/mint')
      .post(async(req, res) => {
        try {
          let txhash = await promisify(cb => this.app.locals.contract.mint(req.body.recipient, req.body.tokens, {from: this.app.locals.coinbase, gasPrice: config.gasprice}, cb))
          let dbinsert = await db.none('INSERT INTO ethtransactions (txaddress, transaction_type_id, recipient_account, value, timeof, created_at, updated_at)' +
      'VALUES(${txhash}, 1, ${recipient_account}, ${tokens}, now(), now(), now() )',  {txhash: txhash, recipient_account: req.body.recipient, tokens: req.body.tokens})

          res.status(200).json({"success": txhash})
        } catch (error) {
          console.log(util.inspect(error ))
          res.status(500).json({"error": error.message})
        }
    })

    /* POST to /spend

       spends tokens, inserts into ethtransactions database, and returns transaction hash if successful

    */
    this.app.route('/spend')
      .post(async(req, res) =>  {
        try {
          let txhash = await await promisify(cb => this.app.locals.contract.spend(req.body.sender, req.body.tokens, {from: this.app.locals.coinbase, gasprice: config.gasprice}, cb))
          let dbinsert = await db.none('INSERT INTO ethtransactions (txaddress, transaction_type_id, source_account, value, timeof, created_at, updated_at)' +
      'VALUES(${txhash}, 2, ${sender}, ${tokens}, now(), now(), now() )',  {txhash: txhash, sender: req.body.sender, tokens: req.body.tokens});

          res.status(200).json({"success": txhash})
        } catch (error) {
          res.status(500).json({"error": error.message})
        }
    })


    /* POST /create_account

      creates an account with the password sent in the req.body, returns the address of this account

     */
    this.app.route('/create_account')
      .post(async(req, res) => {
        try {
          let account = await  promisify(cb => web3.personal.newAccount(req.body.password, cb))
          res.status(200).json({"success": account})
        } catch (error) {
          res.status(500).json({"error": error.message})
        }
    })

    /*
      GET balance of account

      query the contract to return the balance of an address. simple, fast.

     */

    this.app.route('/get_account_balance')
      .get(async(req,res) =>  {
        try {
          const balance = await promisify(cb => this.app.locals.contract.balanceOf(req.query.account, cb));
          // let balance = await this.app.locals.contract.balanceOf(req.query.account)

          res.status(200).json({"success": balance})
        } catch (error) {
          res.status(500).json({"error": error.message})
        }
    })

    /*
     POST /transfer

     transfers tokens from one address to another
     TODO should probably limit this to a maximum number per day per user since it takes small amount of gas from central minter account

    */
    this.app.route('/transfer')
      .post(async(req, res) => {
        try {
          // check balance first here to avoid making unecessary blockchain call
          let senderbalance = await promisify(cb => this.app.locals.contract.balanceOf(req.body.sender, cb))
          if (senderbalance < parseInt(req.body.tokens)) {
            res.status(400).json({"error": 'Not enough balance from sending account'})
          } else {
            let txhash = await
            promisify(cb => this.app.locals.contract.biathlon_transfer(req.body.sender, req.body.recipient, req.body.tokens,
              {from: this.app.locals.coinbase, gasPrice: config.gasprice}, cb))
            let dbinsert = db.none('INSERT INTO ethtransactions (txaddress, transaction_type_id, source_account, recipient_account, value, timeof, created_at, updated_at)' +
              'VALUES(${txhash}, 3, ${sender}, ${recipient}, ${tokens}, now(), now(), now() )', {
              txhash: txhash,
              sender: req.body.sender,
              recipient: req.body.recipient,
              tokens: req.body.tokens
            });
            res.status(200).json({"success": txhash})
          }
        } catch (error) {
          res.status(500).json({"error": error.message})
        }
     })

    /* GET /check_transaction

      Look to see if a transaction exists and is confirmed

     */
    this.app.route('/check_transaction')
      .get(async(req, res) => {
        try {
          let confirmation = await promisify(cb => web3.eth.getTransactionReceipt(req.query.txhash, cb))
          res.status(200).json(confirmation)
        } catch (error) {
          res.status(500).json({"error": error.message})
        }
    })


      /* GET /

        Return all local accounts and balances, like the old version did

         */
    this.app.route('/')
      .get(async(req, res) =>  {
        let accounts = {};
        accounts['accounts'] = {};
        accounts['totalSupply'] = 0;
        let contract = this.app.locals.contract

        web3.eth.getAccounts(function(err, alist) {
          promise.map(alist, (acc) => {
            accounts['accounts'][acc] = {};

            let balance = get_balance(acc)

            return balance.then(function(value) {
              accounts['accounts'][acc]['ether'] = value;

            }).then(function() {

              return get_biathlon_balance(contract, acc)
              .then(function(value) {
                accounts['accounts'][acc]['biathlon'] = value;
              });
            });

          }).then(function() {
            var ts = new promise(function(resolve,reject) {
              contract.totalSupply(function(err, data) {
                if(err !== null) return reject(err);
                resolve(data);
              });
            });
            return ts.then(function(totals) {
              accounts['totalSupply'] = totals;
            });
          }).then(function() {
            res.status(200).json({status: 'success',
                                  data: accounts });
        })
      })
    })

  }
}

exports.Controllers = Controllers;
