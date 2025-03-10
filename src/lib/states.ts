import { ExpireIn30Mins, getRedisClient } from './redis';

// Shared state to be used across API routes
export interface JobState {
  progress: number;
  status: string;
  statusId: number;
  fileName?: string;
  pdfPath?: string;
  error?: string;
}

export const generateJobId = (): string => Math.random().toString(36).substring(2, 11);

export const getJobState = async (jobId: string): Promise<JobState | undefined> => {
  try {
    const redis = getRedisClient();
    const data = await redis.get(`job:${jobId}`);
    return data ? JSON.parse(data) : undefined;
  } catch (error) {
    console.error(`Error getting job state for ${jobId}:`, error);
    return undefined;
  }
};

export const setJobState = async (jobId: string, state: JobState): Promise<void> => {
  try {
    const redis = getRedisClient();
    await redis.set(`job:${jobId}`, JSON.stringify(state));
    await redis.expire(`job:${jobId}`, ExpireIn30Mins);
  } catch (error) {
    console.error(`Error setting job state for ${jobId}:`, error);
  }
};

export const initJobState = async (jobId: string): Promise<void> => {
  await setJobState(jobId, {
    progress: 0,
    status: "in progress",
    statusId: 1,
  });
};

export const removeJobState = async (jobId: string): Promise<void> => {
  try {
    const redis = getRedisClient();
    await redis.del(`job:${jobId}`);
  } catch (error) {
    console.error(`Error removing job state for ${jobId}:`, error);
  }
};
