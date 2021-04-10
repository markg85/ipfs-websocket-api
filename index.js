// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })
const osu = require('node-os-utils')
const io = require('socket.io')(fastify.server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket'],
    serveClient: false
});
const ipfsClient = require('ipfs-http-client');

const ipfs = ipfsClient('http://ipfs_host:5001');
const ApiHandler = require('./APIHandler');
let handler = null;

let clientData = null;

// Declare a route
fastify.get('/', async (request, reply) => {
    return JSON.stringify(await ipfs.pubsub.ls())
})

async function welcomeConnection(socket) {
    let usage = await osu.cpu.usage();
    let status = "CONN_OK"
    let message = "You are now connected."

    console.log(`CPU USAGE: ${usage}`)

    /*
        We give the user different status messages.

        CONN_OK
          The connection is OK. The user can do whatever.

        CONN_HIGH_LOAD
          If the CPU usage is above 70% this status is given.
          A connection is still accepted but not preferred.

        CONN_KILLED_TOO_HIGH_CPU_LOAD
          If the CPU usahe gets above 90%, all new connections are
          given this status and killed immediately after.
          The user must connect to a different server.
    */
    if (usage > 70.0 && usage <= 90.0) {
        console.log(`PLEASE USE ANOTHER SERVER`)
        status = "CONN_HIGH_LOAD"
        message = "Please consider using another server. This one has a high CPU load. (>70%)"
    } else if (usage > 90.0) {
        console.log(`KICKING USER, too high CPU load`)
        status = "CONN_KILLED_TOO_HIGH_CPU_LOAD"
        message = "The CPU load is above 90%. Not accepting new connections, closing. Use a different server."
    }

    return {
        id: socket.id,
        status: status,
        message: message
    }
}

io.on('connection', async (socket) => {
    console.log(`Connected. Socket id: ${socket.id}`)
    let welcomePackage = await welcomeConnection(socket)
    let stringData = JSON.stringify(welcomePackage)
    let buffer = Buffer.from(stringData).toString('base64')
    socket.emit(`info`, buffer)

    if (welcomePackage.status == "CONN_KILLED_TOO_HIGH_CPU_LOAD") {
        socket.disconnect();
        console.log(`Forcefully disconnected ${socket.id} due to high CPU load.`)
        return;
    }

    socket.on('message', (data) => {
        console.log(data)
    });
    socket.on('disconnect', () => {
        // At this point we have no clue which socket was connected to which API method.
        // So just ask the handler (which will ask all mappings) to remove any socket with this id.
        // This could be inefficient if we have thousands of open sockets...
        console.log(`Going to disconnect. Socket id: ${socket.id}`)
        handler.remove(socket.id)
    });
    socket.on('subscribe', (channel) => {
        console.log(`Attempting to register channel: ${channel} to socket id: ${socket.id}`);
        handler.registerSubscribe(channel, socket)
    });
    socket.on('publish', (data) => {
        handler.publish(socket, data)
    });
});

// Run the server!
const start = async () => {
    try {
        clientData = await ipfs.id();
        handler = new ApiHandler(ipfs, clientData);
        await fastify.listen(80, '0.0.0.0')
        fastify.log.info(`server listening on ${fastify.server.address().port}`)
    } catch (err) {
        fastify.log.error(err)
        process.exit(1)
    }
}
start()
