<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/10gdZFNqvtkBGuZ-fX-fTYtx-Ph135gcd

## Run Locally

**Prerequisites:** Node.js, Python 3.10+

### Backend (FastAPI)
1. Install backend dependencies:
   `python -m pip install -r backend/requirements.txt`
2. Set your Gemini key:
   `export GEMINI_API_KEY=your_key_here`
3. Start the API:
   `uvicorn backend.main:app --reload --port 8000`

### Frontend (React)
1. Install frontend dependencies:
   `npm install`
2. Optional: point the UI to a different API base URL by setting `VITE_API_BASE_URL` in `.env.local`.
3. Run the app:
   `npm run dev`
