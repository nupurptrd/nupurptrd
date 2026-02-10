import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { join } from 'path';
import { readFileSync, existsSync } from 'fs';

export interface FirebaseUser {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  emailVerified: boolean;
}

@Injectable()
export class FirebaseService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase() {
    if (admin.apps.length > 0) {
      this.logger.log('Firebase Admin already initialized');
      return;
    }

    // Try to find the service account file
    const possiblePaths = [
      join(
        process.cwd(),
        'smarton-content-firebase-adminsdk-fbsvc-b6a72db617.json',
      ),
      join(process.cwd(), 'firebase-service-account.json'),
      join(process.cwd(), 'service-account.json'),
    ];

    let serviceAccountPath: string | null = null;
    for (const path of possiblePaths) {
      if (existsSync(path)) {
        serviceAccountPath = path;
        break;
      }
    }

    if (serviceAccountPath) {
      try {
        const serviceAccount = JSON.parse(
          readFileSync(serviceAccountPath, 'utf8'),
        );
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
        this.logger.log('Firebase Admin initialized with service account');
      } catch (error) {
        this.logger.error(
          'Failed to initialize Firebase with service account',
          error,
        );
        throw error;
      }
    } else {
      // Try using application default credentials
      try {
        admin.initializeApp({
          credential: admin.credential.applicationDefault(),
        });
        this.logger.log(
          'Firebase Admin initialized with application default credentials',
        );
      } catch (error) {
        this.logger.error('Failed to initialize Firebase', error);
        throw new Error(
          'Firebase service account not found. Please add the service account JSON file to the project root.',
        );
      }
    }
  }

  /**
   * Verify a Firebase ID token and return the decoded user info
   */
  async verifyIdToken(idToken: string): Promise<FirebaseUser> {
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);

      return {
        uid: decodedToken.uid,
        email: decodedToken.email || '',
        displayName: decodedToken.name,
        photoURL: decodedToken.picture,
        emailVerified: decodedToken.email_verified || false,
      };
    } catch (error) {
      this.logger.error('Failed to verify Firebase ID token', error);
      throw error;
    }
  }

  /**
   * Get user info from Firebase by UID
   */
  async getUser(uid: string): Promise<admin.auth.UserRecord> {
    return admin.auth().getUser(uid);
  }

  /**
   * Check if a token is valid without throwing
   */
  async isTokenValid(idToken: string): Promise<boolean> {
    try {
      await admin.auth().verifyIdToken(idToken);
      return true;
    } catch {
      return false;
    }
  }
}
