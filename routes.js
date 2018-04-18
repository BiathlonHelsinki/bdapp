"use strict";
Object.defineProperty(exports, "__esModule", { value: true });

const controllers = require('./controllers');
const settings = require("./middlewares/settings");
const syncer = require("./middlewares/syncing")

class Routes {
    constructor(app) {
        new syncer.Syncer(app);
        new settings.Setting(app);
        new controllers.Controllers(app).routes();
        // app.get('/settings', db.listSettings);
        // app.post('/mint', db.mintTokens);
        // app.post('/spend', db.spendTokens);
        // app.post('/transfer', db.transfer_tokens);
        // app.post('/transfer_owner', db.transfer_tokens_from_owner);
        // app.post('/account_balance', db.get_account_balance);
        // app.post('/create_account', db.create_account);
        // app.post('/check_transaction', db.check_transaction);

        app.get('*', (req, res) => {
            res.status(404).json({
                'msg': 'Route not found'
            });
        });
    }
}
exports.Routes = Routes;

