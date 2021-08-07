export { };

const Omegle = require('omegle-node-fix');
const om = new Omegle();
const words = require('an-array-of-english-words')

let connected = false;
let topics = [];

const captchaWords = [""]

const redis = require("redis");
const client = redis.createClient();

// Debug helper function
function debug(msg) {
	client.get("debug", (err, reply) => { if (reply != true) console.log(`${process.pid} Debug: ${msg}`) });
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
				om.stopTyping();
				resolve(1);
			}, 700)
		} else reject();
	});
};

// Miscellaneous connection and error handlers.

// Handle errors and recaptchas.
om.on('omerror', function (err) {
	console.log('Error: ' + err);
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
	sendWithTyping("Hello")
});


om.on('gotMessage', function (msg) {
	debug(`Stranger sent: ${msg}`)
	if (connected == true) {}
});

om.on('commonLikes', function (likes) {
	console.log('Common likes: ' + likes);
});

om.on('strangerDisconnected', function () {
	console.log('Stranger has disconnected.');
});

om.on('disconnected', function () {
	debug("Got disconnected. Reconnecting...")

});

om.connect(topics);



