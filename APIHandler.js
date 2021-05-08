'use strict';
const Multimap = require('multimap');
const nkn = require('nkn-sdk');
const IPFSSubscribeHandler = require('./IPFSSubscribeHandler');
const NKNSubscribeHandler = require('./NKNSubscribeHandler');
const IPFSNKNHelper = require('./IPFSNKNHelper');
//const ServerStatistics = require('./ServerStatistics');

class APIHandler
{
    constructor(ipfsClient, clientData)
    {
        this.ipfsClient = ipfsClient;
        this.mapping = new Multimap();
        this.clientData = clientData;
        this.nknClient = null;
        this.nknHelper = new IPFSNKNHelper(this.ipfsClient)

        // Register the ServerStatistics channel to respond to server statsistics requests.
        // DISABLED for now. The intention is to have a "server statistics" channel in which each server
        // broadcasts it's own statistics from time to time. Another use is to let each server respond to
        // a question like "how many of you are there" where each server should respond to get and idea
        // for how many of these pubsub proxy nodes are online. But this is too easily abused where anyone
        // could repeatedly ask for this thus keep the nodes busy responding. It needs to be a bit more
        // fool proof.
        // this.mapping.set(`serverstatistics`, new ServerStatistics(`serverstatistics`, this.ipfsClient));

        this.setupNkn();
    }

    setupNkn()
    {
        this.nknClient = new nkn.Client({
            shouldReconnect: true
        });

        this.nknClient.destaddrs = []
        this.nknHelper.setNknClient(this.nknClient)
        this.nknHelper.askAllNknsToReport()
        this.nknHelper.addSelfToAddrs()
    }

    registerSubscribe(channel, socket)
    {
        // This is actually a "composed" api method. Just to identify different channels.
        // There is no actual api method with the channel name included in IPFS.
        let apiMethod = `pubsub.subscribe.${channel}`

        if (!this.mapping.get(apiMethod)?.some((obj) => { return obj instanceof IPFSSubscribeHandler; }))
        {
            this.mapping.set(apiMethod, new IPFSSubscribeHandler(channel, this.ipfsClient))
        }

        if (!this.mapping.get(apiMethod)?.some((obj) => { return obj instanceof NKNSubscribeHandler; }))
        {
            this.mapping.set(apiMethod, new NKNSubscribeHandler(channel, this.nknClient))
        }

        this.mapping.get(apiMethod).forEach((obj) => {
            obj.register(socket);
        });
    }

    publish(socket, data)
    {
        let objTemplate = {id: socket.id, data: "", selfEmit: false, timestamp: Date.now()}
        objTemplate.data = data?.data
        objTemplate.selfEmit = data?.selfEmit

        this.mapping.forEach(async (value) => {
            value.publish(data.channel, objTemplate);
        });
    }

    remove(id)
    {
        this.mapping.forEach((value) => {
            value.remove(id);
        });
    }
}

module.exports = APIHandler;