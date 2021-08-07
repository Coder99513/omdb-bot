"use strict";
exports.__esModule = true;
var Omegle = require('omegle-node-fix');
var om = new Omegle();
var words = require('an-array-of-english-words');
var connected = false;
var topics = [];
var captchaWords = [""];
var redis = require("redis");
var client = redis.createClient();
function debug(msg) {
    client.get("debug", function (err, reply) { if (reply != true)
        console.log(process.pid + " Debug: " + msg); });
}
function formatMessage(input) {
    input = input.replace(/\s+/g, '');
    return input.toLowerCase();
}
function resetConnection() {
    console.log("Reset connection.");
    if (om.connected()) {
        om.disconnect();
        connected = false;
    }
    om.connect(topics);
}
var sendWithTyping = function (message) {
    return new Promise(function (resolve, reject) {
        if (om.connected()) {
            om.startTyping();
            setTimeout(function () {
                if (!om.connected()) {
                    reject();
                    return;
                }
                om.send(message);
                om.stopTyping();
                resolve(1);
            }, 700);
        }
        else
            reject();
    });
};
om.on('omerror', function (err) {
    console.log('Error: ' + err);
});
om.on('recaptchaRequired', function (challenge) {
    debug("Captcha found. Disconnecting.");
    resetConnection();
});
om.on('gotID', function (id) {
    debug('Connected to Omegle as ' + id);
    setTimeout(function () {
        if (!om.connected()) {
            om.stopLookingForCommonLikes();
            debug('Topics ineffective. Searching for random user.');
            topics = [];
        }
    }, 30000);
});
om.on('waiting', function () {
    debug("Searching for stranger...");
});
om.on('serverUpdated', function (server) {
    debug('Server updated to: ' + server);
});
om.on('connected', function () {
    sendWithTyping("Hello");
});
om.on('gotMessage', function (msg) {
    debug("Stranger sent: " + msg);
    if (connected == true) { }
});
om.on('commonLikes', function (likes) {
    console.log('Common likes: ' + likes);
});
om.on('strangerDisconnected', function () {
    console.log('Stranger has disconnected.');
});
om.on('disconnected', function () {
    debug("Got disconnected. Reconnecting...");
});
om.connect(topics);
