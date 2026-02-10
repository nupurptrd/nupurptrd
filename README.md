# Smarton Content Studio - Backend API

> AI-Powered Audio Content Platform Backend

A robust NestJS backend for the Echosphere/Smarton audio content platform, providing REST APIs for AI-powered audio drama creation and news generation.

## ✨ Features

- **Authentication**: JWT-based auth with role-based access control (super_admin, admin, editor, moderator, viewer)
- **Series Management**: CRUD for audio drama series, characters, and episodes
- **AI Script Generation**: Gemini API integration for generating episode scripts
- **Multi-Character Audio**: ElevenLabs TTS with emotion-based voice settings
- **Sound Effects**: AI-generated SFX via ElevenLabs Sound Generation API
- **News Generation**: AI-powered news article creation with web search
- **Voice Library**: Sync and manage ElevenLabs voices by language
- **Storage**: S3 or local file storage for audio files
- **DRM**: Digital Rights Management with signed URLs and license control
- **Rate Limiting**: Tiered rate limiting to prevent abuse
- **Request Logging**: Correlation ID-based request tracing
- **Caching**: Redis-based response caching

## 🛠 Tech Stack

- **Framework**: NestJS 11
- **Database**: PostgreSQL with TypeORM
- **Cache/Queue**: Redis with Bull
- **Authentication**: Passport JWT
- **Validation**: class-validator, class-transformer
- **Documentation**: Swagger/OpenAPI
- **External APIs**: Google Gemini, ElevenLabs, AWS S3
- **Testing**: Jest

## 📋 Prerequisites

- Node.js 18+ (LTS recommended)
- PostgreSQL 14+
- Redis 6+
- FFmpeg (for audio processing)

## 🚀 Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd smarton-backend
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your database, Redis, and API credentials (see `.env.example` for all options).

### 3. Start Services

```bash
# Start PostgreSQL and Redis (if using Docker)
docker-compose up postgres redis -d

# Run database migrations
npm run typeorm:run

# Start development server
npm run start:dev
```

API will be available at [http://localhost:3001](http://localhost:3001)  
Swagger docs at [http://localhost:3001/api/docs](http://localhost:3001/api/docs)

## 📜 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run start:dev` | Start development server with hot reload |
| `npm run start:prod` | Start production server |
| `npm run build` | Build for production |
| `npm run test` | Run unit tests |
| `npm run test:cov` | Run tests with coverage |
| `npm run test:e2e` | Run e2e tests |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run seed:admin` | Seed initial admin user |

## 🏗 Project Structure

```
src/
├── main.ts              # Application bootstrap
├── app.module.ts        # Root module
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators
│   ├── enums/           # Shared enums
│   ├── filters/         # Exception filters
│   └── middleware/      # Request middleware
├── config/              # Configuration
├── entities/            # TypeORM entities (25+)
├── migrations/          # Database migrations
├── modules/             # Feature modules
│   ├── ai/              # AI generation (Gemini)
│   ├── auth/            # JWT authentication
│   ├── bookmarks/       # User bookmarks
│   ├── books/           # PDF processing
│   ├── categories/      # Content categories
│   ├── drm/             # Digital rights management
│   ├── elevenlabs/      # TTS integration
│   ├── firebase/        # Push notifications
│   ├── home/            # Home feed
│   ├── news/            # News articles
│   ├── playback/        # Playback position sync
│   ├── public/          # Public endpoints
│   ├── queue/           # Bull job processors
│   ├── scheduler/       # Cron jobs
│   ├── series/          # Audio series management
│   ├── settings/        # User settings
│   ├── storage/         # S3/local file storage
│   └── users/           # User management
└── scripts/             # Utility scripts
```

## 📡 API Endpoints

| Module | Endpoints |
|--------|-----------|
| Auth | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/profile` |
| Series | `GET/POST /api/series`, `GET/PUT/DELETE /api/series/:id` |
| Characters | `GET/POST /api/series/:id/characters`, `PUT/DELETE /api/series/characters/:id` |
| Episodes | `GET/POST /api/series/:id/episodes`, `PUT/DELETE /api/series/episodes/:id` |
| Categories | `GET/POST /api/categories`, `GET/PUT/DELETE /api/categories/:id` |
| News | `GET/POST /api/news`, `GET/PUT/DELETE /api/news/:id` |
| ElevenLabs | `GET /api/elevenlabs/voices`, `GET /api/elevenlabs/languages`, `POST /api/elevenlabs/sync` |
| Settings | `GET/POST /api/settings/api-keys`, `GET/PUT /api/settings/platform` |
| AI | `POST /api/ai/generate-episode-script`, `POST /api/ai/generate-episode-audio`, `POST /api/ai/generate-news` |
| DRM | `POST /api/drm/sign-url`, `POST /api/drm/validate-playback` |

Full API documentation available at `/api/docs` (Swagger UI).

## 🧪 Testing

```bash
# Run unit tests
npm run test

# Run with coverage
npm run test:cov

# Run e2e tests
npm run test:e2e

# Watch mode
npm run test:watch
```

### Test Coverage Goals

- Services: 80%
- Controllers: 70%
- Overall: 75%

## 🐳 Docker

Build and run with Docker:

```bash
# Build image
docker build -t smarton-backend:latest .

# Run container
docker run -p 3001:3001 --env-file .env smarton-backend:latest
```

Or use Docker Compose from the root directory:

```bash
docker-compose up backend postgres redis
```

## 🔒 Security Features

- **Helmet**: Security headers
- **Rate Limiting**: 3 tiers (short/medium/long)
- **JWT Auth**: Secure token-based authentication
- **Input Validation**: class-validator on all DTOs
- **DRM**: Signed URLs with expiration
- **CORS**: Configurable origins
- **Request Logging**: Correlation ID tracking
- **Exception Filter**: Standardized error responses

## 🔧 Configuration

### TypeScript

Strict mode enabled:
- `strictNullChecks`: true
- `noImplicitAny`: true
- `strict`: true

### Pre-commit Hooks

Husky runs lint-staged on commit:
- ESLint --fix
- Prettier formatting

## 📖 Documentation

- Swagger API docs: `http://localhost:3001/api/docs`
- [Echosphere Studio README](../echosphere-studio/README.md) - Frontend documentation
- [Flutter App README](../smarton_content/README.md) - Mobile app documentation

## 🤝 Contributing

1. Create a feature branch
2. Make changes with tests
3. Ensure all checks pass: `npm run lint && npm run test`
4. Submit pull request

## 📄 License

Proprietary - Sunbots
