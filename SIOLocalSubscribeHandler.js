'use strict';

const WebSocket = require('ws');
const CRC32 = require('crc-32'); 

/**
 * This class handles channel messages from connections to THIS server.
 * This is an optimization to receive an answer faster for users connected to the same server.
 */
class SIOLocalSubscribeHandler
{
    constructor(channel)
    {
        this.channel = channel
        this.sockets = []

        console.log(`SIOLocalSubscribeHandler Subscribes to channel: ${channel}`)
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
        this.subscribe(data)
    }

    async subscribe(decodedData)
    {
        console.log(`Received message on channel: ${this.channel}, these sockets could receive this message (pre filtering).`)
        console.table(this.sockets.map(sock => sock.id))

        let crc = CRC32.str(JSON.stringify(decodedData)).toString()

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
        let stringData = `L${JSON.stringify(decodedData?.data)}`
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

module.exports = SIOLocalSubscribeHandler;