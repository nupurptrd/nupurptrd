import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class StorageService implements OnModuleInit {
  private s3Client: S3Client | null = null;
  private bucketName: string;
  private localStoragePath: string;
  private useS3: boolean;
  private s3Verified: boolean = false;

  constructor(private configService: ConfigService) {
    const accessKeyId = this.configService.get('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get('AWS_SECRET_ACCESS_KEY');
    this.bucketName = this.configService.get(
      'AWS_BUCKET_NAME',
      'smarton-content',
    );
    this.localStoragePath = this.configService.get(
      'LOCAL_STORAGE_PATH',
      './uploads',
    );

    this.useS3 = !!(accessKeyId && secretAccessKey);

    if (this.useS3) {
      this.s3Client = new S3Client({
        region: this.configService.get('AWS_REGION', 'ap-south-1'),
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      if (!fs.existsSync(this.localStoragePath)) {
        fs.mkdirSync(this.localStoragePath, { recursive: true });
      }
    }
  }

  async onModuleInit() {
    if (this.useS3 && this.s3Client) {
      try {
        await this.s3Client.send(
          new HeadBucketCommand({ Bucket: this.bucketName }),
        );
        this.s3Verified = true;
        console.log(`✅ S3 bucket verified: ${this.bucketName}`);
      } catch (error: any) {
        console.error(`❌ S3 bucket verification failed: ${error.message}`);
        console.log('⚠️ Falling back to local storage');
        this.useS3 = false;
        if (!fs.existsSync(this.localStoragePath)) {
          fs.mkdirSync(this.localStoragePath, { recursive: true });
        }
      }
    } else {
      console.log('📁 Using local storage (no S3 credentials configured)');
    }
  }

  isUsingS3(): boolean {
    return this.useS3 && this.s3Verified;
  }

  async uploadFile(
    key: string,
    body: Buffer,
    contentType: string = 'application/octet-stream',
  ): Promise<string> {
    if (this.useS3 && this.s3Client) {
      try {
        // Try with public-read ACL first
        const command = new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: body,
          ContentType: contentType,
          ACL: 'public-read',
        });

        await this.s3Client.send(command);
        console.log(`S3 upload successful (public-read): ${key}`);
      } catch (aclError: any) {
        // If ACL fails (bucket policy blocks public ACLs), try without ACL
        if (
          aclError.Code === 'AccessControlListNotSupported' ||
          aclError.name === 'AccessControlListNotSupported'
        ) {
          console.log('Public ACL not supported, uploading without ACL...');
          const command = new PutObjectCommand({
            Bucket: this.bucketName,
            Key: key,
            Body: body,
            ContentType: contentType,
          });
          await this.s3Client.send(command);
          console.log(`S3 upload successful (no ACL): ${key}`);
        } else {
          console.error('S3 upload error:', aclError);
          throw aclError;
        }
      }

      const region = this.configService.get('AWS_REGION', 'ap-south-1');
      return `https://${this.bucketName}.s3.${region}.amazonaws.com/${key}`;
    } else {
      const filePath = path.join(this.localStoragePath, key);
      const dir = path.dirname(filePath);

      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(filePath, body);
      console.log(`Local storage upload: ${filePath}`);
      return `/uploads/${key}`;
    }
  }

  async getFile(key: string): Promise<Buffer> {
    if (this.useS3 && this.s3Client) {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as any) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } else {
      const filePath = path.join(this.localStoragePath, key);
      return fs.readFileSync(filePath);
    }
  }

  async deleteFile(key: string): Promise<void> {
    if (this.useS3 && this.s3Client) {
      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      await this.s3Client.send(command);
    } else {
      const filePath = path.join(this.localStoragePath, key);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    if (this.useS3 && this.s3Client) {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: key,
      });
      return getSignedUrl(this.s3Client, command, { expiresIn });
    } else {
      return `/uploads/${key}`;
    }
  }
}
