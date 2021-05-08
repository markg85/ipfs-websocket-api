'use strict';

/**
 * This class does the bookkeeping to have all nodes send the publish messages to all other nodes.
 * To do that, this class registers itself on IPFS pubsub. There each node will broadcast it's own
 * existance by public key. Found keys will then get added to the list of NKN addresses to send publish messages too.
 * 
 */
class IPFSNKNHelper
{
    constructor(ipfsClient)
    {
        this.ipfsClient = ipfsClient;
        this.nknClient = null;
        this.opsnNknChannel = "__openpubsubnetwork.nkn"

        // Subscribe to the channel
        this.ipfsClient.pubsub.subscribe(this.opsnNknChannel, (msg) => {
            this.subscribe(msg)
        });
    }

    setNknClient(nknClient)
    {
        this.nknClient = nknClient
    }

    async askAllNknsToReport()
    {
        this.ipfsClient.pubsub.publish(this.opsnNknChannel, JSON.stringify({ task: "IDENTIFY", nknPublicKey: this.nknClient.getPublicKey() }));
    }

    async addSelfToAddrs()
    {
        if (!this.nknClient.destaddrs.includes(this.nknClient.getPublicKey()))
        {
            this.nknClient.destaddrs.push(this.nknClient.getPublicKey())
            console.log(`Added self (${this.nknClient.getPublicKey()}) to the list of addresses to send publish messages too.`)
        }
    }

    async subscribe(msg)
    {
        let enc = new TextDecoder("utf-8");
        let decodedStr = enc.decode(msg.data);
        let nknPublicKey = ""

        try {
            let jsonData = JSON.parse(decodedStr);
            if (jsonData?.task)
            {
                // We have been asked to identify ourselves to jsonData.nknPublicKey
                if (jsonData.task == "IDENTIFY" && jsonData?.nknPublicKey) {
                    this.ipfsClient.pubsub.publish(this.opsnNknChannel, JSON.stringify({ task: "IDENTIFY_RESPONSE", myPublicKey: this.nknClient.getPublicKey(), destPublicKey: jsonData.nknPublicKey }));
                    return;
                } else if (jsonData.task == "IDENTIFY_RESPONSE" && jsonData?.myPublicKey && jsonData?.destPublicKey) {
                    // Is this response for us?
                    if (this.nknClient.getPublicKey() == jsonData.destPublicKey) {
                        // Yes, it's for us!
                        nknPublicKey = jsonData.myPublicKey
                    } else {
                        return;
                    }
                } else {
                    return;
                }
            } else {
                console.log("There's no task in this data. Ignoring.")
            }

            if (jsonData.nknPublicKey != undefined)
            {
                nknPublicKey = jsonData.nknPublicKey
            }
        } catch(e) {
            console.log("Some bozo is apparently spamming us with fake data i assume... Ignoring.");
            return;
        }

        if(nknPublicKey == "")
        {
            console.log("We did receive data but not valid NKN address.")
            console.log(decodedStr)
            return;
        }

        if (!this.nknClient.destaddrs.includes(nknPublicKey))
        {
            this.nknClient.destaddrs.push(nknPublicKey)
            console.log(`Added ${nknPublicKey} to the list of addresses to send publish messages too.`)
        }
    }

}

module.exports = IPFSNKNHelper;