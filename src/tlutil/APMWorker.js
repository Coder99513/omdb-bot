/********************************************************************** 
 * Teenzylab Technologies
 * Standard APM System: APM Cluster worker utility
 * Description:
 *      Substitute console utilities with headless APM flags
 * **********************************************************************/

const diagnostics_channel = require('diagnostics_channel');
const cutils = require("./consoleUtils.js");


class APMService {
    /**********************************************************************
     * CONSTRUCTOR
     **********************************************************************/
    constructor(name, type, enable, level) {
        this.projectName = name;
        this.enableAPM = enable;
        this.debugLevel = level; // true or false (true being minor)
        this.channel = null;
        this.flagchannel = null;
        if (this.enableAPM) {
            this.channel = diagnostics_channel.channel(`${name}-${type}Worker-${process.pid}`);
            this.flagchannel = diagnostics_channel(`${name}-${type}Worker`)
            // Ex: cutils = new APMWorker("OMDB", "Chat", debugEnable, debugVerbose);  
        }
    }

    /**********************************************************************
     * APM Messages
     * Exposed functions
     **********************************************************************/
    APMWarning(message) {
        cutils.warn(message);
        if (this.enableAPM)
            this.channel.publish({ type: "warningmsg", sender: process.pid, payload: message })
    }

    APMError(message) {
        cutils.error(message);
        if (this.enableAPM)
            this.channel.publish({ type: "errormsg", sender: process.pid, payload: message })
    }

    APMOk(message) {
        cutils.ok(message);
        if (this.enableAPM)
            this.channel.publish({ type: "okmsg", sender: process.pid, payload: message })
    }

    APMInfo(message) {
        cutils.log(message);
        if (this.enableAPM)
            this.channel.publish({ type: "infomsg", sender: process.pid, payload: message })
    }

    APMDebugMinor(message) {
        if (this.enableAPM && this.debugLevel)
            this.channel.publish({ type: "minordebugmsg", sender: process.pid, payload: message })
    }

    APMDebugMajor(message) {
        if (this.enableAPM)
            this.channel.publish({ type: "minordebugmsg", sender: process.pid, payload: message })
    }

}

module.exports = APMService;
