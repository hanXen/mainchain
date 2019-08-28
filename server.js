'use strict';
var express = require("express");
var bodyParser = require("body-parser");
var WebSocket = require("ws");

const {Blockchain,Transaction} = require('./blockchain');

var http_port = process.argv[2]||3001;
var p2p_port = process.argv[3] || 6001;
var initialPeers = process.argv[4]? [process.argv[4]] : [];

const blockchain = new Blockchain();

var sockets = [];
var MessageType = {
    QUERY_LATEST: 0,
    QUERY_ALL: 1,
    RESPONSE_BLOCKCHAIN: 2
};

var newTransaction = (tx_type, PDid, h_enc_PD, h_agreement, access_list) => {
    const nonce = 1;
    const tx = new Transaction(tx_type, PDid, h_enc_PD, h_agreement, access_list, nonce);
    blockchain.pendingTransactions.push(tx);
}


var initHTTPServer = () => {
    var app = express();
    app.use(bodyParser.json());

    app.get('/blocks',(req, res) => res.send(JSON.stringify(blockchain.chain)));
    app.get('/mineBlock', (req, res) => {
        res.sendFile(__dirname + "/mine.html");
    });
    app.post('/mineBlock', (req, res) => {
        //console.log(req.body.data);
        console.log(`data: ${blockchain.pendingTransactions}`);
        var newBlock = blockchain.generateNextBlock(blockchain.pendingTransactions);
        //var newBlock = blockchain.generateNextBlock(req.body.data);

        blockchain.addBlock(newBlock);
        broadcast(responseLatestMsg());
        console.log('block added: ' + JSON.stringify(newBlock));
        blockchain.pendingTransactions = [];
        console.log(blockchain.chain);
        res.send(JSON.stringify(blockchain.chain));
    });
    app.get('/peers', (req, res) => {
        console.log(sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort) );
        res.send(sockets.map(s => s._socket.remoteAddress + ':' + s._socket.remotePort));
    });
    app.get('/addPeer', (req, res) => {
        res.sendFile(__dirname + '/addPeer.html');
    });
    app.post('/addPeer', (req, res) => {
        console.log([req.body]);
        connectToPeers([req.body.peer]);
        res.send();
    });

    app.post('/newTransaction', (req, res) => {
        const tx = req.body;
        //required = ['tx_type', 'PDid', 'h_enc_PD', 'h_agreement', 'access_list'];
        
        newTransaction(tx.tx_type, tx.PDid, tx.h_enc_PD, tx.h_agreement, tx.access_list);
        res.send(`tx will append at ${blockchain.chain.length} block\n`);
    });

    app.listen(http_port, () => console.log('Listening http on port: ' + http_port ));
}

var initP2PServer = () => {
    var server = new WebSocket.Server({port : p2p_port});
    server.on('connection', (ws) => initConnection(ws));
    console.log('listening websocket p2p on: ' + p2p_port);
}

var initConnection = (ws) => {
    sockets.push(ws);
    initMessageHandler(ws);
    console.log(`initConnection\n`);
    write(ws,queryChainLengthMsg());
}

var initMessageHandler = (ws) => {
    ws.on('message', (data) => {
        var message = JSON.parse(data);
        //console.log(`Received Message: ${JSON.stringify(message)} time: ${new Date().getTime()}\n`);
        switch(message.type) {
            case MessageType.QUERY_LATEST:
                write(ws, responseLatestMsg());
                break;
            case MessageType.QUERY_ALL:
                write(ws, responseChainMsg());
                break;
            case MessageType.RESPONSE_BLOCKCHAIN:
                handleBlockchainResponse(message);
                break;
        }
    })
}

var connectToPeers = (newPeers) => {
    newPeers.forEach((peer) => {
        var ws = new WebSocket(peer);
        ws.on('open', () => initConnection(ws));
        ws.on('error', () => {
            console.log('connection failed');
        });
    });
};

var handleBlockchainResponse = (message) => {
    console.log(`handleBlockchainResponse\n`);
    //console.log(`chain : ${JSON.stringify(message)}`);
    var receivedBlocks = JSON.parse(message.data).sort((b1,b2) => (b1.index - b2.index));
    var latestBlockReceived = receivedBlocks[receivedBlocks.length-1];
    var latestBlockHeld =  blockchain.getLatestBlock();
    if(latestBlockReceived.index > latestBlockHeld.index) {
        console.log('blockchain possibly behind. We got: ' + latestBlockHeld.index + ' Peer got: ' + latestBlockReceived.index);
        if(latestBlockHeld.hash == latestBlockReceived.previousHash) {
            console.log("We can append the received block to our chain");
            blockchain.chain.push(latestBlockReceived);
            broadcast(responseLatestMsg());
        } else if(receivedBlocks.length == 1) {
            console.log("We have to query the chain from our peer");
            broadcast(queryAllMsg());
        } else {
            console.log("Received blockchain is longer than current blockchain");
            replaceChain(receivedBlocks);
        }
    } else {
        console.log('received blockchain is not longer than current blockchain. Do nothing');
    }
};


var replaceChain = (newBlocks) => {
    if(blockchain.isValidChain(newBlocks) && newBlocks.length > blockchain.chain.length) {
        console.log('Received blockchain is valid. Replacing current blockchain with received blockchain');
        blockchain.chain = newBlocks;
        broadcast(responseLatestMsg());
    } else {
        console.log('Received blockchain invalid');
    }
} 

var queryChainLengthMsg = () => ({'type': MessageType.QUERY_LATEST});
var queryAllMsg = () => ({'type': MessageType.QUERY_ALL});
var responseLatestMsg = () => ({
    'type' : MessageType.RESPONSE_BLOCKCHAIN,
    'data' : JSON.stringify([blockchain.getLatestBlock()])
});
var responseChainMsg = () => ({
    'type' : MessageType.RESPONSE_BLOCKCHAIN,
    'data' : JSON.stringify(blockchain.chain)
});
var write = (ws,message) => { //console.log(`$$$$message: ${JSON.stringify(message)} time : ${new Date().getTime()}\n`)
    ws.send(JSON.stringify(message));}
var broadcast = (message) => sockets.forEach(socket => write(socket,message));

connectToPeers(initialPeers);
initHTTPServer();
initP2PServer();

console.log(blockchain.chain);