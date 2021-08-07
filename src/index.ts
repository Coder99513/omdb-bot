const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;

const redis = require("redis");
const client = redis.createClient();

client.on("error", function(error) {
  console.error(`Redis error in ${process.pid}: ${error}`);
});


function between(min, max) {  
    return Math.floor(
      Math.random() * (max - min) + min
    )
  }

if (cluster.isMaster) {
  console.log(`Primary ${process.pid} is running`);

  // Fork workers.
  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
  for (let i = 0; i < 5; i++) {
    setTimeout(cluster.fork,between(1000,2000));
  }
  setTimeout(()=>{client.publish("channel","message")},8000)
} else {
  console.log("run worker: ", process.pid);
  client.on("message", function(channel, message) {
    console.log(`Got message: ${message} in ${channel} on ${process.pid}`)
  });
  client.subscribe("channel")
}