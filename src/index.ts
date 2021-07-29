const cluster = require('cluster');
const http = require('http');
const numCPUs = require('os').cpus().length;

const PubSub = require('PubSub');
const pubsub = new PubSub();

function between(min, max) {  
    return Math.floor(
      Math.random() * (max - min) + min
    )
  }

if (cluster.isMaster) {
  console.log(`Primary ${process.pid} is running`);

  // Fork workers.
  const onUserAdd = pubsub.subscribe('garbolage', (data, topic) => {
    console.log('e:', data);
  });
  cluster.on('exit', (worker, code, signal) => {
    console.log(`worker ${worker.process.pid} died`);
  });
  for (let i = 0; i < 5; i++) {
    setTimeout(cluster.fork,between(1000,2000));
  }
  setTimeout(function () {console.log(pubsub.subscribers())},3000);
} else {
  console.log("run bitch: ", process.pid);
  pubsub.publish('garbolage', process.pid);
  pubsub.subscribe('garbolage', (data, topic) => {
    console.log(process.pid, data);
  });
}