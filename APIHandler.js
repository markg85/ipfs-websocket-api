'use strict';

const IPFSSubscribeHandler = require('./IPFSSubscribeHandler');
//const ServerStatistics = require('./ServerStatistics');

class APIHandler
{
    constructor(ipfsClient, clientData)
    {
        this.ipfsClient = ipfsClient;
        this.mapping = new Map();
        this.clientData = clientData;

        // Register the ServerStatistics channel to respond to server statsistics requests.
        // DISABLED for now. The intention is to have a "server statistics" channel in which each server
        // broadcasts it's own statistics from time to time. Another use is to let each server respond to
        // a question like "how many of you are there" where each server should respond to get and idea
        // for how many of these pubsub proxy nodes are online. But this is too easily abused where anyone
        // could repeatedly ask for this thus keep the nodes busy responding. It needs to be a bit more
        // fool proof.
        // this.mapping.set(`serverstatistics`, new ServerStatistics(`serverstatistics`, this.ipfsClient));
    }

    registerSubscribe(channel, socket)
    {
        let obj = null;
        
        // This is actually a "composed" api method. Just to identify different channels.
        // There is no actual api method with the channel name included in IPFS.
        let apiMethod = `pubsub.subscribe.${channel}`

        if (!this.mapping.has(apiMethod))
        {
            this.mapping.set(apiMethod, new IPFSSubscribeHandler(channel, this.ipfsClient));
        }

        obj = this.mapping.get(apiMethod);
        obj.register(socket)
    }

    publish(socket, data)
    {
        let objTemplate = {id: socket.id, data: "", selfEmit: false}
        objTemplate.data = data?.data
        objTemplate.selfEmit = data?.selfEmit
        this.ipfsClient.pubsub.publish(data.channel, JSON.stringify(objTemplate));
    }

    remove(id)
    {
        this.mapping.forEach((value) => {
            value.remove(id);
        });
    }
}

module.exports = APIHandler;