'use strict';

const cryptoJS = require('crypto-js');

class Block{
    constructor(index,previousHash, timestamp, transactions, hash){
        this.index = index;
        this.previousHash = previousHash.toString();
        this.timestamp = timestamp;
        this.transactions = transactions;
        this.hash = hash.toString();
    }
}

class Transaction {
    constructor(tx_type, PDid, h_enc_PD, h_agreement, access_list,  txn_nounce) {
        this.tx_type = tx_type;
        this.PDid = PDid;
        this.h_enc_PD = h_enc_PD;
        this.h_agreement = h_agreement;
        this.access_list = access_list;
        this.txn_nounce = txn_nounce;
    }
}

class Blockchain {
    constructor() {
        this.chain = [this.getGenesisBlock()];
        this.pendingTransactions = [];
    }

    getGenesisBlock() {
        return new Block(0,"0",1465154705, "my genesis block!!", "816534932c2b7154836da6afc367695e6337db8a921823784c14378abed4f7d7");
    }; 

    calculateHashForBlock(block) {
        return this.calculateHash(block.index, block.previousHash, block.timestamp, block.transactions);
    }
    calculateHash(index, previousHash, timestamp, transactions) {
        return cryptoJS.SHA256(index + previousHash + timestamp + transactions).toString();
    }

    generateNextBlock(blockData) {
        console.log(`block data: ${blockData}`);
        var previousBlock = this.getLatestBlock();
        var nextIndex = previousBlock.index + 1;
        var nextTimeStamp = new Date().getTime() / 1000;
        var nextHash = this.calculateHash(nextIndex,previousBlock.hash, nextTimeStamp, blockData);
        return new Block(nextIndex, previousBlock.hash, nextTimeStamp, blockData, nextHash);
    }

    addBlock(newBlock) {
        //console.log(`newBlock: ${JSON.stringify(newBlock)}`);

        if(this.isValidNewBlock(newBlock, this.getLatestBlock())) {
            this.chain.push(newBlock);
        }
    }

    isValidNewBlock(newBlock, previousBlock) {
        if(previousBlock.index + 1 !== newBlock.index) {
            console.log('invalid index');
            return false;
        } else if(previousBlock.hash !== newBlock.previousHash) {
            console.log('invalid previoushash');
            return false;
        } else if(this.calculateHashForBlock(newBlock) !== newBlock.hash) {
            console.log(typeof(newBlock.hash) + ' ' + typeof(this.calculateHashForBlock(newBlock)));
            console.log('invalid hash: ' + this.calculateHashForBlock(newBlock) + ' ' + newBlock.hash);
            return false;
        }
        return true;
    }

    isValidChain(blockchainToValidate) {
        if(JSON.stringify(blockchainToValidate[0]) !== JSON.stringify(this.getGenesisBlock())) {
            return false;
        }
        var tempBlocks = [blockchainToValidate[0]];
        for(var i = 1; i < blockchainToValidate.length; i++) {
            if(this.isValidNewBlock(blockchainToValidate[i],tempBlocks[i-1])) {
                tempBlocks.push(blockchainToValidate[i]);
            } else {
                return false;
            }
        }
        return true;
    }


    getLatestBlock() {return this.chain[this.chain.length - 1];}

}


//let hancoin = new Blockchain();
//hancoin.addBlock(hancoin.generateNextBlock('afdfdsfsfsf'));


module.exports.Blockchain = Blockchain;
module.exports.Block = Block;
module.exports.Transaction = Transaction;