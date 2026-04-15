import { NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import crypto from 'crypto';

// The strictly enforced University Gateway IP
const ALLOWED_IP = '103.233.171.35';

// Helper function to generate a 4-digit OTP based on a secret and a 10-second time window
function generateTOTP(secret: string, timeWindow: number): string {
  const hash = crypto
    .createHmac('sha256', secret)
    .update(timeWindow.toString())
    .digest('hex');
  // Extract a 4-digit number from the hash
  return (parseInt(hash.substring(0, 8), 16) % 10000).toString().padStart(4, '0');
}

export async function POST(req: Request) {
  try {
    // 1. STRICT IP VALIDATION
    // On Vercel/Next.js, the client IP is found in the x-forwarded-for header
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : 'UNKNOWN';

    // UNCOMMENT THIS IN PRODUCTION to enforce the IP lock. 
    // (Left commented out for local testing purposes)
    
    if (!clientIp.startsWith("103.233.171.")) {
    return NextResponse.json({ error: 'Access Denied: Must be connected to University Campus Wi-Fi.' }, { status: 403 });
}
    

    const body = await req.json();
    const { courseId, date, studentRollNo, otp, deviceHash, idToken } = body;

    if (!courseId || !date || !studentRollNo || !otp || !deviceHash || !idToken) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    // 2. AUTHENTICATION VALIDATION
    const decodedToken = await adminAuth.verifyIdToken(idToken);
    if (!decodedToken.email?.includes(studentRollNo.toLowerCase())) {
      return NextResponse.json({ error: 'Auth mismatch: Roll number does not match logged-in user.' }, { status: 403 });
    }

    // 3. FETCH SESSION DATA
    const sessionRef = adminDb.doc(`courses/${courseId}/sessions/${date}`);
    const sessionSnap = await sessionRef.get();

    if (!sessionSnap.exists) {
      return NextResponse.json({ error: 'Session does not exist.' }, { status: 404 });
    }

    const sessionData = sessionSnap.data()!;

    // 4. THE 60-SECOND WINDOW & 5-SECOND GRACE PERIOD (Server-Side Time Sync)
    const now = Date.now();
    const startTime = sessionData.startTime.toMillis();
    const elapsedTime = now - startTime;

    // 60 seconds + 5 seconds network latency grace period = 65000 ms
    if (!sessionData.session_active || elapsedTime > 65000) {
      return NextResponse.json({ error: 'Session expired or inactive.' }, { status: 403 });
    }

    // 5. THE 10-SECOND OTP VALIDATION
    // The TA dashboard generates an 'otpSecret' when starting the session.
    const currentWindow = Math.floor(now / 10000); // 10-second intervals
    
    const validOtpCurrent = generateTOTP(sessionData.otpSecret, currentWindow);
    const validOtpPrevious = generateTOTP(sessionData.otpSecret, currentWindow - 1); // Account for latency

    if (otp !== validOtpCurrent && otp !== validOtpPrevious) {
      return NextResponse.json({ error: 'Invalid or expired OTP.' }, { status: 400 });
    }

    // 6. DEVICE FINGERPRINTING (1-Submission-Per-Device Rule)
    const submissionsRef = sessionRef.collection('submissions');
    
    // Check if this device hash has already been used in this session
    const deviceCheckSnap = await submissionsRef.where('deviceHash', '==', deviceHash).get();
    if (!deviceCheckSnap.empty) {
      // If the existing submission belongs to a DIFFERENT student, block it.
      // (If it's the same student retrying due to a network drop, we allow it to overwrite).
      const existingSubmission = deviceCheckSnap.docs[0];
      if (existingSubmission.id !== studentRollNo) {
        return NextResponse.json({ 
          error: 'Device Flagged: This device has already submitted attendance for another student.' 
        }, { status: 403 });
      }
    }

    // 7. WRITE TO SUBCOLLECTION (Concurrency Safe)
    // Path: courses/{courseId}/sessions/{date}/submissions/{studentRollNo}
    await submissionsRef.doc(studentRollNo).set({
      rollNo: studentRollNo,   // <--- THIS IS THE MAGIC NEW LINE
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      deviceHash: deviceHash,
      ipAddress: clientIp,
      status: 'Present',
      method: 'OTP'
    });

    return NextResponse.json({ success: true, message: 'Attendance recorded successfully.' }, { status: 200 });

  } catch (error: any) {
    console.error('Submission Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}