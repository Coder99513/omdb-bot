

const { channel } = require('diagnostics_channel');
const Omegle = require('omegle-node-fix');
const { format } = require('path/posix');
const { send } = require('process');
const om = new Omegle();

const redis = require("redis");
const { arrayBuffer } = require('stream/consumers');
let client = redis.createClient();
let publisher = redis.createClient();

const cutils = require('./consoleUtils.js')

const intdebug = true; // Set to true to enable internal debug

let connected = false;
const settopics = ["art", "music", "advice"];
let topics = settopics;
let captchatext = "";
let nickname = "";

// 1 "Cycle" is a connection to an omegle user.
// Cycledelta is the number of tries it took to get to this user
// Cycledelta is reset upon finding a user.
// userNumber is the number of users the bot has seen.
let chatinitinfo = {
	cycles: 0
	, cycledelta: 0
	, startTime: Date.now()
	, userNumber: 0
	, likes: []
}

let chatroominfo = {
	botsRunning: [],
	inRoom: []
}

let userAttributes = {
	nick: `Stranger#${process.pid}`,
	pid: process.pid,
	channel: ""
}


// Captcha gen
function captchaWordGen() {
	const words = ["Apple", "Bannana", "Pear", "Water", "Monday"];
	return words[Math.floor(Math.random() * words.length)];
}



// Format commands
function formatMessage(input) {
	input = input.replace(/\s+/g, '');
	return input.toLowerCase();
}

// Disconnect and reconnect.
function resetConnection() {
	chatinitinfo.fcycledelta++;
	chatinitinfo.cycles++;
	//clearTimeout(currentID)
	if (om.connected()) {
		om.disconnect()
		clearInterval(captchaTimer);
		connected = false;
		cntdebounce = false;
	}
	om.connect(topics)
}
// Promise, sends a message more quickly than a human, but slower than an instantaneous message send.
const sendWithTyping = (message) => {
	return new Promise((resolve, reject) => {
		if (om.connected()) {
			om.startTyping();
			setTimeout(() => {
				if (!om.connected()) { cutils.error("Not connected to omegle user."); return; }
				try {
					om.send(message);
					cutils.ebug(`Omegle bot sent: ${message}`)
					om.stopTyping();
				} catch (e) { cutils.error(e) };
				resolve(1);
			}, 700)
		} else cutils.error("Not connected to Omegle user.");
	});
};

// Miscellaneous connection and erroror handlers.

// Handle errors and recaptchas.
om.on('omerror', function (err) {
	cutils.ebug('Omegle Error: ' + err);
});
om.on('recaptchaRequired', function (challenge) {
	cutils.ebug("Captcha found. Disconnecting.");
	clearInterval(captchaTimer);
	chatinitinfo.cycledelta++;
	resetConnection();
});

// Search for a user.
om.on('gotID', function (id) {
	cutils.ebug('Connected to Omegle as ' + id);
	setTimeout(function () {
		if (!om.connected()) {
			om.stopLookingForCommonLikes(); // or you could call om.slfcl()
			cutils.ebug('Topics ineffective. Searching for random user.');
			topics = [];
		}
	}, 30000);
});

om.on('waiting', function () {
	cutils.ebug("Searching for stranger...");
});

om.on('serverUpdated', function (server) {
	cutils.ebug('Server updated to: ' + server);
});

let cntdebounce = false;
let captchaTimer;

om.on('connected', function () {
	if (cntdebounce == false) {
		incorrectCaptchaTries = 0;
		cntdebounce = true;
		connected = false;
		captchatext = captchaWordGen();
		nickname = `Stranger#${process.pid}`
		sendWithTyping("You have come across a multi-user chatroom. Please say  the word: " + captchatext + " to join the chatroom.")
			.then(() => { sendWithTyping("You have 40 seconds to complete this captcha, or you will be disconnected.") })
		captchaTimer = setInterval(() => {
			incorrectCaptchaTries++;
			if (incorrectCaptchaTries >= 2) {
				incorrectCaptchaTries = 0;
				sendWithTyping("Captcha timed out. Goodbye.")
					.then(() => { resetConnection() })
			} else if (incorrectCaptchaTries == 1) {
				sendWithTyping("Time is running out. Please say: " + captchatext)
			}
		}, 20000)
	}
});

let incorrectCaptchaTries = 0;
om.on('gotMessage', function (msg) {
	cutils.ebug(`Stranger sent: ${msg}`)
	if (connected == false) {
		// Captcha logic
		if (!msg.toLowerCase().includes(captchatext.toLowerCase())) {
			if (incorrectCaptchaTries >= 2) {
				incorrectCaptchaTries = 0;
				sendWithTyping("Captcha incorrect. Goodbye.")
					.then(() => { resetConnection() })
			} else {
				incorrectCaptchaTries++;
				sendWithTyping("Captcha incorrect. Say " + captchatext + " to enter the chat room. " + incorrectCaptchaTries + "/2 tries.")
			}
		} else {
			// User completed captcha. Give them init text.
			chatinitinfo.userNumber++;
			clearInterval(captchaTimer);
			cutils.ok(`${process.pid} found a user.`)
			sendWithTyping("It has taken " + chatinitinfo.cycledelta + " tries for this bot to find you since the last user. The bot has tried " + chatinitinfo.cycles + " in total. There have been " + chatinitinfo.userNumber + " real people interacting with this specific bot in the past.")
				.then(() => { sendWithTyping("Your nickname in this chatroom is Stranger#" + captchaTimer + ", unless you change your nickname with /nick") })
				.then(() => { sendWithTyping("There are " + chatroominfo.inRoom.length + " other users in this room.") })
			chatinitinfo.cycledelta = 0;
			connected = true;
			publisher.publish(channelset, JSON.stringify(["sysmsg", userAttributes, userAttributes.nick + " has joined"]), () => { })
		}
	} else {
		if (msg.startsWith("/"))
			commandHandler(msg)
		else {
			publisher.publish(channelset, JSON.stringify(["chatmsg", userAttributes, userAttributes.nick+" | "+msg]), () => { })
		}
	}
});

om.on('commonLikes', function (likes) {
	chatinitinfo.likes = likes;
});

om.on('strangerDisconnected', function () {
	if (connected == true) cutils.warn(`${process.pid} Disconnected from stranger (them).`)
	clearInterval(captchaTimer);
	if (connected == true) {
		publisher.publish(channelset, JSON.stringify(["sysmsg", userAttributes, userAttributes.nick + " has disconnected"]), () => { })
		connected = false;
	}
	cntdebounce = false;
	chatinitinfo.cycledelta++;
	chatinitinfo.cycles++;
});

om.on('disconnected', function () {
	if (connected == true) cutils.warn(`${process.pid} Disconnected from stranger (bot).`)
	cutils.ebug("Got disconnected. Reconnecting...");
	clearInterval(captchaTimer);
	cntdebounce = false;
	chatinitinfo.cycledelta++;
	chatinitinfo.cycles++;
	topics = settopics;
	try {
		om.connect(topics);
	} catch (e) { cutils.error(e) }
});

// Handle commands
function commandHandler(msg) {
	msg = msg.split(" ");
	const command = formatMessage(msg[0])
	switch (command) {
		case "/nick":
			if (msg[1] != undefined) {
				userAttributes.nick = msg[1];
				sendWithTyping("Set your nickname to " + userAttributes.nick)
			} else {
				sendWithTyping("You must specify a nickname!")
			}
			break;
	}
}

function isJson(item) {
	item = typeof item !== "string"
		? JSON.stringify(item)
		: item;

	try {
		item = JSON.parse(item);
	} catch (e) {
		return false;
	}

	if (typeof item === "object" && item !== null) {
		return true;
	}

	return false;
}


let channelset;
const args = process.argv.slice(2);
client.on("message", function (channel, message) {
	cutils.ebug(`Recieved message: ${message}`)
	if (!isJson(message)) {
		// system flags
		if (message == "BEGIN" && channel == channelset) {
			cutils.ok(`${process.pid} starting...`)
			om.connect(topics)
		};
		if (message == "STOP" && channel == channelset) process.exit(0);
	} else {
		// Message?
		message = JSON.parse(message)
		if (message[0] == "chatmsg" && connected == true && message[1].pid != process.pid) {
			if (message[1].pid != process.pid) 
				sendWithTyping(message[2])
			
		} else if (message[0] == "sysmsg") {
			//if (message[1].pid == process.pid) break;
			cutils.ebug("Recieved system message")
			if (message[2].endsWith("has joined"))
				chatroominfo.inRoom.push(message[1].pid)
			if (message[2].endsWith("has disconnected"))
				chatroominfo.inRoom.splice(chatroominfo.inRoom.indexOf(message[1].pid), 1)
			if (connected == true) 
				sendWithTyping(message[2])
		}
	}
});
module.exports = (chnl) => {
	client.subscribe(chnl);
	channelset = chnl;
	userAttributes.channel = channelset;
	cutils.log(`Worker ${process.pid} ready`);
}
