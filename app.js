const express = require('express')
const app = express()
const port = 3000
const WebSocket = require('ws')
var moment = require('moment-timezone');
moment().tz("Asia/Jakarta").format();
const db = require("./db")

let authToken = "0cdb1a93-019d-4ec3-84ba-5dbba5a8121c",
    deviceId = "f5f41f89e29170097fe38eff20d2345a"

let conn = null;

let openPosition = {
    "202108310930": { type: "S", amount: "14000" }
}

function open() {
    let amount = 1400000
    if (conn.openLevel == 1)
        amount = 3500000
    if (conn.openLevel == 2)
        amount = 8750000
    conn.status = "OPEN"
    let position = conn.lastPosition
    let createdAt = (new Date()).getTime()
    let expiredAt = Math.round(createdAt / 10000) * 10 + conn.expired
    let message =
    {
        "topic": "base",
        "event": "create_deal",
        "payload": {
            "amount": amount,
            "asset": "Z-CRY/IDX",
            "asset_id": 347,
            "asset_name": "Crypto IDX", "created_at": createdAt, "currency_iso": "IDR", "deal_type": "demo",
            "expire_at": expiredAt, "option_type": "turbo", "tournament_id": null, "trend": position == "S" ? "put" : "call", "is_state": false
        }, "ref": conn.ref, "join_ref": "11"
    }
    if (conn != null) {
        conn.ref++;
        conn.send(JSON.stringify(message))
        console.log(`open position`, JSON.stringify(message))
    }
}

setInterval(async () => {
    if (conn != null) {
        const sec = moment().format("ss");
        if (sec == "00") {
            let datetimeminute = moment().tz("Asia/Jakarta").format("YYYYMMDDHHmm");
            const row = await db(`open`).where("datetime", datetimeminute).first();
            console.log(`row `, row)
            if (row !== undefined && row !== null) {
                conn.lastPosition = row.position
                open();
            }
            console.log(datetimeminute)
        }
    }

}, 1000);

const ws = new WebSocket('wss://as.binomo-investment.com/', {
    origin: 'https://binomo-investment.com'
});


ws.on('open', function open() {
    console.log('connected');
    ws.send(JSON.stringify({ "action": "subscribe", "rics": ["Z-CRY/IDX"] }));
});

ws.on('close', function close() {
    console.log('disconnected');
});

ws.on('message', function incoming(message) {
    // console.log('received: %s', message);
});

let ws2 = new WebSocket('wss://ws.binomo-investment.com/?authtoken=' + authToken + '&device=web&device_id=' + deviceId + '&v=2&vsn=2.0.0',
    {
        headers: {
            "host": "ws.binomo-investment.com",
            "origin": "https://binomo-investment.com",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/92.0.4515.159 Safari/537.36"
        }
    });

ws2.on('open', function open() {
    console.log('connected ws 2');
    conn = ws2;
    conn.status = ""
    conn.openLevel = 0;
    conn.time = 0;
    conn.accountFirst = true;
    conn.userFirst = true;
    conn.baseFirst = true;
    conn.cfdZeroSpread = true;
    conn.ref = 15;
    conn.expired = 20;
    conn.currentBalance = 0;
    conn.lastPosition = "B"
    ws2.send(JSON.stringify({ "topic": "account", "event": "phx_join", "payload": {}, "ref": "5", "join_ref": "5" }))
    ws2.send(JSON.stringify({ "topic": "user", "event": "phx_join", "payload": {}, "ref": "8", "join_ref": "8" }))
    ws2.send(JSON.stringify({ "topic": "base", "event": "phx_join", "payload": {}, "ref": "11", "join_ref": "11" }))
    ws2.send(JSON.stringify({ "topic": "cfd_zero_spread", "event": "phx_join", "payload": {}, "ref": "14", "join_ref": "14" }))

    setInterval(() => {
        ws2.send(JSON.stringify({ "topic": "phoenix", "event": "heartbeat", "payload": {}, "ref": conn.ref }));
        conn.ref++;
        ws2.send(JSON.stringify({ "topic": "account", "event": "ping", "payload": {}, "ref": conn.ref, "join_ref": "5" }));
        conn.ref++;
        ws2.send(JSON.stringify({ "topic": "user", "event": "ping", "payload": {}, "ref": conn.ref, "join_ref": "8" }));
        conn.ref++;
        ws2.send(JSON.stringify({ "topic": "base", "event": "ping", "payload": {}, "ref": conn.ref, "join_ref": "11" }));
        conn.ref++;
        ws2.send(JSON.stringify({ "topic": "cfd_zero_spread", "event": "ping", "payload": {}, "ref": conn.ref, "join_ref": "14" }));
        conn.ref++;

    }, 60000);
});

ws2.on('connection', function connection(ws, req) {
    console.log('connected connection');
});


ws2.on('close', function close() {
    console.log('disconnected');
});

ws2.on('message', function incoming(message) {

    message = JSON.parse(message)
    console.log('\x1b[33m%s\x1b[0m', JSON.stringify(message));  //yellow

    if (message.event == "phx_reply" && message.topic == "account") {
        if (!conn.accountFirst) {
            ws2.send(JSON.stringify({ "topic": "account", "event": "ping", "payload": {}, "ref": conn.ref, "join_ref": "5" }))
            conn.ref++
        }
        conn.accountFirst = true;
    }

    if (message.event == "phx_reply" && message.topic == "user") {
        if (!conn.userFirst) {
            ws2.send(JSON.stringify({ "topic": "user", "event": "ping", "payload": {}, "ref": conn.ref, "join_ref": "8" }))
            conn.ref++
        }
        conn.userFirst = true;
    }

    if (message.event == "phx_reply" && message.topic == "base") {
        if (!conn.baseFirst) {
            ws2.send(JSON.stringify({ "topic": "base", "event": "ping", "payload": {}, "ref": conn.ref, "join_ref": "11" }))
            conn.ref++
        }
        conn.baseFirst = true;
    }

    if (message.event == "change_balance") {
        const updateBalance = message.payload.demo_balance
        console.log("currentBalance ", updateBalance);
        if (conn.status == "CLOSE") {
            let amountModal = 1400000
            if (conn.openLevel == 1)
                amountModal = 3500000
            if (conn.openLevel == 2)
                amountModal = 8750000
            let profit = updateBalance - conn.currentBalance - amountModal
            if (profit < 0) {
                if (conn.openLevel < 2) {
                    conn.openLevel++;
                    open();
                } else
                    conn.openLevel = 0
                console.log("Lose session")
            } else
                conn.openLevel = 0
        }
        conn.currentBalance = updateBalance
    }

    if (message.event == "deal_created") {
        conn.status = "OPEN"
    }

    if (message.event == "close_deal_batch") {
        conn.status = "CLOSE"
    }

    if (message.event == "phx_reply" && message.payload.status == "error") {
        console.log("kena validasi expired")
        if (conn.expired < 90)
            conn.expired += 10;
        else
            conn.expired = 20;
        open()
    }
});


app.get('/', async (req, res) => {
    let data = await db(`open`).orderBy(`datetime`, `ASC`);
    const a = data.map(item => {
        const datetimeStd = item.datetime.substr(0, 4) + "-" + item.datetime.substr(4, 2) + "-" + item.datetime.substr(6, 2) + " " +
            item.datetime.substr(8, 2) + ":" + item.datetime.substr(10, 2) + ":00"
        return {
            datetime: moment(datetimeStd).format("DD/MM/YYYY HH:mm"),
            position: item.position
        }
    })
    return res.json(a)
})

app.get('/input', async (req, res) => {
    const a = req.query
    return res.json(a)
})

app.get('/find', async (req, res) => {
    const datetime = "202008311000"
    const a = await db(`open`).where("datetime", datetime).first();
    return res.json(a)
})

app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})