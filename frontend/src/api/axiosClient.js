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
    // Only a missing, invalid or expired login TOKEN signs the user out. A 403
    // ("you are not allowed to do that") or a 401 such as "current password is
    // incorrect" must reach the page so it can show its message.
    const status = error.response && error.response.status;
    const code = error.response && error.response.data && error.response.data.code;
    if (status === 401 && code === 'AUTH_REQUIRED') {
      localStorage.removeItem('safestack_token');
      localStorage.removeItem('safestack_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axiosClient;