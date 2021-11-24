/********************************************************************** 
 * Teenzylab Technologies
 * OMDB: Standard Console utilites
 * Description:
 *      Provide console utils
 * **********************************************************************/
const chalk = require("chalk");
const debugok = true;

// Logging utilities
function log(msg) {console.log(`[${chalk.blue("INFO")}] ${msg}`)};
function ok(msg) {console.log(`[${chalk.green(" OK ")}] ${msg}`)};
function error(msg) {console.log(`[${chalk.redBright("ERR ")}] ${msg}`)}; 
function debug(msg) {if (debugok == true) console.log(`[${chalk.whiteBright("DEBUG")}] ${process.pid} | ${msg}`)};
function warn(msg) {console.log(`[${chalk.yellowBright("WARN")}] ${msg}`)};
function ebug(msg) {} // Used for partially eliminating debug statmements
 
// This mess is responsible for the start splash
const asciiText = (function () {/* _____                         _       _     
|_   _|__  ___ _ __  _____   _| | __ _| |__  
  | |/ _ \/ _ \ '_ \|_  / | | | |/ _` | '_ \ 
  | |  __/  __/ | | |/ /| |_| | | (_| | |_) |
  |_|\___|\___|_| |_/___|\__, |_|\__,_|_.__/ 
                        |___/ Technologies*/}).toString().match(/[^]*\/\*([^]*)\*\/\}$/)[1];

function splash(name, version, author) {
  console.log(asciiText);
  console.log(chalk.green(`${name} | v${version} | By ${author}`));
}

/*
Example usage:
const packagejson = require("package.json");
start("Cascadia Discord Bot",packagejson.version,packagejson.author)
*/


// TODO: Make this look less cursed
module.exports.log = log;
module.exports.ok = ok;
module.exports.error = error;
module.exports.warn = warn;
module.exports.debug = debug;
module.exports.splash = splash;
module.exports.ebug = ebug;