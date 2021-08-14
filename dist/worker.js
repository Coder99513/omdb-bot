"use strict";
exports.__esModule = true;
var Omegle = require('omegle-node-fix');
var om = new Omegle();
var intdebug = true;
var connected = false;
var topics = [];
var captchatext = "";
var nickname = "";
var redis = require("redis");
var client = redis.createClient();
function debug(msg) {
    client.get("debug", function (err, reply) { if (reply == true || intdebug == true)
        console.log(process.pid + " Debug: " + msg); });
}
function maketoken(length) {
    var result = '';
    var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for (var i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() *
            charactersLength));
    }
    return result;
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
                debug("Omegle bot sent: " + message);
                om.stopTyping();
                resolve(1);
            }, 700);
        }
        else
            reject();
    });
};
om.on('omerror', function (err) {
    debug('Omegle Error: ' + err);
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
    connected = false;
    captchatext = maketoken(4);
    nickname = "Stranger#" + process.pid;
    sendWithTyping("You have come across a roving chatroom. Please say '" + captchatext + "' to join the chatroom.")
        .then(function () { sendWithTyping("Your nickname in this chatroom will be Stranger#" + process.pid + ", unless you change your nickname with /nick"); });
});
om.on('gotMessage', function (msg) {
    debug("Stranger sent: " + msg);
    if (connected == false) {
        if (msg != captchatext) {
            sendWithTyping("You have gotten the captcha wrong. Goodbye.")
                .then(function () { resetConnection(); });
        }
        else {
            sendWithTyping("congrats you have typed it wri");
        }
    }
});
om.on('commonLikes', function (likes) {
    console.log('Common likes: ' + likes);
});
om.on('strangerDisconnected', function () {
    console.log('Stranger has disconnected.');
});
om.on('disconnected', function () {
    debug("Got disconnected. Reconnecting...");
    om.connect(topics);
});
om.connect(topics);
