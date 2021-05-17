'use strict';
const Multimap = require('multimap');
const nkn = require('nkn-sdk');
const IPFSSubscribeHandler = require('./IPFSSubscribeHandler');
const NKNSubscribeHandler = require('./NKNSubscribeHandler');
const IPFSNKNHelper = require('./IPFSNKNHelper');
const SIOLocalSubscribeHandler = require('./SIOLocalSubscribeHandler');
//const ServerStatistics = require('./ServerStatistics');

class APIHandler
{
    constructor(ipfsClient, clientData)
    {
        this.ipfsClient = ipfsClient;
        this.mapping = new Multimap();
        this.clientData = clientData;
        this.nknClient = null;
        this.nknHelper = new IPFSNKNHelper(this.ipfsClient, this)
        this.sockets = []

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
        // this.nknHelper.addSelfToAddrs()
    }

    registerSubscribe(channel, socket = null)
    {
        // This is actually a "composed" api method. Just to identify different channels.
        // There is no actual api method with the channel name included in IPFS.
        let apiMethod = `pubsub.subscribe.${channel}`

        if (!this.mapping.get(apiMethod)?.some((obj) => { return obj instanceof IPFSSubscribeHandler; })) {
            // We're not subscribed yet and don't have a socket. This means we received a request to 
            if (socket == null) {
                // Subscribe to the requested channel
                this.mapping.set(apiMethod, new IPFSSubscribeHandler(channel, this))
            } else {
                this.nknHelper.broadcastSubscribeRequest(channel)
            }
        }

        if (!this.mapping.get(apiMethod)?.some((obj) => { return obj instanceof NKNSubscribeHandler; }))
        {
            this.mapping.set(apiMethod, new NKNSubscribeHandler(channel, this))
        }

        // This must be the only one handling local socket connections! That's just the fastest way.
        if (!this.mapping.get(apiMethod)?.some((obj) => { return obj instanceof SIOLocalSubscribeHandler; }))
        {
            this.mapping.set(apiMethod, new SIOLocalSubscribeHandler(channel, this))
        }

        if (socket != null) {
            socket.channel = channel
            this.sockets.push(socket)
        }
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
        let filtered = this.sockets.filter((value) => { 
            return value.id !== id;
        });
        this.sockets = filtered;

        if (this.sockets.empty) {
            this.mapping.forEach((value) => {
                value.unsubscribe();
            });
        }
    }
}

module.exports = APIHandler;