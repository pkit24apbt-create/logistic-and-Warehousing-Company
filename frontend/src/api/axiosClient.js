import axios from 'axios';

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api',
});

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('safestack_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response && error.response.status;
    const code = error.response && error.response.data && error.response.data.code;

    // Signed out ONLY when the token itself is missing, invalid or expired.
    // A plain "no permission" (403) just shows its message and keeps the session.
    if (status === 401 && code === 'AUTH_REQUIRED') {
      localStorage.removeItem('safestack_token');
      localStorage.removeItem('safestack_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }

    // The server says this account still has a one-time password.
    if (status === 403 && code === 'PASSWORD_CHANGE_REQUIRED') {
      if (window.location.pathname !== '/change-password') {
        window.location.href = '/change-password';
      }
    }

    return Promise.reject(error);
  }
);

export default axiosClient;