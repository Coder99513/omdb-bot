var Omegle = require('omegle-node-fix');
var om = new Omegle();

om.on('omerror',function(err){
	console.log('Error: ' + err);
});

om.on('recaptchaRequired',function(challenge){
    console.log(challenge);
    process.exit();
});

om.on('gotID',function(id){
	console.log('Connected to server as: ' + id);
	setTimeout(function(){
		if(!om.connected()){
			om.stopLookingForCommonLikes(); // or you could call om.slfcl()
			console.log('Connecting to a random stranger instead...');
		}
	},5000);
});

om.on('waiting', function(){
	console.log('Waiting for a stranger.');
});

om.on('serverUpdated',function(server){
	console.log('Server updated to: ' + server);
});

om.on('connected',function(){
	console.log('Connected');
	om.startTyping();
	setTimeout(function(){
		om.stopTyping(); //It's better to check if you're still connected to the stranger when using setTimeout.
		om.send('send nudes pls');
	},3000);
});


om.on('gotMessage',function(msg){
	console.log('Stranger: ' + msg);
});

om.on('commonLikes',function(likes){
	console.log('Common likes: ' + likes);
});

om.on('strangerDisconnected',function(){
	console.log('Stranger has disconnected.');
});

om.on('disconnected',function(){
	console.log('You have disconnected.');
});

var topics = ['jadfjpi0qawjieofopjiavjin0wipejdfpiajwefijp'];
om.connect(topics);



