'use strict';

const WebSocket = require('ws');
const CRC32 = require('crc-32'); 

/**
 * This class handles channel messages from connections to THIS server.
 * This is an optimization to receive an answer faster for users connected to the same server.
 */
class SIOLocalSubscribeHandler
{
    constructor(channel, apiHandler)
    {
        this.channel = channel
        this.apiHandler = apiHandler;

        console.log(`SIOLocalSubscribeHandler Subscribes to channel: ${channel}`)
    }

    sockets()
    {
        return this.apiHandler.sockets.filter((sock) => { 
            return sock.channel == this.channel;
        });
    }

    async publish(channel, data)
    {
        this.subscribe(data)
    }

    async subscribe(decodedData)
    {
        console.log(`Received message on channel: ${this.channel}, these sockets could receive this message (pre filtering).`)
        console.table(this.sockets().map(sock => sock.id))

        let crc = CRC32.str(JSON.stringify(decodedData)).toString()

        let filteredSockets = this.sockets();

        if (decodedData?.selfEmit === false)
        {
            filteredSockets = filteredSockets.filter((sock) => { 
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

        let stringData = decodedData

        if (decodedData?.data) {
            stringData = JSON.stringify(decodedData?.data)
        } else if (typeof decodedData === 'object') {
            stringData = JSON.stringify(decodedData)
        }

        stringData = `L${stringData}`

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