const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = '9243725983:AAEYZmfYPvFW1VNNB-Fo-c2cWW4K5ajng_4';
const TELEGRAM_CHAT_ID = '2022295826';

const TARGET_URL = 'https://www.doenets.lk/examresults';
let previousBodyText = '';
let previousHeadings = '';

async function sendTelegramAlert(message) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        await axios.post(url, {
            chat_id: TELEGRAM_CHAT_ID,
            text: message
        });
        console.log('Telegram Alert Sent Successfully!');
    } catch (error) {
        console.error('Error sending telegram message:', error.response?.data || error.message);
    }
}

async function checkExamSite() {
    try {
        const response = await axios.get(TARGET_URL, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        const $ = cheerio.load(response.data);
        const currentBodyText = $('body').text().replace(/\s+/g, ' ').trim();
        
        let currentHeadings = '';
        $('h1, h2, h3, a').each((i, el) => {
            currentHeadings += $(el).text().trim() + ' ';
        });

        console.log(`[${new Date().toLocaleTimeString()}] Checked site. Status: OK`);

        if (previousBodyText === '') {
            previousBodyText = currentBodyText;
            previousHeadings = currentHeadings;
            console.log('Initial site content saved for comparison.');
            return;
        }

        const is2026New = currentBodyText.includes('2026') && !previousBodyText.includes('2026');
        const isTextChanged = currentBodyText !== previousBodyText;
        const isHeadingsChanged = currentHeadings !== previousHeadings;

        if (is2026New || (isTextChanged && isHeadingsChanged)) {
            console.log('ALERT! Change detected on the site!');
            
            let changeDetails = "විභාග දෙපාර්තමේන්තුවේ වෙබ් අඩවියේ යම් වෙනස්කමක් සිදුවී ඇත!\n";
            if (is2026New) {
                changeDetails += "🔥 විශේෂයි: වෙබ් අඩවිය තුළට '2026' වර්ෂය එකතු වී ඇත!\n";
            } else {
                changeDetails += "ℹ️ වෙබ් අඩවියේ බැකෙන්ඩ් හෝ ඉදිරිපස දත්තවල සියුම් වෙනසක් සිදුවී ඇත.\n";
            }

            await sendTelegramAlert(
                `🚨 A/L Result Monitor Alert!\n\n${changeDetails}\n🔗 පරීක්ෂා කරන්න: ${TARGET_URL}`
            );
        }
        
        previousBodyText = currentBodyText;
        previousHeadings = currentHeadings;

    } catch (error) {
        console.error('Error fetching site:', error.message);
    }
}

// සෑම විනාඩි 3කට වරක්ම ක්‍රියාත්මක වේ
setInterval(checkExamSite, 3 * 60 * 1000);

app.get('/', (req, res) => {
    res.send('Exam Monitor Telegram Bot is Running 24/7!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    sendTelegramAlert('✅ Exam Monitor Bot Started Successfully on Railway!');
});
