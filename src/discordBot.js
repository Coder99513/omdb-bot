/********************************************************************** 
 * Teenzylab Technologies
 * OMDB: Discord Bot
 * Description:
 *      Connect omegle cluster to discord.
 * **********************************************************************/

const redis = require("redis");
let client = redis.createClient();
let publisher = redis.createClient();
const { token, subchannel, guildId } = require('../config.json');
const packagejson = require("../package.json");
const cutils = require("./consoleUtils.js");

// Version / Author splash
// https://discord.com/api/oauth2/authorize?client_id=912908295742836786&permissions=2214750272&scope=bot

const { Client, Collection, Intents, MessageEmbed } = require('discord.js')
const dclient = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_MEMBERS] });


/**********************************************************************
 * REDIS MESSAGE HANDLER
 **********************************************************************/
let channelset;
const args = process.argv.slice(2);
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
client.on("message", function (channel, message) {
    cutils.ebug(`Recieved message: ${message}`)
    if (!isJson(message)) {
        // Internal system flags
        // None for discord bot.
    } else {
        // Chat message / system message
        message = JSON.parse(message)
        if (message[0] == "chatmsg" && message[1].fdiscord != true) {
            try {
                dclient.guilds.cache.get(guildId).channels.cache.get(subchannel).send(message[2])
            } catch (e) { cutils.error(e) }

        } else if (message[0] == "sysmsg") {
            //Check for joins and leaves, as well ask keep track of number of users.
            cutils.ebug("Recieved system message")
            if (message[2].endsWith("has joined")) {
                const joininfo = " | CycleDelta: " + message[3].cycledelta + "  CycleTotal: " + message[3].cycles + " UserNumber: " + message[3].userNumber
                try {
                    dclient.guilds.cache.get(guildId).channels.cache.get(subchannel).send(message[2] + joininfo)
                } catch (e) { cutils.error(e) }
            } else {

            try {
                dclient.guilds.cache.get(guildId).channels.cache.get(subchannel).send(message[2])
            } catch (e) { cutils.error(e) }}
        }
    }
});

// Discord message handler
module.exports = (chnl) => {
    channelset = chnl;
    dclient.login(token)
    
    dclient.on("message", (message) => {
        if (message.author.bot) return;
        publisher.publish(channelset, JSON.stringify(["chatmsg", { pid: process.pid, nick: message.author.username, fdiscord: true }, message.author.username + " D| " + message.content]), () => { })
    });
    client.subscribe(channelset);
    cutils.ok("Discord bot logged on.")
}