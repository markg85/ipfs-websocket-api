'use strict';

const WebSocket = require('ws');
const CRC32 = require('crc-32'); 

// This class manages n registrants for 1 topic.
// An NKNSubscribeHandler class only handles 1 topic and sends messages 
// received on that one topic to each of the registrants (sockets).
class NKNSubscribeHandler
{
    constructor(channel, nknClient)
    {
        this.channel = channel
        this.sockets = []
        this.nknClient = nknClient;

        // Public key: 03fd4a45582bc45065c556e580543f7aeae14032f99ed24956330855c5ea4bbe

        this.nknClient.onMessage(async ({ src, payload, isEncrypted }) => {
            this.subscribe({ src, payload, isEncrypted })
        });

        console.log(this.nknClient.getSeed(), this.nknClient.getPublicKey());

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
        if (this.nknClient.isReady == false) {
            await Promise.all([
                new Promise((resolve, reject) => this.nknClient.onConnect(resolve))
            ]);

            await new Promise((resolve, reject) => setTimeout(resolve, 1000));
        }

        try {
            for (let addr of this.nknClient.destaddrs)
            {
                this.nknClient.send(
                    addr,
                    JSON.stringify({channel: channel, data: data}),
                    {responseTimeout: 0}
                );
            }
        } catch (error) {
            console.log(error)
        }

    }

    async subscribe(msg)
    {
        console.log(`Received message on channel: ${this.channel}, these sockets could receive this message (pre filtering).`)
        console.table(this.sockets.map(sock => sock.id))
        
        let decodedData = JSON.parse(msg.payload);

        if (decodedData?.channel != this.channel) {
            console.warn("Received data not intended for this channel.")
            console.log(decodedData)
            return;
        }

        if (decodedData?.data == undefined) {
            console.error("No data")
            console.log(decodedData)
            return;
        }

        let crc = CRC32.str(JSON.stringify(decodedData.data)).toString()

        // This is the data we're interested in. This came from the website and needs to be broadcast to all interested parties.
        decodedData = decodedData.data

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

            console.log(`Kicking ${sock.id} from NKN, message already handled by another backend`)

            return false;
        });

        console.log(`Sending data to:`)
        console.table(filteredSockets.map(sock => sock.id))
        let stringData = `N${JSON.stringify(decodedData?.data)}`
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
    }
}

module.exports = NKNSubscribeHandler;