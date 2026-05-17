import mongoose from "mongoose";

export async function connectMongo(): Promise<void> {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    throw new Error("MONGO_URI is not set in environment");
  }

  await mongoose.connect(uri);
  console.log("[db] connected to MongoDB");
  console.log("[db] database:", mongoose.connection.name);
}
