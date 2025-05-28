
import { NextResponse } from "next/server";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getStorage } from "firebase-admin/storage";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin if it hasn't been already
let app;
if (!getApps().length) {
  // The service account key can be set as an environment variable or directly in your hosting platform
  const serviceAccount = JSON.parse(
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}'
  );
  
  app = initializeApp({
    credential: cert(serviceAccount),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  });
} else {
  app = getApps()[0];
}

const bucket = getStorage().bucket();
const db = getFirestore();

export async function POST(req) {
  try {
    const { audioContent, userId, storyId } = await req.json();

    if (!audioContent || !userId || !storyId) {
      return NextResponse.json(
        { error: "Missing required parameters" }, 
        { status: 400 }
      );
    }

    // Decode the base64 audio content
    const buffer = Buffer.from(audioContent, 'base64');
    
    // Set up the file path and options
    const filePath = `audio/${userId}/${storyId}.mp3`;
    const file = bucket.file(filePath);
    
    // Upload the file
    await file.save(buffer, {
      metadata: {
        contentType: 'audio/mp3',
        metadata: {
          userId,
          storyId
        }
      }
    });
    
    // Make the file publicly accessible (if appropriate for your use case)
    // Otherwise, you can generate a signed URL with expiration
    await file.makePublic();
    
    // Get the public URL
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    
    // Optionally, save the audio URL to Firestore
    await db.collection('audios').add({
      userId,
      storyId,
      audioUrl: publicUrl,
      createdAt: new Date(),
      filename: `${storyId}.mp3`
    });
    
    return NextResponse.json({ 
      success: true, 
      downloadURL: publicUrl 
    });
  } catch (error) {
    console.error("Server-side audio upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload audio", message: error.message }, 
      { status: 500 }
    );
  }
}