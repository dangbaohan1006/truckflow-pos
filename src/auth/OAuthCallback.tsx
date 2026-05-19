/**
 * OAuthCallback.tsx — Handles the Google OAuth redirect.
 *
 * After the user logs in with Google, they are redirected back to this page
 * with an authorization code in the URL query string.
 *
 * This component extracts the code, exchanges it for a session token,
 * and redirects to the main app.
 */

import { useEffect, useState } from 'react';
import { useAuth } from './AuthContext';

export default function OAuthCallback() {
  const { handleOAuthRedirect } = useAuth();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const processCallback = async () => {
      // Parse query parameters from the current URL
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const errorParam = params.get('error');

      if (errorParam) {
        setStatus('error');
        setError(`Google OAuth error: ${errorParam}`);
        return;
      }

      if (!code) {
        setStatus('error');
        setError('No authorization code received from Google');
        return;
      }

      const result = await handleOAuthRedirect(code);
      if (result.success) {
        setStatus('success');
        // Redirect to main app after a brief delay
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      } else {
        setStatus('error');
        setError(result.error || 'Failed to authenticate');
      }
    };

    processCallback();
  }, [handleOAuthRedirect]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="bg-white p-8 rounded-lg shadow-md text-center max-w-md">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-800">Đang xác thực...</h2>
            <p className="text-gray-500 mt-2">Vui lòng đợi trong giây lát</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="text-green-500 text-5xl mb-4">✓</div>
            <h2 className="text-xl font-semibold text-gray-800">Đăng nhập thành công!</h2>
            <p className="text-gray-500 mt-2">Đang chuyển hướng...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="text-red-500 text-5xl mb-4">✕</div>
            <h2 className="text-xl font-semibold text-gray-800">Đăng nhập thất bại</h2>
            <p className="text-red-500 mt-2">{error}</p>
            <button
              onClick={() => window.location.href = '/'}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Quay lại đăng nhập
            </button>
          </>
        )}
      </div>
    </div>
  );
}
