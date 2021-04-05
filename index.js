// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })
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

io.on('connection', (socket) => {
    console.log(`Connected. Socket id: ${socket.id}`)
    socket.emit(`info`, socket.id)
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
