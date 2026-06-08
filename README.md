# Taraflow Enterprise SaaS

Taraflow is a modern social media management, automation, and AI-assisted content creation workspace. It is structured as a monorepo containing a frontend client (built with Vite + React + TailwindCSS) and a backend API server (built with Node.js + Express + MongoDB).

## Repository Structure

- `/client` - Vite + React frontend client.
- `/server` - Node.js Express server backend.

---

## 🚀 Deployment Guide

This project is configured and ready for seamless deployment to **Vercel** (for the frontend client) and **Render** (for the backend server).

### 1. Backend Deployment (Render)

Render can automatically detect configuration from the `render.yaml` blueprint file included in this repository.

#### Step-by-Step Render Deployment:
1. Log in to your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** and select **Blueprint**.
3. Connect your GitHub repository (`dharmiktarasaka/Taraflow`).
4. Render will read the `render.yaml` configuration and list the `taraflow-backend` service.
5. Provide values for the required environment variables:
   - `MONGODB_URI`: Your MongoDB connection string.
   - `ENCRYPTION_KEY`: A 32-byte hex key (e.g., `0987654321abcdef1234567890abcdef0123456789abcdef0123456789taramation`).
   - `CLIENT_URL`: The URL of your Vercel frontend (you can update this after Vercel deployment).
   - `QWEN_API_KEY`: NVIDIA NIM API Key (if using AI features).
   - `GEMINI_API_KEY`: Gemini API Key (if using AI features).
6. Click **Deploy**. Render will install dependencies, build, and start your backend service on the free tier.

---

### 2. Frontend Deployment (Vercel)

The frontend client uses client-side routing. A `client/vercel.json` configuration is included to correctly handle SPA routing.

#### Step-by-Step Vercel Deployment:
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** and choose **Project**.
3. Import your GitHub repository (`dharmiktarasaka/Taraflow`).
4. Under **Project Settings**:
   - **Root Directory**: Click *Edit* and select the `client` directory.
   - **Build and Development Settings**: Keep defaults (Vercel automatically detects Vite).
5. Open **Environment Variables** and add:
   - `VITE_API_URL`: The URL of your deployed Render backend (e.g., `https://taraflow-backend.onrender.com/api/v1`).
6. Click **Deploy**.

*Note: Once Vercel finishes deploying, copy your frontend application URL (e.g., `https://taraflow-client.vercel.app`) and update the `CLIENT_URL` environment variable on your Render backend service.*

---

## 🛠️ Local Development

### Prerequisites
- Node.js (v18+)
- MongoDB (running locally or a remote Atlas instance)
- Redis (Optional, used for caching)

### Running the Backend
```bash
cd server
npm install --legacy-peer-deps
npm run dev
```

### Running the Frontend
```bash
cd client
npm install
npm run dev
```
The client will run on [http://localhost:5173](http://localhost:5173).
