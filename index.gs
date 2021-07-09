// this is required by btoa function
const keystr =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

// this is required by btoa function
function btoaLookup(index) {
  if (index >= 0 && index < 64) {
    return keystr[index];
  }
  return undefined;
}

// this function is required by web3.min.js
function btoa(s) {
  var i;
  // String conversion as required by Web IDL.
  s = `${s}`;
  // "The btoa() method must throw an "InvalidCharacterError" DOMException if
  // data contains any character whose code point is greater than U+00FF."
  for (i = 0; i < s.length; i++) {
    if (s.charCodeAt(i) > 255) {
      return null;
    }
  }
  var out = "";
  for (i = 0; i < s.length; i += 3) {
    var groupsOfSix = [undefined, undefined, undefined, undefined];
    groupsOfSix[0] = s.charCodeAt(i) >> 2;
    groupsOfSix[1] = (s.charCodeAt(i) & 0x03) << 4;
    if (s.length > i + 1) {
      groupsOfSix[1] |= s.charCodeAt(i + 1) >> 4;
      groupsOfSix[2] = (s.charCodeAt(i + 1) & 0x0f) << 2;
    }
    if (s.length > i + 2) {
      groupsOfSix[2] |= s.charCodeAt(i + 2) >> 6;
      groupsOfSix[3] = s.charCodeAt(i + 2) & 0x3f;
    }
    for (var j = 0; j < groupsOfSix.length; j++) {
      if (typeof groupsOfSix[j] === "undefined") {
        out += "=";
      } else {
        out += btoaLookup(groupsOfSix[j]);
      }
    }
  }
  return out;
};

const WEB3_JS = 'https://cdn.jsdelivr.net/gh/ethereum/web3.js/dist/web3.min.js';
const WEB3_PROVIDER='https://eth-kovan.alchemyapi.io/v2/YOUR_API_KEY';
const BUMP_MARKET_CONTRACT='0x60D76E2353aA9A7e76d15C69BBc408da3B496a10';
const FROM_BLOCK=25660887;
const TO_BLOCK='latest';

var window = {}; // this is required by evaluating web3.min.js
eval(UrlFetchApp.fetch(WEB3_JS).getContentText());
const web3 = new window.Web3(new window.Web3.providers.HttpProvider(WEB3_PROVIDER));
const DEPOSIT_MADE_TOPIC = web3.utils.sha3('DepositMade(address,uint256,uint256)');
const BUMP_PURCHASED_TOPIC = web3.utils.sha3('BumpPurchased(address,uint256,uint256)');
const REWARD_ISSUED_TOPIC = web3.utils.sha3('RewardIssued(address,uint256,uint256)');

function getEvents(topic) {
  return web3.eth.getPastLogs({
      address: BUMP_MARKET_CONTRACT,
      topics: [topic],
      fromBlock: FROM_BLOCK,
      toBlock: TO_BLOCK
  });
}

function getChecksumAddress(paddedAddress) {
  return web3.utils.toChecksumAddress('0x' + paddedAddress.substr(26));
}

function parseDepositData(data) {
  const numberOne = data.substr(0, 66);
  const numberTwo = data.substr(66);
  return [
      web3.utils.fromWei(web3.utils.hexToNumberString(numberOne), 'mwei'), // USDC has 6 decimal points, hence use 'mwei' as unit
      web3.utils.hexToNumber('0x' + numberTwo)
  ];
}

function parseBumpTokenData(data) {
  const numberOne = data.substr(0, 66);
  const numberTwo = data.substr(66);
  return [
      web3.utils.fromWei(web3.utils.hexToNumberString(numberOne)),
      web3.utils.hexToNumber('0x' + numberTwo) / 10000
  ];
}

function organiseData(deposits, purchases, rewards) {
  const data = [];
  const headers = [
      'Block Number',
      'Depositor Address',
      'Deposit Amount',
      'Interest Rate',
      'Purchased Bump Tokens',
      'Bump Token Price',
      'Rewarded Bump Tokens',
  ];
  data.push(headers);
  for(let i = 0; i < deposits.length; i++) {
      let dataItems = [];
      dataItems.push(deposits[i].blockNumber);
      dataItems.push(getChecksumAddress(deposits[i].topics[1]));
      parseDepositData(deposits[i].data).forEach(n => dataItems.push(n));
      parseBumpTokenData(purchases[i].data).forEach(n => dataItems.push(n));
      dataItems.push(parseBumpTokenData(rewards[i].data)[0]);
      data.push(dataItems);
  }
  return data;
}

function setTimeout(func,ms) {
  Utilities.sleep(ms);
  func();
};

function dumpBumpMarketData() {
  return new Promise(function (resolve, reject) {
    Promise.all([
      getEvents(DEPOSIT_MADE_TOPIC),
      getEvents(BUMP_PURCHASED_TOPIC),
      getEvents(REWARD_ISSUED_TOPIC),
    ]).then(([deposits, purchases, rewards]) => {
      const data = organiseData(deposits, purchases, rewards);
      const sheet = SpreadsheetApp.getActiveSheet();
      const range = sheet.getRange(1, 1, purchases.length + 1, 7);
      range.setValues(data);
      resolve();
    }).catch(err => {
      reject(err);
    });
  });
}
