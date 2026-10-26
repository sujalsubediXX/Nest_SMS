import mongoose from "mongoose"; 

export default async function  connectDB(){
    try {
        const conn = await mongoose.connect(process.env.MONGODB_URI);
        console.log(`MongoDB Connected: ${conn.connection.host}`);
        console.log(`Database Name: ${conn.connection.name}`);
    }
    catch (error) {
        console.error("MongoDB connection failed:", error);
        process.exit(1);
    }
}


