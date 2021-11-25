const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;
const redis = require("redis");

const cutils = require("./src/consoleUtils.js");
const channel = "chat1";

function between(min, max) {
  return Math.floor(
    Math.random() * (max - min) + min
  )
}

function messageSent(msg) {
  console.log(`[MESSAGE] ${msg}`)
}



if (cluster.isMaster) {

  const publisher = redis.createClient();

  cutils.ok(`Primary ${process.pid} is running`);

  // Fork workers.
  cluster.on('exit', (worker, code, signal) => {
    cutils.warn(`Worker ${worker.process.pid} exited.`);
  });
  for (let i = 0; i < 4; i++) {
    setTimeout(cluster.fork, between(1000, 4000));
  }

  // Tell units to begin
  setTimeout(() => { publisher.publish(channel, "BEGIN") }, 7000)

  // Start master discord unit
  require('./src/discordBot.js')(channel)
} else {
  cutils.log(`Starting worker from ${process.pid}`)
  const classifiedWorker = require('./src/classifiedworker.js')
  new classifiedWorker(["art", "music", "advice", "chat", "bored", "drunk", "pizza", "illuminati"], true, true, 4, channel)
}