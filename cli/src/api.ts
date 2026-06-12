import axios from 'axios';
import { getToken, getApiUrl } from './config';

const api = axios.create({
  baseURL: getApiUrl(),
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
