import 'reflect-metadata';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User, UserRole, Profile } from '../entities';
import { AppRole } from '../common/enums';
import { join } from 'path';

// Load environment variables
config();

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  username: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  database: process.env.DATABASE_NAME || 'smarton_content',
  entities: [join(__dirname, '..', '**', '*.entity.{ts,js}')],
  synchronize: false,
});

async function seedAdmin() {
  console.log('🔐 Seeding Admin User...\n');

  try {
    await dataSource.initialize();
    console.log('✅ Database connected\n');

    const userRepository = dataSource.getRepository(User);
    const userRoleRepository = dataSource.getRepository(UserRole);
    const profileRepository = dataSource.getRepository(Profile);

    const adminEmail = 'deep.parmar@sunbots.in';
    const adminPassword = 'Deep@1234';

    // Check if admin already exists
    const existingUser = await userRepository.findOne({
      where: { email: adminEmail },
    });

    if (existingUser) {
      console.log(`⚠️  User with email ${adminEmail} already exists`);
      console.log(`   User ID: ${existingUser.id}`);

      // Check if they have admin role
      const existingRole = await userRoleRepository.findOne({
        where: { userId: existingUser.id, role: AppRole.SUPER_ADMIN },
      });

      if (!existingRole) {
        const adminRole = userRoleRepository.create({
          userId: existingUser.id,
          role: AppRole.SUPER_ADMIN,
        });
        await userRoleRepository.save(adminRole);
        console.log('   ✅ Added SUPER_ADMIN role to existing user');
      } else {
        console.log('   ✅ User already has SUPER_ADMIN role');
      }
    } else {
      // Hash password
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(adminPassword, saltRounds);

      // Create user
      const user = userRepository.create({
        email: adminEmail,
        password: hashedPassword,
      });
      const savedUser = await userRepository.save(user);
      console.log(`✅ Created user: ${adminEmail}`);
      console.log(`   User ID: ${savedUser.id}`);

      // Create admin role
      const adminRole = userRoleRepository.create({
        userId: savedUser.id,
        role: AppRole.SUPER_ADMIN,
      });
      await userRoleRepository.save(adminRole);
      console.log('   ✅ Assigned SUPER_ADMIN role');

      // Create profile
      const profile = profileRepository.create({
        userId: savedUser.id,
        email: adminEmail,
        fullName: 'Deep Parmar',
      });
      await profileRepository.save(profile);
      console.log('   ✅ Created user profile');
    }

    console.log('\n🎉 Admin seeding completed!');
    console.log('\n📋 Login Credentials:');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await dataSource.destroy();
  }
}

void seedAdmin();
