import mongoose from "mongoose"

const connectDB = async () => {
    try {
        const connectionInstance = await mongoose.connect(process.env.MONGODB_URI, {
            maxPoolSize: 50,           // Max connections in pool (default 100, reduce for Atlas shared tier)
            minPoolSize: 5,            // Keep 5 warm connections ready
            socketTimeoutMS: 45000,    // Close sockets after 45 seconds of inactivity
            serverSelectionTimeoutMS: 5000, // Fail fast if no server available
            connectTimeoutMS: 10000,   // Timeout for initial connection
            maxIdleTimeMS: 30000,      // Close idle connections after 30 seconds
        })
        console.log(`\nMongoDB connected !! DB HOST: ${connectionInstance.connection.host}`)
    } catch (error) {
        console.error("MONGODB connection error : ", error)
        process.exit(1)
    }
}

export default connectDB