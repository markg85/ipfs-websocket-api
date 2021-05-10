'use strict';
const CRC32 = require('crc-32'); 

// This class manages n registrants for 1 topic.
// An IPFSSubscribeHandler class only handles 1 topic and sends messages 
// received on that one topic to each of the registrants (sockets).
class IPFSSubscribeHandler
{
    constructor(channel, ipfsClient)
    {
        this.channel = channel
        this.sockets = []
        this.ipfsClient = ipfsClient;

        // Subscribe to the channel
        this.ipfsClient.pubsub.subscribe(this.channel, async (msg) => {
            let idData = await this.ipfsClient.id()

            if (msg.from != idData.id) {
                this.subscribe(msg)
            } else {
                console.log(`A message was received on channel ${this.channel} from itself. Skipping.`)
            }
        });

        console.log(`Subscribe to channel: ${channel}`)
    }

    // Adds a socket wanting to get messages on the channel this class manages
    register(socket)
    {
        if (this.sockets.some(sock => sock.id === socket.id))
        {
            console.log(`Socket with ${socket.id} already exists, not adding it.`)
            return;
        }

        this.sockets.push(socket)

        console.log(`Registered socket id: ${socket.id} to receive messages from channel: ${this.channel}. The following sockets now get served when a message is received:`);
        console.table(this.sockets.map(sock => sock.id))
    }

    // Removes a socket. Could be because of a disconnect or just not interested in the toipic anymore.
    remove(id)
    {
        let filtered = this.sockets.filter((value) => { 
            return value.id !== id;
        });
        this.sockets = filtered;

        if (this.sockets.empty) {
            unsubscribe()
        }

        console.log(`Sockets were deleted. The following sockets now get served when a message is received:`);
        console.table(this.sockets.map(sock => sock.id))
    }

    async publish(channel, data)
    {
        this.ipfsClient.pubsub.publish(channel, JSON.stringify(data));
    }

    // Every time a message arrives on the IPFS pubsub channel, this function is called.
    // All sockets registered for this channel will then get the data that was send to this channel.
    // Note that we only re-emit the "data: any" value, that is what should have been send from
    // the website end. The msg here contains more that we don't re-emit to the website.
    // Also, emitting does depend on selfEmit. If that's true (you want to receive your own message)
    // If it's false, you don't want to receive your own message. By default it's false.
    async subscribe(msg)
    {
        console.log(msg)
        // return;
        console.log(`Received message on channel: ${this.channel}, these sockets could receive this message (pre filtering).`)
        console.table(this.sockets.map(sock => sock.id))
        
        let enc = new TextDecoder("utf-8");
        let decodedStr = enc.decode(msg.data);

        let crc = CRC32.str(decodedStr).toString()

        let decodedData = JSON.parse(decodedStr);
        let filteredSockets = this.sockets;

        if (decodedData?.selfEmit === false)
        {
            filteredSockets = this.sockets.filter((sock) => { 
                return sock.id !== decodedData?.id;
            });
        }

        // Filter out sockets that contain the above crc (add the crc if they don't contain it)
        filteredSockets = filteredSockets.filter((sock) => { 
            if (!sock.bloom.has(crc)) {
                sock.bloom.add(crc)
                return true;
            }

            console.log(`Kicking ${sock.id} from IPFS, message already handled by another backend`)

            return false;
        });

        console.log(`Sending data to:`)
        console.table(filteredSockets.map(sock => sock.id))
        let stringData = `P${JSON.stringify(decodedData?.data)}`
        let buffer = Buffer.from(stringData).toString('base64')

        for (let socket of filteredSockets)
        {
            socket.emit(this.channel, buffer) 
        }
    }

    // When no more sockets are listening for this topic, unsubscibe from it entirely.
    unsubscribe()
    {
        console.log(`No more sockets waiting for data from this channel. Unsubscribing.`)
        this.ipfsClient.pubsub.unsubscribe(this.channel);
    }
}

module.exports = IPFSSubscribeHandler;