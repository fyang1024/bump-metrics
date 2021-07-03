require('dotenv').config();
const fs = require('fs');
const Eth = require('web3-eth');
const Utils = require('web3-utils');

const eth = new Eth(process.env.WEB3_PROVIDER);
const DEPOSIT_MADE_TOPIC = Utils.sha3('DepositMade(address,uint256,uint256)');
const BUMP_PURCHASED_TOPIC = Utils.sha3('BumpPurchased(address,uint256,uint256)');
const REWARD_ISSUED_TOPIC = Utils.sha3('RewardIssued(address,uint256,uint256)');

function getEvents(topic) {
    return eth.getPastLogs({
        address: process.env.BUMP_MARKET_CONTRACT,
        topics: [topic],
        fromBlock: process.env.FROM_BLOCK,
        toBlock: process.env.TO_BLOCK || 'latest'
    })
}

function getChecksumAddress(paddedAddress) {
    return Utils.toChecksumAddress('0x' + paddedAddress.substr(26));
}

function parseDepositData(data) {
    const numberOne = data.substr(0, 66);
    const numberTwo = data.substr(66);
    return [
        Utils.fromWei(Utils.hexToNumberString(numberOne), 'mwei'), // USDC has 6 decimal points, hence use 'mwei' as unit
        Utils.hexToNumber('0x' + numberTwo)
    ];
}

function parseBumpTokenData(data) {
    const numberOne = data.substr(0, 66);
    const numberTwo = data.substr(66);
    return [
        Utils.fromWei(Utils.hexToNumberString(numberOne)),
        Utils.hexToNumber('0x' + numberTwo) / 10000
    ];
}

function generateCSVFile(deposits, purchases, rewards) {
    const outputFile = process.env.OUTPUT_FILE;
    const headers = [
        'Block Number',
        'Depositor Address',
        'Deposit Amount',
        'Interest Rate',
        'Purchased Bump Tokens',
        'Bump Token Price',
        'Rewarded Bump Tokens',
        'Transaction Hash',
    ];
    let content = headers.join(',');
    for(let i = 0; i < deposits.length; i++) {
        let dataItems = [];
        dataItems.push(deposits[i].blockNumber);
        dataItems.push(getChecksumAddress(deposits[i].topics[1]));
        parseDepositData(deposits[i].data).forEach(n => dataItems.push(n));
        parseBumpTokenData(purchases[i].data).forEach(n => dataItems.push(n));
        dataItems.push(parseBumpTokenData(rewards[i].data)[0]);
        dataItems.push(rewards[i].transactionHash);
        content = content.concat('\n' + dataItems.join(','));
    }
    fs.writeFile(outputFile, content, err => {
        if (err) {
          console.log('Error writing to csv file', err);
        } else {
          console.log(`saved as ${outputFile}`);
        }
    });
}

Promise.all([
    getEvents(DEPOSIT_MADE_TOPIC),
    getEvents(BUMP_PURCHASED_TOPIC),
    getEvents(REWARD_ISSUED_TOPIC),
]).then(([deposits, purchases, rewards]) => {
    generateCSVFile(deposits, purchases, rewards);
});
