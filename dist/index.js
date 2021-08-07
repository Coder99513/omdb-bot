var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length;
var redis = require("redis");
var client = redis.createClient();
client.on("error", function (error) {
    console.error("Redis error in " + process.pid + ": " + error);
});
function between(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}
if (cluster.isMaster) {
    console.log("Primary " + process.pid + " is running");
    cluster.on('exit', function (worker, code, signal) {
        console.log("worker " + worker.process.pid + " died");
    });
    for (var i = 0; i < 5; i++) {
        setTimeout(cluster.fork, between(1000, 2000));
    }
    setTimeout(function () { client.publish("channel", "message"); }, 8000);
}
else {
    console.log("run worker: ", process.pid);
    client.on("message", function (channel, message) {
        console.log("Got message: " + message + " in " + channel + " on " + process.pid);
    });
    client.subscribe("channel");
}
