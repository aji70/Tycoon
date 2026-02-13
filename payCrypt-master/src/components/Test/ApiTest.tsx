import React, { useState } from 'react';
import { checkApiHealth } from '../../utils/api';
import { authApi } from '../../utils/authApi';

const ApiTest: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<string>('Not checked');
  const [isLoading, setIsLoading] = useState(false);
  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  const testApiHealth = async () => {
    setIsLoading(true);
    try {
      const health = await checkApiHealth();
      setHealthStatus(`✅ API is healthy - ${health.status}`);
      addResult('✅ Health check passed');
    } catch (error) {
      setHealthStatus(`❌ API is down - ${error}`);
      addResult(`❌ Health check failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testLogin = async () => {
    setIsLoading(true);
    try {
      // This will likely fail since we don't have a test user, but it will test the connection
      await authApi.login({ email: 'test@example.com', password: 'testpass' });
      addResult('✅ Login endpoint is accessible');
    } catch (error: any) {
      if (error.message.includes('User not found') || error.message.includes('Invalid credentials')) {
        addResult('✅ Login endpoint is working (expected auth failure)');
      } else {
        addResult(`❌ Login endpoint error: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setTestResults([]);
    setHealthStatus('Not checked');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">API Connection Test</h2>
      
      <div className="space-y-4">
        <div className="p-4 bg-gray-50 rounded-lg">
          <h3 className="font-semibold mb-2">Backend Health Status:</h3>
          <p className={`text-sm ${healthStatus.includes('✅') ? 'text-green-600' : healthStatus.includes('❌') ? 'text-red-600' : 'text-gray-600'}`}>
            {healthStatus}
          </p>
        </div>

        <div className="flex space-x-4">
          <button
            onClick={testApiHealth}
            disabled={isLoading}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Test Health Check'}
          </button>
          
          <button
            onClick={testLogin}
            disabled={isLoading}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
          >
            {isLoading ? 'Testing...' : 'Test Login Endpoint'}
          </button>
          
          <button
            onClick={clearResults}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
          >
            Clear Results
          </button>
        </div>

        {testResults.length > 0 && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-semibold mb-2">Test Results:</h3>
            <div className="space-y-1 text-sm font-mono">
              {testResults.map((result, index) => (
                <div key={index} className={result.includes('✅') ? 'text-green-600' : result.includes('❌') ? 'text-red-600' : 'text-gray-600'}>
                  {result}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-4 bg-blue-50 rounded-lg">
          <h3 className="font-semibold mb-2 text-blue-800">Instructions:</h3>
          <ol className="text-sm text-blue-700 space-y-1">
            <li>1. Make sure your backend server is running on port 3000</li>
            <li>2. Click "Test Health Check" to verify basic connectivity</li>
            <li>3. Click "Test Login Endpoint" to test API endpoint access</li>
            <li>4. Check the results below for any connection issues</li>
          </ol>
        </div>
      </div>
    </div>
  );
};

export default ApiTest;
