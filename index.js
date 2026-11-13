const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;

const TARGET_URL = 'https://www.doenets.lk/examresults';
const TARGET_EMAIL = 'imalshanethsara58@gmail.com';

// දුරකථන අංක සැකසුම
const BOT_WHATSAPP_NUMBER = '94740196225'; // බොට් කනෙක්ට් වන අංකය
const ALERT_RECEIVER_NUMBER = '94769761929'; // ඇලර්ට් මැසේජ් එක යා යුත් අංකය

// Gmail SMTP Configuration (ඊමේල් යැවීමට)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'imalshanethsara58@gmail.com',
        pass: 'YOUR_GMAIL_APP_PASSWORD' // මෙතනට ඔයාගේ Gmail App Password එක දාන්න
    }
});

let sock;
let isConnected = false;
let lastPageState = '';
let lastApiState = '';

// WhatsApp Pairing Code සෙටප් එක
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            try {
                const code = await sock.requestPairingCode(BOT_WHATSAPP_NUMBER);
                console.log(`\n========================================`);
                console.log(`🔑 WHATSAPP PAIRING CODE: ${code}`);
                console.log(`========================================\n`);
            } catch (err) {
                console.error('Error requesting pairing code:', err);
            }
        }, 3000);
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'open') {
            isConnected = true;
            console.log('WhatsApp connected successfully!');
            
            // කනෙක්ට් වූ වගෙ තහවුරු කිරීමට බොට් අංකයෙන්ම මැසේජ් එකක් යැවීම
            try {
                const jid = `${BOT_WHATSAPP_NUMBER}@s.whatsapp.net`;
                await sock.sendMessage(jid, { text: '✅ WhatsApp Exam Monitor Bot Connected Successfully & Ready!' });
            } catch (e) {
                console.error('Connect notification error:', e);
            }

        } else if (connection === 'close') {
            isConnected = false;
            if ((lastDisconnect.error)?.output?.statusCode !== DisconnectReason.loggedOut) {
                connectToWhatsApp();
            }
        }
    });

    // .alive සහ වෙනත් කමාන්ඩ් සඳහා මැසේජ් සවන් දීම (Listening for messages)
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const messageText = msg.message.conversation || msg.message.extendedTextMessage?.text;
        const senderJid = msg.key.remoteJid;

        if (messageText && messageText.trim() === '.alive') {
            await sock.sendMessage(senderJid, { text: '🤖 *Exam Monitor Bot is ALIVE and RUNNING 24/7!*' }, { quoted: msg });
        }
    });
}

// වෙනසක් සිදු වූ විට WhatsApp සහ Email වෙත ඇලර්ට් යැවීම
async function sendAlerts(reason, details) {
    const message = `🚨 *A/L 2026 RESULTS UPDATE DETECTED!* 🚨\n\n` +
                    `📌 *Reason:* ${reason}\n` +
                    `🔍 *Details:* ${details}\n` +
                    `🔗 *Link:* ${TARGET_URL}`;

    // 1. වෙනත් නම්බර් එකකට WhatsApp මැසේජ් එක යැවීම (94769761929)
    if (isConnected) {
        try {
            const receiverJid = `${ALERT_RECEIVER_NUMBER}@s.whatsapp.net`;
            await sock.sendMessage(receiverJid, { text: message });
            console.log('WhatsApp alert sent to target number successfully!');
        } catch (err) {
            console.error('WhatsApp send error:', err);
        }
    }

    // 2. Email යැවීම
    try {
        await transporter.sendMail({
            from: 'imalshanethsara58@gmail.com',
            to: TARGET_EMAIL,
            subject: `🚨 Doenets Update Detected: ${reason}`,
            text: message
        });
        console.log('Email alert sent successfully!');
    } catch (err) {
        console.error('Email send error:', err);
    }
}

// වෙබ් පේජ් එක සහ බැකෙන්ඩ්/API වෙනස්වීම් පරීක්ෂා කිරීම
async function checkWebsiteAndBackend() {
    try {
        const pageResponse = await axios.get(TARGET_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $ = cheerio.load(pageResponse.data);
        const pageText = $('body').text().replace(/\s+/g, ' ').trim();

        let apiData = '';
        try {
            const apiRes = await axios.get('https://www.doenets.lk/results/service/exam/results', { timeout: 5000 }).catch(() => null);
            if (apiRes) {
                apiData = JSON.stringify(apiRes.data);
            }
        } catch (e) {
            apiData = pageResponse.data;
        }

        if (lastPageState === '') {
            lastPageState = pageText;
            lastApiState = apiData;
            console.log('Initial baseline captured. Full monitoring active...');
            return;
        }

        let changeDetected = false;
        let changeReason = '';
        let changeDetails = '';

        if (!lastPageState.includes('2026') && pageText.includes('2026')) {
            changeDetected = true;
            changeReason = '2026 A/L Results Year Published!';
            changeDetails = 'The text "2026" has newly appeared on the official results page.';
        } else if (pageText !== lastPageState) {
            changeDetected = true;
            changeReason = 'Website UI / Text Content Updated';
            changeDetails = 'The visual layout or text content on doenets.lk/examresults has changed.';
        } else if (apiData !== lastApiState && apiData !== '') {
            changeDetected = true;
            changeReason = 'Backend API / Database Updated';
            changeDetails = 'The underlying backend data or API response structure for exam results has been updated.';
        }

        if (changeDetected) {
            console.log(`Update detected: ${changeReason}`);
            await sendAlerts(changeReason, changeDetails);
            
            lastPageState = pageText;
            lastApiState = apiData;
        } else {
            console.log('No changes on page or backend.');
        }

    } catch (error) {
        console.error('Monitoring check error:', error.message);
    }
}

// සෑම මිනිත්තු 3කට වරක්ම පරීක්ෂා කරයි
setInterval(checkWebsiteAndBackend, 3 * 60 * 1000);

app.get('/', (req, res) => {
    res.send('Advanced Exam & Backend Monitor Bot is running live!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    connectToWhatsApp();
});
