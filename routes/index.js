let express = require('express');
let router = express.Router();

const bitcore = require("bitcore-lib");
const Mnemonic = require("bitcore-mnemonic");
const axios = require("axios");

const apiNetwork = "https://api.blockcypher.com/v1/btc/test3"
const publicAddress = "";
const blockCypherToken = "59b884b56bd04fb798b7b3fff8cce4e6";
const privateKey = "";

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

router.get('/', function(req, res) {
    res.render('index', {
        balance: getBalance(publicAddress),
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

    // TODO: Test if the given BTC address is valid for the given network ...

    sendBitcoin(address, btcAmount);
    req.flash('success', btcAmount + " BTC sent successfully to " + address
        + ". I may take up to few minutes before the transaction is completed.");
    res.redirect("/");
});

function getBalance(address) {
    // TODO: Retrieve the real BTC balance for a given address
    return parseFloat("0").toFixed(8);
}

function sendBitcoin(toAddress, btcAmount) {
    // TODO: Proceed to do the real transfer ...
}

module.exports = router;
