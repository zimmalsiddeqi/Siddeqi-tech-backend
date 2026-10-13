# Siddeqi-tech-backend

Backend API service for Shawkat Siddeqi Tech LMS platform built with Fastify, Supabase, LiveKit WebRTC, and S3-compatible cloud storage.

## Tech Stack
- **Fastify**: High-performance Node.js HTTP framework
- **Supabase**: PostgreSQL database, authentication, and S3 storage
- **LiveKit Server SDK**: Real-time WebRTC live classrooms, token management, and egress recording
- **AWS S3 Client**: Automated recording playback and cloud video storage

## Getting Started

1. Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

Server will run on `http://localhost:5000`.
