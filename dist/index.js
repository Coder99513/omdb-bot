var cluster = require('cluster');
var http = require('http');
var numCPUs = require('os').cpus().length;
var PubSub = require('PubSub');
var pubsub = new PubSub();
function between(min, max) {
    return Math.floor(Math.random() * (max - min) + min);
}
if (cluster.isMaster) {
    console.log("Primary " + process.pid + " is running");
    var onUserAdd = pubsub.subscribe('garbolage', function (data, topic) {
        console.log('e:', data);
    });
    cluster.on('exit', function (worker, code, signal) {
        console.log("worker " + worker.process.pid + " died");
    });
    for (var i = 0; i < 5; i++) {
        setTimeout(cluster.fork, between(1000, 2000));
    }
    setTimeout(function () { console.log(pubsub.subscribers()); }, 3000);
}
else {
    console.log("run bitch: ", process.pid);
    pubsub.publish('garbolage', process.pid);
    pubsub.subscribe('garbolage', function (data, topic) {
        console.log(process.pid, data);
    });
}
