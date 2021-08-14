import { setEnvironmentData } from "worker_threads";

export { };

const Omegle = require('omegle-node-fix');
const om = new Omegle();

const intdebug = true; // Set to true to enable internal debug

let connected = false;
let topics = [];
let captchatext = "";
let nickname = "";


const redis = require("redis");
const client = redis.createClient();

// Debug helper function
function debug(msg) {
	client.get("debug", (err, reply) => { if (reply == true || intdebug == true) console.log(`${process.pid} Debug: ${msg}`) });
}
// Random text gen
function maketoken(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
      result += characters.charAt(Math.floor(Math.random() * 
 charactersLength));
   }
   return result;
}
// Format commands
function formatMessage(input) {
	input = input.replace(/\s+/g, '');
	return input.toLowerCase();
}
// Disconnect and reconnect.
function resetConnection() {
	console.log("Reset connection.")
	//clearTimeout(currentID)
	if (om.connected()) {
		om.disconnect()
		connected = false;
	}
	om.connect(topics)
}
// Promise, sends a message more quickly than a human, but slower than an instantaneous message send.
const sendWithTyping = (message) => {
	return new Promise((resolve, reject): void => {
		if (om.connected()) {
			om.startTyping();
			setTimeout(() => {
				if (!om.connected()) { reject(); return; }
				om.send(message);
				debug(`Omegle bot sent: ${message}`)
				om.stopTyping();
				resolve(1);
			}, 700)
		} else reject();
	});
};

// Miscellaneous connection and error handlers.

// Handle errors and recaptchas.
om.on('omerror', function (err) {
	debug('Omegle Error: ' + err);
});
om.on('recaptchaRequired', function (challenge) {
	debug("Captcha found. Disconnecting.");
	resetConnection();
});

// Search for a user.
om.on('gotID', function (id) {
	debug('Connected to Omegle as ' + id);
	setTimeout(function () {
		if (!om.connected()) {
			om.stopLookingForCommonLikes(); // or you could call om.slfcl()
			debug('Topics ineffective. Searching for random user.');
			topics = [];
		}
	}, 30000);
});

om.on('waiting', function () {
	debug("Searching for stranger...")
});

om.on('serverUpdated', function (server) {
	debug('Server updated to: ' + server);
});


om.on('connected', function () {
	connected = false;
	captchatext = maketoken(4);
	nickname = `Stranger#${process.pid}`
	sendWithTyping("You have come across a roving chatroom. Please say '" + captchatext + "' to join the chatroom.")
	.then(()=>{sendWithTyping("Your nickname in this chatroom will be Stranger#" + process.pid + ", unless you change your nickname with /nick")})
});


om.on('gotMessage', function (msg) {
	debug(`Stranger sent: ${msg}`)
	if (connected == false) {
		if (msg != captchatext) {
			sendWithTyping("You have gotten the captcha wrong. Goodbye.")
			.then(()=>{resetConnection()})
		} else {
			sendWithTyping("congrats you have typed it wri")
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
	debug("Got disconnected. Reconnecting...")
	om.connect(topics);
});

om.connect(topics);
