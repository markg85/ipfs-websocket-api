'use strict';

const IPFSSubscribeHandler = require('./IPFSSubscribeHandler');

class ServerStatistics extends IPFSSubscribeHandler
{
    constructor(channel, ipfsClient)
    {
        super(channel, ipfsClient)
    }

    subscribe(msg)
    {
        var enc = new TextDecoder("utf-8");
        console.log(enc.decode(msg.data))
        console.log(msg)
    }
}

module.exports = ServerStatistics;