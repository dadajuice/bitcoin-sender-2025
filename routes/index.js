let express = require('express');
let router = express.Router();

const bitcore = require("bitcore-lib");
const Mnemonic = require("bitcore-mnemonic");
const axios = require("axios");

const apiNetwork = "https://api.blockcypher.com/v1/btc/test3"
const publicAddress = "tb1qdxg0pj8r8vp6s0qpavs099t0u2pxz2gjukxjp3";
const blockCypherToken = "59b884b56bd04fb798b7b3fff8cce4e6";
const privateKey = "cV3Sf496sZY5E5hn78HxokQxfGfsM5dh6NLyiaYSCC46SAetYzkr";

router.get("/wallet", function (req, res) {
    const mnemonic = new Mnemonic();
    console.log(`🌱 SEED PHASE: ${mnemonic.toString()}`);

    const seed = mnemonic.toSeed();
    const hdRoot = bitcore.HDPrivateKey.fromSeed(
        seed, bitcore.Networks.testnet);

    // BIP32 (derive path) + BIP84
    const path = "m/84'/1'/0'/0/0";
    const child = hdRoot.deriveChild(path);

    // Private key + WIF
    const pk = child.privateKey;
    const wif = pk.toWIF();
    console.log(`🔐 PRIVATE KEY (WIF): ${wif}`);

    // Public key
    const pubKey = pk.toPublicKey();
    const sigwitAddress = bitcore.Address.fromPublicKey(
        pubKey,
        bitcore.Networks.testnet,
        'witnesspubkeyhash' // P2WPKH
    );
    console.log(`🔑 PUBLIC ADDRESS (SIGWIT): ${sigwitAddress}`);

    res.send("SUCCESS! Check the node console for details.");
});

router.get('/', async function(req, res) {
    res.render('index', {
        balance: await getBalance(publicAddress),
        error: req.flash('error'),
        success: req.flash('success'),
        address: publicAddress
    });
});

router.post('/', async function (req, res) {
    let btcAmount = req.body.amount;
    let address = req.body.address;

    if (btcAmount === undefined || btcAmount === "") {
        req.flash('error', "The amount to sent must be given.");
        res.redirect("/");
        return;
    }

    if (isNaN(btcAmount)) {
        req.flash('error', "The amount must be numeric.");
        res.redirect("/");
        return;
    }

    if (address === undefined || address === "") {
        req.flash('error', "The recipient address must be given.");
        res.redirect("/");
        return;
    }

    if (!bitcore.Address.isValid(address, bitcore.Networks.testnet)) {
        req.flash("error", "Invalid recipient address given. Be sure to use a valid BTC address on the test network.");
        res.redirect("/");
        return;
    }

    try {
        const result = await sendBitcoin(address, btcAmount);
        console.log(result);
        req.flash('success', btcAmount + " BTC sent successfully to " + address
            + ". I may take up to few minutes before the transaction is completed.");
        res.redirect("/");
    } catch (e) {
        let errorMessage = e.message;
        if (e.response && e.response.data && e.response.data.error) {
            errorMessage = errorMessage + " (" + e.response.data.error + ")";
        }
        req.flash("error", errorMessage);
        res.redirect("/");
    }
});

async function getBalance(address) {
    const url = `${apiNetwork}/addrs/${address}/balance`;
    const result = await axios.get(url);
    const data = result.data;
    // Values are in Sats (100,000,000 Sats = 1 BTC)
    const balance = parseFloat(data.final_balance / 100000000);
    return balance.toFixed(8);
}

async function sendBitcoin(toAddress, btcAmount) {
    const satoshiToSend = Math.ceil(btcAmount * 100000000);
    const txUrl = `${apiNetwork}/addrs/${publicAddress}?includeScript=true&unspentOnly=true`;
    const txResult = await axios.get(txUrl);

    let inputs = [];
    let totalAmountAvailable = 0;
    let inputCount = 0;

    let outputs = txResult.data.txrefs || [];
    // Quality of life because Fauset are slow to confirm transactions
    outputs = outputs.concat(txResult.data.unconfirmed_txrefs || []);
    for (const element of outputs) {
        let utx = {};
        utx.satoshis = Number(element.value);
        utx.script = element.script;
        utx.address = txResult.data.address;
        utx.txId = element.tx_hash;
        utx.outputIndex = element.tx_output_n;
        totalAmountAvailable += utx.satoshis;
        inputCount += 1;
        inputs.push(utx);
    }

    const transaction = new bitcore.Transaction();
    transaction.from(inputs);

    let outputCount = 2;
    let transactionSize = (inputCount * 148) + (outputCount * 34) + 10;
    let fee = transactionSize * 20; // TODO: In main net we would call an API to get the real fees ...

    transaction.to(toAddress, satoshiToSend);
    transaction.fee(fee);
    transaction.change(publicAddress);
    transaction.sign(privateKey);

    const serializedTransaction = transaction.serialize();
    const result = await axios({
        method: "POST",
        url: `${apiNetwork}/txs/push?token=${blockCypherToken}`,
        data: {
            tx: serializedTransaction
        }
    });
    return result.data;
}

module.exports = router;
