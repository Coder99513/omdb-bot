const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;
const redis = require("redis");
const { start } = require('repl');

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

  const readline = require('readline');
  const rl = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });

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

  const subscriber = redis.createClient();
  const publisher = redis.createClient();

  console.log(`Primary ${process.pid} is running`);

  // Fork workers.
  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
  for (let i = 0; i < 3; i++) {
    setTimeout(cluster.fork, between(1000, 4000));
  }

  function startConsole() {
    console.log = function (data) {
      readline.clearLine(process.stdout, 0);
      readline.cursorTo(process.stdout, 0);
      process.stdout.write(data + "\n")
      process.stdout.write("> ");
    }
    process.stdout.write("> ");
    rl.on('line', (input) => {
      if (input == "STOPBOT") publisher.publish(channel, "STOP")
      publisher.publish(channel, JSON.stringify(["chatmsg", {pid: process.pid, nick: "System"}, "Sysop -> "+input]), () => { })
    });
  }
  startConsole();

  // Tell units to begin
  setTimeout(() => { publisher.publish(channel, "BEGIN") }, 7000)

  // Master controller
  subscriber.on("message", function (channel, message) {
    cutils.ebug(`Recieved message: ${message}`)
    if (!isJson(message)) {
    } else {
      // Message?
      message = JSON.parse(message)
      if (message[0] == "chatmsg") {
        messageSent(message[2])
      } else if (message[0] == "sysmsg") {
        //if (message[1].pid == process.pid) break;
        messageSent(message[2])
      }
    }
  });
  subscriber.subscribe(channel);
  require('./src/discordBot.js')(channel)


} else {
  cutils.log(`Starting worker from ${process.pid}`)
  require('./src/worker.js')(channel)
}