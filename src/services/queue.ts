import pLimit from 'p-limit';

// Limit concurrent AI requests to prevent server overload
// Adjust this number based on your server's GPU capacity (e.g., 5 for a single GPU)
export const aiQueue = pLimit(5);
