const io = require('socket.io-client');

// Replace with your actual authentication token
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImVtYWlsIjoiYWRtaW5AYml0dHJhZGUuY28uaW4iLCJyb2xlIjoiYWRtaW4iLCJpYXQiOjE3MzY5ODcxMjl9.dVFhR_NLXhNqLRLLZJ_MFUxbJVWMJ3sVjTvjBQqvL0U';

const socket = io('http://192.168.1.164:3001', {
    auth: { token }
});

socket.on('connect', () => {
    console.log('Connected to WebSocket server');
    
    // Wait a bit for connection to be fully established
    setTimeout(() => {
        // Test the portfolio endpoints
        const testRequests = [
            { action: 'user.portfolio', payload: {} },
            { action: 'public.bitcoin-data', payload: {} },
            { action: 'public.bitcoin-sentiment', payload: {} }
        ];
        
        testRequests.forEach((req, index) => {
            setTimeout(() => {
                const id = `test-${index}`;
                console.log(`\nSending request: ${req.action}`);
                socket.emit('request', { id, ...req });
            }, index * 1000);
        });
    }, 1000);
});

socket.on('response', (response) => {
    console.log('\n=== WebSocket Response ===');
    console.log('ID:', response.id);
    console.log('Success:', response.success);
    if (response.success) {
        console.log('Data:', JSON.stringify(response.data, null, 2));
    } else {
        console.log('Error:', response.error);
    }
    console.log('=========================\n');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
});

socket.on('disconnect', () => {
    console.log('Disconnected from WebSocket server');
});

// Keep the process alive
setTimeout(() => {
    socket.disconnect();
    process.exit(0);
}, 10000);
