// api/services/otp.service.js (Fast2SMS Example)
const axios = require('axios'); // Ensure you have installed axios: npm install axios
const FAST2SMS_API_KEY = process.env.FAST2SMS_API_KEY; // Ensure this is set in your .env file

// --- ADDED: OTP Generation Function ---
const generateOTP = () => {
    // Generates a random 6-digit OTP
    return Math.floor(100000 + Math.random() * 900000).toString();
};

const sendOTP = async (mobileNumber, otp) => {
    if (!FAST2SMS_API_KEY) {
        console.error('FAST2SMS_API_KEY is not set. OTP SMS will not be sent.');
        return false;
    }

    const url = 'https://www.fast2sms.com/dev/bulkV2';
    const params = new URLSearchParams();
    params.append('authorization', FAST2SMS_API_KEY);
    params.append('variables_values', otp);
    params.append('route', 'otp'); // Use their OTP route
    params.append('numbers', mobileNumber);

    try {
        const response = await axios.post(url, params.toString(), {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'cache-control': 'no-cache'
            }
        });
        console.log('Fast2SMS OTP response:', response.data);
        // Fast2SMS API returns { return: true/false, message: "..." }
        return response.data.return === true;
    } catch (error) {
        console.error('Error sending OTP via Fast2SMS:', error.response ? error.response.data : error.message);
        return false;
    }
};

module.exports = {
    generateOTP, // <--- EXPORTED generateOTP
    sendOTP      // <--- EXPORTED sendOTP
};