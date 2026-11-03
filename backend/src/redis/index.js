import { createClient } from "redis";

const redisClient = createClient({ url: process.env.REDIS_URL });

redisClient.on("error", (error) => { console.error("[REDIS] Error:", error) });
redisClient.on("connect", () => { console.log("[REDIS] Connected successfully!") });

export const connectRedis = async () => {
    try {
        await redisClient.connect();
    } catch (error) {
        console.error("[REDIS] Connection failed:", error);
    }
};

export default redisClient;