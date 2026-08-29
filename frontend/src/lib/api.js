import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const fetchPrograms = async () => {
  try {
    const response = await api.get('/programs');
    return response.data;
  } catch (error) {
    console.error('Error fetching programs:', error);
    throw error;
  }
};

export const fetchLeftovers = async () => {
  try {
    const response = await api.get('/leftovers');
    return response.data;
  } catch (error) {
    console.error('Error fetching leftovers:', error);
    throw error;
  }
};

export const quarantineProgram = async (programId) => {
  try {
    const response = await api.post(`/quarantine/${programId}`);
    return response.data;
  } catch (error) {
    console.error('Error quarantining program:', error);
    throw error;
  }
};

export const restoreProgram = async (programId) => {
  try {
    const response = await api.post(`/restore/${programId}`);
    return response.data;
  } catch (error) {
    console.error('Error restoring program:', error);
    throw error;
  }
};

export default api;