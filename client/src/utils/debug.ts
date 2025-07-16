// Debug utility for mobile connection issues
export const debugConnection = () => {
  console.log('=== DEBUG CONNECTION INFO ===');
  console.log('Current URL:', window.location.href);
  console.log('Current host:', window.location.host);
  console.log('Current protocol:', window.location.protocol);
  console.log('User agent:', navigator.userAgent);
  console.log('Network type:', (navigator as any).connection?.effectiveType || 'unknown');
  console.log('API URL:', process.env.REACT_APP_API_URL);
  console.log('WebSocket URL:', process.env.REACT_APP_WS_URL);
  console.log('Node ENV:', process.env.NODE_ENV);
  console.log('Local storage token:', localStorage.getItem('token') ? 'exists' : 'missing');
  console.log('==============================');
};

export const testNetworkConnectivity = async () => {
  console.log('=== TESTING NETWORK CONNECTIVITY ===');
  
  // Test API endpoint
  try {
    const apiUrl = process.env.REACT_APP_API_URL || 'http://192.168.1.164:3001/api';
    const response = await fetch(`${apiUrl}/public/bitcoin-price`);
    console.log('API connectivity:', response.ok ? 'OK' : 'FAILED');
  } catch (error) {
    console.error('API connectivity test failed:', error);
  }
  
  // Test WebSocket connectivity
  try {
    const wsUrl = process.env.REACT_APP_WS_URL || 'ws://192.168.1.164:3001';
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('WebSocket connectivity: OK');
      ws.close();
    };
    
    ws.onerror = (error) => {
      console.error('WebSocket connectivity test failed:', error);
    };
    
    ws.onclose = () => {
      console.log('WebSocket test connection closed');
    };
    
    // Close connection after 5 seconds
    setTimeout(() => {
      if (ws.readyState === WebSocket.CONNECTING) {
        console.error('WebSocket connection timeout');
        ws.close();
      }
    }, 5000);
  } catch (error) {
    console.error('WebSocket test failed:', error);
  }
  
  console.log('===================================');
};
