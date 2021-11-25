/********************************************************************** 
 * Teenzylab Technologies
 * OMDB: Chat worker
 * Description:
 *      Find omegle users and connect them to the OMDB redis system
 * **********************************************************************/
"use strict";

// Omegle
const Omegle = require('omegle-node-fix');

// Redis
const redis = require("redis");
const debug = require('redis/lib/debug');

// Debug & Diagnostics
const APMWorker = require('./tlutil/APMWorker.js');
let cutils;

class chatEndpoint {
    /**********************************************************************
     * HELPER FUNCTIONS
     * All functions are private (#)
     **********************************************************************/
    // Captcha gen
    #captchaWordGen() {
        const words = ["Apple", "Banana", "Pear", "Water", "Monday"];
        return words[Math.floor(Math.random() * words.length)];
    }

    // Format commands
    #formatMessage(input) {
        input = input.replace(/\s+/g, '');
        return input.toLowerCase();
    }

    // Reset class attributes to settings before connecting
    #resetAttributes(that) {
        that.captchatext = "";
        that.connected = false;
        that.cntdebounce = false;
        if (that.captchaTimer != null) clearInterval(that.captchaTimer);
        if (that.sIntervalRunning != null) clearInterval(that.sIntervalRunning);
        that.captchaTimer = null;
        that.incorrectCaptchaTries = 0;
        that.currenttopics = that.configtopics;
    }

    // Disconnect and reconnect.
    #resetConnection(that) {
        // Add to cycle delta and cycle count
        that.chatinitinfo.fcycledelta++;
        that.chatinitinfo.cycles++;
        //clearTimeout(currentID)
        if (that.om.connected()) {
            that.om.disconnect();
        }
        that.#resetAttributes(that);
        that.om.connect(that.currenttopics)
    }

    // Check if text is JSON
    #isJson(item) {
        item = typeof item !== "string"
            ? JSON.stringify(item)
            : item;
        try {
            item = JSON.parse(item);
        } catch (e) {
            return false;
        }
        if (typeof item === "object" && item !== null)
            return true;
        return false;
    }

    /**********************************************************************
    * OMEGLE HANDLERS
    * All functions are private (#)
    **********************************************************************/

    // Omegle captcha solution - just pound the damn thing with requests until it goes away
    #omegleRecaptchaRequired(challenge, that) {
        cutils.APMWarning("Captcha found. Disconnecting.");
        clearInterval(that.captchaTimer);
        that.chatinitinfo.cycledelta++;
        that.#resetConnection(that);
    }

    // Reset likes if no strangers with given topics found
    #omegleResetLikes(that) {
        if (!that.om.connected() && !that.noRestartAdvisory) {
            that.om.stopLookingForCommonLikes();
            cutils.APMDebugMajor('Topics ineffective. Searching for random user.');
            that.currenttopics = [];
            that.chatinitinfo.unlikedCycles++;
        }
    }

    #omegleGotID(id, that) {
        if (id != undefined) {
            cutils.APMDebugMajor('Connected to omegle. ID: ' + id);
            setTimeout(() => { that.#omegleResetLikes(that) }, 30000);
        } else {
            cutils.APMWarning("ID is undefined. Shutting down.")
            process.exit()
        }
    }

    #omegleCommonLikes(likes, that) {
        that.chatinitinfo.likes = likes;
    }

    #omegleStrangerDisconnected(that) {
        if (that.connected == true) {
            cutils.APMWarning(`${process.pid} Disconnected from stranger (them).`)
            that.redis.publisher.publish(that.redis.channel, JSON.stringify(["sysmsg", that.userAttributes, that.userAttributes.nick + " has disconnected"]), () => { })
            that.connected = false;
        } else clearInterval(that.captchaTimer);
    }

    #omegleDisconnected(that) {
        if (that.connected == true) {
            cutils.APMWarning(`${process.pid} Disconnected from stranger (bot).`)
            that.redis.publisher.publish(that.redis.channel, JSON.stringify(["sysmsg", that.userAttributes, that.userAttributes.nick + " has disconnected"]), () => { })
            that.connected = false;
        }
        cutils.APMDebugMajor("Got disconnected. Reconnecting...");
        clearInterval(this.captchaTimer);
        that.cntdebounce = false;
        that.chatinitinfo.cycledelta++;
        that.chatinitinfo.cycles++;
        if (that.noRestartAdvisory != true)
            that.#resetConnection(that)
    }

    // Handle commands
    #commandHandler(msg, that) {
        msg = msg.split(" ");
        const command = this.#formatMessage(msg[0])
        switch (command) {
            case "/nick":
                if (msg[1] != undefined) {
                    this.userAttributes.nick = msg[1];
                    this.messagequeue.push("Set your nickname to " + this.userAttributes.nick)
                } else {
                    this.messagequeue.push("You must specify a nickname!")
                }
                break;
        }
    }

    /**********************************************************************
     * SEND / MESSAGE QUEUE
     * All functions are private (#)
     **********************************************************************/
    // sendInterval - called every 800ms to send user messages in their queue
    #sendInterval(that) {
        if (that.om.connected() && that.connected == true) {
            if (that.messagequeue.length == 0) {
                if (that.nextmessage != null) {
                    cutils.APMDebugMajor(`Sending (connected): ${that.nextmessage}`);
                    that.om.send(that.nextmessage);
                    that.nextmessage = null;
                }
                that.om.stopTyping();
            }
            if (that.messagequeue.length > 0) {
                if (that.nextmessage != null) {
                    cutils.APMDebugMajor(`Sending (connected): ${that.nextmessage}`);
                    that.om.send(that.nextmessage);
                } else that.om.startTyping();
                that.nextmessage = that.messagequeue.shift();
            }
        } else {
            // Auto-reset
            that.messagequeue = [];
            that.nextmessage = null;
            that.connected = false;
            clearInterval(that.sIntervalRunning);
        }
    }

    // For system messages & captcha - automatic typing & send
    // User messages are to use queue.
    #sendWithTyping(message, that) {
        return new Promise((resolve, reject) => {
            if (that.om.connected()) {
                that.om.startTyping();
                setTimeout(() => {
                    if (!that.om.connected()) { cutils.APMError("Not connected to omegle user."); return; }
                    try {
                        that.om.send(message);
                        cutils.APMDebugMajor(`Omegle bot sent: ${message}`)
                        that.om.stopTyping();
                    } catch (e) { cutils.APMError(e) };
                    resolve(1);
                }, 1100)
            } else cutils.APMError("Not connected to Omegle user.");
        });
    };

    /**********************************************************************
     * CONNECTION / CAPTCHA HANDLER
     * All functions are private (#)
     **********************************************************************/
    #captchaTimerFunction(that) {
        that.incorrectCaptchaTries++;
        if (that.incorrectCaptchaTries >= 2) {
            that.incorrectCaptchaTries = 0;
            that.#sendWithTyping("Captcha timed out. Goodbye.", that)
                .then(() => { that.#resetConnection(that) })
        } else if (that.incorrectCaptchaTries == 1) {
            that.#sendWithTyping("Time is running out. Please say: " + that.captchatext, that)
        }
    }

    #omegleConnected(that) {
        if (that.cntdebounce == false) {
            if (that.noRestartAdvisory == true) {
                that.#resetAttributes(that);
                that.#sendWithTyping("Bot is shutting down. Goodbye, and have an excellent day!", that)
                    .then(() => { that.#sendWithTyping("== Thank you for choosing Teenzylab Technologies ==", that) })
                    .then(that.om.disconnect);
                return;
            }
            cutils.APMDebugMajor("Connected to user.")
            that.incorrectCaptchaTries = 0;
            that.cntdebounce = true;
            that.connected = false;
            that.captchatext = that.#captchaWordGen();
            that.userAttributes.nick = `Stranger#${process.pid}`
            that.#sendWithTyping("You have come across a multi-user chatroom. Please say  the word: " + that.captchatext + " to join the chatroom.", that)
                .then(() => { that.#sendWithTyping("You have 40 seconds to complete this captcha, or you will be disconnected.", that) })
            that.captchaTimer = setInterval(() => { that.#captchaTimerFunction(that) }, 20000)
        }
    }

    #omegleGotMessage(msg, that) {
        cutils.APMDebugMajor(`Stranger sent: ${msg}`)
        if (that.noRestartAdvisory == true) {
            that.#resetAttributes(that);
            that.#sendWithTyping("Bot is shutting down. Goodbye, and have an excellent day!", that)
                .then(() => { that.#sendWithTyping("== Thank you for choosing Teenzylab Technologies ==", that) })
                .then(that.om.disconnect);
            return;
        }
        if (that.connected == false) {
            if (msg.startsWith("You have come across a multi-user chatroom.")) { that.#resetConnection(that); return; }
            // Captcha logic
            if (!msg.toLowerCase().includes(that.captchatext.toLowerCase())) {
                if (that.incorrectCaptchaTries >= 2) {
                    that.incorrectCaptchaTries = 0;
                    that.#sendWithTyping("Captcha incorrect. Goodbye.", that)
                        .then(() => { that.#resetConnection(that) })
                } else {
                    that.incorrectCaptchaTries++;
                    that.#sendWithTyping("Captcha incorrect. Say " + that.captchatext + " to enter the chat room. " + that.incorrectCaptchaTries + "/2 tries.", that)
                }
            } else {
                // User completed captcha. Give them init text.
                that.chatinitinfo.userNumber++;
                clearInterval(that.captchaTimer);
                cutils.APMOk(`${process.pid} found a user.`)
                that.#sendWithTyping("It has taken " + that.chatinitinfo.cycledelta + " tries for that bot to find you since the last user. The bot has tried " + that.chatinitinfo.cycles + " in total. There have been " + that.chatinitinfo.userNumber + " real people interacting with this specific worker bot in the past.", that)
                    .then(() => { that.#sendWithTyping("Your nickname in this chatroom is Stranger#" + that.captchaTimer + ". You may change your nickname with /nick <name>", that) })
                    .then(() => { that.#sendWithTyping("You may change your nickname with /nick <name>", that) })
                    .then(() => { that.#sendWithTyping("There are " + that.chatinitinfo.inRoom.length + " other users in this room.", that) })
                that.userAttributes.nick = `Stranger#${process.pid}`;
                that.connected = true;
                that.sIntervalRunning = setInterval(() => { that.#sendInterval(that) }, 800);
                that.redis.publisher.publish(that.redis.channel, JSON.stringify(["sysmsg", that.userAttributes, that.userAttributes.nick + " has joined", that.chatinitinfo]), () => { })
                that.chatinitinfo.cycledelta = 0;
            }
        } else {
            if (msg.startsWith("/"))
                that.#commandHandler(msg)
            else {
                that.redis.publisher.publish(that.redis.channel, JSON.stringify(["chatmsg", that.userAttributes, that.userAttributes.nick + " | " + msg]), () => { })
            }
        }
    }

    /**********************************************************************
     * REDIS MESSAGE HANDLER
     * All functions are private (#)
     **********************************************************************/
    #redisGotMessage(channel, message, that) {
        cutils.APMDebugMinor(`Recieved message: ${message}`)
        if (!that.#isJson(message)) {
            // Internal system flags
            if (message == "BEGIN") {
                cutils.APMOk(`${process.pid} starting...`)
                that.om.connect(that.currenttopics)
            };
            if (message == "STOP") {
                that.noRestartAdvisory = true;
                that.#resetAttributes(that);
                if (that.connected == true) {
                    that.connected = false;
                    that.#sendWithTyping("Bot is shutting down. Goodbye, and have an excellent day!", that)
                        .then(() => { that.#sendWithTyping("== Thank you for choosing Teenzylab Technologies ==", that) })
                        .then(that.om.disconnect);
                    cutils.APMOk("Disconnected and reset.")
                } else {
                    that.om.disconnect();
                }
                setTimeout(() => { that.noRestartAdvisory = false; process.exit() }, 10000)
            }
        } else {
            // Chat message / system message
            message = JSON.parse(message)
            if (message[0] == "chatmsg" && that.connected == true && message[1].pid != process.pid) {
                if (message[1].pid != process.pid)
                    that.messagequeue.push(message[2])

            } else if (message[0] == "sysmsg") {
                //Check for joins and leaves, as well ask keep track of number of users.
                cutils.APMDebugMajor("Recieved system message")
                if (message[2].endsWith("has joined"))
                    that.chatinitinfo.inRoom.push(message[1].pid)
                if (message[2].endsWith("has disconnected"))
                    that.chatinitinfo.inRoom.splice(that.chatinitinfo.inRoom.indexOf(message[1].pid), 1)
                if (that.connected == true)
                    that.messagequeue.push(message[2])
            }
        }
    }

    /**********************************************************************
     * CONSTRUCTOR
     **********************************************************************/
    constructor(topics, debugEnable, debugVerbose, clusterSize, redisChannel) {
        this.currenttopics = topics; // Current Topics (clears if topics ineffective)
        this.configtopics = topics; // Constant topics

        this.captchatext = ""; // Current captcha being used
        this.connected = false; // Found confirmed user?
        this.cntdebounce = false; // Prevent connect event from being fired mutliple times
        this.captchaTimer = null; // Interval - 20 second captcha timeout / warning. Reset after every connection.
        this.incorrectCaptchaTries = 0; // Number of reset captchas
        this.noRestartAdvisory = false;

        // Start APM system
        cutils = new APMWorker("OMDB", "Chat", debugEnable, debugVerbose);

        // Chat initiation information - given to user 
        this.chatinitinfo = {
            cycles: 0 // Number of total cycles (found strangers)
            , cycledelta: 0 // Number of cycles from last confirmed person
            , startTime: Date.now()
            , userNumber: 0 // Number of confirmed people during this session
            , likes: [] // Likes
            , unlikedCycles: 0
            , clusterSize: clusterSize // Size of cluster (number of workers)
            , inRoom: [] // Other workers in room (connected w/ stranger)
        }

        // Redis message metadata
        this.userAttributes = {
            nick: `Stranger#${process.pid}`,
            pid: process.pid
        }

        // Redis clients
        this.redis = {
            subscriber: redis.createClient()
            , publisher: redis.createClient()
            , channel: redisChannel
        }

        // Omegle client
        this.om = new Omegle();

        // Message queue
        this.messagequeue = [];
        this.nextmessage = null;
        this.sIntervalRunning = null;

        /**********************************************************************
         * OMEGLE HANDLERS
         **********************************************************************/
        this.om.on('omerror', (err) => {
            cutils.APMError(`Omegle error: ${err}`);
        });

        this.om.on('recaptchaRequired', (challenge) => { that.#omegleRecaptchaRequired(challenge, that) });

        // Reset topics if they stop working.
        this.om.on('gotID', (id) => { that.#omegleGotID(id, that) });

        this.om.on('waiting', function () {
            cutils.APMDebugMajor("Searching for stranger...");
        });

        this.om.on('serverUpdated', function (server) {
            cutils.APMDebugMinor('Server updated to: ' + server);
        });

        let that = this;

        // Store likes
        this.om.on('commonLikes', (likes) => { that.#omegleCommonLikes(likes, that) });

        // Stranger disconnected - reset and recycle
        this.om.on('strangerDisconnected', () => { that.#omegleStrangerDisconnected(that) });

        // General disconnected - reset and recycle
        this.om.on('disconnected', () => { that.#omegleDisconnected(that) });

        // Omegle connected - run captcha system
        this.om.on('connected', () => { that.#omegleConnected(that) });

        // Omegle message
        this.om.on('gotMessage', (msg) => { that.#omegleGotMessage(msg, that) });


        // Start Redis
        this.redis.subscriber.on("message", (channel, message) => { that.#redisGotMessage(channel, message, that) });
        this.redis.subscriber.subscribe(this.redis.channel);
        cutils.APMInfo(`Worker ${process.pid} ready`);
    }
}

module.exports = chatEndpoint;

